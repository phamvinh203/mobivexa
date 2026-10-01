import { Request, Response } from 'express'
import { asyncHandler } from '../helpers/async_handler'
import { sendSuccess } from '../helpers/response'
import { getDashboardStats } from '../services/dashboard.service'

// ─── Admin: dashboard thống kê ────────────────────────────────────────────────

// Tổng hợp số liệu trang Dashboard: today, doanh thu 30 ngày, đơn theo trạng thái,
// top bán chạy, cảnh báo tồn kho — shape khớp hợp đồng FE (api-contract)
export const stats = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getDashboardStats()
  sendSuccess(res, data)
})
