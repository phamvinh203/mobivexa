import { BannerPosition } from '../generated/prisma/enums'

export { BannerPosition }

// Derive từ Prisma enum — tự đồng bộ nếu enum thay đổi
export const BANNER_POSITIONS = Object.values(BannerPosition) as BannerPosition[]

export const BANNER_POSITION_LABEL: Record<BannerPosition, string> = {
  HERO:       'Banner chính (full-width đầu trang)',
  LEFT:       'Banner bên trái',
  RIGHT:      'Banner bên phải',
  HORIZONTAL: 'Banner ngang dài',
}

export interface CreateBannerBody {
  alt: string
  href?: string
  description?: string
  position?: BannerPosition
  isActive?: boolean | string
  sortOrder?: number | string
}

export interface UpdateBannerBody {
  alt?: string
  href?: string
  description?: string
  position?: BannerPosition
  isActive?: boolean | string
  sortOrder?: number | string
}
