import { ApiError } from '@/lib/api/http'

/**
 * Consolidates action error and fetch error into a single error message.
 * Used in admin pages that combine React Query fetch errors with optimistic update action errors.
 *
 * @param actionError - Error from optimistic update/mutation actions
 * @param fetchError - Error from React Query fetch
 * @param entityName - Name of the entity being fetched (e.g., "sản phẩm", "đơn hàng")
 * @returns Consolidated error message, or empty string if no errors
 */
export function consolidateApiError(
  actionError: string | undefined | null,
  fetchError: unknown,
  entityName: string,
): string {
  // Action errors take priority (user-triggered operations)
  if (actionError) return actionError

  // Fetch errors from React Query
  if (fetchError instanceof ApiError) {
    return fetchError.message
  }

  // Generic error fallback
  if (fetchError) {
    return `Không tải được danh sách ${entityName}`
  }

  return ''
}
