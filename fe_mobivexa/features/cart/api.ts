import { http } from '@/lib/api/http'
import type { Cart, AddItemPayload, UpdateItemPayload } from './types'

// Khớp src/routes/cart.route.ts — prefix /cart (yêu cầu đăng nhập)
export const cartApi = {
  get: () => http.get<Cart>('/cart'),
  addItem: (body: AddItemPayload) => http.post<Cart>('/cart/items', body),
  updateItem: (itemId: string, body: UpdateItemPayload) =>
    http.put<Cart>(`/cart/items/${itemId}`, body),
  removeItem: (itemId: string) =>
    http.delete<Cart>(`/cart/items/${itemId}`),
  clear: () => http.delete<{ message: string }>('/cart'),
}
