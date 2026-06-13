import type { ProductVariant, Product } from '../products/types'

export interface CartItem {
  id: string
  cartId: string
  variantId: string
  quantity: number
  variant: ProductVariant & { product?: Product }
}

export interface Cart {
  id: string
  userId: string
  items: CartItem[]
}

export interface AddItemPayload {
  variantId: string
  quantity: number
}

export interface UpdateItemPayload {
  quantity: number
}
