'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import {
  Search, PackageX, AlertTriangle, PackageCheck, Boxes, Layers,
  ChevronRight, ImageOff, CircleCheck,
} from 'lucide-react'
import { FilterChip } from '@/components/ui/filter-chip'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Pagination } from '@/components/ui/pagination'
import { ApiError } from '@/lib/api/http'
import { formatVND } from '@/lib/utils/format'
import { adminInventoryApi } from '@/features/inventory/api'
import { adminBrandApi } from '@/features/brands/api'
import type { Brand } from '@/features/brands/types'
import type {
  InventoryListResult,
  InventorySummary,
  InventoryVariant,
  StockStatus,
} from '@/features/inventory/types'
import type { PaginationMeta } from '@/types/api'

const PAGE_SIZE = 20
const LOW_THRESHOLD = 5
const EMPTY_PAGINATION: PaginationMeta = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 }

type StockFilter = 'all' | StockStatus

// ─── Group helpers ─────────────────────────────────────────────────────────────

interface ProductGroup {
  productId: string
  name: string
  categoryName: string | null
  brandName: string | null
  coverUrl: string | null
  variants: InventoryVariant[]
}

function groupByProduct(variants: InventoryVariant[]): ProductGroup[] {
  const map = new Map<string, ProductGroup>()
  for (const v of variants) {
    const pid = v.product.id
    if (!map.has(pid)) {
      map.set(pid, {
        productId: pid,
        name: v.product.name,
        categoryName: v.product.category?.name ?? null,
        brandName: v.product.brand?.name ?? null,
        coverUrl: v.product.images?.[0]?.url ?? null,
        variants: [],
      })
    }
    map.get(pid)!.variants.push(v)
  }
  return Array.from(map.values())
}

function stockLevel(stock: number): StockStatus {
  if (stock === 0) return 'out_of_stock'
  if (stock <= LOW_THRESHOLD) return 'low_stock'
  return 'in_stock'
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AdminInventoryPage() {
  const [result, setResult] = useState<InventoryListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [page, setPage] = useState(1)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [brands, setBrands] = useState<Brand[]>([])
  const [brandSlug, setBrandSlug] = useState('')

  useEffect(() => {
    adminBrandApi.list().then(setBrands).catch(() => {/* filter để trống nếu lỗi */})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await adminInventoryApi.list({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        stockStatus: stockFilter === 'all' ? undefined : stockFilter,
        brandSlug: brandSlug || undefined,
      })
      setResult(data)
      // Mặc định mở rộng tất cả khi load lần đầu
      setExpandedIds((prev) => {
        if (prev.size > 0) return prev
        const ids = new Set<string>()
        data.variants.forEach((v) => ids.add(v.product.id))
        return ids
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được dữ liệu tồn kho')
    } finally {
      setLoading(false)
    }
  }, [page, search, stockFilter, brandSlug])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [load])

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput.trim())
    setPage(1)
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const summary = result?.summary
  const variants = result?.variants ?? []
  const pagination = result?.pagination ?? EMPTY_PAGINATION
  const groups = groupByProduct(variants)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Quản lý Tồn kho</h1>
        <p className="text-sm text-gray-500">
          Tổng quan tồn kho theo sản phẩm và biến thể, sắp xếp theo tồn kho thấp nhất.
        </p>
      </div>

      {summary && <SummaryCards summary={summary} />}

      {/* ── Filters ── */}
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
        <NativeSelect
          value={brandSlug}
          onChange={(e) => { setBrandSlug(e.target.value); setPage(1) }}
          className="h-8"
        >
          <option value="">Tất cả thương hiệu</option>
          {brands.map((b) => (
            <option key={b.id} value={b.slug}>{b.name}</option>
          ))}
        </NativeSelect>

        <div className="ml-auto flex gap-2">
          {(['all', 'in_stock', 'low_stock', 'out_of_stock'] as StockFilter[]).map((s) => (
            <FilterChip
              key={s}
              active={stockFilter === s}
              label={
                s === 'all' ? 'Tất cả'
                : s === 'in_stock' ? 'Còn hàng'
                : s === 'low_stock' ? 'Sắp hết'
                : 'Hết hàng'
              }
              onClick={() => { setStockFilter(s); setPage(1) }}
            />
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>
      )}

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Sản phẩm / Biến thể
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Mã SKU
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Biến thể
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Giá bán
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Tồn kho
                </th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Trạng thái
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center text-sm text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
                      Đang tải dữ liệu...
                    </div>
                  </td>
                </tr>
              ) : groups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center text-sm text-gray-400">
                    Không có biến thể phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                groups.map((group) => (
                  <ProductGroupRows
                    key={group.productId}
                    group={group}
                    expanded={expandedIds.has(group.productId)}
                    onToggle={() => toggleExpand(group.productId)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="border-t border-border px-4 py-3">
            <Pagination
              meta={pagination}
              loading={loading}
              emptyLabel="Không có biến thể"
              onChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Product group rows ────────────────────────────────────────────────────────

function ProductGroupRows({
  group,
  expanded,
  onToggle,
}: {
  group: ProductGroup
  expanded: boolean
  onToggle: () => void
}) {
  const totalStock = group.variants.reduce((sum, v) => sum + v.stock, 0)

  // Worst status: hết hàng > sắp hết > còn hàng
  const worstLevel: StockStatus =
    group.variants.some((v) => v.stock === 0)
      ? 'out_of_stock'
      : group.variants.some((v) => v.stock > 0 && v.stock <= LOW_THRESHOLD)
        ? 'low_stock'
        : 'in_stock'

  return (
    <>
      {/* ── Product header row ── */}
      <tr
        className="cursor-pointer bg-gray-50/70 transition-colors hover:bg-gray-100/80"
        onClick={onToggle}
      >
        {/* Sản phẩm */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <ChevronRight
              className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${
                expanded ? 'rotate-90' : ''
              }`}
            />
            {/* Thumbnail */}
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-border">
              {group.coverUrl ? (
                <Image
                  src={group.coverUrl}
                  alt={group.name}
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-gray-300">
                  <ImageOff className="h-4 w-4" />
                </div>
              )}
            </div>
            {/* Name + meta */}
            <div className="min-w-0">
              <p className="truncate font-semibold text-gray-800">{group.name}</p>
              <div className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-400">
                {group.categoryName && <span>{group.categoryName}</span>}
                {group.categoryName && group.brandName && (
                  <span className="text-gray-300">|</span>
                )}
                {group.brandName && <span>{group.brandName}</span>}
              </div>
            </div>
          </div>
        </td>

        {/* SKU — empty for product row */}
        <td className="px-4 py-3 text-gray-300 text-xs">—</td>

        {/* Biến thể count */}
        <td className="px-4 py-3">
          <span className="inline-flex items-center rounded-full bg-[var(--color-primary)]/8 px-2.5 py-0.5 text-xs font-medium text-[var(--color-primary)] ring-1 ring-inset ring-[var(--color-primary)]/20">
            {group.variants.length} biến thể
          </span>
        </td>

        {/* Giá — empty for product row */}
        <td className="px-4 py-3 text-right text-gray-300 text-xs">—</td>

        {/* Tổng tồn kho */}
        <td className="px-4 py-3 text-right">
          <span className="font-semibold text-gray-700">
            {totalStock.toLocaleString('vi-VN')}
          </span>
        </td>

        {/* Status tổng */}
        <td className="px-4 py-3 text-center">
          <StatusBadge level={worstLevel} compact />
        </td>
      </tr>

      {/* ── Variant rows ── */}
      {expanded &&
        group.variants.map((v) => (
          <VariantRow key={v.id} variant={v} />
        ))}
    </>
  )
}

// ─── Variant row ──────────────────────────────────────────────────────────────

function VariantRow({ variant }: { variant: InventoryVariant }) {
  const level = stockLevel(variant.stock)
  const attrs = [variant.color, variant.ram, variant.storage].filter(Boolean).join(' · ')
  const imgSrc = variant.imageUrl ?? variant.product.images?.[0]?.url ?? null

  return (
    <tr className="bg-white transition-colors hover:bg-gray-50/50">
      {/* Sản phẩm / Biến thể — ảnh + attributes, indented */}
      <td className="py-2.5 pl-14 pr-4">
        <div className="flex items-center gap-2.5">
          {/* Thumbnail ảnh biến thể (fallback về ảnh sản phẩm) */}
          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-gray-100 ring-1 ring-border">
            {imgSrc ? (
              <Image src={imgSrc} alt="" fill sizes="32px" className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-200">
                <ImageOff className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
          <span className="text-gray-600">{attrs || <span className="text-gray-300">—</span>}</span>
        </div>
      </td>

      {/* SKU */}
      <td className="px-4 py-2.5">
        <code className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">
          {variant.sku}
        </code>
      </td>

      {/* Biến thể — empty for variant row */}
      <td className="px-4 py-2.5 text-gray-300 text-xs">—</td>

      {/* Giá bán */}
      <td className="px-4 py-2.5 text-right text-gray-700">
        {formatVND(variant.salePrice)}
      </td>

      {/* Tồn kho */}
      <td className="px-4 py-2.5 text-right">
        <StockNumber stock={variant.stock} level={level} />
      </td>

      {/* Trạng thái */}
      <td className="px-4 py-2.5 text-center">
        <StatusBadge level={level} />
      </td>
    </tr>
  )
}

// ─── StockNumber ──────────────────────────────────────────────────────────────

function StockNumber({ stock, level }: { stock: number; level: StockStatus }) {
  const cls =
    level === 'out_of_stock'
      ? 'text-[var(--color-danger)] font-bold'
      : level === 'low_stock'
        ? 'text-amber-500 font-semibold'
        : 'text-emerald-600 font-semibold'
  return (
    <span className={cls}>{stock.toLocaleString('vi-VN')}</span>
  )
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ level, compact }: { level: StockStatus; compact?: boolean }) {
  if (level === 'in_stock') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
        <CircleCheck className="h-3 w-3" />
        {!compact && 'Còn hàng'}
      </span>
    )
  }
  if (level === 'low_stock') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
        <AlertTriangle className="h-3 w-3" />
        {!compact && 'Sắp hết'}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-[var(--color-danger)] ring-1 ring-inset ring-red-200">
      <PackageX className="h-3 w-3" />
      {!compact && 'Hết hàng'}
    </span>
  )
}

// ─── Summary cards ─────────────────────────────────────────────────────────────

function SummaryCards({ summary }: { summary: InventorySummary }) {
  const cards = [
    {
      label: 'Tổng biến thể',
      value: summary.totalVariants,
      icon: Layers,
      color: 'text-gray-500',
      bg: 'bg-gray-50',
    },
    {
      label: 'Tổng tồn kho',
      value: summary.totalStock,
      icon: Boxes,
      color: 'text-gray-500',
      bg: 'bg-gray-50',
    },
    {
      label: 'Còn hàng',
      value: summary.inStock,
      icon: PackageCheck,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Sắp hết',
      value: summary.lowStock,
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Hết hàng',
      value: summary.outOfStock,
      icon: PackageX,
      color: 'text-[var(--color-danger)]',
      bg: 'bg-red-50',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <div
          key={c.label}
          className="flex items-center gap-3 rounded-xl bg-white p-4 ring-1 ring-border"
        >
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${c.bg}`}>
            <c.icon className={`h-4 w-4 ${c.color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 truncate">{c.label}</p>
            <p className="text-xl font-bold text-gray-800">
              {c.value.toLocaleString('vi-VN')}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
