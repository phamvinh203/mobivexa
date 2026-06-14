'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Plus, Pencil, Trash2, Eye, EyeOff, Star, Search, ImageOff } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { FilterChip } from '@/components/ui/filter-chip'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api/http'
import { formatVND } from '@/lib/utils/format'
import { adminProductApi } from '@/features/products/api'
import type { Product, ProductVariant } from '@/features/products/types'
import { categoryApi } from '@/features/categories/api'
import { brandApi } from '@/features/brands/api'
import type { Category } from '@/features/categories/types'
import type { Brand } from '@/features/brands/types'
import type { PaginationMeta } from '@/types/api'

const PAGE_SIZE = 12
const EMPTY_PAGINATION: PaginationMeta = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 }

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'
type FeaturedFilter = 'ALL' | 'FEATURED' | 'NORMAL'

export default function AdminProductsPage() {
  const [result, setResult] = useState<{ products: Product[]; pagination: PaginationMeta } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [categorySlug, setCategorySlug] = useState('')
  const [brandSlug, setBrandSlug] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [featuredFilter, setFeaturedFilter] = useState<FeaturedFilter>('ALL')
  const [page, setPage] = useState(1)

  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  // Tải danh mục + thương hiệu một lần cho filter dropdown.
  useEffect(() => {
    Promise.all([categoryApi.list(), brandApi.list()])
      .then(([cats, brs]) => {
        setCategories(cats)
        setBrands(brs)
      })
      .catch(() => {
        /* filter dropdown để trống — không chặn load sản phẩm */
      })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await adminProductApi.list({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        category: categorySlug || undefined,
        brand: brandSlug || undefined,
        isActive: statusFilter === 'ALL' ? undefined : statusFilter === 'ACTIVE',
        isFeatured: featuredFilter === 'ALL' ? undefined : featuredFilter === 'FEATURED',
      })
      setResult(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được danh sách sản phẩm')
    } finally {
      setLoading(false)
    }
  }, [page, search, categorySlug, brandSlug, statusFilter, featuredFilter])

  useEffect(() => {
    void load()
  }, [load])

  const resetPage = () => setPage(1)

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput.trim())
    resetPage()
  }

  // Bọc thao tác trên 1 dòng: set busy + bắt lỗi; cập nhật state cục bộ trong op.
  async function runBusy(id: string, op: () => Promise<void>, errMsg: string) {
    setBusyId(id)
    try {
      await op()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : errMsg)
    } finally {
      setBusyId(null)
    }
  }

  // Thực hiện 1 patch (toggleStatus/toggleFeatured) rồi merge kết quả vào list.
  function patchProduct(id: string, fn: () => Promise<Product>, errMsg: string) {
    return runBusy(id, async () => {
      const updated = await fn()
      setResult((prev) =>
        prev
          ? { ...prev, products: prev.products.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)) }
          : prev,
      )
    }, errMsg)
  }

  const handleToggleStatus = (p: Product) => patchProduct(p.id, () => adminProductApi.toggleStatus(p.id), 'Cập nhật trạng thái thất bại')
  const handleToggleFeatured = (p: Product) => patchProduct(p.id, () => adminProductApi.toggleFeatured(p.id), 'Cập nhật nổi bật thất bại')

  function handleDelete(product: Product) {
    if (!confirm(`Xoá sản phẩm "${product.name}"? Hành động này không thể hoàn tác.`)) return
    return runBusy(
      product.id,
      async () => {
        await adminProductApi.remove(product.id)
        setResult((prev) => {
          if (!prev) return prev
          const total = Math.max(0, prev.pagination.total - 1)
          return {
            products: prev.products.filter((p) => p.id !== product.id),
            pagination: { ...prev.pagination, total, totalPages: Math.ceil(total / prev.pagination.limit) },
          }
        })
      },
      'Xoá sản phẩm thất bại',
    )
  }

  const products = result?.products ?? []
  const pagination = result?.pagination ?? EMPTY_PAGINATION

  const rangeLabel = useMemo(() => {
    if (pagination.total === 0) return 'Không có sản phẩm'
    const from = (pagination.page - 1) * pagination.limit + 1
    const to = Math.min(pagination.page * pagination.limit, pagination.total)
    return `${from}–${to} / ${pagination.total}`
  }, [pagination])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quản lý Sản phẩm</h1>
          <p className="text-sm text-gray-500">Danh sách, bật/tắt trạng thái & nổi bật, xoá sản phẩm.</p>
        </div>
        <Link href="/admin/products/new" className={buttonVariants({ size: 'lg' })}>
          <Plus className="h-4 w-4" />
          Thêm sản phẩm
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm theo tên sản phẩm..."
            className="h-8 w-56 pl-8"
          />
        </form>

        {/* Category / Brand dropdown */}
        <select
          value={categorySlug}
          onChange={(e) => {
            setCategorySlug(e.target.value)
            resetPage()
          }}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={brandSlug}
          onChange={(e) => {
            setBrandSlug(e.target.value)
            resetPage()
          }}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">Tất cả thương hiệu</option>
          {brands.map((b) => (
            <option key={b.id} value={b.slug}>
              {b.name}
            </option>
          ))}
        </select>

        {/* Status chips */}
        <div className="ml-auto flex gap-2">
          {(['ALL', 'ACTIVE', 'INACTIVE'] as StatusFilter[]).map((s) => (
            <FilterChip
              key={s}
              active={statusFilter === s}
              label={s === 'ALL' ? 'Tất cả' : s === 'ACTIVE' ? 'Đang bán' : 'Đã ẩn'}
              onClick={() => {
                setStatusFilter(s)
                resetPage()
              }}
            />
          ))}
          {(['ALL', 'FEATURED', 'NORMAL'] as FeaturedFilter[]).map((f) => (
            <FilterChip
              key={f}
              active={featuredFilter === f}
              label={f === 'ALL' ? 'Mọi BT' : f === 'FEATURED' ? 'Nổi bật' : 'Thường'}
              onClick={() => {
                setFeaturedFilter(f)
                resetPage()
              }}
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
                <th className="px-4 py-3 font-medium">Danh mục</th>
                <th className="px-4 py-3 font-medium">Thương hiệu</th>
                <th className="px-4 py-3 text-right font-medium">Giá</th>
                <th className="px-4 py-3 text-center font-medium">Tồn</th>
                <th className="px-4 py-3 text-center font-medium">Trạng thái</th>
                <th className="px-4 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    Đang tải...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    Không có sản phẩm phù hợp.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    busy={busyId === product.id}
                    onToggleStatus={handleToggleStatus}
                    onToggleFeatured={handleToggleFeatured}
                    onDelete={handleDelete}
                  />
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

// ─── Product row ──────────────────────────────────────────────────────────────

function ProductRow({
  product,
  busy,
  onToggleStatus,
  onToggleFeatured,
  onDelete,
}: {
  product: Product
  busy: boolean
  onToggleStatus: (p: Product) => void
  onToggleFeatured: (p: Product) => void
  onDelete: (p: Product) => void
}) {
  const cover = product.images?.[0]?.url
  const variants = product.variants ?? []

  // Khoảng giá (variants đã orderBy salePrice asc ở backend).
  const minPrice = variants[0]?.salePrice
  const maxPrice = variants[variants.length - 1]?.salePrice
  const priceLabel =
    variants.length === 0
      ? '—'
      : minPrice === maxPrice
        ? formatVND(minPrice!)
        : `${formatVND(minPrice!)} – ${formatVND(maxPrice!)}`

  const totalStock = variants.reduce((sum, v) => sum + v.stock, 0)

  return (
    <tr className="hover:bg-gray-50/60">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-gray-100 ring-1 ring-border">
            {cover ? (
              <Image src={cover} alt={product.name} fill sizes="48px" className="object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-gray-300">
                <ImageOff className="h-5 w-5" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Link
                href={`/admin/products/${product.id}`}
                className="truncate font-medium text-gray-800 hover:text-[var(--color-primary)]"
              >
                {product.name}
              </Link>
              {product.isFeatured && (
                <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
              )}
            </div>
            <div className="truncate text-xs text-gray-400">/{product.slug}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-gray-600">{product.category?.name ?? '—'}</td>
      <td className="px-4 py-3 text-gray-600">{product.brand?.name ?? '—'}</td>
      <td className="px-4 py-3 text-right text-gray-700">{priceLabel}</td>
      <td className="px-4 py-3 text-center text-gray-600">{totalStock.toLocaleString('vi-VN')}</td>
      <td className="px-4 py-3 text-center">
        {product.isActive ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Đang bán
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
            Đã ẩn
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={busy}
            onClick={() => onToggleFeatured(product)}
            title={product.isFeatured ? 'Bỏ nổi bật' : 'Đánh dấu nổi bật'}
          >
            <Star className={`h-4 w-4 ${product.isFeatured ? 'fill-amber-400 text-amber-400' : 'text-gray-400'}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={busy}
            onClick={() => onToggleStatus(product)}
            title={product.isActive ? 'Ẩn sản phẩm' : 'Hiện sản phẩm'}
          >
            {product.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Link
            href={`/admin/products/${product.id}`}
            className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
            title="Sửa"
          >
            <Pencil className="h-4 w-4" />
          </Link>
          <Button
            variant="destructive"
            size="icon-sm"
            disabled={busy}
            onClick={() => onDelete(product)}
            title="Xoá"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  )
}
