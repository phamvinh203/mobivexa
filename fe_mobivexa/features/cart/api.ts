import { http } from '@/lib/api/http'
import type { Cart, CartSummary, AddItemPayload, UpdateItemPayload } from './types'

// Khớp src/routes/cart.route.ts — prefix /cart (yêu cầu đăng nhập).
// Backend bọc mọi response trong { cart } (xem cart.controller.ts) → unwrap tại
// đây. Lưu ý: chỉ GET /cart trả giỏ đầy đủ; add/update/remove trả lean
// { cartId, itemCount } để FE cập nhật badge mà không phải join lại toàn bộ.
export const cartApi = {
  get: () => http.get<{ cart: Cart }>('/cart').then((r) => r.cart),

  addItem: (body: AddItemPayload) =>
    http
      .post<{ message: string; cart: CartSummary }>('/cart/items', body)
      .then((r) => r.cart),

  updateItem: (itemId: string, body: UpdateItemPayload) =>
    http
      .put<{ message: string; cart: CartSummary }>(`/cart/items/${itemId}`, body)
      .then((r) => r.cart),

  removeItem: (itemId: string) =>
    http
      .delete<{ message: string; cart: CartSummary }>(`/cart/items/${itemId}`)
      .then((r) => r.cart),

  clear: () => http.delete<{ message: string }>('/cart'),
}
