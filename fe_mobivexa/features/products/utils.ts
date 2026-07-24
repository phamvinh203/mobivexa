import type { Money } from '@/lib/utils/format'
import type { Tag } from '../tags/types'
import type { Product, ProductImage, ProductVariant } from './types'

/** Ảnh bìa của sản phẩm: ưu tiên ảnh isCover, fallback ảnh đầu tiên. */
export function coverImageUrl(product: Product): string | undefined {
  return (
    product.images?.find((i) => i.isCover)?.url ?? product.images?.[0]?.url
  )
}

/** Danh sách ảnh cho gallery: ảnh bìa lên đầu, phần còn lại giữ thứ tự sortOrder
 *  backend đã sắp. Bổ sung ảnh riêng của variant (imageUrl) nếu chưa có trong
 *  bộ ảnh sản phẩm — để chọn màu nào là thấy đúng ảnh màu đó. */
export function galleryImages(product: Product): { id: string; url: string }[] {
  const images = [...(product.images ?? [])].sort(
    (a, b) => Number(b.isCover) - Number(a.isCover),
  )
  const urls = new Set(images.map((i) => i.url))
  const gallery = images.map((i: ProductImage) => ({ id: i.id, url: i.url }))

  for (const v of product.variants ?? []) {
    if (v.imageUrl && !urls.has(v.imageUrl)) {
      urls.add(v.imageUrl)
      gallery.push({ id: `variant-${v.id}`, url: v.imageUrl })
    }
  }
  return gallery
}

/** Tag của sản phẩm — backend trả productTags[{ tag }], hỗ trợ luôn dạng tags[]
 *  phòng khi API đổi sang phẳng. */
export function productTagList(product: Product): Tag[] {
  if (product.tags?.length) return product.tags
  return (product.productTags ?? []).map((pt) => pt.tag)
}

/** Chỉ lấy variant còn bán được (isActive). Backend đã sort theo salePrice tăng dần. */
export function activeVariants(product: Product): ProductVariant[] {
  return (product.variants ?? []).filter((v) => v.isActive)
}

/** Khoảng giá bán của sản phẩm — dùng cho listing/SEO khi chưa chọn variant. */
export function priceRange(
  variants: ProductVariant[],
): { min: Money; max: Money } | null {
  if (variants.length === 0) return null
  const prices = variants.map((v) => Number(v.salePrice))
  return { min: Math.min(...prices), max: Math.max(...prices) }
}

/** Tổng tồn kho của các variant đang bán. */
export function totalStock(variants: ProductVariant[]): number {
  return variants.reduce((sum, v) => sum + v.stock, 0)
}
