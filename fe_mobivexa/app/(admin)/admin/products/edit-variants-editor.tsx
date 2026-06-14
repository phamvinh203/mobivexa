'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api/http'
import { formatVND } from '@/lib/utils/format'
import { adminProductApi } from '@/features/products/api'
import type { ProductVariant, VariantPayload } from '@/features/products/types'
import { Field } from './create-variants-editor'

interface EditVariantsEditorProps {
  productId: string
  existingVariants?: ProductVariant[]
  onError: (msg: string) => void
}

export function EditVariantsEditor({ productId, existingVariants = [], onError }: EditVariantsEditorProps) {
  const [variants, setVariants] = useState<ProductVariant[]>(existingVariants)
  const [busyId, setBusyId] = useState<string | null>(null)

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

  async function handleAdd() {
    const body: VariantPayload = {
      sku: `SKU-${Date.now().toString().slice(-6)}`,
      originalPrice: 0,
      salePrice: 0,
      stock: 0,
    }
    await runBusy(
      'new',
      async () => {
        const created = await adminProductApi.createVariant(productId, body)
        setVariants((prev) => [...prev, created])
      },
      'Thêm biến thể thất bại',
    )
  }

  async function handleStockChange(variant: ProductVariant, stock: number) {
    await runBusy(
      variant.id,
      async () => {
        const updated = await adminProductApi.updateStock(productId, variant.id, { stock })
        setVariants((prev) => prev.map((v) => (v.id === updated.id ? updated : v)))
      },
      'Cập nhật tồn kho thất bại',
    )
  }

  async function handleRemove(variant: ProductVariant) {
    if (!confirm(`Xoá biến thể ${variant.sku}?`)) return
    await runBusy(
      variant.id,
      async () => {
        await adminProductApi.removeVariant(productId, variant.id)
        setVariants((prev) => prev.filter((v) => v.id !== variant.id))
      },
      'Xoá biến thể thất bại',
    )
  }

  return (
    <div className="space-y-3">
      {variants.length === 0 && (
        <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-gray-400">
          Chưa có biến thể nào. Thêm biến thể để bắt đầu bán.
        </p>
      )}

      {variants.map((v) => {
        const specs = [v.color, v.storage, v.ram].filter(Boolean).join(' · ')
        const outOfStock = v.stock === 0
        const discounted = Number(v.originalPrice) > Number(v.salePrice) && Number(v.originalPrice) > 0
        return (
          <div
            key={v.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-border bg-muted/20 p-4 transition-colors hover:border-border/80"
          >
            {/* Định danh: SKU */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs font-medium text-gray-700 ring-1 ring-border">
                  {v.sku}
                </code>
                {specs && <span className="text-sm text-gray-500">{specs}</span>}
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm">
                <span className="font-semibold text-gray-800">{formatVND(v.salePrice)}</span>
                {discounted && (
                  <span className="text-xs text-gray-400 line-through">{formatVND(v.originalPrice)}</span>
                )}
              </div>
            </div>

            {/* Tồn kho (editable) */}
            <div className="w-28">
              <Field label="Tồn kho">
                <Input
                  type="number"
                  placeholder="0"
                  defaultValue={v.stock}
                  disabled={busyId === v.id}
                  onBlur={(e) => {
                    const n = Number(e.target.value)
                    if (Number.isFinite(n) && n !== v.stock) void handleStockChange(v, n)
                  }}
                />
              </Field>
            </div>

            {/* Trạng thái + xoá */}
            <div className="flex items-center gap-2">
              {outOfStock ? (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">Hết hàng</span>
              ) : (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-600">Còn bán</span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={busyId === v.id}
                onClick={() => handleRemove(v)}
                className="text-gray-400 hover:text-[var(--color-danger)]"
                title="Xoá biến thể"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )
      })}

      <Button type="button" variant="outline" size="sm" disabled={busyId === 'new'} onClick={handleAdd}>
        <Plus className="h-4 w-4" />
        Thêm biến thể
      </Button>
    </div>
  )
}
