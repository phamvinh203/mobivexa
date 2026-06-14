'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ProductForm } from '../product-form'

export default function AdminProductCreatePage() {
  const router = useRouter()

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/products" className="text-sm text-gray-500 hover:text-[var(--color-primary)]">
          ← Quay lại danh sách
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-800">Thêm sản phẩm mới</h1>
        <p className="text-sm text-gray-500">Điền thông tin, upload ảnh và thêm biến thể.</p>
      </div>

      <ProductForm mode="create" onDone={() => router.push('/admin/products')} />
    </div>
  )
}
