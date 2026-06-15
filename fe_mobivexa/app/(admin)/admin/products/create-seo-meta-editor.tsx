'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export const META_TITLE_MAX = 60
export const META_DESC_MAX = 160

export interface SeoMetaValue {
  metaTitle: string
  metaDescription: string
}

interface SeoMetaCardProps {
  initial?: Partial<SeoMetaValue>
  defaultOpen?: boolean
  productName?: string
  productSlug?: string
}

export function SeoMetaCard({
  initial,
  defaultOpen = true,
  productName = '',
  productSlug = '',
}: SeoMetaCardProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [metaTitle, setMetaTitle] = useState(initial?.metaTitle ?? '')
  const [metaDescription, setMetaDescription] = useState(initial?.metaDescription ?? '')
  const [showPreview, setShowPreview] = useState(false)

  // Fallback display values for Google preview
  const previewTitle = metaTitle || (productName ? `${productName} | Mobivexa` : 'Tiêu đề trang')
  const previewDesc = metaDescription || 'Mô tả trang sẽ xuất hiện ở đây khi bạn nhập vào ô Meta Description...'
  const previewSlug = productSlug || 'duong-dan-san-pham'
  const previewUrl = `mobivexa.com › san-pham › ${previewSlug}`

  return (
    <section className="rounded-xl bg-white ring-1 ring-border">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between p-5 text-left"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">SEO &amp; META</h2>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border/60 p-5">

          {/* Meta Title */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="seo-meta-title">Meta Title</Label>
              <span
                className={`text-xs tabular-nums ${
                  metaTitle.length > META_TITLE_MAX ? 'text-[var(--color-danger)]' : 'text-gray-400'
                }`}
              >
                {metaTitle.length} / {META_TITLE_MAX}
              </span>
            </div>
            <Input
              id="seo-meta-title"
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              placeholder="Tiêu đề hiển thị trên kết quả tìm kiếm"
            />
          </div>

          {/* Helper links */}
          <div className="flex items-center gap-4 text-xs">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="font-medium text-[var(--color-primary)] underline-offset-2 hover:underline"
            >
              {showPreview ? 'Ẩn xem trước' : 'Trình xem trước'}
            </button>
            <button
              type="button"
              className="font-medium text-[var(--color-primary)] underline-offset-2 hover:underline"
            >
              Kiểm tra SEO
            </button>
          </div>

          {/* Meta Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="seo-meta-desc">Meta Description</Label>
              <span
                className={`text-xs tabular-nums ${
                  metaDescription.length > META_DESC_MAX ? 'text-[var(--color-danger)]' : 'text-gray-400'
                }`}
              >
                {metaDescription.length} / {META_DESC_MAX}
              </span>
            </div>
            <Textarea
              id="seo-meta-desc"
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              placeholder="Mô tả ngắn hiển thị trên kết quả tìm kiếm (khoảng 160 ký tự)..."
              rows={3}
            />
          </div>

          {/* Google preview */}
          {showPreview && (
            <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-3.5">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                Xem trước kết quả tìm kiếm
              </p>
              <div className="space-y-0.5">
                {/* URL breadcrumb */}
                <p className="truncate text-[12px] text-gray-500">{previewUrl}</p>
                {/* Title */}
                <p className="line-clamp-1 text-[15px] font-medium leading-snug text-[#1a0dab]">
                  {previewTitle}
                </p>
                {/* Description */}
                <p className="line-clamp-2 text-[12px] leading-relaxed text-gray-600">
                  {previewDesc}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ── Wrappers ────────────────────────────────────────────────────────────────

export function CreateSeoMetaEditor({
  productName,
  productSlug,
}: {
  productName?: string
  productSlug?: string
}) {
  return <SeoMetaCard productName={productName} productSlug={productSlug} />
}
