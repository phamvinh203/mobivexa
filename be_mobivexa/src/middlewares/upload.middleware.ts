import path from 'path'
import multer from 'multer'
import { Request, Response, NextFunction, RequestHandler } from 'express'
import { AppError } from '../helpers/app_error'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
const MAX_SIZE_MB = 5
// Mặc định của busboy cho field text là 1MB. Mô tả sản phẩm đi kèm ảnh dán dạng
// base64 vượt mức đó rất dễ, và khi vượt thì multer ném MulterError — xem
// error.middleware, nếu không bắt riêng thì nó thành 500 không chỉ ra nguyên nhân.
const MAX_FIELD_MB = 10

const multerInstance = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_SIZE_MB * 1024 * 1024,
    fieldSize: MAX_FIELD_MB * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    // Chỉ có tên file + mimetype do CLIENT khai báo tại bước này — cả hai đều
    // giả mạo được (đổi đuôi, sửa header multipart). Vẫn lọc sớm ở đây để chặn
    // rác không đáng tốn băng thông; xác nhận thật (magic byte) nằm ở
    // validateImageContent, chạy sau khi multer đã đọc xong buffer.
    const ext = path.extname(file.originalname).toLowerCase()
    const mimeOk = ALLOWED_MIME_TYPES.includes(file.mimetype)
    const extOk  = ALLOWED_EXTENSIONS.includes(ext)

    if (mimeOk && extOk) {
      cb(null, true)
    } else {
      cb(new AppError(400, 'Chỉ chấp nhận ảnh JPG, PNG, WebP'))
    }
  },
})

// Magic byte (vài byte đầu file) của 3 định dạng cho phép — không đọc theo tên
// hay mimetype vì cả hai đều do client khai báo. Đây là cách tối thiểu để phát
// hiện file đổi đuôi/giả mạo Content-Type (vd đổi .php.jpg, hoặc file thực chất
// là gì đó khác nhưng khai .jpg) mà không cần thêm thư viện ngoài.
function isAllowedImageBuffer(buffer: Buffer): boolean {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true // JPEG
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return true // PNG
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return true // WebP
  }
  return false
}

function validateImageContent(req: Request, _res: Response, next: NextFunction): void {
  const files: Express.Multer.File[] = req.file ? [req.file] : (req.files as Express.Multer.File[] | undefined) ?? []

  for (const file of files) {
    if (!isAllowedImageBuffer(file.buffer)) {
      next(new AppError(400, 'File không đúng định dạng ảnh JPG, PNG hoặc WebP'))
      return
    }
  }

  next()
}

// Bọc multer.single/array để mọi route dùng uploadImage tự động có luôn bước
// kiểm tra magic byte, khỏi phải nhớ gắn thêm validateImageContent ở từng nơi.
export const uploadImage = {
  single(field: string): RequestHandler[] {
    return [multerInstance.single(field), validateImageContent]
  },
  array(field: string, maxCount?: number): RequestHandler[] {
    return [multerInstance.array(field, maxCount), validateImageContent]
  },
}
