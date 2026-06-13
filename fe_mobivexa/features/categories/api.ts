import { http } from '@/lib/api/http'
import { assertImageFile } from '@/lib/utils/file'
import type { ListQuery } from '@/types/api'
import type { Category, CategoryPayload } from './types'

// Khớp src/routes/category.route.ts. Backend bọc { categories } / { category } → unwrap tại đây.
export const categoryApi = {
  // Public: /categories — cache 5 phút (danh mục rất ít đổi)
  list: () =>
    http.get<{ categories: Category[] }>('/categories', { auth: false, revalidate: 300 }).then((r) => r.categories ?? []),
  getBySlug: (slug: string) =>
    http.get<{ category: Category }>(`/categories/${slug}`, { auth: false, revalidate: 300 }).then((r) => r.category),
}

// Admin: /admin/categories (STAFF + ADMIN)
export const adminCategoryApi = {
  list: (query?: ListQuery) =>
    http.get<Category[]>('/admin/categories', { params: query }),

  create: (body: CategoryPayload, image?: File) => {
    if (image) assertImageFile(image)
    const form = new FormData()
    form.append('name', body.name)
    if (body.description) form.append('description', body.description)
    if (body.parentId) form.append('parentId', body.parentId)
    if (body.sortOrder != null) form.append('sortOrder', String(body.sortOrder))
    if (image) form.append('image', image)
    return http.post<Category>('/admin/categories', form)
  },

  update: (id: string, body: CategoryPayload, image?: File) => {
    if (image) assertImageFile(image)
    const form = new FormData()
    if (body.name) form.append('name', body.name)
    if (body.description != null) form.append('description', body.description)
    if (body.parentId != null) form.append('parentId', body.parentId)
    if (body.sortOrder != null) form.append('sortOrder', String(body.sortOrder))
    if (image) form.append('image', image)
    return http.put<Category>(`/admin/categories/${id}`, form)
  },

  remove: (id: string) =>
    http.delete<{ message: string }>(`/admin/categories/${id}`),
  toggleStatus: (id: string) =>
    http.patch<Category>(`/admin/categories/${id}/status`),
}
