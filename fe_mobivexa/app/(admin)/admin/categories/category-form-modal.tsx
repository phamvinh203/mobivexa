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
import { adminCategoryApi } from '@/features/categories/api'
import type { Category, CategoryPayload } from '@/features/categories/types'

interface CategoryFormModalProps {
  /** Danh mục đang sửa, hoặc null khi tạo mới */
  editing: Category | null
  onClose: () => void
  onSaved: (saved?: Category) => void
}

export function CategoryFormModal({ editing, onClose, onSaved }: CategoryFormModalProps) {
  const isEdit = editing !== null

  const [name, setName] = useState(editing?.name ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [sortOrder, setSortOrder] = useState(String(editing?.sortOrder ?? 0))
  const [isActive, setIsActive] = useState(editing?.isActive ?? true)

  const { file: imageFile, preview, error: imageError, clearError, handlePickFile } = useImageUpload({
    initialUrl: editing?.imageUrl,
  })

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    clearError()

    if (name.trim().length < 2) {
      setError('Tên danh mục phải có ít nhất 2 ký tự')
      return
    }

    const payload: CategoryPayload = {
      name: name.trim(),
      description: description.trim(),
      sortOrder: Number(sortOrder) || 0,
    }

    setSubmitting(true)
    try {
      let savedCategory: Category
      if (isEdit) {
        savedCategory = await adminCategoryApi.update(editing.id, payload, imageFile ?? undefined)
      } else {
        savedCategory = await adminCategoryApi.create(payload, imageFile ?? undefined)
      }
      onSaved(savedCategory)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Lưu danh mục thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog title={isEdit ? 'Sửa danh mục' : 'Thêm danh mục'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
        {(error || imageError) && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">
            {error || imageError}
          </div>
        )}

        {/* Ảnh */}
        <div className="space-y-1.5">
          <Label>Ảnh danh mục (tuỳ chọn)</Label>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground transition-colors hover:bg-muted/60">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="preview" className="max-h-32 w-auto rounded-md object-contain" />
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
              onChange={(e) => handlePickFile(e.target.files?.[0])}
            />
          </label>
          {preview && (
            <p className="text-xs text-muted-foreground">Bấm vào ảnh để chọn ảnh khác</p>
          )}
        </div>

        {/* Tên */}
        <div className="space-y-1.5">
          <Label htmlFor="name">
            Tên danh mục <span className="text-[var(--color-danger)]">*</span>
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Điện thoại, Laptop, Phụ kiện..."
          />
        </div>

        {/* Mô tả */}
        <div className="space-y-1.5">
          <Label htmlFor="description">Mô tả (tuỳ chọn)</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Giới thiệu ngắn về danh mục sản phẩm này"
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
            {submitting ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo danh mục'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
