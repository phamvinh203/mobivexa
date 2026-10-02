import { AppError } from '../helpers/app_error'

// Bỏ dấu tiếng Việt: NFD tách ký tự gốc + dấu thanh, xoá range dấu combining;
// 'đ' không nằm trong range đó nên xử lý riêng.
export function removeVietnameseDiacritics(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // bỏ dấu thanh (combining diacritics)
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

// Chuyển text (kể cả tiếng Việt có dấu) thành slug an toàn cho URL
export function slugify(text: string): string {
  return removeVietnameseDiacritics(text)
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

// Slug khi SỬA bản ghi catalog (brand / category / product). Slug rỗng = yêu cầu sinh lại
// từ tên, đúng như placeholder ở form đang hứa — không có nhánh này thì
// generateUniqueSlug('') sẽ tạo ra slug rỗng. `name` là tên mới (nếu đang sửa tên),
// `currentName` là tên hiện có để làm nguồn cuối cùng.
export function regenerateSlug(opts: {
  slug: string
  name: string | undefined
  currentName: string
  findBySlug: (slug: string) => Promise<{ id: string } | null>
  excludeId: string
}): Promise<string> {
  const { slug, name, currentName, findBySlug, excludeId } = opts
  const base = slug.trim() || name?.trim() || currentName
  return generateUniqueSlug(base, slugTaken(findBySlug, excludeId))
}

// Slug rỗng/không gửi → tự sinh (thêm hậu tố -1, -2… nếu đụng, như generateUniqueSlug).
// Slug có gửi tường minh → slugify rồi kiểm tồn tại, đụng thì báo lỗi ngay (409) thay vì
// tự đổi hậu tố — admin đã chọn một slug cụ thể, tự động đổi sang giá trị khác sẽ gây
// bất ngờ. Dùng cho blog (post/category/tag) — khác hành vi generateUniqueSlug thuần của
// product/category sản phẩm (luôn tự thêm hậu tố bất kể có gửi slug hay không).
export async function resolveUniqueSlug(opts: {
  base: string
  provided: string | undefined
  excludeId?: string
  findBySlug: (slug: string) => Promise<{ id: string } | null>
  conflictMessage: string
  invalidMessage?: string
  // RVW-014: tiêu đề/tên không có ký tự Latin nào (CJK thuần, emoji, "???") khiến
  // slugify(base) ra chuỗi rỗng. Không có fallback thì bản ghi đầu tiên lưu slug ""
  // và bản ghi thứ hai đụng nó sẽ được cấp "-1" — vẫn qua mọi kiểm tra "thiếu slug"
  // (chuỗi "-1" không rỗng) nên có thể xuất bản với URL /tin-tuc/-1. Domain gọi hàm
  // này PHẢI truyền fallbackBase phù hợp (vd 'bai-viet', 'danh-muc', 'tag').
  fallbackBase: string
}): Promise<string> {
  const { base, provided, excludeId, findBySlug, conflictMessage, invalidMessage = 'Slug không hợp lệ', fallbackBase } = opts
  const taken = slugTaken(findBySlug, excludeId)

  if (!provided || !provided.trim()) {
    const root = slugify(base) || fallbackBase
    return generateUniqueSlug(root, taken)
  }

  const slug = slugify(provided)
  if (!slug) throw new AppError(400, invalidMessage)
  if (await taken(slug)) throw new AppError(409, conflictMessage)
  return slug
}
