'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api/http'
import { adminProductApi } from '@/features/products/api'
import type { ProductVariant, VariantPayload } from '@/features/products/types'

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
      {variants.length === 0 && <p className="text-sm text-gray-400">Chưa có biến thể nào.</p>}
      {variants.map((v) => (
        <div key={v.id} className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-3 sm:grid-cols-4 lg:grid-cols-6">
          <div className="truncate font-mono text-xs text-gray-600">{v.sku}</div>
          <div className="truncate text-sm text-gray-600">{[v.color, v.storage, v.ram].filter(Boolean).join(' · ') || '—'}</div>
          <div className="text-sm text-gray-600">{Number(v.salePrice).toLocaleString('vi-VN')}đ</div>
          <Input
            type="number"
            placeholder="Tồn"
            defaultValue={v.stock}
            disabled={busyId === v.id}
            onBlur={(e) => {
              const n = Number(e.target.value)
              if (Number.isFinite(n) && n !== v.stock) void handleStockChange(v, n)
            }}
          />
          <Button
            type="button"
            variant="destructive"
            size="icon-sm"
            disabled={busyId === v.id}
            onClick={() => handleRemove(v)}
            title="Xoá biến thể"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" disabled={busyId === 'new'} onClick={handleAdd}>
        <Plus className="h-4 w-4" />
        Thêm biến thể
      </Button>
    </div>
  )
}
