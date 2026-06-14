import { http } from '@/lib/api/http'
import { objectToFormData } from '@/lib/utils/file'
import type { Brand, BrandPayload } from './types'

// Khớp src/routes/brand.route.ts. Backend bọc { brands } / { brand } → unwrap tại đây.
export const brandApi = {
  // Public: /brands — cache 5 phút (thương hiệu rất ít đổi)
  list: () =>
    http.get<{ brands: Brand[] }>('/brands', { auth: false, revalidate: 300 }).then((r) => r.brands ?? []),
  getBySlug: (slug: string) =>
    http.get<{ brand: Brand }>(`/brands/${slug}`, { auth: false, revalidate: 300 }).then((r) => r.brand),
}

const toForm = (body: Partial<BrandPayload>, logo?: File) =>
  objectToFormData(body, { field: 'logo', value: logo })

// Admin: /admin/brands (STAFF + ADMIN)
export const adminBrandApi = {
  list: () =>
    http.get<{ brands: Brand[] }>('/admin/brands').then((r) => r.brands ?? []),

  create: (body: BrandPayload, logo?: File) =>
    http.post<{ brand: Brand }>('/admin/brands', toForm(body, logo)).then((r) => r.brand),

  update: (id: string, body: Partial<BrandPayload>, logo?: File) =>
    http.put<{ brand: Brand }>(`/admin/brands/${id}`, toForm(body, logo)).then((r) => r.brand),

  remove: (id: string) => http.delete<{ message: string }>(`/admin/brands/${id}`),

  toggleStatus: (id: string) =>
    http.patch<{ brand: Brand }>(`/admin/brands/${id}/status`).then((r) => r.brand),
}
