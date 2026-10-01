// Hợp đồng SSE của POST /api/chat — GHIM CỨNG, FE đang dựng theo đúng hệ event này.
// Mỗi event đi ra dưới dạng: `event: <type>\ndata: <json 1 dòng>\n\n`

// Card sản phẩm kèm event `products` — FE render bubble có nút thêm giỏ/link chi tiết
export interface ChatProductCard {
  id: string
  slug: string
  name: string
  brand: string
  salePrice: number
  originalPrice: number
  imageUrl: string | null
}

export type ChatStreamEvent =
  | { type: 'session'; sessionId: string }
  | { type: 'delta'; text: string }
  | { type: 'products'; items: ChatProductCard[] }
  | { type: 'done'; messageId: string; sessionId: string }
  // Chỉ xảy ra SAU khi headers đã bắn — không còn cách đổi status, FE đọc code + message
  | { type: 'error'; code: number; message: string }

export interface ChatRequestBody {
  sessionId?: string
  message: string
}

// Giới hạn nội dung 1 tin nhắn — validate ở chat.validator.ts TRƯỚC khi mở stream
export const MAX_CHAT_MESSAGE_LENGTH = 2000

// Context gửi cho LLM = N tin nhắn cuối của session (plan chatbot v1.0 mục 2.3)
export const CHAT_HISTORY_LIMIT = 10
