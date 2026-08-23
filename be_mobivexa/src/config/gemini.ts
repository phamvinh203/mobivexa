import { GoogleGenAI } from '@google/genai'

// Kiểm tra ngay lúc import, không đợi tới request đầu tiên.
//
// Thiếu key mà vẫn cho server khởi động thì lỗi chỉ lộ ra khi có khách thật bấm
// gửi tin nhắn — lúc đó nó là lỗi 500 giữa giờ chạy, thay vì một dòng báo lỗi
// lúc deploy.
const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  throw new Error('Thiếu GEMINI_API_KEY trong biến môi trường — chatbot không khởi động được')
}

// flash: độ trễ thấp, chi phí thấp, đủ cho tư vấn sản phẩm. Đọc từ env để đổi
// sang model mạnh hơn mà không phải sửa code.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

// Người dùng đợi quá 30 giây là đã đóng tab. Thà trả lỗi "trợ lý đang bận" còn
// hơn giữ connection treo cho tới khi Express tự cắt.
export const GEMINI_TIMEOUT_MS = 30_000

export const genAI = new GoogleGenAI({ apiKey })
