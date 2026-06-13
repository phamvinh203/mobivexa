interface PagePlaceholderProps {
  title: string
  /** Mô tả ngắn vai trò của trang */
  description?: string
  /** Endpoint backend mà trang này sẽ gọi (để dev biết wiring) */
  endpoint?: string
  /** Gợi ý các việc cần làm tiếp */
  todos?: string[]
}

/**
 * Khung trang tạm cho các route đã scaffold nhưng chưa implement UI.
 * Hiển thị rõ endpoint + việc cần làm để dev tiếp tục.
 */
export function PagePlaceholder({
  title,
  description,
  endpoint,
  todos,
}: PagePlaceholderProps) {
  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      {description && <p className="mt-1 text-gray-500">{description}</p>}
      {endpoint && (
        <p className="mt-3 inline-block rounded bg-[var(--color-primary-light)] px-2.5 py-1 font-mono text-xs text-[var(--color-primary)]">
          {endpoint}
        </p>
      )}
      {todos && todos.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm text-gray-600 list-disc list-inside">
          {todos.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
