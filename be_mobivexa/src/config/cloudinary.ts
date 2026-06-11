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

// Upload ảnh entity (category/brand/product...) — public_id do Cloudinary tự sinh.
// Trả về { url, publicId } để lưu vào DB.
export async function uploadEntityImage(buffer: Buffer, folder: string) {
  const result = await uploadBuffer(buffer, { folder, resource_type: 'image' })
  return { url: result.secure_url, publicId: result.public_id }
}

// Xóa ảnh trên Cloudinary theo public_id (bỏ qua lỗi nếu ảnh không tồn tại)
export async function destroyImage(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId)
  } catch {
    // ảnh đã bị xóa hoặc không tồn tại — không cần chặn luồng
  }
}

export default cloudinary
