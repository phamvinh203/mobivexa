'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Plus, Pencil, Trash2, Eye, EyeOff, Star, Search, ImageOff } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, buttonVariants } from '@/components/ui/button'
import { FilterChip } from '@/components/ui/filter-chip'
import { Input } from '@/components/ui/input'
import { AdminTable } from '@/components/ui/admin-table'
import { Pagination } from '@/components/ui/pagination'
import { NativeSelect } from '@/components/ui/native-select'
import { StatusDot } from '@/components/ui/status-dot'
import { consolidateApiError } from '@/lib/utils/error'
import { useRowAction } from '@/lib/hooks/use-row-action'
import { ApiError } from '@/lib/api/http'
import { formatVND } from '@/lib/utils/format'
import { adminProductApi } from '@/features/products/api'
import type { Product } from '@/features/products/types'
import { categoryApi } from '@/features/categories/api'
import { brandApi } from '@/features/brands/api'
import type { PaginationMeta } from '@/types/api'

const PAGE_SIZE = 12
const EMPTY_PAGINATION: PaginationMeta = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 }

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'
type FeaturedFilter = 'ALL' | 'FEATURED' | 'NORMAL'

const COLUMNS = [
  'Sản phẩm', 'Danh mục', 'Thương hiệu',
  { label: 'Giá', className: 'text-right' },
  { label: 'Tồn', className: 'text-center' },
  { label: 'Trạng thái', className: 'text-center' },
  { label: 'Thao tác', className: 'text-right' },
] as const

type ProductsData = { products: Product[]; pagination: PaginationMeta }

export default function AdminProductsPage() {
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState('')

  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [categorySlug, setCategorySlug] = useState('')
  const [brandSlug, setBrandSlug] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [featuredFilter, setFeaturedFilter] = useState<FeaturedFilter>('ALL')
  const [page, setPage] = useState(1)

  const { busyId, runBusy } = useRowAction(setActionError)

  // ── Filter data (hiếm thay đổi) ───────────────────────────────────────────
  const { data: categories = [] } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => categoryApi.list(),
  })
  const { data: brands = [] } = useQuery({
    queryKey: ['admin-brands'],
    queryFn: () => brandApi.list(),
  })

  // ── Danh sách sản phẩm ────────────────────────────────────────────────────
  const productsKey = ['admin-products', page, search, categorySlug, brandSlug, statusFilter, featuredFilter]

  const { data, isLoading, error: fetchError } = useQuery<ProductsData>({
    queryKey: productsKey,
    queryFn: () => adminProductApi.list({
      page,
      limit: PAGE_SIZE,
      search: search || undefined,
      category: categorySlug || undefined,
      brand: brandSlug || undefined,
      isActive: statusFilter === 'ALL' ? undefined : statusFilter === 'ACTIVE',
      isFeatured: featuredFilter === 'ALL' ? undefined : featuredFilter === 'FEATURED',
    }),
  })

  const products = data?.products ?? []
  const pagination = data?.pagination ?? EMPTY_PAGINATION
  const errorMsg = consolidateApiError(actionError, fetchError, 'sản phẩm')

  const resetPage = () => setPage(1)

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput.trim())
    resetPage()
  }

  function patchProduct(id: string, fn: () => Promise<Product>, errMsg: string) {
    return runBusy(id, async () => {
      const updated = await fn()
      queryClient.setQueryData<ProductsData>(productsKey, (prev) =>
        prev ? { ...prev, products: prev.products.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)) } : prev,
      )
    }, errMsg)
  }

  const handleToggleStatus = (p: Product) => patchProduct(p.id, () => adminProductApi.toggleStatus(p.id), 'Cập nhật trạng thái thất bại')
  const handleToggleFeatured = (p: Product) => patchProduct(p.id, () => adminProductApi.toggleFeatured(p.id), 'Cập nhật nổi bật thất bại')

  function handleDelete(product: Product) {
    if (!confirm(`Xoá sản phẩm "${product.name}"? Hành động này không thể hoàn tác.`)) return
    return runBusy(product.id, async () => {
      await adminProductApi.remove(product.id)
      queryClient.setQueryData<ProductsData>(productsKey, (prev) => {
        if (!prev) return prev
        const total = Math.max(0, prev.pagination.total - 1)
        return {
          products: prev.products.filter((p) => p.id !== product.id),
          pagination: { ...prev.pagination, total, totalPages: Math.ceil(total / prev.pagination.limit) },
        }
      })
    }, 'Xoá sản phẩm thất bại')
  }

  return (
    <div className="space-y-5">
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

        <NativeSelect value={categorySlug} onChange={(e) => { setCategorySlug(e.target.value); resetPage() }}>
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </NativeSelect>

        <NativeSelect value={brandSlug} onChange={(e) => { setBrandSlug(e.target.value); resetPage() }}>
          <option value="">Tất cả thương hiệu</option>
          {brands.map((b) => <option key={b.id} value={b.slug}>{b.name}</option>)}
        </NativeSelect>

        <div className="ml-auto flex gap-2">
          {(['ALL', 'ACTIVE', 'INACTIVE'] as StatusFilter[]).map((s) => (
            <FilterChip
              key={s}
              active={statusFilter === s}
              label={s === 'ALL' ? 'Tất cả' : s === 'ACTIVE' ? 'Đang bán' : 'Đã ẩn'}
              onClick={() => { setStatusFilter(s); resetPage() }}
            />
          ))}
          {(['ALL', 'FEATURED', 'NORMAL'] as FeaturedFilter[]).map((f) => (
            <FilterChip
              key={f}
              active={featuredFilter === f}
              label={f === 'ALL' ? 'Mọi BT' : f === 'FEATURED' ? 'Nổi bật' : 'Thường'}
              onClick={() => { setFeaturedFilter(f); resetPage() }}
            />
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">{errorMsg}</div>
      )}

      <AdminTable
        columns={COLUMNS}
        colSpan={7}
        loading={isLoading}
        empty={products.length === 0}
        emptyMessage="Không có sản phẩm phù hợp."
        scrollable
        footer={
          pagination.totalPages > 1
            ? <Pagination meta={pagination} loading={isLoading} emptyLabel="Không có sản phẩm" onChange={setPage} />
            : undefined
        }
      >
        {products.map((product) => (
          <ProductRow
            key={product.id}
            product={product}
            busy={busyId === product.id}
            onToggleStatus={handleToggleStatus}
            onToggleFeatured={handleToggleFeatured}
            onDelete={handleDelete}
          />
        ))}
      </AdminTable>
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

  const priceLabel = variants[0] ? formatVND(variants[0].salePrice) : '—'

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
              {product.isFeatured && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
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
        <StatusDot active={product.isActive} activeLabel="Đang bán" inactiveLabel="Đã ẩn" />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost" size="icon-sm" disabled={busy}
            onClick={() => onToggleFeatured(product)}
            title={product.isFeatured ? 'Bỏ nổi bật' : 'Đánh dấu nổi bật'}
          >
            <Star className={`h-4 w-4 ${product.isFeatured ? 'fill-amber-400 text-amber-400' : 'text-gray-400'}`} />
          </Button>
          <Button
            variant="ghost" size="icon-sm" disabled={busy}
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
            variant="destructive" size="icon-sm" disabled={busy}
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
