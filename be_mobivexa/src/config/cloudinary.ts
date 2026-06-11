import { v2 as cloudinary, UploadApiOptions, UploadApiResponse } from 'cloudinary'

// Tự đọc CLOUDINARY_URL từ env (format: cloudinary://api_key:api_secret@cloud_name)
cloudinary.config({ secure: true })

// Upload buffer (vd: file từ multer memoryStorage) lên Cloudinary
export function uploadBuffer(buffer: Buffer, options: UploadApiOptions): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(options, (error, result) => {
        if (error || !result) reject(error ?? new Error('Upload thất bại'))
        else resolve(result)
      })
      .end(buffer)
  })
}

export default cloudinary
