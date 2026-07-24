'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import type { Category } from '@/features/categories/types'
import type { Brand } from '@/features/brands/types'
import type { Tag } from '@/features/tags/types'
import {
  PRICE_RANGES,
  buildHref,
  matchedPriceRange,
  type ProductFilters,
} from '../_lib/filters'

export interface FacetData {
  categories: Category[]
  brands: Brand[]
  tags: Tag[]
}

interface FilterPanelProps {
  filters: ProductFilters
  facets: FacetData
  /** Gọi sau khi chọn — drawer mobile dùng để tự đóng */
  onNavigate?: () => void
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-gray-500">
      {children}
    </h3>
  )
}

/** Dòng chọn 1-trong-nhiều. Bấm lại vào mục đang chọn = bỏ chọn. */
function OptionRow({
  label,
  count,
  selected,
  onClick,
}: {
  label: string
  count?: number
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
        selected
          ? 'bg-[var(--color-primary-light)] font-semibold text-[var(--color-primary)]'
          : 'text-gray-600 hover:bg-gray-50'
      }`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {selected && <Check className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />}
        <span className="truncate">{label}</span>
      </span>
      {count != null && (
        <span className="flex-shrink-0 text-xs text-muted-foreground">{count}</span>
      )}
    </button>
  )
}

export function FilterPanel({ filters, facets, onNavigate }: FilterPanelProps) {
  const router = useRouter()
  const [minInput, setMinInput] = useState(
    filters.minPrice !== undefined ? String(filters.minPrice) : '',
  )
  const [maxInput, setMaxInput] = useState(
    filters.maxPrice !== undefined ? String(filters.maxPrice) : '',
  )

  const activeRange = matchedPriceRange(filters)

  function go(patch: Partial<ProductFilters>) {
    router.push(buildHref(filters, patch))
    onNavigate?.()
  }

  /** Bấm lại mục đang chọn thì bỏ chọn — đỡ phải đi tìm nút "xoá". */
  function toggle(key: 'category' | 'brand' | 'tag', value: string) {
    go({ [key]: filters[key] === value ? undefined : value })
  }

  function applyCustomPrice() {
    const min = Number(minInput)
    const max = Number(maxInput)
    go({
      minPrice: minInput && Number.isFinite(min) && min > 0 ? min : undefined,
      maxPrice: maxInput && Number.isFinite(max) && max > 0 ? max : undefined,
    })
  }

  const rootCategories = facets.categories.filter(
    (c) => c.parentId === null && c.isActive,
  )
  const activeBrands = facets.brands.filter((b) => b.isActive)

  return (
    <div className="flex flex-col gap-6">
      {/* ── Danh mục ───────────────────────────────────────────────────────── */}
      {rootCategories.length > 0 && (
        <section>
          <SectionTitle>Danh mục</SectionTitle>
          <div className="flex flex-col gap-0.5">
            {rootCategories.map((cat) => {
              const children = facets.categories.filter(
                (c) => c.parentId === cat.id && c.isActive,
              )
              return (
                <div key={cat.id}>
                  <OptionRow
                    label={cat.name}
                    count={cat._count?.products}
                    selected={filters.category === cat.slug}
                    onClick={() => toggle('category', cat.slug)}
                  />
                  {children.length > 0 && (
                    <div className="ml-3 border-l border-border pl-1.5">
                      {children.map((child) => (
                        <OptionRow
                          key={child.id}
                          label={child.name}
                          count={child._count?.products}
                          selected={filters.category === child.slug}
                          onClick={() => toggle('category', child.slug)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Thương hiệu ────────────────────────────────────────────────────── */}
      {activeBrands.length > 0 && (
        <section>
          <SectionTitle>Thương hiệu</SectionTitle>
          <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
            {activeBrands.map((brand) => (
              <OptionRow
                key={brand.id}
                label={brand.name}
                count={brand._count?.products}
                selected={filters.brand === brand.slug}
                onClick={() => toggle('brand', brand.slug)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Giá ────────────────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Khoảng giá</SectionTitle>
        <div className="flex flex-col gap-0.5">
          {PRICE_RANGES.map((range) => (
            <OptionRow
              key={range.id}
              label={range.label}
              selected={activeRange === range.id}
              onClick={() =>
                go(
                  activeRange === range.id
                    ? { minPrice: undefined, maxPrice: undefined }
                    : { minPrice: range.min, maxPrice: range.max },
                )
              }
            />
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={minInput}
            onChange={(e) => setMinInput(e.target.value)}
            placeholder="Từ"
            aria-label="Giá thấp nhất"
            className="w-full min-w-0 rounded-lg border border-border px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={maxInput}
            onChange={(e) => setMaxInput(e.target.value)}
            placeholder="Đến"
            aria-label="Giá cao nhất"
            className="w-full min-w-0 rounded-lg border border-border px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <button
          type="button"
          onClick={applyCustomPrice}
          className="mt-2 w-full rounded-lg border border-[var(--color-primary)] py-1.5 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-light)]"
        >
          Áp dụng
        </button>
      </section>

      {/* ── Tag ────────────────────────────────────────────────────────────── */}
      {facets.tags.length > 0 && (
        <section>
          <SectionTitle>Nhãn</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {facets.tags.map((tag) => {
              const selected = filters.tag === tag.slug
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggle('tag', tag.slug)}
                  aria-pressed={selected}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    selected
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-white text-gray-600 ring-1 ring-border hover:bg-gray-50'
                  }`}
                >
                  {tag.name}
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
