'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, X, Tag as TagIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api/http'
import { adminTagApi } from '@/features/tags/api'
import type { Tag } from '@/features/tags/types'
import { TagFormModal } from './tag-form-modal'

export default function AdminTagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setTags(await adminTagApi.list())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được danh sách tag')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  function handleSaved(savedTag: Tag) {
    setModalOpen(false)
    // Optimistic update: thêm tag mới vào đầu danh sách
    setTags((prev) => [savedTag, ...prev])
  }

  async function handleDelete(tag: Tag) {
    if (!confirm(`Xoá tag "${tag.name}"?`)) return

    setBusyId(tag.id)
    try {
      await adminTagApi.remove(tag.id)
      setTags((prev) => prev.filter((t) => t.id !== tag.id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Xoá tag thất bại')
    } finally {
      setBusyId(null)
    }
  }

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

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>
      )}

      {/* Lưới chip tags */}
      {loading ? (
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
