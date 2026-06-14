import { http } from '@/lib/api/http'
import { objectToFormData } from '@/lib/utils/file'
import {
  emptyBannersByPosition,
  type Banner,
  type BannerPayload,
  type BannerPosition,
  type BannersByPosition,
} from './types'

// Public: /banners — backend bọc { banners } / { banner } → unwrap tại đây.
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

const toForm = (body: Partial<BannerPayload>, image?: File) =>
  objectToFormData(body, { field: 'image', value: image })

// Admin: /admin/banners (STAFF + ADMIN)
export const adminBannerApi = {
  list: (position?: BannerPosition) =>
    http
      .get<{ banners: Banner[] }>('/admin/banners', {
        ...(position ? { params: { position } } : {}),
      })
      .then((r) => r.banners ?? []),

  create: (body: BannerPayload, image: File) =>
    http.post<{ banner: Banner }>('/admin/banners', toForm(body, image)).then((r) => r.banner),

  update: (id: string, body: Partial<BannerPayload>, image?: File) =>
    http.put<{ banner: Banner }>(`/admin/banners/${id}`, toForm(body, image)).then((r) => r.banner),

  remove: (id: string) => http.delete<{ message: string }>(`/admin/banners/${id}`),

  toggleStatus: (id: string) =>
    http.patch<{ banner: Banner }>(`/admin/banners/${id}/status`).then((r) => r.banner),
}
