// Body của POST /api/chat/messages. sessionId không bắt buộc: thiếu thì service
// tạo phiên mới, nhờ vậy lượt chat đầu tiên chỉ tốn một request.
export interface SendMessageBody {
  sessionId?: string
  message: string
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
}

// Vết tra cứu lưu vào ChatMessage.toolCalls
export interface ToolCallTrace {
  name: string
  args: Record<string, unknown>
  resultCount: number
}
