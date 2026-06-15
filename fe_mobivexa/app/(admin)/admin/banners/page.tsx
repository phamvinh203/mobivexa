'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Plus, Pencil, Trash2, Eye, EyeOff, ImageOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AdminTable } from '@/components/ui/admin-table'
import { StatusDot } from '@/components/ui/status-dot'
import { upsertById } from '@/lib/utils/list'
import { useRowAction } from '@/lib/hooks/use-row-action'
import { ApiError } from '@/lib/api/http'
import { adminBannerApi } from '@/features/banners/api'
import {
  BANNER_POSITIONS,
  BANNER_POSITION_META,
  type Banner,
  type BannerPosition,
} from '@/features/banners/types'
import { BannerFormModal } from './banner-form-modal'

const COLUMNS = [
  'Ảnh', 'Nội dung', 'Vị trí', 'Thứ tự', 'Trạng thái',
  { label: 'Thao tác', className: 'text-right' },
] as const

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<BannerPosition | 'ALL'>('ALL')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Banner | null>(null)

  const { busyId, runBusy } = useRowAction(setError)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setBanners(await adminBannerApi.list())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được danh sách banner')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  // Tải toàn bộ banner một lần; lọc theo vị trí ở client (danh sách nhỏ).
  const visible = useMemo(
    () => (filter === 'ALL' ? banners : banners.filter((b) => b.position === filter)),
    [banners, filter],
  )

  function openCreate() { setEditing(null); setModalOpen(true) }
  function openEdit(banner: Banner) { setEditing(banner); setModalOpen(true) }

  function handleSaved(savedBanner?: Banner) {
    setModalOpen(false)
    if (savedBanner) setBanners((prev) => upsertById(prev, savedBanner))
    else void load()
  }

  function handleToggle(banner: Banner) {
    return runBusy(banner.id, async () => {
      const updated = await adminBannerApi.toggleStatus(banner.id)
      setBanners((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
    }, 'Cập nhật trạng thái thất bại')
  }

  function handleDelete(banner: Banner) {
    if (!confirm(`Xoá banner "${banner.alt}"?`)) return
    return runBusy(banner.id, async () => {
      await adminBannerApi.remove(banner.id)
      setBanners((prev) => prev.filter((b) => b.id !== banner.id))
    }, 'Xoá banner thất bại')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quản lý Banner</h1>
          <p className="text-sm text-gray-500">Banner hiển thị trên trang chủ theo từng vị trí.</p>
        </div>
        <Button size="lg" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Thêm banner
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['ALL', ...BANNER_POSITIONS] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setFilter(p)}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              filter === p
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-white text-gray-600 ring-1 ring-border hover:bg-gray-50'
            }`}
          >
            {p === 'ALL' ? 'Tất cả' : BANNER_POSITION_META[p].label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>
      )}

      <AdminTable
        columns={COLUMNS}
        colSpan={6}
        loading={loading}
        empty={visible.length === 0}
        emptyMessage='Chưa có banner nào. Bấm "Thêm banner" để tạo mới.'
      >
        {visible.map((b) => (
          <tr key={b.id} className="hover:bg-gray-50/60">
            <td className="px-4 py-3">
              <div className="relative h-12 w-20 overflow-hidden rounded-md bg-gray-100 ring-1 ring-border">
                {b.imageUrl ? (
                  <Image src={b.imageUrl} alt={b.alt} fill sizes="80px" className="object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-gray-300">
                    <ImageOff className="h-5 w-5" />
                  </div>
                )}
              </div>
            </td>
            <td className="px-4 py-3">
              <div className="font-medium text-gray-800">{b.alt}</div>
              {b.description && <div className="line-clamp-1 text-xs text-gray-400">{b.description}</div>}
              <div className="text-xs text-gray-400">{b.href ?? '/products'}</div>
            </td>
            <td className="px-4 py-3">
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${BANNER_POSITION_META[b.position].badgeClass}`}>
                {BANNER_POSITION_META[b.position].label}
              </span>
            </td>
            <td className="px-4 py-3 text-gray-600">{b.sortOrder}</td>
            <td className="px-4 py-3">
              <StatusDot active={b.isActive} activeLabel="Hiển thị" inactiveLabel="Ẩn" />
            </td>
            <td className="px-4 py-3">
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost" size="icon-sm"
                  disabled={busyId === b.id}
                  onClick={() => handleToggle(b)}
                  title={b.isActive ? 'Ẩn banner' : 'Hiển thị banner'}
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
        <BannerFormModal editing={editing} onClose={() => setModalOpen(false)} onSaved={handleSaved} />
      )}
    </div>
  )
}
