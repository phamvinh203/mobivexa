'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { X, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api/http'
import { assertImageFile } from '@/lib/utils/file'
import { adminBannerApi } from '@/features/banners/api'
import {
  BANNER_POSITIONS,
  BANNER_POSITION_META,
  type Banner,
  type BannerPosition,
} from '@/features/banners/types'

interface BannerFormModalProps {
  /** Banner đang sửa, hoặc null khi tạo mới */
  editing: Banner | null
  onClose: () => void
  onSaved: () => void
}

export function BannerFormModal({ editing, onClose, onSaved }: BannerFormModalProps) {
  const isEdit = editing !== null

  const [alt, setAlt] = useState(editing?.alt ?? '')
  const [href, setHref] = useState(editing?.href ?? '/products')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [position, setPosition] = useState<BannerPosition>(editing?.position ?? 'HERO')
  const [sortOrder, setSortOrder] = useState(String(editing?.sortOrder ?? 0))
  const [isActive, setIsActive] = useState(editing?.isActive ?? true)

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(editing?.imageUrl ?? null)
  const objectUrlRef = useRef<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Thu hồi object URL khi đổi ảnh / unmount để tránh rò rỉ bộ nhớ
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  function handlePickImage(file: File | undefined) {
    if (!file) return
    try {
      assertImageFile(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ảnh không hợp lệ')
      return
    }
    setError('')
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setImageFile(file)
    setPreview(url)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (alt.trim().length < 2) {
      setError('Alt text phải có ít nhất 2 ký tự')
      return
    }
    if (!isEdit && !imageFile) {
      setError('Vui lòng chọn ảnh banner')
      return
    }

    const payload = {
      alt: alt.trim(),
      href: href.trim() || '/products',
      description: description.trim(),
      position,
      isActive,
      sortOrder: Number(sortOrder) || 0,
    }

    setSubmitting(true)
    try {
      if (isEdit) {
        await adminBannerApi.update(editing.id, payload, imageFile ?? undefined)
      } else {
        await adminBannerApi.create(payload, imageFile!)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Lưu banner thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-bold">{isEdit ? 'Sửa banner' : 'Thêm banner'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">
              {error}
            </div>
          )}

          {/* Ảnh */}
          <div className="space-y-1.5">
            <Label>Ảnh banner {!isEdit && <span className="text-[var(--color-danger)]">*</span>}</Label>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground transition-colors hover:bg-muted/60">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="preview" className="max-h-40 w-auto rounded-md object-contain" />
              ) : (
                <>
                  <Upload className="h-6 w-6" />
                  <span>Bấm để chọn ảnh (JPG, PNG, WebP — tối đa 5MB)</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePickImage(e.target.files?.[0])}
              />
            </label>
            {preview && (
              <p className="text-xs text-muted-foreground">Bấm vào ảnh để chọn ảnh khác</p>
            )}
          </div>

          {/* Vị trí */}
          <div className="space-y-1.5">
            <Label htmlFor="position">Vị trí hiển thị</Label>
            <select
              id="position"
              value={position}
              onChange={(e) => setPosition(e.target.value as BannerPosition)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {BANNER_POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {BANNER_POSITION_META[p].label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{BANNER_POSITION_META[position].hint}</p>
          </div>

          {/* Alt */}
          <div className="space-y-1.5">
            <Label htmlFor="alt">
              Alt text <span className="text-[var(--color-danger)]">*</span>
            </Label>
            <Input
              id="alt"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Mô tả ngắn cho ảnh (SEO + accessibility)"
            />
          </div>

          {/* Href */}
          <div className="space-y-1.5">
            <Label htmlFor="href">Link điều hướng</Label>
            <Input
              id="href"
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="/products?tag=hot"
            />
          </div>

          {/* Mô tả */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Mô tả (tuỳ chọn)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ghi chú nội bộ về banner này"
            />
          </div>

          {/* Thứ tự + trạng thái */}
          <div className="flex items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sortOrder">Thứ tự</Label>
              <Input
                id="sortOrder"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-24"
              />
            </div>
            <label className="flex h-8 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              Đang hiển thị
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" size="lg" onClick={onClose}>
              Huỷ
            </Button>
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo banner'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
