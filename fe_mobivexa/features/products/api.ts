import { http } from '@/lib/api/http'
import { assertImageFiles } from '@/lib/utils/file'
import type {
  Product,
  ProductVariant,
  ProductListQuery,
  ProductPayload,
  VariantPayload,
  UpdateStockPayload,
} from './types'

// Khớp src/routes/product.route.ts
export const productApi = {
  // Public: /products — cache 60s (catalog ít thay đổi theo giây)
  list: (query?: ProductListQuery) =>
    http.get<Product[]>('/products', { auth: false, params: query, revalidate: 60 }),
  featured: () =>
    http.get<Product[]>('/products/featured', { auth: false, revalidate: 300 }),
  getBySlug: (slug: string) =>
    http.get<Product>(`/products/${slug}`, { auth: false, revalidate: 60 }),
}

// Admin: /admin/products (STAFF + ADMIN)
export const adminProductApi = {
  // body có kiểu chặt ProductPayload → không cho phép inject field tuỳ ý
  create: (body: ProductPayload, images?: File[]) => {
    const form = buildProductForm(body, images)
    return http.post<Product>('/admin/products', form)
  },
  update: (id: string, body: Partial<ProductPayload>, images?: File[]) => {
    const form = buildProductForm(body, images)
    return http.put<Product>(`/admin/products/${id}`, form)
  },
  remove: (id: string) =>
    http.delete<{ message: string }>(`/admin/products/${id}`),
  toggleStatus: (id: string) =>
    http.patch<Product>(`/admin/products/${id}/status`),
  toggleFeatured: (id: string) =>
    http.patch<Product>(`/admin/products/${id}/featured`),

  // Images (buildProductForm tự validate ảnh)
  uploadImages: (id: string, images: File[]) =>
    http.post<Product>(
      `/admin/products/${id}/images`,
      buildProductForm({}, images),
    ),
  removeImage: (id: string, imageId: string) =>
    http.delete<{ message: string }>(`/admin/products/${id}/images/${imageId}`),
  setCover: (id: string, imageId: string) =>
    http.patch<Product>(`/admin/products/${id}/images/${imageId}/cover`),

  // Variants
  createVariant: (id: string, body: VariantPayload) =>
    http.post<ProductVariant>(`/admin/products/${id}/variants`, body),
  updateVariant: (id: string, variantId: string, body: Partial<VariantPayload>) =>
    http.put<ProductVariant>(`/admin/products/${id}/variants/${variantId}`, body),
  removeVariant: (id: string, variantId: string) =>
    http.delete<{ message: string }>(
      `/admin/products/${id}/variants/${variantId}`,
    ),
  updateStock: (id: string, variantId: string, body: UpdateStockPayload) =>
    http.patch<ProductVariant>(
      `/admin/products/${id}/variants/${variantId}/stock`,
      body,
    ),
}

function buildProductForm(body: object, images?: File[]): FormData {
  if (images?.length) assertImageFiles(images)
  const form = new FormData()
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue
    // mảng/object (variants, tagIds) → JSON string, backend tự parse
    form.append(
      key,
      typeof value === 'object' ? JSON.stringify(value) : String(value),
    )
  }
  images?.forEach((f) => form.append('images', f))
  return form
}
