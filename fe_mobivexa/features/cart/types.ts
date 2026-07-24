import type { ProductVariant } from '../products/types'

/** Sản phẩm kèm theo trong giỏ — backend chỉ select id/name/slug + 1 ảnh bìa
 *  (CART_INCLUDE trong be_mobivexa/src/services/cart.service.ts), KHÔNG phải
 *  Product đầy đủ. Ảnh cũng chỉ có { url }. */
export interface CartProduct {
  id: string
  name: string
  slug: string
  images: { url: string }[]
}

export interface CartItem {
  id: string
  cartId: string
  variantId: string
  quantity: number
  createdAt: string
  variant: ProductVariant & { product: CartProduct }
}

export interface Cart {
  id: string
  userId: string
  createdAt: string
  updatedAt: string
  items: CartItem[]
}

/** Kết quả các mutation (add/update/remove) — backend cố tình trả lean để FE
 *  cập nhật badge mà không phải join lại 4 cấp. KHÔNG chứa danh sách item. */
export interface CartSummary {
  cartId: string
  itemCount: number
}

export interface AddItemPayload {
  variantId: string
  quantity: number
}

export interface UpdateItemPayload {
  quantity: number
}

/** Giới hạn của checkQuantity() bên backend — số nguyên trong [1, 100]. */
export const MIN_CART_QUANTITY = 1
export const MAX_CART_QUANTITY = 100
