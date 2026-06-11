// Lỗi nghiệp vụ có HTTP status — services throw, error middleware bắt và trả về client
export class AppError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'AppError'
  }
}
