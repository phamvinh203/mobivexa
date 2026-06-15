import { http } from '@/lib/api/http'
import { assertImageFiles } from '@/lib/utils/file'
import type {
  Product,
  ProductVariant,
  ProductListQuery,
  AdminProductListQuery,
  AdminProductListResult,
  ProductPayload,
  VariantPayload,
  UpdateStockPayload,
} from './types'

// Khớp src/routes/product.route.ts. Backend bọc response: { products } / { product }
// (sendSuccess(res, { products }) — xem be_mobivexa/src/controllers). Unwrap tại đây
// để mọi consumer nhận thẳng Product[] / Product.
export const productApi = {
  // Public: /products — cache 60s (catalog ít thay đổi theo giây)
  list: (query?: ProductListQuery) =>
    http
      .get<{ products: Product[] }>('/products', { auth: false, params: query, revalidate: 60 })
      .then((r) => r.products ?? []),
  featured: () =>
    http
      .get<{ products: Product[] }>('/products/featured', { auth: false, revalidate: 300 })
      .then((r) => r.products ?? []),
  getBySlug: (slug: string) =>
    http
      .get<{ product: Product }>(`/products/${slug}`, { auth: false, revalidate: 60 })
      .then((r) => r.product),
}

// Admin: /admin/products (STAFF + ADMIN). Backend bọc { products, pagination } /
// { product } → unwrap tại đây (khớp pattern brand/category).
export const adminProductApi = {
  list: (query?: AdminProductListQuery) =>
    http.get<AdminProductListResult>('/admin/products', { params: query }),

  get: (id: string) =>
    http.get<{ product: Product }>(`/admin/products/${id}`).then((r) => r.product),

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
    http.patch<{ product: Product }>(`/admin/products/${id}/status`).then((r) => r.product),
  toggleFeatured: (id: string) =>
    http.patch<{ product: Product }>(`/admin/products/${id}/featured`).then((r) => r.product),

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

  // Variants — backend bọc { message, variant } → unwrap tại đây
  createVariant: (id: string, body: VariantPayload) =>
    http.post<{ variant: ProductVariant }>(`/admin/products/${id}/variants`, body).then((r) => r.variant),
  updateVariant: (id: string, variantId: string, body: Partial<VariantPayload>) =>
    http.put<{ variant: ProductVariant }>(`/admin/products/${id}/variants/${variantId}`, body).then((r) => r.variant),
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
