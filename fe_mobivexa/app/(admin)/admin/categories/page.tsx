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
import { adminCategoryApi } from '@/features/categories/api'
import type { Category } from '@/features/categories/types'
import { CategoryFormModal } from './category-form-modal'

const COLUMNS = [
  'Ảnh', 'Tên danh mục', 'Slug', 'Sản phẩm', 'Thứ tự', 'Trạng thái',
  { label: 'Thao tác', className: 'text-right' },
] as const

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)

  const { busyId, runBusy } = useRowAction(setError)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setCategories(await adminCategoryApi.list())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được danh sách danh mục')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  function openCreate() { setEditing(null); setModalOpen(true) }
  function openEdit(category: Category) { setEditing(category); setModalOpen(true) }

  function handleSaved(savedCategory?: Category) {
    setModalOpen(false)
    if (savedCategory) setCategories((prev) => upsertById(prev, savedCategory))
    else void load()
  }

  function handleToggle(category: Category) {
    return runBusy(category.id, async () => {
      const updated = await adminCategoryApi.toggleStatus(category.id)
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    }, 'Cập nhật trạng thái thất bại')
  }

  function handleDelete(category: Category) {
    if (!confirm(`Xoá danh mục "${category.name}"?`)) return
    return runBusy(category.id, async () => {
      await adminCategoryApi.remove(category.id)
      setCategories((prev) => prev.filter((c) => c.id !== category.id))
    }, 'Xoá danh mục thất bại')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quản lý Danh mục</h1>
          <p className="text-sm text-gray-500">Danh mục sản phẩm hiển thị trên cửa hàng.</p>
        </div>
        <Button size="lg" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Thêm danh mục
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>
      )}

      <AdminTable
        columns={COLUMNS}
        colSpan={7}
        loading={loading}
        empty={categories.length === 0}
        emptyMessage='Chưa có danh mục nào. Bấm "Thêm danh mục" để tạo mới.'
      >
        {categories.map((category) => (
          <tr key={category.id} className="hover:bg-gray-50/60">
            <td className="px-4 py-3">
              <div className="relative h-12 w-12 overflow-hidden rounded-md bg-gray-100 ring-1 ring-border">
                {category.imageUrl ? (
                  <Image src={category.imageUrl} alt={category.name} fill sizes="48px" className="object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-gray-300">
                    <ImageOff className="h-5 w-5" />
                  </div>
                )}
              </div>
            </td>
            <td className="px-4 py-3">
              <div className="font-medium text-gray-800">{category.name}</div>
              {category.description && (
                <div className="line-clamp-1 text-xs text-gray-400">{category.description}</div>
              )}
            </td>
            <td className="px-4 py-3">
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{category.slug}</code>
            </td>
            <td className="px-4 py-3 text-gray-600">{category._count?.products ?? 0}</td>
            <td className="px-4 py-3 text-gray-600">{category.sortOrder}</td>
            <td className="px-4 py-3">
              <StatusDot active={category.isActive} activeLabel="Hiển thị" inactiveLabel="Ẩn" />
            </td>
            <td className="px-4 py-3">
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost" size="icon-sm"
                  disabled={busyId === category.id}
                  onClick={() => handleToggle(category)}
                  title={category.isActive ? 'Ẩn danh mục' : 'Hiển thị danh mục'}
                >
                  {category.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => openEdit(category)} title="Sửa">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive" size="icon-sm"
                  disabled={busyId === category.id}
                  onClick={() => handleDelete(category)}
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
        <CategoryFormModal
          editing={editing}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
