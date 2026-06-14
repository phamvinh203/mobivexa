'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api/http'
import { adminTagApi } from '@/features/tags/api'
import type { Tag, TagPayload } from '@/features/tags/types'

interface TagFormModalProps {
  onClose: () => void
  onSaved: (saved: Tag) => void
}

export function TagFormModal({ onClose, onSaved }: TagFormModalProps) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (name.trim().length < 1) {
      setError('Tên tag không được để trống')
      return
    }

    const payload: TagPayload = {
      name: name.trim(),
      slug: slug.trim() || undefined,
    }

    setSubmitting(true)
    try {
      const savedTag = await adminTagApi.create(payload)
      onSaved(savedTag)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tạo tag thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog title="Thêm tag" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}

        {/* Tên */}
        <div className="space-y-1.5">
          <Label htmlFor="name">
            Tên tag <span className="text-[var(--color-danger)]">*</span>
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="iPhone, Samsung, Ưu đãi..."
            autoFocus
          />
        </div>

        {/* Slug */}
        <div className="space-y-1.5">
          <Label htmlFor="slug">Slug (tuỳ chọn)</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="iphone"
          />
          <p className="text-xs text-muted-foreground">Để trống sẽ tự tạo từ tên tag.</p>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" size="lg" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? 'Đang tạo...' : 'Tạo tag'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
