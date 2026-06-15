'use client'

import { useState } from 'react'
import type { ComponentType } from 'react'
import Link from 'next/link'
import {
  Wallet,
  Clock,
  Undo2,
  Landmark,
  ChevronRight,
  RefreshCw,
  type LucideProps,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, buttonVariants } from '@/components/ui/button'
import { Loading } from '@/components/ui/loading'
import { consolidateApiError } from '@/lib/utils/error'
import { ApiError } from '@/lib/api/http'
import { formatVND, formatDateTime } from '@/lib/utils/format'
import { paymentApi } from '@/features/payment/api'
import type { PaymentStats } from '@/features/payment/types'
import { adminOrderApi } from '@/features/orders/api'
import type { AdminOrder } from '@/features/orders/types'
import { PaymentMethod, PaymentStatus } from '@/types/api'

const AWAITING_LIMIT = 10

export default function AdminPaymentPage() {
  const queryClient = useQueryClient()

  const [error, setError] = useState('')

  // Stats tổng hợp
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<PaymentStats>({
    queryKey: ['admin-payment-stats'],
    queryFn: () => paymentApi.getStats(),
  })

  // Danh sách đơn CK đang chờ đối soát (UNPAID + BANK_TRANSFER)
  const { data: awaitingData, isLoading: awaitingLoading, error: awaitingError } = useQuery<{ orders: AdminOrder[] }>({
    queryKey: ['admin-payment-awaiting'],
    queryFn: () => adminOrderApi.list({
      page: 1,
      limit: AWAITING_LIMIT,
      paymentStatus: PaymentStatus.UNPAID,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
    }),
  })

  const awaiting = awaitingData?.orders ?? []
  const loading = statsLoading || awaitingLoading
  const errorMsg = consolidateApiError(
    error,
    statsError || awaitingError,
    'thống kê thanh toán'
  )

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['admin-payment-stats'] })
    queryClient.invalidateQueries({ queryKey: ['admin-payment-awaiting'] })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Giám sát thanh toán SePay</h1>
          <p className="text-sm text-gray-500">
            Theo dõi doanh thu, công nợ & đối soát đơn chuyển khoản.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={loading} onClick={handleRefresh}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {([
          {
            icon: Wallet,
            label: 'Doanh thu đã thu',
            value: formatVND(stats?.revenue ?? 0),
            hint: 'Tổng đơn đã thanh toán',
            variant: 'emerald',
          },
          {
            icon: Clock,
            label: 'Chờ thanh toán',
            value: formatVND(stats?.pending.amount ?? 0),
            hint: `${stats?.pending.count ?? 0} đơn chưa thanh toán`,
            variant: 'amber',
          },
          {
            icon: Landmark,
            label: 'Chờ đối soát CK',
            value: formatVND(stats?.awaitingBankTransfer.amount ?? 0),
            hint: `${stats?.awaitingBankTransfer.count ?? 0} đơn chờ webhook SePay`,
            variant: 'sky',
          },
          {
            icon: Undo2,
            label: 'Đã hoàn tiền',
            value: formatVND(stats?.refunded.amount ?? 0),
            hint: `${stats?.refunded.count ?? 0} đơn hoàn tiền`,
            variant: 'rose',
          },
        ] as StatCardData[]).map(({ icon, label, value, hint, variant }) => (
          <StatCard
            key={label}
            icon={icon}
            label={label}
            value={value}
            hint={hint}
            variant={variant}
            loading={loading}
          />
        ))}
      </div>

      {/* Awaiting-payment list */}
      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-border">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="font-medium text-gray-800">Đơn chuyển khoản chờ đối soát</h2>
            <p className="text-xs text-gray-400">
              Đơn BANK_TRANSFER chưa nhận được webhook xác nhận từ SePay.
            </p>
          </div>
          <Link
            href="/admin/orders"
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            Xem tất cả
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Mã đơn</th>
                <th className="px-4 py-3 font-medium">Khách hàng</th>
                <th className="px-4 py-3 text-right font-medium">Số tiền</th>
                <th className="px-4 py-3 font-medium">Ngày đặt</th>
                <th className="px-4 py-3 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <Loading.TableRow colSpan={5} message="Đang tải..." />
              ) : awaiting.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                    Không có đơn chuyển khoản nào đang chờ đối soát.
                  </td>
                </tr>
              ) : (
                awaiting.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <code className="font-mono text-xs font-medium text-gray-700">{order.orderCode}</code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{order.shippingName}</div>
                      <div className="text-xs text-gray-400">{order.user?.email ?? order.shippingPhone}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">{formatVND(order.total)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDateTime(order.createdAt)}</td>
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
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

// Cặp màu nền + chữ cho icon, gom 1 chỗ để call site chỉ truyền 1 `variant`.
const STAT_VARIANTS = {
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  sky: 'bg-sky-50 text-sky-600',
  rose: 'bg-rose-50 text-rose-600',
} as const

// Dữ liệu 1 thẻ (không gồm `loading` — do trang truyền chung).
interface StatCardData {
  icon: ComponentType<LucideProps>
  label: string
  value: string
  hint: string
  variant: keyof typeof STAT_VARIANTS
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  variant,
  loading,
}: StatCardData & { loading: boolean }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-border">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${STAT_VARIANTS[variant]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
          <p className="truncate text-lg font-bold text-gray-800">
            {loading ? '—' : value}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-400">{hint}</p>
    </div>
  )
}
