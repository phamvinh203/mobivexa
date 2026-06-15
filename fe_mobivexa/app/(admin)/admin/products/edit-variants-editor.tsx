'use client'

import { useState } from 'react'
import { Plus, Trash2, ImageIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api/http'
import { formatVND } from '@/lib/utils/format'
import { adminProductApi } from '@/features/products/api'
import type { ProductVariant, VariantPayload } from '@/features/products/types'
import { ImagePickerOverlay, type PickableImage } from './create-variants-editor'

// ─── Local row state (mirrors server, allows in-place editing) ────────────────

type RowEdit = {
  color: string
  storage: string
  sku: string
  originalPrice: string
  salePrice: string
  stock: string
}

function toRowEdit(v: ProductVariant): RowEdit {
  return {
    color: v.color ?? '',
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
}

export function EditVariantsEditor({ productId, existingVariants = [], onError, availableImages = [] }: EditVariantsEditorProps) {
  const [variants, setVariants] = useState<ProductVariant[]>(existingVariants)
  const [busyId, setBusyId] = useState<string | null>(null)
  // Variant image: khởi tạo từ server (v.imageUrl), persist qua updateVariant khi chọn
  const [variantImages, setVariantImages] = useState<Record<string, string>>(() =>
    Object.fromEntries(existingVariants.filter((v) => v.imageUrl).map((v) => [v.id, v.imageUrl!])),
  )
  const [pickerFor, setPickerFor] = useState<string | null>(null)

  // Per-row edit buffer: id → current field values (strings for input binding)
  const [rows, setRows] = useState<Record<string, RowEdit>>(() =>
    Object.fromEntries(existingVariants.map((v) => [v.id, toRowEdit(v)])),
  )

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function updateRow(id: string, field: keyof RowEdit, value: string) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  async function runBusy(id: string, op: () => Promise<void>, errMsg: string) {
    setBusyId(id)
    try { await op() }
    catch (err) { onError(err instanceof ApiError ? err.message : errMsg) }
    finally { setBusyId(null) }
  }

  // ── Save variant on blur (only if value changed) ────────────────────────────

  async function handleBlur(variant: ProductVariant, field: keyof RowEdit) {
    const row = rows[variant.id]
    if (!row) return

    const original = toRowEdit(variant)
    if (row[field] === original[field]) return   // no change — skip API call

    const body: Partial<VariantPayload> = {
      sku: row.sku.trim() || variant.sku,
      color: row.color.trim() || undefined,
      storage: row.storage.trim() || undefined,
      ram: variant.ram ?? undefined,
      imageUrl: variantImages[variant.id] ?? variant.imageUrl ?? undefined,
      originalPrice: Number(row.originalPrice) || Number(variant.originalPrice),
      salePrice: Number(row.salePrice) || Number(variant.salePrice),
      stock: Number(row.stock) || variant.stock,
    }

    await runBusy(variant.id, async () => {
      const updated = await adminProductApi.updateVariant(productId, variant.id, body)
      setVariants((prev) => prev.map((v) => (v.id === updated.id ? updated : v)))
      // Sync buffer back to server state
      setRows((prev) => ({ ...prev, [updated.id]: toRowEdit(updated) }))
    }, 'Cập nhật biến thể thất bại')
  }

  // ── Add new variant ─────────────────────────────────────────────────────────

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

  // ── Select variant image and persist immediately ────────────────────────────

  async function handleImageSelect(variantId: string, url: string | undefined) {
    // Use '' as sentinel for "explicitly cleared" so handleBlur doesn't fall back to old server value
    setVariantImages((prev) => ({ ...prev, [variantId]: url ?? '' }))
    setPickerFor(null)

    // '' → backend does '' || null = null (clears imageUrl); truthy url → stored as-is
    await runBusy(variantId, async () => {
      const updated = await adminProductApi.updateVariant(productId, variantId, { imageUrl: url || '' })
      setVariants((prev) => prev.map((v) => (v.id === updated.id ? updated : v)))
      setRows((prev) => ({ ...prev, [updated.id]: toRowEdit(updated) }))
    }, 'Cập nhật ảnh biến thể thất bại')
  }

  // ── Remove variant ──────────────────────────────────────────────────────────

  async function handleRemove(variant: ProductVariant) {
    if (!confirm(`Xoá biến thể ${variant.sku}?`)) return
    await runBusy(variant.id, async () => {
      await adminProductApi.removeVariant(productId, variant.id)
      setVariants((prev) => prev.filter((v) => v.id !== variant.id))
      setRows((prev) => { const next = { ...prev }; delete next[variant.id]; return next })
    }, 'Xoá biến thể thất bại')
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Variant table ───────────────────────────────────────────── */}
      {variants.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
          Chưa có biến thể nào. Thêm biến thể để bắt đầu bán.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                {['ẢNH', 'MÀU SẮC', 'DUNG LƯỢNG', 'SKU', 'GIÁ', 'GIẢM GIÁ', 'TỒN KHO'].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 first:w-12 last:w-24"
                  >
                    {h}
                  </th>
                ))}
                {/* delete col */}
                <th className="w-8" />
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {variants.map((v) => {
                const busy = busyId === v.id
                const row = rows[v.id] ?? toRowEdit(v)
                const selectedImage = variantImages[v.id]
                const hasDiscount =
                  Number(row.salePrice) > 0 &&
                  Number(row.originalPrice) > 0 &&
                  Number(row.salePrice) < Number(row.originalPrice)

                return (
                  <tr key={v.id} className={`group bg-white hover:bg-gray-50/50 ${busy ? 'opacity-60' : ''}`}>
                    {/* Image cell — clickable picker */}
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        title="Chọn ảnh cho biến thể"
                        onClick={() => setPickerFor(v.id)}
                        className="group/img relative h-9 w-9 overflow-hidden rounded-md border border-dashed border-gray-300 bg-gray-100 transition-colors hover:border-[var(--color-primary)]/60 hover:bg-gray-50"
                      >
                        {selectedImage ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={selectedImage} alt="" className="h-full w-full object-cover" />
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

                    {/* Color — editable */}
                    <td className="px-3 py-2.5">
                      <Input
                        value={row.color}
                        disabled={busy}
                        placeholder="Titan Đen"
                        onChange={(e) => updateRow(v.id, 'color', e.target.value)}
                        onBlur={() => handleBlur(v, 'color')}
                        className="h-8 min-w-[90px] text-sm"
                      />
                    </td>

                    {/* Storage — editable */}
                    <td className="px-3 py-2.5">
                      <Input
                        value={row.storage}
                        disabled={busy}
                        placeholder="256GB"
                        onChange={(e) => updateRow(v.id, 'storage', e.target.value)}
                        onBlur={() => handleBlur(v, 'storage')}
                        className="h-8 min-w-[80px] text-sm"
                      />
                    </td>

                    {/* SKU — editable */}
                    <td className="px-3 py-2.5">
                      <Input
                        value={row.sku}
                        disabled={busy}
                        placeholder="IPH15PRO-BLK-256"
                        onChange={(e) => updateRow(v.id, 'sku', e.target.value)}
                        onBlur={() => handleBlur(v, 'sku')}
                        className="h-8 min-w-[130px] font-mono text-xs text-[var(--color-primary)]"
                      />
                    </td>

                    {/* Original price — editable */}
                    <td className="px-3 py-2.5">
                      <Input
                        type="number"
                        value={row.originalPrice}
                        disabled={busy}
                        placeholder="0"
                        onChange={(e) => updateRow(v.id, 'originalPrice', e.target.value)}
                        onBlur={() => handleBlur(v, 'originalPrice')}
                        className="h-8 min-w-[110px] text-right text-sm"
                      />
                    </td>

                    {/* Sale price — editable, shown red if discounted */}
                    <td className="px-3 py-2.5">
                      <Input
                        type="number"
                        value={row.salePrice}
                        disabled={busy}
                        placeholder="—"
                        onChange={(e) => updateRow(v.id, 'salePrice', e.target.value)}
                        onBlur={() => handleBlur(v, 'salePrice')}
                        className={`h-8 min-w-[110px] text-right text-sm ${hasDiscount ? 'text-[var(--color-danger)]' : ''}`}
                      />
                    </td>

                    {/* Stock — editable */}
                    <td className="px-3 py-2.5">
                      <Input
                        type="number"
                        value={row.stock}
                        disabled={busy}
                        placeholder="0"
                        onChange={(e) => updateRow(v.id, 'stock', e.target.value)}
                        onBlur={() => handleBlur(v, 'stock')}
                        className="h-8 w-20 text-right text-sm"
                      />
                    </td>

                    {/* Delete */}
                    <td className="px-2 py-2.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRemove(v)}
                        title="Xoá biến thể"
                        className="text-gray-300 opacity-0 transition-all hover:text-[var(--color-danger)] group-hover:opacity-100 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add button ──────────────────────────────────────────────── */}
      <button
        type="button"
        disabled={busyId === 'new'}
        onClick={handleAdd}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-3 text-sm text-gray-500 transition-colors hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)] disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        Thêm biến thể
      </button>

      {/* ── Image picker overlay ──────────────────────────────────── */}
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
