// Chuyển cặp query from/to thành filter Prisma { gte, lte }.
// Trả undefined khi cả hai đều rỗng để caller spread thẳng vào where mà không tạo field thừa.

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

// Ô lọc ngày trên admin gửi 'yyyy-mm-dd'. Đưa thẳng vào new Date() thì cả hai
// đầu đều thành 00:00 UTC: "đến 17/08" cắt mất trọn ngày 17/08, còn "từ 17/08"
// lệch 7 tiếng so với ngày làm việc ở VN. Nên ngày trần được nới ra hai đầu
// ngày theo giờ máy chủ; chuỗi đã kèm giờ thì giữ nguyên, caller nào cần mốc
// chính xác vẫn tự quyết định được.
function boundary(value: string, edge: 'start' | 'end'): Date {
  if (!DATE_ONLY.test(value)) return new Date(value)
  return new Date(`${value}T${edge === 'start' ? '00:00:00.000' : '23:59:59.999'}`)
}

export function dateRange(from?: string, to?: string) {
  if (!from && !to) return undefined
  return {
    ...(from ? { gte: boundary(from, 'start') } : {}),
    ...(to   ? { lte: boundary(to,   'end')   } : {}),
  }
}
