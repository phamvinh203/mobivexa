import { Request, Response } from 'express'
import { asyncHandler } from '../helpers/async_handler'
import { AppError } from '../helpers/app_error'
import { streamChatReply } from '../services/chat.service'
import { ChatRequestBody, ChatStreamEvent } from '../types/chat.type'

// Heartbeat comment SSE — giữ kết nối sống khi model/tool chậm, tránh proxy
// giữa chừng cắt stream vì tưởng connection chết (plan mục 6: rủi ro SSE qua proxy).
const HEARTBEAT_INTERVAL_MS = 15_000

// Ghi 1 event đúng hợp đồng SSE: `event: <tên>\ndata: <JSON 1 dòng>\n\n`.
// `type` chỉ dùng để đặt tên event — KHÔNG nhét vào data (hợp đồng ghim cứng:
// data của `session` chỉ có {sessionId}, `delta` chỉ có {text}...).
function writeEvent(res: Response, event: ChatStreamEvent): void {
  const { type, ...payload } = event
  res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`)
}

// POST /api/chat — SSE streaming.
//
// Thứ tự trong route: chat.validator.ts chặn body lỗi bằng 400 JSON → controller
// mở stream. Từ lúc headers đã bắn (200 + text/event-stream) mọi lỗi chuyển thành
// `event: error` rồi kết thúc stream, vì không còn cách nào đổi status nữa.
export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  // Validator đã bảo đảm shape: message string khác rỗng, sessionId string ≤64 hoặc undefined
  const { sessionId, message } = req.body as ChatRequestBody

  // Feature flag tắt nhanh khi sự cố (cháy quota, LLM trả lời sai…) — chặn TRƯỚC khi
  // mở stream để còn trả được 503 JSON thật.
  if (process.env.CHATBOT_ENABLED !== 'true') {
    throw new AppError(503, 'Chatbot đang tạm tắt, vui lòng thử lại sau')
  }

  // ─── Từ đây mở stream: mọi lỗi đi vào `event: error` ───
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // nginx không buffer — buffer là chết streamed text
  })
  res.flushHeaders()

  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_INTERVAL_MS)

  // Client ngắt kết nối (đóng tab, huỷ fetch) → huỷ vòng lặp model/tool để không
  // burn quota Gemini; service vẫn persist phần chữ đã stream vào history.
  // LƯU Ý: phải nghe trên `res`, KHÔNG phải `req` — từ Node 16, `req` phát 'close'
  // ngay khi body được express.json() consume (tức là LẬP TỨC với POST JSON) và sẽ
  // abort oan mọi request; `res` chỉ phát 'close' khi kết nối thật sự đứt hoặc
  // response đã kết thúc.
  const abort = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) abort.abort()
  })

  try {
    for await (const event of streamChatReply({
      sessionId,
      message,
      user: req.user,
      signal: abort.signal,
    })) {
      // Client đã ngắt: vẫn kéo generator chạy hết để service kịp lưu phần đã stream
      // (break ở đây sẽ bỏ dở generator tại yield) — chỉ thôi ghi ra socket đã đóng.
      if (!abort.signal.aborted) writeEvent(res, event)
    }
  } catch (err) {
    const code = err instanceof AppError ? err.status : 500
    const errorMessage = err instanceof AppError ? err.message : 'Có lỗi khi xử lý tin nhắn, vui lòng thử lại'
    console.error('[Chat] stream error:', err)
    writeEvent(res, { type: 'error', code, message: errorMessage })
  } finally {
    clearInterval(heartbeat)
    res.end()
  }
})
