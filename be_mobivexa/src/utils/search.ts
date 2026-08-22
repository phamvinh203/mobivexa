// Chuyển chuỗi tìm kiếm của user thành tsquery hợp lệ cho PostgreSQL
// "iphone 15 pro" → "iphone & 15 & pro:*"
// Từ cuối dùng :* để hỗ trợ prefix search (gõ giữa chừng vẫn ra kết quả)
export function toTsQuery(input: string): string {
  const words = input
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // chỉ giữ chữ, số, khoảng trắng (unicode-aware)
    .split(/\s+/)
    .filter((w) => w.length > 0)

  if (words.length === 0) return ''

  return words.map((w, i) => (i === words.length - 1 ? `${w}:*` : w)).join(' & ')
}

// Chuẩn hoá tham số ?search từ query string.
//
// Express 5 trả về MẢNG khi một key xuất hiện nhiều lần (?search=a&search=b),
// nên `query.search?.trim()` ném TypeError và rơi vào nhánh catch-all của
// errorHandler — người dùng bấm submit hai lần hoặc mở bookmark hỏng thì nhận
// "Lỗi server". Lấy phần tử đầu là đủ: key lặp là lỗi phía client, không phải
// yêu cầu lọc nhiều từ khoá.
//
// Trả undefined cho chuỗi rỗng để caller viết `if (search)` mà không phải tự
// phân biệt "không gửi" với "gửi chuỗi trắng".
export function parseSearch(raw: unknown): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}
