'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SlidersHorizontal, X } from 'lucide-react'
import { formatVND } from '@/lib/utils/format'
import { FilterPanel, type FacetData } from './filter-panel'
import {
  SORT_OPTIONS,
  PRODUCTS_BASE,
  buildHref,
  hasActiveFilters,
  type ProductFilters,
  type SortValue,
  type LockedFacet,
} from '@/features/products/filters'

interface ProductControlsProps {
  filters: ProductFilters
  facets: FacetData
  total: number
  /** Route gốc để dựng link (mặc định /products) */
  basePath?: string
  /** Facet do route quyết định → không hiện chip (gỡ nó là rời trang) */
  locked?: LockedFacet
}

interface ActiveChip {
  label: string
  patch: Partial<ProductFilters>
}

/** Chip cho từng filter đang bật, kèm patch để gỡ đúng filter đó. */
function activeChips(
  filters: ProductFilters,
  facets: FacetData,
  locked?: LockedFacet,
): ActiveChip[] {
  const chips: ActiveChip[] = []

  if (filters.search) {
    chips.push({ label: `Tìm: "${filters.search}"`, patch: { search: undefined } })
  }
  if (filters.featured) {
    chips.push({ label: 'Nổi bật', patch: { featured: false } })
  }
  if (locked !== 'category' && filters.category) {
    const name = facets.categories.find((c) => c.slug === filters.category)?.name
    chips.push({ label: name ?? filters.category, patch: { category: undefined } })
  }
  if (locked !== 'brand' && filters.brand) {
    const name = facets.brands.find((b) => b.slug === filters.brand)?.name
    chips.push({ label: name ?? filters.brand, patch: { brand: undefined } })
  }
  if (filters.tag) {
    const name = facets.tags.find((t) => t.slug === filters.tag)?.name
    chips.push({ label: name ?? filters.tag, patch: { tag: undefined } })
  }
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const from = filters.minPrice !== undefined ? formatVND(filters.minPrice) : null
    const to = filters.maxPrice !== undefined ? formatVND(filters.maxPrice) : null
    const label = from && to ? `${from} – ${to}` : from ? `Từ ${from}` : `Đến ${to}`
    chips.push({ label, patch: { minPrice: undefined, maxPrice: undefined } })
  }

  return chips
}

export function ProductControls({
  filters,
  facets,
  total,
  basePath = PRODUCTS_BASE,
  locked,
}: ProductControlsProps) {
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const chips = activeChips(filters, facets, locked)
  const showClearAll = hasActiveFilters(filters, locked)

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              Bộ lọc
              {chips.length > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--color-primary)] px-1 text-[11px] font-bold text-white">
                  {chips.length}
                </span>
              )}
            </button>

            <p aria-live="polite" className="text-sm text-muted-foreground">
              <span className="font-semibold text-gray-800">{total}</span> sản phẩm
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Sắp xếp</span>
            <select
              value={filters.sort}
              onChange={(e) =>
                router.push(buildHref(filters, { sort: e.target.value as SortValue }, basePath, locked))
              }
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium outline-none focus:border-[var(--color-primary)]"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => router.push(buildHref(filters, chip.patch, basePath, locked))}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-light)] py-1 pl-3 pr-2 text-xs font-medium text-[var(--color-primary)] transition-opacity hover:opacity-80"
              >
                {chip.label}
                <X className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">Bỏ lọc {chip.label}</span>
              </button>
            ))}
            {showClearAll && (
              <button
                type="button"
                onClick={() => router.push(basePath)}
                className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-gray-800"
              >
                Xoá tất cả
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Drawer bộ lọc (mobile) ─────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Đóng bộ lọc"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col bg-white shadow-xl">
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="font-bold">Bộ lọc</h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Đóng"
                className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4">
              <FilterPanel
                filters={filters}
                facets={facets}
                basePath={basePath}
                locked={locked}
                onNavigate={() => setDrawerOpen(false)}
              />
            </div>

            {showClearAll && (
              <footer className="border-t border-border p-4">
                <button
                  type="button"
                  onClick={() => {
                    router.push(basePath)
                    setDrawerOpen(false)
                  }}
                  className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold text-gray-700"
                >
                  Xoá tất cả bộ lọc
                </button>
              </footer>
            )}
          </div>
        </div>
      )}
    </>
  )
}
