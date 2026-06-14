import { http } from '@/lib/api/http'
import { objectToFormData } from '@/lib/utils/file'
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

const toForm = (body: Partial<CategoryPayload>, image?: File) =>
  objectToFormData(body, { field: 'image', value: image })

// Admin: /admin/categories (STAFF + ADMIN)
export const adminCategoryApi = {
  list: (query?: ListQuery) =>
    http.get<{ categories: Category[] }>('/admin/categories', { params: query }).then((r) => r.categories ?? []),

  create: (body: CategoryPayload, image?: File) =>
    http.post<{ category: Category }>('/admin/categories', toForm(body, image)).then((r) => r.category),

  update: (id: string, body: Partial<CategoryPayload>, image?: File) =>
    http.put<{ category: Category }>(`/admin/categories/${id}`, toForm(body, image)).then((r) => r.category),

  remove: (id: string) =>
    http.delete<{ message: string }>(`/admin/categories/${id}`),

  toggleStatus: (id: string) =>
    http.patch<{ category: Category }>(`/admin/categories/${id}/status`).then((r) => r.category),
}
