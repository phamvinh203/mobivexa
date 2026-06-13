// Loading UI cho khu vực admin khi Server Component đang fetch.
export default function AdminLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-56 rounded-lg bg-gray-100 animate-pulse" />
      <div className="rounded-xl border border-[var(--color-border)] p-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
