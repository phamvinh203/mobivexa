'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ApiError } from '@/lib/api/http'
import { adminProductApi } from '@/features/products/api'
import type { Product } from '@/features/products/types'
import { ProductForm } from '../product-form'

export default function AdminProductEditPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    adminProductApi
      .get(id)
      .then(setProduct)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Không tải được sản phẩm'))
      .finally(() => setLoading(false))
  }, [id])

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/products" className="text-sm text-gray-500 hover:text-[var(--color-primary)]">
          ← Quay lại danh sách
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-800">
          {product ? `Sửa: ${product.name}` : 'Chỉnh sửa sản phẩm'}
        </h1>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>
      )}

      {loading ? (
        <div className="rounded-xl bg-white px-4 py-10 text-center text-sm text-gray-400 ring-1 ring-border">
          Đang tải...
        </div>
      ) : product ? (
        <ProductForm mode="edit" product={product} onDone={() => router.push('/admin/products')} />
      ) : null}
    </div>
  )
}
