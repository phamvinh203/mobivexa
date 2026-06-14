'use client'

import { useState } from 'react'
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
      {drafts.map((d) => (
        <div key={d.key} className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-3 sm:grid-cols-4 lg:grid-cols-7">
          <Input placeholder="SKU *" value={d.sku} onChange={(e) => updateDraft(d.key, 'sku', e.target.value)} />
          <Input placeholder="Màu" value={d.color} onChange={(e) => updateDraft(d.key, 'color', e.target.value)} />
          <Input placeholder="ROM" value={d.storage} onChange={(e) => updateDraft(d.key, 'storage', e.target.value)} />
          <Input placeholder="RAM" value={d.ram} onChange={(e) => updateDraft(d.key, 'ram', e.target.value)} />
          <Input type="number" placeholder="Giá gốc" value={d.originalPrice || ''} onChange={(e) => updateDraft(d.key, 'originalPrice', e.target.value)} />
          <Input type="number" placeholder="Giá bán" value={d.salePrice || ''} onChange={(e) => updateDraft(d.key, 'salePrice', e.target.value)} />
          <div className="flex gap-1">
            <Input type="number" placeholder="Tồn" value={d.stock || ''} onChange={(e) => updateDraft(d.key, 'stock', e.target.value)} />
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeDraft(d.key)} title="Xoá dòng">
              <Trash2 className="h-4 w-4" />
            </Button>
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
