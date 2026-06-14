export type BannerPosition = 'HERO' | 'LEFT' | 'RIGHT' | 'HORIZONTAL'

export const BANNER_POSITIONS: BannerPosition[] = ['HERO', 'LEFT', 'RIGHT', 'HORIZONTAL']

// Metadata hiển thị cho từng vị trí (dùng ở trang admin): nhãn tiếng Việt,
// gợi ý tỉ lệ ảnh, và class màu cho badge. Gom cùng chỗ để thêm vị trí mới
// chỉ sửa một nơi.
export const BANNER_POSITION_META: Record<
  BannerPosition,
  { label: string; hint: string; badgeClass: string }
> = {
  HERO: {
    label: 'Banner chính (full-width đầu trang)',
    hint: 'Ảnh ngang ~1280×400',
    badgeClass: 'bg-indigo-100 text-indigo-700',
  },
  LEFT: {
    label: 'Banner dọc bên trái',
    hint: 'Ảnh dọc ~320×800',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  RIGHT: {
    label: 'Banner dọc bên phải',
    hint: 'Ảnh dọc ~320×800',
    badgeClass: 'bg-amber-100 text-amber-700',
  },
  HORIZONTAL: {
    label: 'Banner ngang dài',
    hint: 'Ảnh ngang ~600×200',
    badgeClass: 'bg-sky-100 text-sky-700',
  },
}

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

// Payload cho form tạo/sửa banner (ảnh truyền riêng dưới dạng File)
export interface BannerPayload {
  alt: string
  href?: string
  description?: string
  position: BannerPosition
  isActive?: boolean
  sortOrder?: number
}
