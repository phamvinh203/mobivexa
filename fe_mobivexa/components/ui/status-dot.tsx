/**
 * Badge "chấm tròn + nhãn" cho trạng thái bật/tắt (hiển thị/ẩn, đang bán/đã ẩn,
 * hoạt động/đã khoá...). Dùng chung ở các bảng admin (users, categories, brands,
 * products, banners) — chỉ khác nhau ở cặp nhãn.
 */
export function StatusDot({
  active,
  activeLabel,
  inactiveLabel,
}: {
  active: boolean
  activeLabel: string
  inactiveLabel: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        active ? 'text-emerald-600' : 'text-gray-400'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-300'}`}
      />
      {active ? activeLabel : inactiveLabel}
    </span>
  )
}
