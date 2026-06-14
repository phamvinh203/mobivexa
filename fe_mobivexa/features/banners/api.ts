import { http } from '@/lib/api/http'
import { emptyBannersByPosition, type Banner, type BannerPosition, type BannersByPosition } from './types'

export const bannerApi = {
  list: (position?: BannerPosition) =>
    http
      .get<{ banners: Banner[] }>('/banners', {
        auth: false,
        revalidate: 60,
        ...(position ? { params: { position } } : {}),
      })
      .then((r) => r.banners ?? []),

  listGrouped: async (): Promise<BannersByPosition> => {
    const banners = await http
      .get<{ banners: Banner[] }>('/banners', { auth: false, revalidate: 60 })
      .then((r) => r.banners ?? [])

    return banners.reduce((acc, b) => {
      acc[b.position].push(b)
      return acc
    }, emptyBannersByPosition())
  },
}
