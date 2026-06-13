'use client'

// Error boundary cho nhóm (client). Bắt lỗi runtime/khi fetch thất bại,
// hiển thị UI thân thiện + nút thử lại thay vì màn hình trắng.
// error.tsx BẮT BUỘC là Client Component.
export default function ClientError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="max-w-[1280px] mx-auto px-6 py-24 text-center">
      <h2 className="text-2xl font-bold">Đã có lỗi xảy ra</h2>
      <p className="mt-2 text-gray-500">
        Không tải được nội dung. Vui lòng thử lại.
      </p>
      {/* Chỉ lộ chi tiết lỗi ở môi trường dev — tránh rò rỉ thông tin nội bộ */}
      {process.env.NODE_ENV === 'development' && (
        <pre className="mt-4 mx-auto max-w-lg overflow-auto rounded-lg bg-gray-50 p-3 text-left text-xs text-[var(--color-danger)]">
          {error.message}
        </pre>
      )}
      <button
        onClick={reset}
        className="mt-6 h-11 px-6 rounded-lg bg-[var(--color-primary)] text-white font-medium"
      >
        Thử lại
      </button>
    </div>
  )
}
