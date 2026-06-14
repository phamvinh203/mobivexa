// Kiểm tra file ảnh phía client trước khi upload. Lớp chặn đầu tiên — backend
// vẫn PHẢI validate lại (client check có thể bị bỏ qua).

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]
const MAX_IMAGE_MB = 5

/** Ném Error nếu file không phải ảnh hợp lệ hoặc quá lớn. */
export function assertImageFile(file: File): void {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Chỉ chấp nhận ảnh JPEG, PNG, WebP hoặc GIF')
  }
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    throw new Error(`Ảnh vượt quá dung lượng cho phép (${MAX_IMAGE_MB}MB)`)
  }
}

/** Validate nhiều ảnh cùng lúc. */
export function assertImageFiles(files: File[]): void {
  files.forEach(assertImageFile)
}

// Dựng FormData từ object body (bỏ field undefined) + 1 file ảnh tuỳ chọn.
// Dùng chung cho các admin API upload (brand logo, banner image...).
export function objectToFormData(
  body: Record<string, unknown>,
  file?: { field: string; value?: File },
): FormData {
  if (file?.value) assertImageFile(file.value)
  const form = new FormData()
  for (const [key, value] of Object.entries(body)) {
    if (value != null) form.append(key, String(value)) // Check cả null và undefined
  }
  if (file?.value) form.append(file.field, file.value)
  return form
}
