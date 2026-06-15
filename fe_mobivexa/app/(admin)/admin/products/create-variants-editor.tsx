'use client'

import { useState, type ReactNode } from 'react'
import { Plus, Trash2, ImageIcon, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { VariantPayload } from '@/features/products/types'

// ─── Types ───────────────────────────────────────────────────────────────────

/** Dòng variant đang soạn (chưa có id). imageUrl kế thừa từ VariantPayload → gửi lên API khi create. */
export interface DraftVariant extends VariantPayload {
  key: string
}

export interface PickableImage {
  url: string
}

const STRING_FIELDS = new Set(['sku', 'color', 'storage', 'ram'])

let draftSeq = 0
function emptyDraft(): DraftVariant {
  draftSeq += 1
  return { key: `draft-${draftSeq}`, sku: '', color: '', storage: '', ram: '', originalPrice: 0, salePrice: 0, stock: 0 }
}

// ─── CreateVariantsEditor ─────────────────────────────────────────────────────

interface CreateVariantsEditorProps {
  onChange: (variants: DraftVariant[]) => void
  availableImages?: PickableImage[]
}

export function CreateVariantsEditor({ onChange, availableImages = [] }: CreateVariantsEditorProps) {
  const [drafts, setDrafts] = useState<DraftVariant[]>([emptyDraft()])
  const [pickerFor, setPickerFor] = useState<string | null>(null)

  function commit(next: DraftVariant[]) { setDrafts(next); onChange(next) }

  function updateDraft(key: string, field: keyof DraftVariant, value: string) {
    commit(
      drafts.map((d) =>
        d.key === key
          ? { ...d, [field]: STRING_FIELDS.has(field as string) ? value : Number(value) || 0 }
          : d,
      ),
    )
  }

  function setVariantImage(key: string, url: string | undefined) {
    commit(drafts.map((d) => (d.key === key ? { ...d, imageUrl: url } : d)))
  }

  function addDraft() { commit([...drafts, emptyDraft()]) }
  function removeDraft(key: string) { commit(drafts.filter((d) => d.key !== key)) }

  return (
    <>
      <div className="space-y-4">
        {/* ── Variant table ───────────────────────────────────────── */}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[580px] text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                {['ẢNH', 'MÀU SẮC', 'DUNG LƯỢNG', 'SKU', 'GIÁ', 'GIẢM GIÁ'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 first:w-12">
                    {h}
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {drafts.map((d) => (
                <tr key={d.key} className="group bg-white hover:bg-gray-50/60">
                  {/* Image cell */}
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      title="Chọn ảnh cho biến thể"
                      onClick={() => setPickerFor(d.key)}
                      className="group/img relative h-9 w-9 overflow-hidden rounded-md border border-dashed border-gray-300 bg-gray-100 transition-colors hover:border-[var(--color-primary)]/60 hover:bg-gray-50"
                    >
                      {d.imageUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={d.imageUrl} alt="" className="h-full w-full object-cover" />
                          <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover/img:opacity-100">
                            <ImageIcon className="h-3.5 w-3.5 text-white" />
                          </span>
                        </>
                      ) : (
                        <span className="flex h-full items-center justify-center">
                          <ImageIcon className="h-3.5 w-3.5 text-gray-300 transition-colors group-hover/img:text-[var(--color-primary)]/60" />
                        </span>
                      )}
                    </button>
                  </td>

                  {/* Color */}
                  <td className="px-3 py-2.5">
                    <Input placeholder="Titan Đen" value={d.color ?? ''} onChange={(e) => updateDraft(d.key, 'color', e.target.value)} className="h-8 min-w-[90px] text-sm" />
                  </td>

                  {/* Storage */}
                  <td className="px-3 py-2.5">
                    <Input placeholder="256GB" value={d.storage ?? ''} onChange={(e) => updateDraft(d.key, 'storage', e.target.value)} className="h-8 min-w-[80px] text-sm" />
                  </td>

                  {/* SKU */}
                  <td className="px-3 py-2.5">
                    <Input placeholder="IPH15PRO-BLK-256" value={d.sku} onChange={(e) => updateDraft(d.key, 'sku', e.target.value)} className="h-8 min-w-[130px] font-mono text-xs" />
                  </td>

                  {/* Original price */}
                  <td className="px-3 py-2.5">
                    <Input type="number" placeholder="0" value={d.originalPrice || ''} onChange={(e) => updateDraft(d.key, 'originalPrice', e.target.value)} className="h-8 min-w-[110px] text-right text-sm" />
                  </td>

                  {/* Sale price */}
                  <td className="px-3 py-2.5">
                    <Input type="number" placeholder="—" value={d.salePrice || ''} onChange={(e) => updateDraft(d.key, 'salePrice', e.target.value)} className="h-8 min-w-[110px] text-right text-sm text-[var(--color-danger)] placeholder:text-gray-400" />
                  </td>

                  {/* Delete */}
                  <td className="px-2 py-2.5">
                    {drafts.length > 1 && (
                      <button type="button" onClick={() => removeDraft(d.key)} title="Xoá biến thể" className="text-gray-300 opacity-0 transition-all hover:text-[var(--color-danger)] group-hover:opacity-100">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Add row button ──────────────────────────────────────── */}
        <button
          type="button"
          onClick={addDraft}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-3 text-sm text-gray-500 transition-colors hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
        >
          <Plus className="h-4 w-4" />
          Thêm biến thể
        </button>
      </div>

      {/* ── Image picker overlay ──────────────────────────────────── */}
      {pickerFor !== null && (
        <ImagePickerOverlay
          images={availableImages}
          selectedUrl={drafts.find((d) => d.key === pickerFor)?.imageUrl}
          onSelect={(url) => { setVariantImage(pickerFor, url); setPickerFor(null) }}
          onClose={() => setPickerFor(null)}
        />
      )}
    </>
  )
}

// ─── Field (dùng chung với edit-variants-editor) ──────────────────────────────

export function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}{required && <span className="ml-0.5 text-[var(--color-danger)]">*</span>}
      </span>
      {children}
    </label>
  )
}

// ─── ImagePickerOverlay (dùng chung cho cả 2 editor) ─────────────────────────

export function ImagePickerOverlay({
  images,
  selectedUrl,
  onSelect,
  onClose,
}: {
  images: PickableImage[]
  selectedUrl?: string
  onSelect: (url: string | undefined) => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-80 rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Chọn ảnh biến thể</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {images.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <ImageIcon className="h-8 w-8 text-gray-200" />
            <p className="text-sm text-gray-400">Chưa có ảnh nào.</p>
            <p className="text-xs text-gray-300">Thêm ảnh ở mục Hình ảnh sản phẩm trước.</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {images.map((img) => {
              const selected = img.url === selectedUrl
              return (
                <button
                  key={img.url}
                  type="button"
                  onClick={() => onSelect(img.url)}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                    selected
                      ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/30'
                      : 'border-transparent hover:border-gray-300'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                  {selected && (
                    <span className="absolute inset-0 flex items-center justify-center bg-[var(--color-primary)]/20">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-primary)] text-[10px] text-white">✓</span>
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Remove selection */}
        {selectedUrl && (
          <button
            type="button"
            onClick={() => onSelect(undefined)}
            className="mt-4 w-full rounded-lg border border-dashed border-gray-200 py-2 text-xs text-gray-400 transition-colors hover:border-red-200 hover:text-[var(--color-danger)]"
          >
            Xoá ảnh biến thể
          </button>
        )}
      </div>
    </div>
  )
}
