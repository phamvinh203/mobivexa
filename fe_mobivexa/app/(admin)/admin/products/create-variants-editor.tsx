'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { buildSku } from '@/lib/utils/sku'
import { ImagePickerOverlay, type PickableImage } from './_shared'
import { VariantTableShell } from './_variants/VariantTableShell'
import { CreateVariantRow } from './_variants/CreateVariantRow'
import type { DraftVariant } from './_variants/types'

// ─── Re-exports (backward compat) ────────────────────────────────────────────
export type { DraftVariant }
export type { PickableImage }

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── CreateVariantsEditor ─────────────────────────────────────────────────────

interface CreateVariantsEditorProps {
  onChange: (variants: DraftVariant[]) => void
  availableImages?: PickableImage[]
  productName?: string
}

export function CreateVariantsEditor({
  onChange,
  availableImages = [],
  productName = '',
}: CreateVariantsEditorProps) {
  const [drafts, setDrafts] = useState<DraftVariant[]>([emptyDraft()])
  const [pickerFor, setPickerFor] = useState<string | null>(null)

  function commit(next: DraftVariant[]) {
    setDrafts(next)
    onChange(next)
  }

  function updateDraft(key: string, field: keyof DraftVariant, rawValue: string) {
    commit(
      drafts.map((d) => {
        if (d.key !== key) return d
        const value = STRING_FIELDS.has(field as string) ? rawValue : Number(rawValue) || 0
        const updated = { ...d, [field]: value }
        // Auto-fill SKU nếu đang rỗng khi thay đổi các trường định danh
        if (['color', 'ram', 'storage'].includes(field as string) && !d.sku && productName) {
          updated.sku = buildSku(
            productName,
            field === 'color' ? rawValue : d.color ?? '',
            field === 'ram' ? rawValue : d.ram ?? '',
            field === 'storage' ? rawValue : d.storage ?? '',
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

  return (
    <>
      <div className="space-y-4">
        <VariantTableShell>
          {drafts.map((d) => (
            <CreateVariantRow
              key={d.key}
              draft={d}
              showDelete={drafts.length > 1}
              onUpdate={(field, value) => updateDraft(d.key, field, value)}
              onRegenerateSku={() => regenerateSku(d.key)}
              onOpenImagePicker={() => setPickerFor(d.key)}
              onRemove={() => commit(drafts.filter((x) => x.key !== d.key))}
            />
          ))}
        </VariantTableShell>

        <button
          type="button"
          onClick={() => commit([...drafts, emptyDraft()])}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-3 text-sm text-gray-500 transition-colors hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
        >
          <Plus className="h-4 w-4" />
          Thêm biến thể
        </button>
      </div>

      {pickerFor !== null && (
        <ImagePickerOverlay
          images={availableImages}
          selectedUrl={drafts.find((d) => d.key === pickerFor)?.imageUrl}
          onSelect={(url) => {
            setVariantImage(pickerFor, url)
            setPickerFor(null)
          }}
          onClose={() => setPickerFor(null)}
        />
      )}
    </>
  )
}
