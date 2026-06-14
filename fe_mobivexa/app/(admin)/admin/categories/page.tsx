'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { Plus, Pencil, Trash2, Eye, EyeOff, ImageOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api/http'
import { adminCategoryApi } from '@/features/categories/api'
import type { Category } from '@/features/categories/types'
import { CategoryFormModal } from './category-form-modal'

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

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
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(category: Category) {
    setEditing(category)
    setModalOpen(true)
  }

  function handleSaved(savedCategory?: Category) {
    setModalOpen(false)
    // Optimistic update: nếu có returned data từ API, dùng nó để update state local
    if (savedCategory) {
      setCategories((prev) => {
        const exists = prev.find((c) => c.id === savedCategory.id)
        if (exists) {
          // Update existing
          return prev.map((c) => (c.id === savedCategory.id ? savedCategory : c))
        } else {
          // Add new
          return [...prev, savedCategory]
        }
      })
    } else {
      // Fallback to reload nếu không có data
      void load()
    }
  }

  // Bọc thao tác trên 1 dòng: set busy + bắt lỗi. Cập nhật state cục bộ trong
  // op (không refetch toàn bộ danh sách).
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

  function handleToggle(category: Category) {
    return runBusy(
      category.id,
      async () => {
        const updated = await adminCategoryApi.toggleStatus(category.id)
        setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      },
      'Cập nhật trạng thái thất bại',
    )
  }

  function handleDelete(category: Category) {
    if (!confirm(`Xoá danh mục "${category.name}"?`)) return
    return runBusy(
      category.id,
      async () => {
        await adminCategoryApi.remove(category.id)
        setCategories((prev) => prev.filter((c) => c.id !== category.id))
      },
      'Xoá danh mục thất bại',
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
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

      {/* Bảng */}
      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Ảnh</th>
              <th className="px-4 py-3 font-medium">Tên danh mục</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Sản phẩm</th>
              <th className="px-4 py-3 font-medium">Thứ tự</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
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
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  Chưa có danh mục nào. Bấm "Thêm danh mục" để tạo mới.
                </td>
              </tr>
            ) : (
              categories.map((category) => (
                <tr key={category.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <div className="relative h-12 w-12 overflow-hidden rounded-md bg-gray-100 ring-1 ring-border">
                      {category.imageUrl ? (
                        <Image
                          src={category.imageUrl}
                          alt={category.name}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
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
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                      {category.slug}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {category._count?.products ?? 0}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{category.sortOrder}</td>
                  <td className="px-4 py-3">
                    {category.isActive ? (
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
                        disabled={busyId === category.id}
                        onClick={() => handleToggle(category)}
                        title={category.isActive ? 'Ẩn danh mục' : 'Hiển thị danh mục'}
                      >
                        {category.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(category)}
                        title="Sửa"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        disabled={busyId === category.id}
                        onClick={() => handleDelete(category)}
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
        <CategoryFormModal
          editing={editing}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
