'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { cartApi } from '@/features/cart/api'
import { ApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/auth-context'
import type { Cart } from '@/features/cart/types'

interface CartContextValue {
  cart: Cart | null
  /** Số dòng sản phẩm trong giỏ (backend đếm cartItem, không cộng dồn quantity) */
  itemCount: number
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  addItem: (variantId: string, quantity: number) => Promise<void>
  updateQuantity: (itemId: string, quantity: number) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  clear: () => Promise<void>
}

const CartContext = createContext<CartContextValue | null>(null)

interface CartState {
  /** Dữ liệu này thuộc về user nào — dùng để biết đã đồng bộ hay chưa */
  userId: string | null
  cart: Cart | null
  count: number
  error: string | null
}

const EMPTY: CartState = { userId: null, cart: null, count: 0, error: null }

function messageOf(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, isAuthenticated } = useAuth()
  const [state, setState] = useState<CartState>(EMPTY)

  const uid = user?.id ?? null
  const synced = state.userId === uid
  // Không setState trong effect để reset khi logout — cứ suy ra từ auth.
  const loading = authLoading || (isAuthenticated && !synced)

  useEffect(() => {
    if (authLoading || !uid || state.userId === uid) return

    let cancelled = false
    cartApi
      .get()
      .then((cart) => {
        if (cancelled) return
        setState({ userId: uid, cart, count: cart.items.length, error: null })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({
          userId: uid,
          cart: null,
          count: 0,
          error: messageOf(err, 'Không tải được giỏ hàng'),
        })
      })

    return () => {
      cancelled = true
    }
  }, [authLoading, uid, state.userId])

  const refresh = useCallback(async () => {
    if (!uid) return
    try {
      const cart = await cartApi.get()
      setState({ userId: uid, cart, count: cart.items.length, error: null })
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: messageOf(err, 'Không tải được giỏ hàng'),
      }))
    }
  }, [uid])

  const addItem = useCallback(
    async (variantId: string, quantity: number) => {
      const summary = await cartApi.addItem({ variantId, quantity })
      setState((prev) => ({ ...prev, count: summary.itemCount, error: null }))
      // Đã mở sẵn giỏ ở đâu đó → nạp lại để có thông tin item vừa thêm
      // (mutation chỉ trả itemCount, không trả item).
      if (state.cart) await refresh()
    },
    [refresh, state.cart],
  )

  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    const summary = await cartApi.updateItem(itemId, { quantity })
    // Biết chính xác thay đổi → sửa tại chỗ, khỏi gọi lại GET /cart.
    setState((prev) => ({
      ...prev,
      count: summary.itemCount,
      error: null,
      cart: prev.cart
        ? {
            ...prev.cart,
            items: prev.cart.items.map((item) =>
              item.id === itemId ? { ...item, quantity } : item,
            ),
          }
        : prev.cart,
    }))
  }, [])

  const removeItem = useCallback(async (itemId: string) => {
    const summary = await cartApi.removeItem(itemId)
    setState((prev) => ({
      ...prev,
      count: summary.itemCount,
      error: null,
      cart: prev.cart
        ? { ...prev.cart, items: prev.cart.items.filter((i) => i.id !== itemId) }
        : prev.cart,
    }))
  }, [])

  const clear = useCallback(async () => {
    await cartApi.clear()
    setState((prev) => ({
      ...prev,
      count: 0,
      error: null,
      cart: prev.cart ? { ...prev.cart, items: [] } : prev.cart,
    }))
  }, [])

  return (
    <CartContext.Provider
      value={{
        // Chưa đăng nhập thì luôn là giỏ rỗng, kể cả state cũ còn sót lại
        cart: isAuthenticated ? state.cart : null,
        itemCount: isAuthenticated ? state.count : 0,
        loading,
        error: isAuthenticated ? state.error : null,
        refresh,
        addItem,
        updateQuantity,
        removeItem,
        clear,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart phải dùng bên trong <CartProvider>')
  return ctx
}
