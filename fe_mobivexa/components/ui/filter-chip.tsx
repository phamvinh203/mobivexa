'use client'

/**
 * Chip toggle dùng chung cho filter (role / status / stock...). Dùng ở các trang
 * admin có thanh filter dạng "chọn 1 trong nhiều". Active = màu primary.
 */
export function FilterChip({
  active,
  label,
  onClick,
  title,
}: {
  active: boolean
  label: string
  onClick: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
        active
          ? 'bg-[var(--color-primary)] text-white'
          : 'bg-white text-gray-600 ring-1 ring-border hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  )
}
