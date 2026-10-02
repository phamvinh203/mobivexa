// multipart/form-data gửi mọi field dạng chuỗi nên boolean tới đây là "true"/"false".
// Quy ước chung: CHỈ đúng 'false' mới là false — mọi giá trị khác là true. Nơi gọi
// tự đặt mặc định cho field vắng mặt: `formBool(isActive ?? true)`.
export const formBool = (raw: unknown): boolean => String(raw) !== 'false'
