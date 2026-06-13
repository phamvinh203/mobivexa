import { http } from '@/lib/api/http'
import type {
  Product,
  ProductVariant,
  ProductListQuery,
  VariantPayload,
  UpdateStockPayload,
} from './types'

// Khớp src/routes/product.route.ts
export const productApi = {
  // Public: /products
  list: (query?: ProductListQuery) =>
    http.get<Product[]>('/products', { auth: false, params: query }),
  featured: () => http.get<Product[]>('/products/featured', { auth: false }),
  getBySlug: (slug: string) =>
    http.get<Product>(`/products/${slug}`, { auth: false }),
}

// Admin: /admin/products (STAFF + ADMIN)
export const adminProductApi = {
  // body JSON + ảnh: backend nhận multipart 'images' (tối đa 10)
  create: (body: Record<string, unknown>, images?: File[]) => {
    const form = buildProductForm(body, images)
    return http.post<Product>('/admin/products', form)
  },
  update: (id: string, body: Record<string, unknown>, images?: File[]) => {
    const form = buildProductForm(body, images)
    return http.put<Product>(`/admin/products/${id}`, form)
  },
  remove: (id: string) =>
    http.delete<{ message: string }>(`/admin/products/${id}`),
  toggleStatus: (id: string) =>
    http.patch<Product>(`/admin/products/${id}/status`),
  toggleFeatured: (id: string) =>
    http.patch<Product>(`/admin/products/${id}/featured`),

  // Images
  uploadImages: (id: string, images: File[]) =>
    http.post<Product>(`/admin/products/${id}/images`, buildProductForm({}, images)),
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

function buildProductForm(
  body: Record<string, unknown>,
  images?: File[],
): FormData {
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
