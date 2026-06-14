import { http } from '@/lib/api/http'
import type { Banner, BannerPosition, BannersByPosition } from './types'

export const bannerApi = {
  // Fetch tất cả banners active — cache 5 phút
  list: (position?: BannerPosition) =>
    http
      .get<{ banners: Banner[] }>('/banners', {
        auth: false,
        revalidate: 60,
        ...(position ? { params: { position } } : {}),
      })
      .then((r) => r.banners ?? []),

  // Fetch toàn bộ rồi group theo position — dùng cho homepage
  listGrouped: async (): Promise<BannersByPosition> => {
    const banners = await http
      .get<{ banners: Banner[] }>('/banners', { auth: false, revalidate: 60 })
      .then((r) => r.banners ?? [])

    return {
      HERO:       banners.filter((b) => b.position === 'HERO'),
      LEFT:       banners.filter((b) => b.position === 'LEFT'),
      RIGHT:      banners.filter((b) => b.position === 'RIGHT'),
      HORIZONTAL: banners.filter((b) => b.position === 'HORIZONTAL'),
    }
  },
}
