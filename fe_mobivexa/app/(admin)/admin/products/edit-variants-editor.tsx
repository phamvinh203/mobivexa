'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { ApiError } from '@/lib/api/http'
import { adminProductApi } from '@/features/products/api'
import type { ProductVariant, VariantPayload } from '@/features/products/types'
import { buildSku } from '@/lib/utils/sku'
import { ImagePickerOverlay, type PickableImage } from './_shared'
import { VariantTableShell } from './_variants/VariantTableShell'
import { EditVariantRow } from './_variants/EditVariantRow'
import type { RowEdit } from './_variants/types'

// ─── Re-exports ───────────────────────────────────────────────────────────────
export type { RowEdit }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toRowEdit(v: ProductVariant): RowEdit {
  return {
    color: v.color ?? '',
    ram: v.ram ?? '',
    storage: v.storage ?? '',
    sku: v.sku,
    originalPrice: String(v.originalPrice),
    salePrice: String(v.salePrice),
    stock: String(v.stock),
  }
}

// ─── EditVariantsEditor ───────────────────────────────────────────────────────

interface EditVariantsEditorProps {
  productId: string
  existingVariants?: ProductVariant[]
  onError: (msg: string) => void
  availableImages?: PickableImage[]
  productName?: string
}

export function EditVariantsEditor({
  productId,
  existingVariants = [],
  onError,
  availableImages = [],
  productName = '',
}: EditVariantsEditorProps) {
  const [variants, setVariants] = useState<ProductVariant[]>(existingVariants)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [variantImages, setVariantImages] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      existingVariants.filter((v) => v.imageUrl).map((v) => [v.id, v.imageUrl!]),
    ),
  )
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const [rows, setRows] = useState<Record<string, RowEdit>>(() =>
    Object.fromEntries(existingVariants.map((v) => [v.id, toRowEdit(v)])),
  )

  // ── Helpers ──────────────────────────────────────────────────────────────

  function updateRow(id: string, field: keyof RowEdit, value: string) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  async function runBusy(id: string, op: () => Promise<void>, errMsg: string) {
    setBusyId(id)
    try {
      await op()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : errMsg)
    } finally {
      setBusyId(null)
    }
  }

  // ── Save on blur ──────────────────────────────────────────────────────────

  async function handleBlur(variant: ProductVariant, field: keyof RowEdit) {
    const row = rows[variant.id]
    if (!row) return
    const original = toRowEdit(variant)
    if (row[field] === original[field]) return

    const body: Partial<VariantPayload> = {
      sku: row.sku.trim() || variant.sku,
      color: row.color.trim() || undefined,
      ram: row.ram.trim() || undefined,
      storage: row.storage.trim() || undefined,
      originalPrice:
        row.originalPrice === '' ? Number(variant.originalPrice) : Number(row.originalPrice),
      salePrice:
        row.salePrice === '' ? Number(variant.salePrice) : Number(row.salePrice),
      stock: row.stock === '' ? variant.stock : Number(row.stock),
    }

    await runBusy(variant.id, async () => {
      const updated = await adminProductApi.updateVariant(productId, variant.id, body)
      setVariants((prev) => prev.map((v) => (v.id === updated.id ? updated : v)))
      setRows((prev) => ({ ...prev, [updated.id]: toRowEdit(updated) }))
    }, 'Cập nhật biến thể thất bại')
  }

  // ── Add variant ───────────────────────────────────────────────────────────

  async function handleAdd() {
    const body: VariantPayload = {
      sku: `SKU-${Date.now().toString().slice(-6)}`,
      originalPrice: 0,
      salePrice: 0,
      stock: 0,
    }
    await runBusy('new', async () => {
      const created = await adminProductApi.createVariant(productId, body)
      setVariants((prev) => [...prev, created])
      setRows((prev) => ({ ...prev, [created.id]: toRowEdit(created) }))
    }, 'Thêm biến thể thất bại')
  }

  // ── Image select ──────────────────────────────────────────────────────────

  async function handleImageSelect(variantId: string, url: string | undefined) {
    setVariantImages((prev) => ({ ...prev, [variantId]: url ?? '' }))
    setPickerFor(null)
    await runBusy(variantId, async () => {
      const updated = await adminProductApi.updateVariant(productId, variantId, {
        imageUrl: url || '',
      })
      setVariants((prev) => prev.map((v) => (v.id === updated.id ? updated : v)))
      setRows((prev) => ({ ...prev, [updated.id]: toRowEdit(updated) }))
    }, 'Cập nhật ảnh biến thể thất bại')
  }

  // ── Regenerate SKU ────────────────────────────────────────────────────────

  async function regenerateSku(variant: ProductVariant) {
    const row = rows[variant.id]
    if (!row) return
    const sku = buildSku(productName, row.color, row.ram, row.storage)
    if (!sku || sku === row.sku) return
    updateRow(variant.id, 'sku', sku)
    await runBusy(variant.id, async () => {
      const updated = await adminProductApi.updateVariant(productId, variant.id, {
        sku,
        color: row.color.trim() || undefined,
        ram: row.ram.trim() || undefined,
        storage: row.storage.trim() || undefined,
        originalPrice:
          row.originalPrice === '' ? Number(variant.originalPrice) : Number(row.originalPrice),
        salePrice:
          row.salePrice === '' ? Number(variant.salePrice) : Number(row.salePrice),
        stock: row.stock === '' ? variant.stock : Number(row.stock),
      })
      setVariants((prev) => prev.map((v) => (v.id === updated.id ? updated : v)))
      setRows((prev) => ({ ...prev, [updated.id]: toRowEdit(updated) }))
    }, 'Cập nhật SKU thất bại')
  }

  // ── Remove variant ────────────────────────────────────────────────────────

  async function handleRemove(variant: ProductVariant) {
    if (!confirm(`Xoá biến thể ${variant.sku}?`)) return
    await runBusy(variant.id, async () => {
      await adminProductApi.removeVariant(productId, variant.id)
      setVariants((prev) => prev.filter((v) => v.id !== variant.id))
      setRows((prev) => {
        const next = { ...prev }
        delete next[variant.id]
        return next
      })
    }, 'Xoá biến thể thất bại')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {variants.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
          Chưa có biến thể nào. Thêm biến thể để bắt đầu bán.
        </p>
      ) : (
        <VariantTableShell minWidth={620}>
          {variants.map((v) => (
            <EditVariantRow
              key={v.id}
              variant={v}
              row={rows[v.id] ?? toRowEdit(v)}
              busy={busyId === v.id}
              selectedImage={variantImages[v.id]}
              onUpdateRow={(field, value) => updateRow(v.id, field, value)}
              onBlur={(field) => handleBlur(v, field)}
              onOpenImagePicker={() => setPickerFor(v.id)}
              onRegenerateSku={() => regenerateSku(v)}
              onRemove={() => handleRemove(v)}
            />
          ))}
        </VariantTableShell>
      )}

      <button
        type="button"
        disabled={busyId === 'new'}
        onClick={handleAdd}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-3 text-sm text-gray-500 transition-colors hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)] disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        Thêm biến thể
      </button>

      {pickerFor !== null && (
        <ImagePickerOverlay
          images={availableImages}
          selectedUrl={variantImages[pickerFor]}
          onSelect={(url) => handleImageSelect(pickerFor, url)}
          onClose={() => setPickerFor(null)}
        />
      )}
    </div>
  )
}
