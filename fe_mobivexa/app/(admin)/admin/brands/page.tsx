'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { Plus, Pencil, Trash2, Eye, EyeOff, ImageOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api/http'
import { adminBrandApi } from '@/features/brands/api'
import type { Brand } from '@/features/brands/types'
import { BrandFormModal } from './brand-form-modal'

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Brand | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

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
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(brand: Brand) {
    setEditing(brand)
    setModalOpen(true)
  }

  function handleSaved() {
    setModalOpen(false)
    void load()
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

  function handleToggle(brand: Brand) {
    return runBusy(
      brand.id,
      async () => {
        const updated = await adminBrandApi.toggleStatus(brand.id)
        setBrands((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
      },
      'Cập nhật trạng thái thất bại',
    )
  }

  function handleDelete(brand: Brand) {
    if (!confirm(`Xoá thương hiệu "${brand.name}"?`)) return
    return runBusy(
      brand.id,
      async () => {
        await adminBrandApi.remove(brand.id)
        setBrands((prev) => prev.filter((b) => b.id !== brand.id))
      },
      'Xoá thương hiệu thất bại',
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
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

      {/* Bảng */}
      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Logo</th>
              <th className="px-4 py-3 font-medium">Thương hiệu</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                  Đang tải...
                </td>
              </tr>
            ) : brands.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                  Chưa có thương hiệu nào. Bấm “Thêm thương hiệu” để tạo mới.
                </td>
              </tr>
            ) : (
              brands.map((b) => (
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
                    {b.description && (
                      <div className="line-clamp-1 text-xs text-gray-400">{b.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {b.isActive ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Hiển thị
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                        Ẩn
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
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
                        variant="destructive"
                        size="icon-sm"
                        disabled={busyId === b.id}
                        onClick={() => handleDelete(b)}
                        title="Xoá"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <BrandFormModal editing={editing} onClose={() => setModalOpen(false)} onSaved={handleSaved} />
      )}
    </div>
  )
}
