import { GoogleGenAI } from '@google/genai'
import { AppError } from '../../helpers/app_error'
import { ChatRole, type ChatMessage } from '../../generated/prisma/client'
import { JwtPayload } from '../../types/auth.type'
import { ChatStreamEvent } from '../../types/chat.type'
import { buildSystemPrompt } from './prompt'
import { toolDeclarationsFor, executeTool, truncateToolResult } from './tools'

// ─── Hằng số cấu hình vòng agent ──────────────────────────────────────────────

const MAX_TOOL_ROUNDS = 3 // cap vòng tool-call/lượt (plan chatbot v1.0 mục 2.5)
const MAX_OUTPUT_TOKENS = 2048
const MAX_MODEL_CALLS = MAX_TOOL_ROUNDS + 1 // vòng cuối (nếu còn) ép trả chữ, không tool
const MODEL_FALLBACK_BACKOFF_MS = 1200 // chờ ngắn giữa 2 model khi 429/503

const FALLBACK_ANSWER =
  'Xin lỗi anh/chị, em chưa xử lý được yêu cầu này. Anh/chị thử hỏi lại theo cách khác, hoặc bấm "Kết nối nhân viên" để shop hỗ trợ trực tiếp nhé.'

// Chuỗi model dự phòng: model chính + GEMINI_MODEL_FALLBACKS (phân tách dấu phẩy).
// Gemini free tier hay 503 "high demand" theo từng model — rơi xuống model kế giúp
// chat không chết theo một model duy nhất. Env đọc mỗi lần gọi thay vì lúc load
// module — test đổi các biến này giữa các case.
function modelChain(): string[] {
  const primary = process.env.GEMINI_MODEL ?? 'gemini-3-flash-preview'
  const fallbacks = (process.env.GEMINI_MODEL_FALLBACKS ?? 'gemini-3.1-flash-lite')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return [...new Set([primary, ...fallbacks])]
}

type GeminiClient = InstanceType<typeof GoogleGenAI>
type GeminiStream = Awaited<ReturnType<GeminiClient['models']['generateContentStream']>>

// Mở stream, thử lần lượt từng model trong chain: chỉ 429/503 (quá tải/hết quota
// tạm thời) mới được rơi xuống model kế, kèm backoff ngắn; lỗi khác (key sai,
// model không tồn tại…) ném ra luôn để không che giấu cấu hình hỏng. Model cuối
// không còn gì để rơi xuống nên gọi thẳng — lỗi của nó ném ngay, không chờ backoff.
// `signal` được kiểm tra trước khi backoff và trước mỗi lượt gọi model kế: client
// đã ngắt thì ném lại lỗi gốc — runAgentTurn bắt (signal.aborted → break) và kết
// thúc có trật tự, đừng đốt thêm lượt model cho một khách không còn nghe.
async function openStream(
  client: GeminiClient,
  args: Omit<Parameters<GeminiClient['models']['generateContentStream']>[0], 'model'>,
  signal?: AbortSignal,
): Promise<GeminiStream> {
  const chain = modelChain()
  for (const model of chain.slice(0, -1)) {
    try {
      return await client.models.generateContentStream({ ...args, model })
    } catch (error) {
      const status = (error as { status?: number }).status
      if (status !== 429 && status !== 503) throw error
      if (signal?.aborted) throw error // client đi rồi: không backoff, không gọi model kế
      await new Promise((resolve) => setTimeout(resolve, MODEL_FALLBACK_BACKOFF_MS))
      if (signal?.aborted) throw error // ngắt trong lúc chờ backoff — cũng dừng hẳn
    }
  }
  return client.models.generateContentStream({ ...args, model: chain[chain.length - 1] })
}

function geminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new AppError(503, 'Chatbot chưa được cấu hình, vui lòng thử lại sau')
  // Tạo client theo request: constructor rẻ (không I/O) và không giữ state giữa các request.
  return new GoogleGenAI({ apiKey })
}

// ─── Vòng lặp Gemini tool-calling ────────────────────────────────────────────

// Tin nhắn đã lưu của phiên (đúng thứ tự thời gian) — agent tự đổi sang định dạng Gemini
export type HistoryMessage = Pick<ChatMessage, 'role' | 'content'>

// Kết quả 1 lượt agent: chữ đã stream + tool cuối đã chạy (lưu DB kèm tin nhắn)
export interface AgentTurnResult {
  answerText: string
  lastToolName: string | null
}

type GeminiPart =
  | { text: string; thoughtSignature?: string }
  | { functionCall: { name: string; args: Record<string, unknown> }; thoughtSignature?: string }
  | { functionResponse: { name: string; response: Record<string, unknown> } }

interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

const toGeminiContent = (m: HistoryMessage): GeminiContent => ({
  role: m.role === ChatRole.USER ? 'user' : 'model',
  parts: [{ text: m.content }],
})

// Một lượt "agent": gọi model → stream chữ ra client → thực thi tool model đòi →
// lặp lại, tối đa MAX_MODEL_CALLS lượt / MAX_TOOL_ROUNDS vòng tool.
//
// Được streamChatReply tiêu thụ bằng `yield*`: mỗi ChatStreamEvent (delta/products)
// đi thẳng ra SSE, còn giá trị return là tổng kết lượt để orchestrator persist.
// `signal` là AbortSignal của client — khi client ngắt kết nối, vòng lặp dừng đúng
// chỗ (không burn thêm lượt gọi Gemini) nhưng vẫn trả về phần chữ đã stream.
export async function* runAgentTurn(input: {
  history: HistoryMessage[]
  message: string
  user?: JwtPayload
  signal?: AbortSignal
}): AsyncGenerator<ChatStreamEvent, AgentTurnResult> {
  const { history, message, user, signal } = input
  const client = geminiClient()
  const systemInstruction = buildSystemPrompt(user)
  const functionDeclarations = toolDeclarationsFor(user)
  const contents: GeminiContent[] = [...history.map(toGeminiContent), { role: 'user', parts: [{ text: message }] }]
  let toolExecutions = 0
  let answerText = ''
  let lastToolName: string | null = null
  let finishReason: string | null = null

  for (let callIndex = 0; callIndex < MAX_MODEL_CALLS; callIndex++) {
    const allowTools = callIndex < MAX_MODEL_CALLS - 1 && toolExecutions < MAX_TOOL_ROUNDS

    // Client đã ngắt giữa các vòng (kể cả giữa lúc chạy tool của vòng trước) —
    // dừng trước khi tốn thêm lượt gọi model
    if (signal?.aborted) break

    let stream: GeminiStream
    try {
      stream = await openStream(
        client,
        {
          contents,
          config: {
            systemInstruction,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            thinkingConfig: { thinkingBudget: 0 }, // chat tư vấn cần độ trễ thấp
            ...(allowTools ? { tools: [{ functionDeclarations }] } : {}),
            ...(signal ? { abortSignal: signal } : {}), // SDK tự huỷ HTTP request khi client ngắt
          },
        },
        signal,
      )
    } catch (error) {
      // Ngắt đúng lúc mở stream: kết thúc có trật tự, giữ phần chữ đã stream.
      // Lỗi khác (config/key hỏng) vẫn ném ra — controller chuyển thành event: error.
      if (signal?.aborted) break
      throw error
    }

    // Gemini 3 gắn thought_signature vào part; khi đẩy functionCall/text trả về cho
    // model ở vòng sau PHẢI giữ nguyên signature, thiếu là 400 ngay. Nên giữ part gốc
    // của round này thay vì dựng lại từ chunk.functionCalls (mất signature).
    const parts: GeminiPart[] = []
    try {
      for await (const chunk of stream) {
        if (signal?.aborted) break
        // Chữ của chunk lấy từ chính các part đang duyệt — getter chunk.text của SDK
        // duyệt lại parts và console.warn mỗi lần chunk có functionCall.
        let delta = ''
        for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
          if (part.thought) continue
          if (part.text) {
            delta += part.text
            parts.push({ text: part.text, thoughtSignature: part.thoughtSignature })
          } else if (part.functionCall?.name) {
            parts.push({
              functionCall: { name: part.functionCall.name, args: part.functionCall.args ?? {} },
              thoughtSignature: part.thoughtSignature,
            })
          }
        }
        if (delta) {
          answerText += delta
          yield { type: 'delta', text: delta }
        }
        // Lý do model dừng ở round này — round sau ghi đè, giá trị cuối cùng là của round cuối
        const reason = chunk.candidates?.[0]?.finishReason
        if (reason) finishReason = String(reason)
      }
    } catch (error) {
      // Client ngắt giữa stream: kết thúc, không ném lỗi. Còn lại là lỗi parse/network
      // tạm thời của SDK (vd "Incomplete JSON segment at the end") — không phải lỗi
      // cấu hình: giữ phần chữ đã stream cho khách, KHÔNG thực thi tool dở dang (part
      // thiếu signature sẽ 400), kết thúc có trật tự.
      if (!signal?.aborted) {
        console.warn('[Chat] stream interrupted, salvaging partial answer:', (error as Error).message)
      }
      break
    }

    // Model không đòi tool, hoặc đã chạm cap → kết thúc, giữ nguyên chữ đã stream
    const calls = parts.flatMap((p) => ('functionCall' in p ? [p.functionCall] : []))
    if (calls.length === 0 || !allowTools) break

    // Thực thi tool + đưa kết quả về cho model
    contents.push({ role: 'model', parts })

    const responseParts: GeminiPart[] = []
    for (const call of calls) {
      if (signal?.aborted) break
      const execution = await executeTool(call.name, call.args, user)
      lastToolName = call.name
      toolExecutions++

      // Card sản phẩm bắn về FE NGAY khi tool trả kết quả (hợp đồng SSE)
      if (execution.cards) yield { type: 'products', items: execution.cards }

      responseParts.push({
        functionResponse: { name: call.name, response: truncateToolResult(execution.payload) },
      })
    }
    contents.push({ role: 'user', parts: responseParts })
  }

  // Model bị cắt cụt vì chạm trần output — nối "…" thay vì im lặng cắt câu giữa chừng
  if (finishReason === 'MAX_TOKENS' && answerText.trim() !== '') {
    console.warn('[Chat] answer truncated at maxOutputTokens, appending ellipsis')
    answerText += '…'
    yield { type: 'delta', text: '…' }
  }

  // Model câm (chạm cap tool, stream đứt sớm, output rỗng) → câu fallback thân thiện. Client
  // đã ngắt thì thôi: không ai đọc, và câu xin lỗi họ chưa từng thấy không được nằm trong history.
  if (answerText.trim() === '' && !signal?.aborted) {
    answerText = FALLBACK_ANSWER
    yield { type: 'delta', text: FALLBACK_ANSWER }
  }

  return { answerText, lastToolName }
}
