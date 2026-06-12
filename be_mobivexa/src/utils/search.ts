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
