import { GoogleGenAI } from '@google/genai'

// flash: độ trễ thấp, chi phí thấp, đủ cho tư vấn sản phẩm. Đọc từ env để đổi
// sang model mạnh hơn mà không phải sửa code.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

// Người dùng đợi quá 30 giây là đã đóng tab. Thà trả lỗi "trợ lý đang bận" còn
// hơn giữ connection treo cho tới khi Express tự cắt.
export const GEMINI_TIMEOUT_MS = 30_000

// Khởi tạo lười thay vì lúc import: file này bị kéo vào qua chuỗi chat.route →
// index.route → app, nếu ném lỗi ngay khi import thì thiếu GEMINI_API_KEY làm
// chết CẢ API (kể cả order, payment) chứ không riêng chatbot. Thiếu key giờ chỉ
// hạ chatbot xuống 503, các nghiệp vụ khác vẫn chạy.
let client: GoogleGenAI | undefined

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY)
}

export function getGemini(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('Thiếu GEMINI_API_KEY trong biến môi trường — chatbot không khả dụng')
    }
    client = new GoogleGenAI({ apiKey })
  }
  return client
}
