import type { Product } from './types'

/** Ảnh bìa của sản phẩm: ưu tiên ảnh isCover, fallback ảnh đầu tiên. */
export function coverImageUrl(product: Product): string | undefined {
  return (
    product.images?.find((i) => i.isCover)?.url ?? product.images?.[0]?.url
  )
}
