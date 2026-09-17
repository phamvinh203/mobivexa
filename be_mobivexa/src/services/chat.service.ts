import type { Content, Part } from '@google/genai'
import prisma from '../config/db'
import { Prisma } from '../generated/prisma/client'
import { getGemini, isGeminiConfigured, GEMINI_MODEL, GEMINI_TIMEOUT_MS } from '../config/gemini'
import { AppError } from '../helpers/app_error'
import { signGuestChatToken, verifyGuestChatToken } from '../utils/token_manager'
import { CHAT_TOOL_DECLARATIONS, executeTool } from './chatbot_tools'
import type {
  ChatProductCard,
  ChatReply,
  SendMessageBody,
  ToolCallTrace,
} from '../types/chat.type'

// Model có thể xin tra cứu mãi không dừng, mỗi vòng là một lần gọi API tính phí
// cộng một lần truy vấn DB. Ba vòng đủ cho tình huống nặng nhất trong thực tế:
// liệt kê danh mục -> tìm sản phẩm -> xem chi tiết để so sánh.
const MAX_TOOL_ROUNDS = 3

// Toàn bộ lịch sử được gửi lại ở MỖI lượt, nên phiên càng dài chi phí càng tăng.
// Mười tin (khoảng năm lượt qua lại) đủ giữ mạch "cái đó", "máy kia".
const HISTORY_LIMIT = 10

const MAX_TITLE_CHARS = 60
const MAX_CARDS = 8

const FALLBACK_REPLY =
  'Mình chưa tra cứu đủ thông tin để trả lời chính xác. Bạn mô tả cụ thể hơn giúp mình nhé — ' +
  'ví dụ tầm giá, hãng, hoặc tên máy bạn đang quan tâm.'

const SYSTEM_PROMPT = `Bạn là nhân viên tư vấn của một cửa hàng bán điện thoại và thiết bị công nghệ.

Nguyên tắc bắt buộc:
1. Chỉ nói về sản phẩm, giá, tồn kho dựa trên dữ liệu các công cụ trả về. Tuyệt đối không tự bịa tên máy, giá hay thông số.
2. Chưa gọi công cụ thì chưa được nêu bất kỳ con số giá nào.
3. Công cụ không trả về kết quả nào thì nói thẳng là cửa hàng chưa có mặt hàng đó, rồi gợi ý sản phẩm gần nhất.
4. Chỉ trao đổi quanh sản phẩm và dịch vụ của cửa hàng. Câu hỏi ngoài phạm vi thì từ chối lịch sự và hỏi khách cần tư vấn gì.
5. Không hứa hẹn khuyến mãi, thời gian giao hàng hay chính sách mà dữ liệu không thể hiện.
6. Trả lời bằng tiếng Việt, ngắn gọn, thân thiện, xưng "mình" và gọi khách là "bạn". Giá viết theo định dạng 9.990.000đ.`

// Kiểu tối giản của response — chỉ khai báo phần thực sự dùng tới, để đổi phiên
// bản SDK không kéo theo sửa cả file.
interface GeminiCall {
  name?: string
  args?: Record<string, unknown>
}

interface GeminiResponse {
  text?: string
  functionCalls?: GeminiCall[]
}

// ─── Phiên ────────────────────────────────────────────────────────────────────

interface SessionRow {
  id: string
  userId: string | null
  title: string | null
}

// session id là cuid — không phải bí mật (có thể lộ qua log/referrer/lịch sử
// trình duyệt), nên không thể dùng một mình nó làm bằng chứng sở hữu cho phiên
// khách vãng lai. Phiên đã có userId thì xác thực bằng userId (JWT); phiên còn
// là khách vãng lai (userId null) thì bắt buộc guestToken khớp mới được coi là
// chủ phiên. Phiên của người khác trả 404 chứ không phải 403: 403 là lời xác
// nhận rằng sessionId đó có thật, tức là biến endpoint thành máy dò phiên.
function isValidGuestToken(sessionId: string, guestToken?: string): boolean {
  if (!guestToken) return false
  try {
    return verifyGuestChatToken(guestToken) === sessionId
  } catch {
    return false
  }
}

async function resolveSession(
  sessionId: string | undefined,
  userId?: string,
  guestToken?: string,
): Promise<SessionRow> {
  if (!sessionId) {
    return prisma.chatSession.create({
      data: { userId: userId ?? null },
      select: { id: true, userId: true, title: true },
    })
  }

  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true, title: true },
  })

  if (!session) throw new AppError(404, 'Không tìm thấy phiên trò chuyện')

  if (session.userId) {
    if (session.userId !== userId) throw new AppError(404, 'Không tìm thấy phiên trò chuyện')
  } else if (!isValidGuestToken(session.id, guestToken)) {
    throw new AppError(404, 'Không tìm thấy phiên trò chuyện')
  }

  return session
}

export async function createSession(userId?: string): Promise<{ sessionId: string; guestToken?: string }> {
  const session = await prisma.chatSession.create({
    data: { userId: userId ?? null },
    select: { id: true },
  })

  if (userId) return { sessionId: session.id }
  return { sessionId: session.id, guestToken: signGuestChatToken(session.id) }
}

export async function getMessages(sessionId: string, userId?: string, guestToken?: string) {
  await resolveSession(sessionId, userId, guestToken)

  // take chặn payload của phiên quá lâu — phiên guest sống 30 ngày, không chặn
  // thì mở lại tab cũ phải tải toàn bộ lịch sử. Lấy 200 tin MỚI nhất rồi đảo
  // ngược để trả theo thứ tự thời gian.
  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { seq: 'desc' },
    take: 200,
    select: { id: true, role: true, content: true, createdAt: true },
  })

  return { sessionId, messages: messages.reverse() }
}

// ─── Gọi model ────────────────────────────────────────────────────────────────

// thinkingConfig tắt thinking: 2.5-flash bật mặc định với ngân sách động, token
// thinking tính phí như output và cộng thêm 1–5s mỗi vòng — trong khi bot này
// tư vấn theo dữ liệu tool trả về, không cần suy luận tự do.
//
// abortSignal hủy THẬT request đang chạy khi quá 30 giây. Cách Promise.race cũ
// chỉ bỏ cuộc đua phía server, request cũ vẫn ngốn quota và socket; khách retry
// giữa lúc Gemini chậm sẽ xếp chồng các request mồ côi.
async function callGeminiOnce(contents: Content[]): Promise<GeminiResponse> {
  return (await getGemini().models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: CHAT_TOOL_DECLARATIONS }],
      thinkingConfig: { thinkingBudget: 0 },
      maxOutputTokens: 1024,
      temperature: 0.2,
      abortSignal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    },
  })) as GeminiResponse
}

// Lỗi tạm thời của Google (hết quota 429, 5xx) đáng thử lại 1 lần trước khi báo
// 503 cho khách; timeout/hủy thì không — khách đã bỏ đi rồi, request càng thêm
// nghiêm túc thì càng phải trả lỗi ngay.
function isTransientGeminiError(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status
  return status === 429 || status === 500 || status === 503
}

async function callGemini(contents: Content[]): Promise<GeminiResponse> {
  if (!isGeminiConfigured()) {
    throw new AppError(503, 'Chatbot tạm thời không khả dụng, vui lòng thử lại sau')
  }

  try {
    return await callGeminiOnce(contents)
  } catch (err) {
    if (!isTransientGeminiError(err)) throw err
    await new Promise((resolve) => setTimeout(resolve, 500))
    return callGeminiOnce(contents)
  }
}

// ─── Vòng lặp hội thoại ───────────────────────────────────────────────────────

export async function sendMessage(body: SendMessageBody, userId?: string): Promise<ChatReply> {
  const session = await resolveSession(body.sessionId, userId, body.guestToken)

  const history = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    // seq là tiebreaker: cặp USER/MODEL của một lượt được createMany chèn chung
    // một statement nên dùng chung createdAt, sắp theo createdAt alone không bảo
    // đảm thứ tự trong cặp — đảo lộn là hỏng trật tự xen kẽ user/model cho Gemini
    orderBy: { seq: 'desc' },
    take: HISTORY_LIMIT,
    select: { role: true, content: true },
  })

  const contents: Content[] = history
    .reverse()
    .map((m) => ({ role: m.role === 'USER' ? ('user' as const) : ('model' as const), parts: [{ text: m.content }] }))

  contents.push({ role: 'user', parts: [{ text: body.message }] })

  const traces: ToolCallTrace[] = []
  const cards = new Map<string, ChatProductCard>()
  let reply = ''

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await callGemini(contents)
      const calls = response.functionCalls ?? []

      if (calls.length === 0) {
        reply = response.text?.trim() ?? ''
        break
      }

      contents.push({
        role: 'model',
        parts: calls.map((c) => ({ functionCall: { name: c.name, args: c.args ?? {} } })),
      })

      // Các call trong cùng một vòng độc lập với nhau và executeTool không bao giờ
      // ném (lỗi biến thành { error } cho model đọc), nên chạy song song được —
      // Promise.all giữ đúng thứ tự kết quả cho parts/traces.
      const executed = await Promise.all(
        calls.map(async (call) => {
          const name = call.name ?? ''
          const args = call.args ?? {}
          const result = await executeTool(name, args)
          return { name, args, result }
        }),
      )

      const parts: Part[] = []
      for (const { name, args, result } of executed) {
        result.products.slice(0, MAX_CARDS).forEach((p) => cards.set(p.id, p))
        traces.push({ name, args, resultCount: result.products.length })
        parts.push({ functionResponse: { name, response: { result: result.data } } })
      }

      contents.push({ role: 'user', parts })
    }
  } catch (err) {
    // Chi tiết lỗi từ Gemini (quota, project id, key) chỉ nằm ở log server.
    console.error('[Chatbot] Gemini lỗi:', err)
    throw new AppError(503, 'Trợ lý đang bận, vui lòng thử lại sau ít phút')
  }

  // Chạm trần vòng lặp mà model vẫn chưa chốt câu trả lời: trả câu mặc định chứ
  // không ném lỗi — khách hỏi mơ hồ không phải là sự cố hệ thống.
  if (!reply) reply = FALLBACK_REPLY

  await prisma.chatMessage.createMany({
    data: [
      { sessionId: session.id, role: 'USER', content: body.message },
      {
        sessionId: session.id,
        role: 'MODEL',
        content: reply,
        // Cast qua InputJsonValue: Prisma đòi kiểu Json có index signature, còn
        // ToolCallTrace[] là mảng interface nên không khớp về hình thức — dữ
        // liệu thì đã là JSON hợp lệ sẵn.
        toolCalls: traces.length > 0 ? (traces as unknown as Prisma.InputJsonValue) : undefined,
      },
    ],
  })

  // Title đặt một lần từ câu hỏi đầu tiên; userId gán khi khách đăng nhập giữa
  // chừng để phiên theo về tài khoản. Gộp chung một lần update.
  const patch: { title?: string; userId?: string } = {}
  if (!session.title) patch.title = body.message.slice(0, MAX_TITLE_CHARS)
  if (!session.userId && userId) patch.userId = userId

  if (Object.keys(patch).length > 0) {
    await prisma.chatSession.update({ where: { id: session.id }, data: patch })
  }

  // Chỉ cấp guestToken khi phiên vừa được tạo trong lượt này: token cũ client đã
  // giữ còn hạn 30 ngày, cấp lại mỗi lượt là khiến client xoay tokens vô ích.
  const ownerId = session.userId ?? patch.userId ?? null
  const guestToken = !body.sessionId && !ownerId ? signGuestChatToken(session.id) : undefined

  return { sessionId: session.id, reply, products: [...cards.values()], guestToken }
}
