import multer from 'multer'
import { AppError } from '../helpers/app_error'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_MB = 5

export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new AppError(400, 'Chỉ chấp nhận ảnh JPG, PNG, WebP'))
    }
  },
})
