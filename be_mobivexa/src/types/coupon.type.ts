import { CouponType } from '../generated/prisma/client'

export interface CreateCouponBody {
  code: string
  description?: string
  type: CouponType
  value: number
  maxDiscount?: number | null
  minOrderValue?: number
  usageLimit?: number | null
  startsAt: string
  endsAt: string
  isActive?: boolean
}

export type UpdateCouponBody = Partial<CreateCouponBody>

/** running = đang chạy | scheduled = chưa tới ngày | expired = đã qua ngày */
export type CouponStatusFilter = 'running' | 'scheduled' | 'expired'

export interface AdminCouponListQuery {
  page?: string
  limit?: string
  search?: string
  status?: CouponStatusFilter
  isActive?: string
}
