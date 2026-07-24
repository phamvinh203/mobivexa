// Chuyển cặp query from/to (ISO date) thành filter Prisma { gte, lte }.
// Trả undefined khi cả hai đều rỗng để caller spread thẳng vào where mà không tạo field thừa.
export function dateRange(from?: string, to?: string) {
  if (!from && !to) return undefined
  return {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to   ? { lte: new Date(to)   } : {}),
  }
}
