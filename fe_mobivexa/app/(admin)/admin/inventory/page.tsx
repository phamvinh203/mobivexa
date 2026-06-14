'use client'

import { useCallback, useEffect, useState } from 'react'
import { Search, PackageX, AlertTriangle, PackageCheck, Boxes, Layers } from 'lucide-react'
import { FilterChip } from '@/components/ui/filter-chip'
import { Input } from '@/components/ui/input'
import { AdminTable } from '@/components/ui/admin-table'
import { Pagination } from '@/components/ui/pagination'
import { ApiError } from '@/lib/api/http'
import { formatVND } from '@/lib/utils/format'
import { adminInventoryApi } from '@/features/inventory/api'
import type {
  InventoryListResult,
  InventorySummary,
  InventoryVariant,
  StockStatus,
} from '@/features/inventory/types'
import type { PaginationMeta } from '@/types/api'

const PAGE_SIZE = 20
// Khớp DEFAULT_LOW_THRESHOLD trong be_mobivexa/src/services/product.service.ts (dùng cho badge client)
const LOW_THRESHOLD = 5

const EMPTY_PAGINATION: PaginationMeta = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 }

type StockFilter = 'all' | StockStatus

const STOCK_STATUS_META: Record<
  StockStatus,
  { label: string; dotClass: string; textClass: string; rowClass: string }
> = {
  in_stock: { label: 'Còn hàng', dotClass: 'bg-emerald-500', textClass: 'text-emerald-600', rowClass: '' },
  low_stock: { label: 'Sắp hết', dotClass: 'bg-amber-500', textClass: 'text-amber-600', rowClass: 'bg-amber-50/30' },
  out_of_stock: { label: 'Hết hàng', dotClass: 'bg-red-500', textClass: 'text-red-600', rowClass: 'bg-red-50/30' },
}

function stockLevel(stock: number): StockStatus {
  if (stock === 0) return 'out_of_stock'
  if (stock <= LOW_THRESHOLD) return 'low_stock'
  return 'in_stock'
}

const COLUMNS = [
  'Sản phẩm', 'SKU', 'Biến thể',
  { label: 'Giá bán', className: 'text-right' },
  { label: 'Tồn kho', className: 'text-center' },
  'Trạng thái',
] as const

export default function AdminInventoryPage() {
  const [result, setResult] = useState<InventoryListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await adminInventoryApi.list({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        stockStatus: stockFilter === 'all' ? undefined : stockFilter,
      })
      setResult(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được dữ liệu tồn kho')
    } finally {
      setLoading(false)
    }
  }, [page, search, stockFilter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const resetPage = () => setPage(1)

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput.trim())
    resetPage()
  }

  const summary = result?.summary
  const variants = result?.variants ?? []
  const pagination: PaginationMeta = result?.pagination ?? EMPTY_PAGINATION

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Quản lý Tồn kho</h1>
        <p className="text-sm text-gray-500">Tổng quan tồn kho theo biến thể sản phẩm, sắp xếp từ ít nhất.</p>
      </div>

      {summary && <SummaryCards summary={summary} />}

      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm theo tên sản phẩm..."
            className="h-8 w-64 pl-8"
          />
        </form>

        <div className="ml-auto flex gap-2">
          {(['all', 'in_stock', 'low_stock', 'out_of_stock'] as StockFilter[]).map((s) => (
            <FilterChip
              key={s}
              active={stockFilter === s}
              label={s === 'all' ? 'Tất cả' : STOCK_STATUS_META[s].label}
              onClick={() => { setStockFilter(s); resetPage() }}
            />
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>
      )}

      <AdminTable
        columns={COLUMNS}
        colSpan={6}
        loading={loading}
        empty={variants.length === 0}
        emptyMessage="Không có biến thể phù hợp."
        scrollable
        footer={
          pagination.totalPages > 1
            ? <Pagination meta={pagination} loading={loading} emptyLabel="Không có biến thể" onChange={setPage} />
            : undefined
        }
      >
        {variants.map((v) => <VariantRow key={v.id} variant={v} />)}
      </AdminTable>
    </div>
  )
}

// ─── Summary cards ───────────────────────────────────────────────────────────

function SummaryCards({ summary }: { summary: InventorySummary }) {
  const cards = [
    { label: 'Tổng biến thể', value: summary.totalVariants, icon: Layers, color: 'text-gray-600' },
    { label: 'Tổng tồn kho', value: summary.totalStock, icon: Boxes, color: 'text-gray-600' },
    { label: 'Còn hàng', value: summary.inStock, icon: PackageCheck, color: 'text-emerald-600' },
    { label: 'Sắp hết', value: summary.lowStock, icon: AlertTriangle, color: 'text-amber-600' },
    { label: 'Hết hàng', value: summary.outOfStock, icon: PackageX, color: 'text-red-600' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl bg-white p-4 ring-1 ring-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{c.label}</span>
            <c.icon className={`h-4 w-4 ${c.color}`} />
          </div>
          <div className="mt-1 text-2xl font-bold text-gray-800">{c.value.toLocaleString('vi-VN')}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Variant row ─────────────────────────────────────────────────────────────

function VariantRow({ variant }: { variant: InventoryVariant }) {
  const meta = STOCK_STATUS_META[stockLevel(variant.stock)]
  const attrs = [variant.color, variant.storage, variant.ram].filter(Boolean).join(' · ')

  return (
    <tr className={`hover:bg-gray-50/60 ${meta.rowClass}`}>
      <td className="px-4 py-3">
        <div className="font-medium text-gray-800">{variant.product.name}</div>
        <div className="text-xs text-gray-400">/{variant.product.slug}</div>
      </td>
      <td className="px-4 py-3">
        <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{variant.sku}</code>
      </td>
      <td className="px-4 py-3 text-gray-600">{attrs || '—'}</td>
      <td className="px-4 py-3 text-right text-gray-700">{formatVND(variant.salePrice)}</td>
      <td className="px-4 py-3 text-center">
        <span className={`font-semibold ${meta.textClass}`}>{variant.stock.toLocaleString('vi-VN')}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${meta.textClass}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
          {meta.label}
        </span>
        {!variant.isActive && (
          <span className="ml-2 inline-flex items-center text-xs font-medium text-gray-400">Ẩn</span>
        )}
      </td>
    </tr>
  )
}
