'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { buttonVariants } from '@/components/ui/button'
import { FilterChip } from '@/components/ui/filter-chip'
import { AdminTable } from '@/components/ui/admin-table'
import { Pagination } from '@/components/ui/pagination'
import { consolidateApiError } from '@/lib/utils/error'
import { ApiError } from '@/lib/api/http'
import { formatVND, formatDate } from '@/lib/utils/format'
import { adminOrderApi } from '@/features/orders/api'
import type { AdminOrder } from '@/features/orders/types'
import { ORDER_STATUS_META, PAYMENT_STATUS_META } from '@/features/orders/types'
import { OrderStatus, PaymentStatus, type PaginationMeta } from '@/types/api'

const PAGE_SIZE = 15
const EMPTY_PAGINATION: PaginationMeta = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 }

type StatusFilter = 'ALL' | OrderStatus
type PaymentFilter = 'ALL' | PaymentStatus

const COLUMNS = [
  'Mã đơn', 'Khách hàng',
  { label: 'Tổng', className: 'text-right' },
  'Trạng thái', 'Thanh toán', 'Ngày đặt',
  { label: '', className: 'text-right' },
] as const

type OrdersData = { orders: AdminOrder[]; pagination: PaginationMeta }

export default function AdminOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('ALL')
  const [page, setPage] = useState(1)

  const ordersKey = ['admin-orders', page, statusFilter, paymentFilter]

  const { data, isLoading, error: fetchError } = useQuery<OrdersData>({
    queryKey: ordersKey,
    queryFn: () => adminOrderApi.list({
      page,
      limit: PAGE_SIZE,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      paymentStatus: paymentFilter === 'ALL' ? undefined : paymentFilter,
    }),
  })

  const resetPage = () => setPage(1)

  const orders = data?.orders ?? []
  const pagination = data?.pagination ?? EMPTY_PAGINATION
  const errorMsg = consolidateApiError('', fetchError, 'đơn hàng')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Quản lý Đơn hàng</h1>
        <p className="text-sm text-gray-500">Theo dõi và cập nhật trạng thái đơn hàng.</p>
      </div>

      <FilterRow
        label="Trạng thái"
        values={Object.values(OrderStatus) as OrderStatus[]}
        meta={ORDER_STATUS_META}
        value={statusFilter}
        onChange={(s) => { setStatusFilter(s); resetPage() }}
      />
      <FilterRow
        label="Thanh toán"
        values={Object.values(PaymentStatus) as PaymentStatus[]}
        meta={PAYMENT_STATUS_META}
        value={paymentFilter}
        onChange={(p) => { setPaymentFilter(p); resetPage() }}
      />

      {errorMsg && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">{errorMsg}</div>
      )}

      <AdminTable
        columns={COLUMNS}
        colSpan={7}
        loading={isLoading}
        empty={orders.length === 0}
        emptyMessage="Không có đơn hàng phù hợp."
        scrollable
        footer={
          pagination.totalPages > 1
            ? <Pagination meta={pagination} loading={isLoading} emptyLabel="Không có đơn hàng" onChange={setPage} />
            : undefined
        }
      >
        {orders.map((order) => (
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
            <td className="px-4 py-3 text-gray-600">{formatDate(order.createdAt)}</td>
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
        ))}
      </AdminTable>
    </div>
  )
}

// ─── Filter row ───────────────────────────────────────────────────────────────

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
