export const LIMITS = {
  DEFAULT:       10,
  PRODUCT:       12,
  INVENTORY:     20,
  MAX:           50,
  MAX_INVENTORY: 100,
} as const

export function parsePagination(
  query: { page?: string; limit?: string },
  defaultLimit: number = LIMITS.DEFAULT,
  maxLimit: number     = LIMITS.MAX
) {
  const page  = Math.max(1, Number(query.page)  || 1)
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || defaultLimit))
  return { page, limit }
}

export function paginationMeta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) }
}
