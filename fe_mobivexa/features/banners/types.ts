export type BannerPosition = 'HERO' | 'LEFT' | 'RIGHT' | 'HORIZONTAL'

export const BANNER_POSITIONS: BannerPosition[] = ['HERO', 'LEFT', 'RIGHT', 'HORIZONTAL']

export type BannersByPosition = Record<BannerPosition, Banner[]>

export const emptyBannersByPosition = (): BannersByPosition =>
  Object.fromEntries(BANNER_POSITIONS.map((p) => [p, [] as Banner[]])) as BannersByPosition

export interface Banner {
  id: string
  imageUrl: string
  imagePublicId: string
  alt: string
  href: string | null
  description: string | null
  position: BannerPosition
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}
