'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, Link2, Search, X } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FilterChip } from '@/components/ui/filter-chip'
import { AdminTable } from '@/components/ui/admin-table'
import { Pagination } from '@/components/ui/pagination'
import { Loading } from '@/components/ui/loading'
import { consolidateApiError } from '@/lib/utils/error'
import { formatVND, formatDateTime } from '@/lib/utils/format'
import { adminPaymentApi } from '@/features/payment/api'
import {
  SePayTxStatus,
  SEPAY_TX_STATUS_META,
  TX_SOURCE_META,
  type SePayTransaction,
  type TransactionListResult,
} from '@/features/payment/types'
import type { PaginationMeta } from '@/types/api'
import { MatchTransactionModal } from './match-transaction-modal'

const PAGE_SIZE = 15
const EMPTY_PAGINATION: PaginationMeta = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 }

type StatusFilter = 'ALL' | SePayTxStatus

const COLUMNS = [
  'Thời gian',
  { label: 'Số tiền', className: 'text-right' },
  'Nội dung CK',
  'Đơn hàng',
  'Trạng thái',
  'Nguồn',
  { label: '', className: 'text-right' },
] as const

export default function AdminTransactionsPage() {
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [page, setPage] = useState(1)
  // searchInput = giá trị đang gõ; search = giá trị đã submit (tránh gọi API mỗi phím)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [matching, setMatching] = useState<SePayTransaction | null>(null)

  const { data, isLoading, error: fetchError } = useQuery<TransactionListResult>({
    queryKey: ['admin-payment', 'transactions', page, statusFilter, search],
    queryFn: () =>
      adminPaymentApi.listTransactions({
        page,
        limit: PAGE_SIZE,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        orderCode: search || undefined,
      }),
  })

  const transactions = data?.transactions ?? []
  const pagination = data?.pagination ?? EMPTY_PAGINATION
  const errorMsg = consolidateApiError(null, fetchError, 'giao dịch')

  const resetPage = () => setPage(1)

  function handleSearch(e: FormEvent) {
    e.preventDefault()
    setSearch(searchInput.trim().toUpperCase())
    resetPage()
  }

  function clearSearch() {
    setSearchInput('')
    setSearch('')
    resetPage()
  }

  // Gán tay xong → refetch cả stats lẫn danh sách (đơn vừa đổi sang PAID)
  function handleMatched() {
    setMatching(null)
    queryClient.invalidateQueries({ queryKey: ['admin-payment'] })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/payment"
            className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-2 mb-1' })}
          >
            <ArrowLeft className="h-4 w-4" />
            Giám sát thanh toán
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Sổ cái giao dịch SePay</h1>
          <p className="text-sm text-gray-500">
            Toàn bộ giao dịch nhận từ webhook &amp; đồng bộ — dùng để tra cứu và đối soát.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
          Trạng thái
        </span>
        {(['ALL', ...Object.values(SePayTxStatus)] as StatusFilter[]).map((v) => (
          <FilterChip
            key={v}
            active={statusFilter === v}
            label={v === 'ALL' ? 'Tất cả' : SEPAY_TX_STATUS_META[v].label}
            onClick={() => {
              setStatusFilter(v)
              resetPage()
            }}
          />
        ))}

        <form onSubmit={handleSearch} className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm theo mã đơn..."
              className="w-56 pl-8 font-mono uppercase"
            />
            {search && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100"
                aria-label="Xoá tìm kiếm"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button type="submit" variant="outline" size="sm">
            Tìm
          </Button>
        </form>
      </div>

      <Loading.ErrorMessage message={errorMsg} />

      <AdminTable
        columns={COLUMNS}
        colSpan={7}
        loading={isLoading}
        empty={transactions.length === 0}
        emptyMessage="Chưa có giao dịch nào phù hợp."
        scrollable
        footer={
          pagination.totalPages > 1 ? (
            <Pagination
              meta={pagination}
              loading={isLoading}
              emptyLabel="Không có giao dịch"
              onChange={setPage}
            />
          ) : undefined
        }
      >
        {transactions.map((tx) => (
          <tr key={tx.id} className="hover:bg-gray-50/60">
            <td className="px-4 py-3 text-gray-600">
              {formatDateTime(tx.transactionDate)}
              <div className="text-xs text-gray-400">{tx.gateway}</div>
            </td>
            <td className="px-4 py-3 text-right">
              <span
                className={
                  tx.transferType === 'in'
                    ? 'font-medium text-emerald-700'
                    : 'font-medium text-gray-500'
                }
              >
                {tx.transferType === 'in' ? '+' : '−'}
                {formatVND(tx.transferAmount)}
              </span>
            </td>
            <td className="max-w-[220px] px-4 py-3">
              <div className="truncate text-gray-600" title={tx.content}>
                {tx.content || '—'}
              </div>
              {tx.note && (
                <div className="truncate text-xs text-amber-700" title={tx.note}>
                  {tx.note}
                </div>
              )}
            </td>
            <td className="px-4 py-3">
              {tx.orderId ? (
                <Link
                  href={`/admin/orders/${tx.orderId}`}
                  className="font-mono text-xs font-medium text-[var(--color-primary)] hover:underline"
                >
                  {tx.orderCode}
                </Link>
              ) : tx.orderCode ? (
                <code className="font-mono text-xs text-gray-400">{tx.orderCode}</code>
              ) : (
                <span className="text-gray-300">—</span>
              )}
            </td>
            <td className="px-4 py-3">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${SEPAY_TX_STATUS_META[tx.status].badgeClass}`}
              >
                {SEPAY_TX_STATUS_META[tx.status].label}
              </span>
            </td>
            <td className="px-4 py-3 text-xs text-gray-500">{TX_SOURCE_META[tx.source].label}</td>
            <td className="px-4 py-3 text-right">
              {/* Chỉ giao dịch tiền vào & chưa khớp mới gán được — khớp điều kiện backend */}
              {tx.status === SePayTxStatus.UNMATCHED && tx.transferType === 'in' && (
                <Button variant="outline" size="sm" onClick={() => setMatching(tx)}>
                  <Link2 className="h-3.5 w-3.5" />
                  Gán đơn
                </Button>
              )}
            </td>
          </tr>
        ))}
      </AdminTable>

      {matching && (
        <MatchTransactionModal
          tx={matching}
          onClose={() => setMatching(null)}
          onSaved={handleMatched}
        />
      )}
    </div>
  )
}
