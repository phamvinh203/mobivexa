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

// Lấy giá trị đầu tiên của một query param.
//
// Express 5 trả về MẢNG khi một key xuất hiện nhiều lần (?category=a&category=b),
// nên đẩy thẳng vào where của Prisma là nổ PrismaClientValidationError thành 500.
// Key lặp là lỗi phía client, không phải yêu cầu lọc nhiều giá trị — lấy phần tử
// đầu là đủ. Trả undefined cho mọi thứ không phải chuỗi.
export function firstQueryValue(raw: unknown): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' ? value : undefined
}

// Chuẩn hoá tham số ?search từ query string.
//
// Dùng chung firstQueryValue để chống key lặp (?search=a&search=b), vốn làm
// `.trim()` ném TypeError và rơi vào nhánh catch-all của errorHandler — người
// dùng bấm submit hai lần hoặc mở bookmark hỏng thì nhận "Lỗi server".
//
// Trả undefined cho chuỗi rỗng để caller viết `if (search)` mà không phải tự
// phân biệt "không gửi" với "gửi chuỗi trắng".
export function parseSearch(raw: unknown): string | undefined {
  const value = firstQueryValue(raw)
  if (value === undefined) return undefined

  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}
