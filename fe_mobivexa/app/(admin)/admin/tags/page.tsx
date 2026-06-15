'use client'

import { useState } from 'react'
import { Plus, X, Tag as TagIcon } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { consolidateApiError } from '@/lib/utils/error'
import { Loading } from '@/components/ui/loading'
import { ApiError } from '@/lib/api/http'
import { adminTagApi } from '@/features/tags/api'
import type { Tag } from '@/features/tags/types'
import { TagFormModal } from './tag-form-modal'

export default function AdminTagsPage() {
  const queryClient = useQueryClient()

  const [actionError, setActionError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const { data: tags = [], isLoading, error: fetchError } = useQuery<Tag[]>({
    queryKey: ['admin-tags'],
    queryFn: () => adminTagApi.list(),
  })

  function handleSaved(savedTag: Tag) {
    setModalOpen(false)
    // Optimistic update: thêm tag mới vào đầu danh sách
    queryClient.setQueryData<Tag[]>(['admin-tags'], (prev) => [savedTag, ...(prev ?? [])])
  }

  async function handleDelete(tag: Tag) {
    if (!confirm(`Xoá tag "${tag.name}"?`)) return

    setBusyId(tag.id)
    try {
      await adminTagApi.remove(tag.id)
      queryClient.setQueryData<Tag[]>(['admin-tags'], (prev) => (prev ?? []).filter((t) => t.id !== tag.id))
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Xoá tag thất bại')
    } finally {
      setBusyId(null)
    }
  }

  const errorMsg = consolidateApiError(actionError, fetchError, 'tag')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quản lý Tags</h1>
          <p className="text-sm text-gray-500">Thẻ gắn cho sản phẩm để lọc và tìm kiếm.</p>
        </div>
        <Button size="lg" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Thêm tag
        </Button>
      </div>

      <Loading.ErrorMessage message={errorMsg} />

      {/* Lưới chip tags */}
      {isLoading ? (
        <div className="rounded-xl bg-white px-4 py-10 text-center text-sm text-gray-400 ring-1 ring-border">
          Đang tải...
        </div>
      ) : tags.length === 0 ? (
        <div className="rounded-xl bg-white px-4 py-10 text-center text-sm text-gray-400 ring-1 ring-border">
          <TagIcon className="mx-auto mb-2 h-8 w-8 text-gray-200" />
          Chưa có tag nào. Bấm &quot;Thêm tag&quot; để tạo mới.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="group inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm ring-1 ring-border transition-colors hover:bg-gray-50"
            >
              <span className="font-medium text-gray-800">{tag.name}</span>
              {tag._count && tag._count.productTags > 0 && (
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                  {tag._count.productTags}
                </span>
              )}
              <button
                type="button"
                disabled={busyId === tag.id}
                onClick={() => handleDelete(tag)}
                className="rounded-full p-0.5 text-gray-400 transition-colors hover:bg-red-100 hover:text-[var(--color-danger)] disabled:opacity-50"
                title="Xoá tag"
                aria-label={`Xoá tag ${tag.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <TagFormModal
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
