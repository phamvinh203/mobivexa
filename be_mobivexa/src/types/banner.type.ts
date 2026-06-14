import { BannerPosition } from '../generated/prisma/enums'

export { BannerPosition }

export const BANNER_POSITIONS = ['HERO', 'LEFT', 'RIGHT', 'HORIZONTAL'] as const

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
