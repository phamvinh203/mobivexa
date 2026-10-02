// Chạy tác vụ nền kiểu fire-and-forget: không await, lỗi chỉ được log — tuyệt đối
// không để thành unhandled rejection hay ảnh hưởng response/transaction đã xong.
export function inBackground(task: Promise<unknown>, errorMessage: string): void {
  void task.catch((err) => console.error(errorMessage, err))
}
