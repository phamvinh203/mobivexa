// Chuyển text (kể cả tiếng Việt có dấu) thành slug an toàn cho URL
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // bỏ dấu thanh (combining diacritics)
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // bỏ ký tự đặc biệt
    .replace(/[\s_-]+/g, '-') // gộp khoảng trắng/gạch thành 1 dấu '-'
    .replace(/^-+|-+$/g, '') // bỏ '-' thừa ở đầu/cuối
}

// Sinh slug duy nhất: nếu trùng thì thêm hậu tố -1, -2, ...
// `exists` là hàm kiểm tra slug đã tồn tại trong DB hay chưa
export async function generateUniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base)
  let slug = root
  let counter = 1
  while (await exists(slug)) {
    slug = `${root}-${counter++}`
  }
  return slug
}

// Tạo hàm `exists` cho generateUniqueSlug từ một lookup theo slug của model bất kỳ.
// `excludeId` để bỏ qua chính bản ghi đang sửa (slug không đổi không bị coi là trùng).
export function slugTaken(
  lookup: (slug: string) => Promise<{ id: string } | null>,
  excludeId?: string,
) {
  return async (slug: string) => {
    const found = await lookup(slug)
    return found !== null && found.id !== excludeId
  }
}
