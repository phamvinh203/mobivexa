import path from 'path'
import multer from 'multer'
import { AppError } from '../helpers/app_error'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
const MAX_SIZE_MB = 5

export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
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
