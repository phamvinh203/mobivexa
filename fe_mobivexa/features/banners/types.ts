export type BannerPosition = 'HERO' | 'LEFT' | 'RIGHT' | 'HORIZONTAL'

export type BannersByPosition = Record<BannerPosition, Banner[]>

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
