'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { Plus, Pencil, Trash2, Eye, EyeOff, ImageOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AdminTable } from '@/components/ui/admin-table'
import { StatusDot } from '@/components/ui/status-dot'
import { upsertById } from '@/lib/utils/list'
import { useRowAction } from '@/lib/hooks/use-row-action'
import { ApiError } from '@/lib/api/http'
import { adminBrandApi } from '@/features/brands/api'
import type { Brand } from '@/features/brands/types'
import { BrandFormModal } from './brand-form-modal'

const COLUMNS = [
  'Logo', 'Thương hiệu', 'Trạng thái', { label: 'Thao tác', className: 'text-right' },
] as const

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Brand | null>(null)

  const { busyId, runBusy } = useRowAction(setError)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setBrands(await adminBrandApi.list())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được danh sách thương hiệu')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  function openCreate() { setEditing(null); setModalOpen(true) }
  function openEdit(brand: Brand) { setEditing(brand); setModalOpen(true) }

  function handleSaved(savedBrand?: Brand) {
    setModalOpen(false)
    if (savedBrand) setBrands((prev) => upsertById(prev, savedBrand))
    else void load()
  }

  function handleToggle(brand: Brand) {
    return runBusy(brand.id, async () => {
      const updated = await adminBrandApi.toggleStatus(brand.id)
      setBrands((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
    }, 'Cập nhật trạng thái thất bại')
  }

  function handleDelete(brand: Brand) {
    if (!confirm(`Xoá thương hiệu "${brand.name}"?`)) return
    return runBusy(brand.id, async () => {
      await adminBrandApi.remove(brand.id)
      setBrands((prev) => prev.filter((b) => b.id !== brand.id))
    }, 'Xoá thương hiệu thất bại')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quản lý Thương hiệu</h1>
          <p className="text-sm text-gray-500">Thương hiệu sản phẩm hiển thị trên cửa hàng.</p>
        </div>
        <Button size="lg" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Thêm thương hiệu
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>
      )}

      <AdminTable
        columns={COLUMNS}
        colSpan={4}
        loading={loading}
        empty={brands.length === 0}
        emptyMessage='Chưa có thương hiệu nào. Bấm "Thêm thương hiệu" để tạo mới.'
      >
        {brands.map((b) => (
          <tr key={b.id} className="hover:bg-gray-50/60">
            <td className="px-4 py-3">
              <div className="relative grid h-12 w-12 place-items-center overflow-hidden rounded-md bg-gray-50 ring-1 ring-border">
                {b.logoUrl ? (
                  <Image src={b.logoUrl} alt={b.name} fill sizes="48px" className="object-contain p-1" />
                ) : (
                  <ImageOff className="h-5 w-5 text-gray-300" />
                )}
              </div>
            </td>
            <td className="px-4 py-3">
              <div className="font-medium text-gray-800">{b.name}</div>
              <div className="text-xs text-gray-400">/{b.slug}</div>
              {b.description && <div className="line-clamp-1 text-xs text-gray-400">{b.description}</div>}
            </td>
            <td className="px-4 py-3">
              <StatusDot active={b.isActive} activeLabel="Hiển thị" inactiveLabel="Ẩn" />
            </td>
            <td className="px-4 py-3">
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost" size="icon-sm"
                  disabled={busyId === b.id}
                  onClick={() => handleToggle(b)}
                  title={b.isActive ? 'Ẩn thương hiệu' : 'Hiển thị thương hiệu'}
                >
                  {b.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => openEdit(b)} title="Sửa">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive" size="icon-sm"
                  disabled={busyId === b.id}
                  onClick={() => handleDelete(b)}
                  title="Xoá"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>

      {modalOpen && (
        <BrandFormModal editing={editing} onClose={() => setModalOpen(false)} onSaved={handleSaved} />
      )}
    </div>
  )
}
