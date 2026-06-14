'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, PackageX, AlertTriangle, PackageCheck, Boxes, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FilterChip } from '@/components/ui/filter-chip'
import { Input } from '@/components/ui/input'
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
// TODO: lý tưởng nhất là backend trả summary.lowThreshold để FE không phải đồng bộ magic number.
const LOW_THRESHOLD = 5

// Giá trị pagination mặc định (module-level → tham chiếu ổn định cho useMemo khi chưa load xong).
const EMPTY_PAGINATION: PaginationMeta = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 }

// 'all' = sentinel FE-only cho "không filter"; 3 giá trị còn lại khớp backend StockStatus.
type StockFilter = 'all' | StockStatus

// Toàn bộ metadata hiển thị cho tình trạng tồn kho — nguồn sự thật duy nhất.
// stockLevel() chỉ phân loại (stock → status), nhãn/màu tra từ đây.
const STOCK_STATUS_META: Record<
  StockStatus,
  { label: string; dotClass: string; textClass: string; rowClass: string }
> = {
  in_stock: { label: 'Còn hàng', dotClass: 'bg-emerald-500', textClass: 'text-emerald-600', rowClass: '' },
  low_stock: { label: 'Sắp hết', dotClass: 'bg-amber-500', textClass: 'text-amber-600', rowClass: 'bg-amber-50/30' },
  out_of_stock: { label: 'Hết hàng', dotClass: 'bg-red-500', textClass: 'text-red-600', rowClass: 'bg-red-50/30' },
}

// Phân loại tình trạng tồn kho dựa vào số lượng (pure classification).
function stockLevel(stock: number): StockStatus {
  if (stock === 0) return 'out_of_stock'
  if (stock <= LOW_THRESHOLD) return 'low_stock'
  return 'in_stock'
}

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
    void load()
  }, [load])

  const resetPage = () => setPage(1)

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput.trim())
    resetPage()
  }

  function applyStockFilter(status: StockFilter) {
    setStockFilter(status)
    resetPage()
  }

  const summary = result?.summary
  const variants = result?.variants ?? []
  const pagination: PaginationMeta = result?.pagination ?? EMPTY_PAGINATION

  const rangeLabel = useMemo(() => {
    if (pagination.total === 0) return 'Không có biến thể'
    const from = (pagination.page - 1) * pagination.limit + 1
    const to = Math.min(pagination.page * pagination.limit, pagination.total)
    return `${from}–${to} / ${pagination.total}`
  }, [pagination])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Quản lý Tồn kho</h1>
        <p className="text-sm text-gray-500">Tổng quan tồn kho theo biến thể sản phẩm, sắp xếp từ ít nhất.</p>
      </div>

      {/* Summary cards — tổng quan toàn kho (không phụ thuộc filter) */}
      {summary && <SummaryCards summary={summary} />}

      {/* Filter bar */}
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
              onClick={() => applyStockFilter(s)}
            />
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>
      )}

      {/* Bảng */}
      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Sản phẩm</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Biến thể</th>
                <th className="px-4 py-3 text-right font-medium">Giá bán</th>
                <th className="px-4 py-3 text-center font-medium">Tồn kho</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    Đang tải...
                  </td>
                </tr>
              ) : variants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    Không có biến thể phù hợp.
                  </td>
                </tr>
              ) : (
                variants.map((v) => (
                  <VariantRow key={v.id} variant={v} />
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
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Trước
              </Button>
              <span className="px-2 text-gray-600">
                {pagination.page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Sau
              </Button>
            </div>
          </div>
        )}
      </div>
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

  // Ghép mô tả biến thể: màu / dung lượng / RAM (bỏ field null)
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
