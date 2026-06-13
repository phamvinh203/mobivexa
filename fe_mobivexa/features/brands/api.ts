import { http } from '@/lib/api/http'
import type { ListQuery } from '@/types/api'
import type { Brand, BrandPayload } from './types'

// Khớp src/routes/brand.route.ts
export const brandApi = {
  // Public: /brands — cache 5 phút (thương hiệu rất ít đổi)
  list: () => http.get<Brand[]>('/brands', { auth: false, revalidate: 300 }),
  getBySlug: (slug: string) =>
    http.get<Brand>(`/brands/${slug}`, { auth: false, revalidate: 300 }),
}

// Admin: /admin/brands (STAFF + ADMIN)
export const adminBrandApi = {
  list: (query?: ListQuery) =>
    http.get<Brand[]>('/admin/brands', { params: query }),

  create: (body: BrandPayload, logo?: File) => {
    const form = new FormData()
    form.append('name', body.name)
    if (body.description) form.append('description', body.description)
    if (logo) form.append('logo', logo)
    return http.post<Brand>('/admin/brands', form)
  },

  update: (id: string, body: BrandPayload, logo?: File) => {
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
