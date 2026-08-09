// Kiểm tra file ảnh phía client trước khi upload. Lớp chặn đầu tiên — backend
// vẫn validate lại (client check có thể bị bỏ qua).
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const MAX_IMAGE_MB = 5;

/** Ném Error nếu file không phải ảnh hợp lệ hoặc quá lớn. */
export function assertImageFile(file: File): void {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Chỉ chấp nhận ảnh JPEG, PNG, WebP hoặc GIF");
  }
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    throw new Error(`Ảnh vượt quá dung lượng cho phép (${MAX_IMAGE_MB}MB)`);
  }
}

/** Khớp PHONE_RE trong be_mobivexa/src/validators/user.validator.ts */
export const PHONE_RE = /^(0|\+84)[0-9]{8,10}$/;
