'use client'

import { useState, type ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { VariantPayload } from '@/features/products/types'

/** Dòng variant đang soạn (chưa có id) — thêm key tạm cho React list. */
export interface DraftVariant extends VariantPayload {
  key: string
}

// Các field dạng chuỗi (còn lại là số) — dùng cho coerce khi update input.
const STRING_FIELDS = new Set(['sku', 'color', 'storage', 'ram'])

let draftSeq = 0
function emptyDraft(): DraftVariant {
  draftSeq += 1
  return {
    key: `draft-${draftSeq}`,
    sku: '',
    color: '',
    storage: '',
    ram: '',
    originalPrice: 0,
    salePrice: 0,
    stock: 0,
  }
}

interface CreateVariantsEditorProps {
  /** Notify parent khi draft variants đổi (gửi kèm create payload). */
  onChange: (variants: DraftVariant[]) => void
}

export function CreateVariantsEditor({ onChange }: CreateVariantsEditorProps) {
  const [drafts, setDrafts] = useState<DraftVariant[]>([emptyDraft()])

  function commit(next: DraftVariant[]) {
    setDrafts(next)
    onChange(next)
  }

  function updateDraft(key: string, field: keyof DraftVariant, value: string) {
    commit(drafts.map((d) =>
      d.key === key
        ? { ...d, [field]: STRING_FIELDS.has(field as string) ? value : Number(value) || 0 }
        : d,
    ))
  }

  function addDraft() {
    commit([...drafts, emptyDraft()])
  }

  function removeDraft(key: string) {
    commit(drafts.filter((d) => d.key !== key))
  }

  return (
    <div className="space-y-3">
      {drafts.map((d, idx) => (
        <div
          key={d.key}
          className="rounded-lg border border-border bg-muted/20 p-4 transition-colors focus-within:border-ring/60 focus-within:bg-muted/40"
        >
          {/* Header: số thứ tự variant + nút xoá */}
          <div className="mb-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--color-primary)]/10 text-[11px] font-bold text-[var(--color-primary)]">
                {idx + 1}
              </span>
              Biến thể
            </span>
            {drafts.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeDraft(d.key)}
                className="text-gray-400 hover:text-[var(--color-danger)]"
                title="Xoá biến thể này"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Fields: định danh + cấu hình */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-4">
            <Field label="SKU" required>
              <Input placeholder="IP15-128" value={d.sku} onChange={(e) => updateDraft(d.key, 'sku', e.target.value)} />
            </Field>
            <Field label="Màu">
              <Input placeholder="Đen" value={d.color} onChange={(e) => updateDraft(d.key, 'color', e.target.value)} />
            </Field>
            <Field label="Dung lượng">
              <Input placeholder="128GB" value={d.storage} onChange={(e) => updateDraft(d.key, 'storage', e.target.value)} />
            </Field>
            <Field label="RAM">
              <Input placeholder="8GB" value={d.ram} onChange={(e) => updateDraft(d.key, 'ram', e.target.value)} />
            </Field>
          </div>

          {/* Fields: giá + tồn kho (cách nhẹ để tách nhóm) */}
          <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-border/60 pt-2.5 sm:grid-cols-3">
            <Field label="Giá gốc (đ)">
              <Input type="number" placeholder="0" value={d.originalPrice || ''} onChange={(e) => updateDraft(d.key, 'originalPrice', e.target.value)} />
            </Field>
            <Field label="Giá bán (đ)">
              <Input type="number" placeholder="0" value={d.salePrice || ''} onChange={(e) => updateDraft(d.key, 'salePrice', e.target.value)} />
            </Field>
            <Field label="Tồn kho">
              <Input type="number" placeholder="0" value={d.stock || ''} onChange={(e) => updateDraft(d.key, 'stock', e.target.value)} />
            </Field>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={addDraft}>
        <Plus className="h-4 w-4" />
        Thêm biến thể
      </Button>
    </div>
  )
}

// ─── Label bao input (dùng chung cho cả 2 editor) ─────────────────────────────

export function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-[var(--color-danger)]">*</span>}
      </span>
      {children}
    </label>
  )
}
