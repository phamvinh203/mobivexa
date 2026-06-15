'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import {
  Search, PackageX, AlertTriangle, PackageCheck, Boxes, Layers,
  ChevronRight, ImageOff, CircleCheck,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { FilterChip } from '@/components/ui/filter-chip'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Pagination } from '@/components/ui/pagination'
import { Loading } from '@/components/ui/loading'
import { consolidateApiError } from '@/lib/utils/error'
import { ApiError } from '@/lib/api/http'
import { formatVND } from '@/lib/utils/format'
import { adminInventoryApi } from '@/features/inventory/api'
import { adminBrandApi } from '@/features/brands/api'
import type { InventoryListResult, InventorySummary, InventoryVariant, StockStatus } from '@/features/inventory/types'
import { groupByProduct, stockLevel } from '@/features/inventory/group'
import type { ColorGroup, ProductGroup } from '@/features/inventory/group'
import type { PaginationMeta } from '@/types/api'

const PAGE_SIZE = 20
const LOW_THRESHOLD = 5
const EMPTY_PAGINATION: PaginationMeta = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 }

type StockFilter = 'all' | StockStatus

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AdminInventoryPage() {
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [page, setPage] = useState(1)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [brandSlug, setBrandSlug] = useState('')

  // ── Filter data (hiếm thay đổi) ───────────────────────────────────────
  const { data: brands = [] } = useQuery({
    queryKey: ['admin-brands'],
    queryFn: () => adminBrandApi.list(),
  })

  // ── Dữ liệu tồn kho ──────────────────────────────────────────────────────
  const { data, isLoading, error: fetchError } = useQuery<InventoryListResult>({
    queryKey: ['admin-inventory', page, search, stockFilter, brandSlug],
    queryFn: () => adminInventoryApi.list({
      page,
      limit: PAGE_SIZE,
      search: search || undefined,
      stockStatus: stockFilter === 'all' ? undefined : stockFilter,
      brandSlug: brandSlug || undefined,
    }),
  })

  // Tự động mở rộng tất cả sản phẩm khi load lần đầu
  useEffect(() => {
    if (!data) return
    setExpandedIds((prev) => {
      if (prev.size > 0) return prev
      const ids = new Set<string>()
      data.variants.forEach((v) => ids.add(v.product.id))
      return ids
    })
  }, [data])

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

  const summary = data?.summary
  const variants = data?.variants ?? []
  const pagination = data?.pagination ?? EMPTY_PAGINATION
  const errorMsg = consolidateApiError('', fetchError, 'dữ liệu tồn kho')
  const groups = useMemo(() => groupByProduct(variants), [variants])

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

      {errorMsg && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">{errorMsg}</div>
      )}

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Sản phẩm / Màu sắc
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
              {isLoading ? (
                <Loading.TableRow colSpan={6} message="Đang tải dữ liệu..." />
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
              isLoading={isLoading}
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
  const totalStock = group.colorGroups.reduce((sum, cg) => sum + cg.totalStock, 0)
  const totalVariants = group.colorGroups.reduce((sum, cg) => sum + cg.variants.length, 0)
  const worstLevel: StockStatus =
    group.colorGroups.some((cg) => cg.worstLevel === 'out_of_stock') ? 'out_of_stock'
    : group.colorGroups.some((cg) => cg.worstLevel === 'low_stock') ? 'low_stock'
    : 'in_stock'

  const swatches = group.colorGroups.slice(0, 5)

  return (
    <>
      {/* ── Product header row ── */}
      <tr
        className="cursor-pointer bg-gray-50/70 transition-colors hover:bg-gray-100/80"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <ChevronRight
              className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${
                expanded ? 'rotate-90' : ''
              }`}
            />
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-border">
              {group.coverUrl ? (
                <Image src={group.coverUrl} alt={group.name} fill sizes="40px" className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-gray-300">
                  <ImageOff className="h-4 w-4" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-gray-800">{group.name}</p>
              <div className="mt-1 flex items-center gap-1.5">
                {/* Color swatch preview */}
                <div className="flex items-center gap-0.5">
                  {swatches.map((cg) => (
                    <span
                      key={cg.colorKey}
                      title={cg.colorDisplay}
                      className="inline-block h-3 w-3 rounded-full ring-1 ring-white"
                      style={{ backgroundColor: cg.colorCss, outline: `1px solid ${cg.colorCss}40` }}
                    />
                  ))}
                  {group.colorGroups.length > 5 && (
                    <span className="text-[10px] text-gray-400 ml-0.5">+{group.colorGroups.length - 5}</span>
                  )}
                </div>
                {(group.categoryName || group.brandName) && (
                  <span className="text-[10px] text-gray-300">·</span>
                )}
                {group.categoryName && <span className="text-[11px] text-gray-400">{group.categoryName}</span>}
                {group.categoryName && group.brandName && (
                  <span className="text-[10px] text-gray-300">|</span>
                )}
                {group.brandName && <span className="text-[11px] text-gray-400">{group.brandName}</span>}
              </div>
            </div>
          </div>
        </td>

        <td className="px-4 py-3 text-gray-300 text-xs">—</td>

        <td className="px-4 py-3">
          <span className="inline-flex items-center rounded-full bg-[var(--color-primary)]/8 px-2.5 py-0.5 text-xs font-medium text-[var(--color-primary)] ring-1 ring-inset ring-[var(--color-primary)]/20">
            {totalVariants} biến thể
          </span>
        </td>

        <td className="px-4 py-3 text-right text-gray-300 text-xs">—</td>

        <td className="px-4 py-3 text-right">
          <span className="font-semibold text-gray-700">{totalStock.toLocaleString('vi-VN')}</span>
        </td>

        <td className="px-4 py-3 text-center">
          <StatusBadge level={worstLevel} compact />
        </td>
      </tr>

      {/* ── Color groups (khi mở rộng) ── */}
      {expanded &&
        group.colorGroups.map((cg) => (
          <ColorGroupSection
            key={cg.colorKey}
            colorGroup={cg}
            productCoverUrl={group.coverUrl}
          />
        ))}
    </>
  )
}

// ─── Color group section ───────────────────────────────────────────────────────

function ColorGroupSection({
  colorGroup,
  productCoverUrl,
}: {
  colorGroup: ColorGroup
  productCoverUrl: string | null
}) {
  const { colorCss, colorDisplay, variants, totalStock, worstLevel } = colorGroup

  return (
    <>
      {/* Color subheader */}
      <tr>
        <td
          colSpan={6}
          className="py-0"
          style={{ borderLeft: `3px solid ${colorCss}` }}
        >
          <div
            className="flex items-center gap-2.5 px-4 py-1.5"
            style={{ backgroundColor: `${colorCss}12` }}
          >
            <span
              className="inline-block h-3.5 w-3.5 shrink-0 rounded-full shadow-sm ring-2 ring-white"
              style={{ backgroundColor: colorCss }}
            />
            <span
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: colorCss }}
            >
              {colorDisplay}
            </span>
            <span className="text-[10px] text-gray-400">
              {variants.length} SKU · {totalStock.toLocaleString('vi-VN')} sản phẩm
            </span>
            <span className="ml-auto">
              <StatusBadge level={worstLevel} compact />
            </span>
          </div>
        </td>
      </tr>

      {/* Variant rows */}
      {variants.map((v) => (
        <VariantRow key={v.id} variant={v} colorCss={colorCss} productCoverUrl={productCoverUrl} />
      ))}
    </>
  )
}

// ─── Variant row ──────────────────────────────────────────────────────────────

function VariantRow({
  variant,
  colorCss,
  productCoverUrl,
}: {
  variant: InventoryVariant
  colorCss: string
  productCoverUrl: string | null
}) {
  const level = stockLevel(variant.stock)
  const attrs = [variant.ram, variant.storage].filter(Boolean).join(' · ')
  const imgSrc = variant.imageUrl ?? productCoverUrl ?? null

  return (
    <tr
      className="bg-white transition-colors hover:bg-gray-50/60"
      style={{ borderLeft: `3px solid ${colorCss}` }}
    >
      <td className="py-2.5 pl-12 pr-4">
        <div className="flex items-center gap-2.5">
          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-gray-100 ring-1 ring-border">
            {imgSrc ? (
              <Image src={imgSrc} alt="" fill sizes="32px" className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImageOff className="h-3.5 w-3.5 text-gray-200" />
              </div>
            )}
          </div>
          {attrs ? (
            <span className="text-gray-600">{attrs}</span>
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </div>
      </td>

      <td className="px-4 py-2.5">
        <code className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">
          {variant.sku}
        </code>
      </td>

      <td className="px-4 py-2.5 text-gray-300 text-xs">—</td>

      <td className="px-4 py-2.5 text-right text-gray-700">
        {formatVND(variant.salePrice)}
      </td>

      <td className="px-4 py-2.5 text-right">
        <StockNumber stock={variant.stock} level={level} />
      </td>

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
