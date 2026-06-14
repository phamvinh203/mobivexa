import { http } from '@/lib/api/http'
import { assertImageFile } from '@/lib/utils/file'
import type { ListQuery } from '@/types/api'
import type { Brand, BrandPayload } from './types'

// Khớp src/routes/brand.route.ts. Backend bọc { brands } / { brand } → unwrap tại đây.
export const brandApi = {
  // Public: /brands — cache 5 phút (thương hiệu rất ít đổi)
  list: () =>
    http.get<{ brands: Brand[] }>('/brands', { auth: false, revalidate: 300 }).then((r) => r.brands ?? []),
  getBySlug: (slug: string) =>
    http.get<{ brand: Brand }>(`/brands/${slug}`, { auth: false, revalidate: 300 }).then((r) => r.brand),
}

// Admin: /admin/brands (STAFF + ADMIN)
export const adminBrandApi = {
  list: (query?: ListQuery) =>
    http.get<Brand[]>('/admin/brands', { params: query }),

  create: (body: BrandPayload, logo?: File) => {
    if (logo) assertImageFile(logo)
    const form = new FormData()
    form.append('name', body.name)
    if (body.description) form.append('description', body.description)
    if (logo) form.append('logo', logo)
    return http.post<Brand>('/admin/brands', form)
  },

  update: (id: string, body: BrandPayload, logo?: File) => {
    if (logo) assertImageFile(logo)
    const form = new FormData()
    if (body.name) form.append('name', body.name)
    if (body.description != null) form.append('description', body.description)
    if (logo) form.append('logo', logo)
    return http.put<Brand>(`/admin/brands/${id}`, form)
  },

  remove: (id: string) =>
    http.delete<{ message: string }>(`/admin/brands/${id}`),
  toggleStatus: (id: string) =>
    http.patch<Brand>(`/admin/brands/${id}/status`),
}
