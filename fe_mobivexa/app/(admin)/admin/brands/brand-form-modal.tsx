'use client'

import { useState, type FormEvent } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api/http'
import { useImageUpload } from '@/lib/hooks/use-image-upload'
import { adminBrandApi } from '@/features/brands/api'
import type { Brand, BrandPayload } from '@/features/brands/types'

interface BrandFormModalProps {
  /** Thương hiệu đang sửa, hoặc null khi tạo mới */
  editing: Brand | null
  onClose: () => void
  onSaved: (saved?: Brand) => void
}

export function BrandFormModal({ editing, onClose, onSaved }: BrandFormModalProps) {
  const isEdit = editing !== null

  const [name, setName] = useState(editing?.name ?? '')
  const [slug, setSlug] = useState(editing?.slug ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [isActive, setIsActive] = useState(editing?.isActive ?? true)

  const { file: logoFile, preview, error: imageError, clearError, handlePickFile } = useImageUpload({
    initialUrl: editing?.logoUrl,
  })

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    clearError()

    if (name.trim().length < 2) {
      setError('Tên thương hiệu phải có ít nhất 2 ký tự')
      return
    }

    const payload: BrandPayload = {
      name: name.trim(),
      description: description.trim(),
      isActive,
      slug: slug.trim() || undefined,
    }

    setSubmitting(true)
    try {
      let savedBrand: Brand
      if (isEdit) {
        savedBrand = await adminBrandApi.update(editing.id, payload, logoFile ?? undefined)
      } else {
        savedBrand = await adminBrandApi.create(payload, logoFile ?? undefined)
      }
      onSaved(savedBrand)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Lưu thương hiệu thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog title={isEdit ? 'Sửa thương hiệu' : 'Thêm thương hiệu'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          {(error || imageError) && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">
              {error || imageError}
            </div>
          )}

          {/* Logo */}
          <div className="space-y-1.5">
            <Label>Logo (tuỳ chọn)</Label>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground transition-colors hover:bg-muted/60">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="preview" className="max-h-28 w-auto rounded-md object-contain" />
              ) : (
                <>
                  <Upload className="h-6 w-6" />
                  <span>Bấm để chọn logo (JPG, PNG, WebP — tối đa 5MB)</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePickFile(e.target.files?.[0])}
              />
            </label>
            {preview && (
              <p className="text-xs text-muted-foreground">Bấm vào ảnh để chọn logo khác</p>
            )}
          </div>

          {/* Tên */}
          <div className="space-y-1.5">
            <Label htmlFor="name">
              Tên thương hiệu <span className="text-[var(--color-danger)]">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Apple, Samsung, Xiaomi..."
            />
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug (tuỳ chọn)</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="apple"
            />
            <p className="text-xs text-muted-foreground">Để trống sẽ tự tạo từ tên thương hiệu.</p>
          </div>

          {/* Mô tả */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Mô tả (tuỳ chọn)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Giới thiệu ngắn về thương hiệu"
            />
          </div>

          {/* Trạng thái */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            Đang hiển thị
          </label>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" size="lg" onClick={onClose}>
              Huỷ
            </Button>
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo thương hiệu'}
            </Button>
          </div>
      </form>
    </Dialog>
  )
}
