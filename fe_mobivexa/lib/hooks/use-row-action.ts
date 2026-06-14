import { useState } from 'react'
import { ApiError } from '@/lib/api/http'

/**
 * Hook quản lý thao tác trên 1 dòng bảng: đặt busy state, bắt lỗi ApiError,
 * rồi clear busy khi xong. Dùng cho toggle/delete ở các trang admin (categories,
 * brands, banners, products, users, reviews).
 *
 * setError: hàm setError từ useState của trang gọi — lỗi dòng và lỗi load dùng
 * chung cùng 1 error banner.
 */
export function useRowAction(setError: (msg: string) => void) {
  const [busyId, setBusyId] = useState<string | null>(null)

  async function runBusy(id: string, op: () => Promise<void>, errMsg: string) {
    setBusyId(id)
    try {
      await op()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : errMsg)
    } finally {
      setBusyId(null)
    }
  }

  return { busyId, runBusy }
}
