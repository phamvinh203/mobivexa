// Body của POST /api/chat/messages. sessionId không bắt buộc: thiếu thì service
// tạo phiên mới, nhờ vậy lượt chat đầu tiên chỉ tốn một request.
export interface SendMessageBody {
  sessionId?: string
  message: string
  // Bắt buộc khi tiếp tục một phiên khách vãng lai (session.userId = null) — chứng
  // minh người gọi chính là người đã tạo phiên, vì session id không phải bí mật.
  guestToken?: string
}

// Sản phẩm rút gọn để frontend render thành card bấm được.
//
// salePrice/originalPrice để kiểu string vì Prisma trả Decimal — ép sang number
// là mất chính xác với số tiền lớn, mà VND thì thường xuyên chạm hàng chục triệu.
export interface ChatProductCard {
  id: string
  name: string
  slug: string
  salePrice: string
  originalPrice: string
  imageUrl: string | null
}

export interface ChatReply {
  sessionId: string
  reply: string
  products: ChatProductCard[]
  // Chỉ có khi phiên còn là khách vãng lai — client phải lưu lại và gửi kèm
  // (SendMessageBody.guestToken / header x-chat-guest-token) ở các lượt sau.
  guestToken?: string
}

// Vết tra cứu lưu vào ChatMessage.toolCalls
export interface ToolCallTrace {
  name: string
  args: Record<string, unknown>
  resultCount: number
}
