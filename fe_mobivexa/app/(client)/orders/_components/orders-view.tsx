'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, PackageSearch, TriangleAlert } from 'lucide-react'
import { orderApi } from '@/features/orders/api'
import { ORDER_STATUS_META, type Order } from '@/features/orders/types'
import { OrderStatus } from '@/types/api'
import { Pagination } from '@/components/ui/pagination'
import { ApiError } from '@/lib/api/http'
import type { PaginationMeta } from '@/types/api'
import { OrderCard } from './order-card'

/** Tab lọc: "Tất cả" + từng trạng thái, đúng thứ tự vòng đời đơn hàng. */
const TABS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: OrderStatus.PENDING, label: ORDER_STATUS_META.PENDING.label },
  { value: OrderStatus.CONFIRMED, label: ORDER_STATUS_META.CONFIRMED.label },
  { value: OrderStatus.SHIPPING, label: ORDER_STATUS_META.SHIPPING.label },
  { value: OrderStatus.DELIVERED, label: ORDER_STATUS_META.DELIVERED.label },
  { value: OrderStatus.CANCELLED, label: ORDER_STATUS_META.CANCELLED.label },
]

const EMPTY_META: PaginationMeta = { page: 1, limit: 10, total: 0, totalPages: 0 }

/** Kết quả kèm "khoá" tạo ra nó (tab:page:nonce). So khoá với request hiện tại
 *  để suy ra trạng thái loading — không phải setState(true) trong effect (thứ
 *  react-hooks/set-state-in-effect cấm). nonce dùng để "Thử lại" ép fetch lại. */
interface LoadState {
  key: string
  orders: Order[]
  meta: PaginationMeta
  error: string | null
}

export function OrdersView() {
  const [tab, setTab] = useState<OrderStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [nonce, setNonce] = useState(0)
  const [state, setState] = useState<LoadState>({
    key: '',
    orders: [],
    meta: EMPTY_META,
    error: null,
  })

  const requestKey = `${tab}:${page}:${nonce}`
  const loading = state.key !== requestKey
  const { orders, meta, error } = state

  useEffect(() => {
    let cancelled = false

    orderApi
      .listMinePaged({ page, status: tab === 'all' ? undefined : tab })
      .then((res) => {
        if (cancelled) return
        setState({
          key: requestKey,
          orders: res.orders ?? [],
          meta: res.pagination ?? EMPTY_META,
          error: null,
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({
          key: requestKey,
          orders: [],
          meta: EMPTY_META,
          error: err instanceof ApiError ? err.message : 'Không tải được đơn hàng',
        })
      })

    return () => {
      cancelled = true
    }
  }, [requestKey, tab, page])

  function selectTab(value: OrderStatus | 'all') {
    if (value === tab) return
    setTab(value)
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Tab lọc trạng thái ─────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <div
          role="tablist"
          aria-label="Lọc theo trạng thái"
          className="inline-flex gap-1 rounded-xl border border-border bg-white p-1"
        >
          {TABS.map((t) => {
            const active = t.value === tab
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectTab(t.value)}
                className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Nội dung ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid min-h-[30vh] place-items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          <p className="text-sm">Đang tải đơn hàng...</p>
        </div>
      ) : error ? (
        <div className="grid place-items-center gap-3 rounded-2xl border border-border bg-white py-16 text-center">
          <TriangleAlert className="h-9 w-9 text-[var(--color-danger)]" aria-hidden />
          <p className="font-semibold text-gray-800">{error}</p>
          <button
            type="button"
            onClick={() => setNonce((n) => n + 1)}
            className="rounded-xl border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-light)]"
          >
            Thử lại
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-2xl border border-border bg-white py-16 text-center">
          <PackageSearch className="h-10 w-10 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-semibold text-gray-800">
              {tab === 'all'
                ? 'Bạn chưa có đơn hàng nào'
                : 'Không có đơn ở trạng thái này'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {tab === 'all'
                ? 'Hãy chọn sản phẩm và đặt đơn đầu tiên của bạn.'
                : 'Thử chọn một trạng thái khác ở phía trên.'}
            </p>
          </div>
          {tab === 'all' && (
            <Link
              href="/products"
              className="mt-1 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-accent)] px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Mua sắm ngay
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onUpdated={(updated) =>
                  setState((prev) => ({
                    ...prev,
                    orders: prev.orders.map((o) =>
                      o.id === updated.id ? updated : o,
                    ),
                  }))
                }
              />
            ))}
          </div>

          <Pagination
            meta={meta}
            loading={loading}
            emptyLabel=""
            onChange={setPage}
            className="rounded-xl border border-border bg-white"
          />
        </>
      )}
    </div>
  )
}
