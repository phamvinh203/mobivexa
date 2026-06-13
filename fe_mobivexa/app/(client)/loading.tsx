// Loading UI tự động hiển thị khi Server Component trong nhóm (client) đang fetch.
// Next.js bọc page trong <Suspense> với fallback này — không cần code thủ công.
export default function ClientLoading() {
  return (
    <div className="max-w-[1280px] mx-auto px-6 py-12">
      <div className="h-8 w-48 rounded-lg bg-gray-100 animate-pulse" />
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--color-border)] overflow-hidden"
          >
            <div className="aspect-square bg-gray-100 animate-pulse" />
            <div className="p-3 space-y-2">
              <div className="h-3 w-2/3 rounded bg-gray-100 animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-gray-100 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
