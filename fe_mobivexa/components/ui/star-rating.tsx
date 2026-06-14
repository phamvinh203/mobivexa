/**
 * Hiển thị rating dạng ngôi sao. Sao đầy = primary amber, sao trống = xám.
 * Dùng chung cho reviews (admin + client) và product detail.
 */
export function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="text-amber-500" aria-label={`${value} trên ${max} sao`}>
      {'★'.repeat(value)}
      <span className="text-gray-200">{'★'.repeat(Math.max(0, max - value))}</span>
    </span>
  )
}
