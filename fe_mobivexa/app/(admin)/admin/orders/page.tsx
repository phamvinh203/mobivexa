'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { FilterChip } from '@/components/ui/filter-chip'
import { ApiError } from '@/lib/api/http'
import { formatVND } from '@/lib/utils/format'
import { adminOrderApi } from '@/features/orders/api'
import type { AdminOrder } from '@/features/orders/types'
import { ORDER_STATUS_META, PAYMENT_STATUS_META } from '@/features/orders/types'
import { OrderStatus, PaymentStatus, type PaginationMeta } from '@/types/api'

const PAGE_SIZE = 15
const EMPTY_PAGINATION: PaginationMeta = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 }

type StatusFilter = 'ALL' | OrderStatus
type PaymentFilter = 'ALL' | PaymentStatus

export default function AdminOrdersPage() {
  const [result, setResult] = useState<{ orders: AdminOrder[]; pagination: PaginationMeta } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('ALL')
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await adminOrderApi.list({
        page,
        limit: PAGE_SIZE,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        paymentStatus: paymentFilter === 'ALL' ? undefined : paymentFilter,
      })
      setResult(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được danh sách đơn hàng')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, paymentFilter])

  useEffect(() => {
    void load()
  }, [load])

  const resetPage = () => setPage(1)

  const orders = result?.orders ?? []
  const pagination = result?.pagination ?? EMPTY_PAGINATION

  const rangeLabel = useMemo(() => {
    if (pagination.total === 0) return 'Không có đơn hàng'
    const from = (pagination.page - 1) * pagination.limit + 1
    const to = Math.min(pagination.page * pagination.limit, pagination.total)
    return `${from}–${to} / ${pagination.total}`
  }, [pagination])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Quản lý Đơn hàng</h1>
        <p className="text-sm text-gray-500">Theo dõi và cập nhật trạng thái đơn hàng.</p>
      </div>

      {/* Filter: trạng thái */}
      <FilterRow
        label="Trạng thái"
        values={Object.values(OrderStatus) as OrderStatus[]}
        meta={ORDER_STATUS_META}
        value={statusFilter}
        onChange={(s) => {
          setStatusFilter(s)
          resetPage()
        }}
      />
      <FilterRow
        label="Thanh toán"
        values={Object.values(PaymentStatus) as PaymentStatus[]}
        meta={PAYMENT_STATUS_META}
        value={paymentFilter}
        onChange={(p) => {
          setPaymentFilter(p)
          resetPage()
        }}
      />

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>
      )}

      {/* Bảng */}
      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Mã đơn</th>
                <th className="px-4 py-3 font-medium">Khách hàng</th>
                <th className="px-4 py-3 text-right font-medium">Tổng</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">Thanh toán</th>
                <th className="px-4 py-3 font-medium">Ngày đặt</th>
                <th className="px-4 py-3 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">Đang tải...</td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">Không có đơn hàng phù hợp.</td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <code className="font-mono text-xs font-medium text-gray-700">{order.orderCode}</code>
                      <div className="text-xs text-gray-400">{order._count?.items ?? order.items?.length ?? 0} mặt hàng</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{order.shippingName}</div>
                      <div className="text-xs text-gray-400">{order.user?.email ?? order.shippingPhone}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">{formatVND(order.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_META[order.status].badgeClass}`}>
                        {ORDER_STATUS_META[order.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_STATUS_META[order.paymentStatus].badgeClass}`}>
                        {PAYMENT_STATUS_META[order.paymentStatus].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                        title="Xem chi tiết"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <span className="text-gray-500">{rangeLabel}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={pagination.page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Trước
              </Button>
              <span className="px-2 text-gray-600">{pagination.page} / {pagination.totalPages}</span>
              <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                Sau
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Hàng filter chips dùng chung (status / payment) ──────────────────────────

function FilterRow<T extends string>({
  label,
  values,
  meta,
  value,
  onChange,
}: {
  label: string
  values: readonly T[]
  meta: Record<T, { label: string }>
  value: 'ALL' | T
  onChange: (v: 'ALL' | T) => void
}) {
  const options = ['ALL', ...values] as ('ALL' | T)[]
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</span>
      {options.map((v) => (
        <FilterChip
          key={v}
          active={value === v}
          label={v === 'ALL' ? 'Tất cả' : meta[v as T].label}
          onClick={() => onChange(v)}
        />
      ))}
    </div>
  )
}

