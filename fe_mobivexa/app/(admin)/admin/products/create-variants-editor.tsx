'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Plus, Trash2, ImageIcon, X, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { VariantPayload } from '@/features/products/types'
import { buildSku } from '@/lib/utils/sku'
import { resolveColor, COLOR_PRESETS } from '@/lib/utils/color'

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
  productName?: string
}

export function CreateVariantsEditor({ onChange, availableImages = [], productName = '' }: CreateVariantsEditorProps) {
  const [drafts, setDrafts] = useState<DraftVariant[]>([emptyDraft()])
  const [pickerFor, setPickerFor] = useState<string | null>(null)

  function commit(next: DraftVariant[]) { setDrafts(next); onChange(next) }

  function updateDraft(key: string, field: keyof DraftVariant, value: string) {
    commit(
      drafts.map((d) => {
        if (d.key !== key) return d
        const updated = { ...d, [field]: STRING_FIELDS.has(field as string) ? value : Number(value) || 0 }
        // Auto-fill SKU nếu đang rỗng khi thay đổi các trường định danh
        if (['color', 'ram', 'storage'].includes(field as string) && !d.sku && productName) {
          updated.sku = buildSku(
            productName,
            field === 'color' ? value : d.color ?? '',
            field === 'ram' ? value : d.ram ?? '',
            field === 'storage' ? value : d.storage ?? '',
          )
        }
        return updated
      }),
    )
  }

  function regenerateSku(key: string) {
    commit(
      drafts.map((d) =>
        d.key === key
          ? { ...d, sku: buildSku(productName, d.color ?? '', d.ram ?? '', d.storage ?? '') }
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
                {['ẢNH', 'MÀU SẮC', 'RAM', 'DUNG LƯỢNG', 'SKU', 'GIÁ GỐC', 'GIÁ BÁN', 'TỒN KHO'].map((h) => (
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
                    <ColorPickerInput
                      value={d.color ?? ''}
                      onChange={(v) => updateDraft(d.key, 'color', v)}
                    />
                  </td>

                  {/* Ram */}
                  <td className="px-3 py-2.5">
                    <Input placeholder="ram" value={d.ram ?? ''} onChange={(e) => updateDraft(d.key, 'ram', e.target.value)} className="h-8 min-w-[70px] text-sm" />
                  </td>

                  {/* Storage */}
                  <td className="px-3 py-2.5">
                    <Input placeholder="dung lượng" value={d.storage ?? ''} onChange={(e) => updateDraft(d.key, 'storage', e.target.value)} className="h-8 min-w-[80px] text-sm" />
                  </td>

                  {/* SKU */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <Input placeholder="SKU" value={d.sku} onChange={(e) => updateDraft(d.key, 'sku', e.target.value)} className="h-8 min-w-[130px] font-mono text-xs" />
                      <button type="button" onClick={() => regenerateSku(d.key)} title="Tự động tạo SKU" className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-[var(--color-primary)]">
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>

                  {/* Original price */}
                  <td className="px-3 py-2.5">
                    <Input type="number" placeholder="0" value={d.originalPrice || ''} onChange={(e) => updateDraft(d.key, 'originalPrice', e.target.value)} className="h-8 min-w-[110px] text-right text-sm" />
                  </td>

                  {/* Sale price */}
                  <td className="px-3 py-2.5">
                    <Input type="number" placeholder="—" value={d.salePrice || ''} onChange={(e) => updateDraft(d.key, 'salePrice', e.target.value)} className="h-8 min-w-[110px] text-right text-sm text-[var(--color-danger)] placeholder:text-gray-400" />
                  </td>

                  {/* Stock */}
                  <td className="px-3 py-2.5">
                    <Input type="number" placeholder="0" value={d.stock || ''} onChange={(e) => updateDraft(d.key, 'stock', e.target.value)} className="h-8 w-20 text-right text-sm" />
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

// ─── ColorPickerInput (dùng chung với edit-variants-editor) ──────────────────

export function ColorPickerInput({
  value,
  onChange,
  disabled,
  onBlur,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  onBlur?: () => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dotColor = resolveColor(value || null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={containerRef} className="relative min-w-[100px]">
      {/* Input với chấm màu live bên trái */}
      <span
        className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full ring-1 ring-black/10"
        style={{ backgroundColor: dotColor }}
      />
      <Input
        value={value}
        disabled={disabled}
        placeholder="màu sắc"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        className="h-8 pl-7 text-sm"
      />

      {/* Dropdown preset */}
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-44 rounded-xl border border-border bg-white py-1.5 shadow-lg">
          <div className="grid grid-cols-2 gap-0.5 px-1.5">
            {COLOR_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault() // giữ focus vào input, không trigger onBlur sớm
                  onChange(p.name)
                  setOpen(false)
                }}
                className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] text-gray-700 transition-colors hover:bg-gray-50 ${
                  value.toLowerCase() === p.name.toLowerCase() ? 'bg-gray-100 font-semibold text-gray-900' : ''
                }`}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: p.hex }}
                />
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
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
