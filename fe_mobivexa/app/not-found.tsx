import Link from 'next/link'

// Trang 404 toàn cục. Tự render khi route không tồn tại hoặc gọi notFound().
export default function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center px-6 text-center">
      <div>
        <p className="text-6xl font-bold text-[var(--color-primary)]">404</p>
        <h1 className="mt-4 text-2xl font-bold">Không tìm thấy trang</h1>
        <p className="mt-2 text-gray-500">
          Trang bạn tìm không tồn tại hoặc đã bị di chuyển.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block h-11 px-6 leading-[44px] rounded-lg bg-[var(--color-primary)] text-white font-medium"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  )
}
