import prisma from '../config/db'
import { JwtPayload } from '../types/auth.type'
import { CHAT_HISTORY_LIMIT, ChatStreamEvent } from '../types/chat.type'
import { ChatRole } from '../generated/prisma/client'
import { type HistoryMessage, runAgentTurn } from './chat/agent'

// ─── Hằng số orchestrator ─────────────────────────────────────────────────────

const MAX_TITLE_LENGTH = 60 // tiêu đề session = tin nhắn đầu, cắt 60 ký tự

// ─── Session & context ────────────────────────────────────────────────────────

// Resolve session cho 1 lượt chat, theo 3 nhánh:
// 1. Session CÓ CHỦ (userId khác null) mà không khớp người hiện tại — kể cả guest
//    chưa đăng nhập — → coi như không tồn tại, tạo session mới. Không bao giờ
//    đọc/ghi context của người khác (hổng ownership nếu chỉ guard khi `user` có).
// 2. Session guest (userId null) mà người hiện tại ĐÃ đăng nhập → CLAIM: gắn
//    session vào tài khoản để lịch sử đi theo user (guest đăng nhập giữa chừng —
//    docs/flows/chat-message.md mục 6).
// 3. Session mới hoặc khớp chủ → dùng tiếp.
// `isNew` cho biết session vừa được tạo (chắc chắn chưa có tin nhắn nào).
async function resolveOrCreateSession(
  sessionId: string | undefined,
  user: JwtPayload | undefined,
  firstMessage: string,
) {
  let session = sessionId ? await prisma.chatSession.findUnique({ where: { id: sessionId } }) : null

  if (session && session.userId !== null && session.userId !== user?.userId) {
    session = null // session của user khác → bỏ, tạo session mới bên dưới
  }

  if (session && session.userId === null && user) {
    // CLAIM — update xong dùng luôn object đang có (chỉ đổi userId), khỏi đọc lại DB
    await prisma.chatSession.update({ where: { id: session.id }, data: { userId: user.userId } })
    session = { ...session, userId: user.userId }
  }

  if (session) return { session, isNew: false }

  session = await prisma.chatSession.create({
    data: {
      userId: user?.userId ?? null,
      title: firstMessage.slice(0, MAX_TITLE_LENGTH),
    },
  })
  return { session, isNew: true }
}

// Context = CHAT_HISTORY_LIMIT tin nhắn cuối (đọc theo index (sessionId, createdAt)
// rồi đảo lại thành thứ tự thời gian).
async function loadHistory(sessionId: string): Promise<HistoryMessage[]> {
  const recent = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
    take: CHAT_HISTORY_LIMIT,
  })
  return recent.reverse()
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

// Luồng 1 tin nhắn chat: resolve session → dựng context → gọi agent (yield* mọi
// event ra SSE) → persist câu trả lời. Thân hàm cố tình phẳng: từng bước đánh số,
// chi tiết kỹ thuật nằm ở chat/agent.ts (vòng tool-call) và chat/tools.ts (tool).
// Feature flag CHATBOT_ENABLED do controller chặn trước khi mở stream.
export async function* streamChatReply(input: {
  sessionId?: string
  message: string
  user?: JwtPayload
  signal?: AbortSignal // client ngắt kết nối — agent dừng gọi Gemini, vẫn persist
}): AsyncGenerator<ChatStreamEvent> {
  const { user, signal } = input
  const message = input.message.trim()

  // 1. Session (guest cũng lưu, userId null) — ownership/claim xem resolveOrCreateSession
  const { session, isNew } = await resolveOrCreateSession(input.sessionId, user, message)
  yield { type: 'session', sessionId: session.id }

  // 2. Context: lịch sử gần nhất (session vừa tạo thì khỏi tốn 1 lượt DB trước token đầu tiên)
  const history = isNew ? [] : await loadHistory(session.id)

  // 3. Lưu tin nhắn của khách TRƯỚC khi gọi LLM — LLM chết thì ý định của khách vẫn còn
  await prisma.chatMessage.create({
    data: { sessionId: session.id, role: ChatRole.USER, content: message },
  })

  // 4. Vòng lặp model/tool-calling — chữ stream ra client ngay khi có; model câm
  //    thì agent đã trả câu fallback thân thiện
  const { answerText, lastToolName } = yield* runAgentTurn({ history, message, user, signal })

  // Client ngắt trước khi có chữ nào (agent không bơm fallback cho người đã đi) → không có
  // gì để lưu, khỏi ghi tin rỗng vào history
  if (answerText.trim() === '') return

  // 5. Lưu câu trả lời + chạm updatedAt của session (đánh dấu phiên còn hoạt động).
  //    Client ngắt giữa chừng thì agent dừng và trả về phần chữ đã có — phần đó vẫn
  //    nằm trong history (controller kéo generator chạy hết kể cả sau khi client đi).
  const [saved] = await Promise.all([
    prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: ChatRole.ASSISTANT,
        content: answerText,
        toolName: lastToolName,
      },
    }),
    prisma.chatSession.update({ where: { id: session.id }, data: { updatedAt: new Date() } }),
  ])

  yield { type: 'done', messageId: saved.id, sessionId: session.id }
}
