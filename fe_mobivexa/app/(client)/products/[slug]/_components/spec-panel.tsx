import Link from 'next/link'
import { formatVND } from '@/lib/utils/format'
import type { Product, ProductVariant } from '@/features/products/types'

/** Nhãn gọn cho 1 phiên bản: "256GB · 8GB · Titan tự nhiên" */
function variantLabel(v: ProductVariant): string {
  return [v.storage, v.ram && `${v.ram} RAM`, v.color].filter(Boolean).join(' · ') || v.sku
}

export function SpecPanel({
  product,
  variants,
}: {
  product: Product
  variants: ProductVariant[]
}) {
  const general: { label: string; value: React.ReactNode }[] = [
    {
      label: 'Thương hiệu',
      value: product.brand ? (
        <Link
          href={`/brands/${product.brand.slug}`}
          className="text-[var(--color-primary)] hover:underline"
        >
          {product.brand.name}
        </Link>
      ) : (
        '—'
      ),
    },
    {
      label: 'Danh mục',
      value: product.category ? (
        <Link
          href={`/categories/${product.category.slug}`}
          className="text-[var(--color-primary)] hover:underline"
        >
          {product.category.name}
        </Link>
      ) : (
        '—'
      ),
    },
    { label: 'Số phiên bản', value: `${variants.length} phiên bản` },
  ]

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-800">
          Thông tin chung
        </h3>
        <dl className="divide-y divide-border rounded-xl border border-border">
          {general.map(({ label, value }) => (
            <div key={label} className="flex justify-between gap-4 px-4 py-3 text-sm">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium text-right">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {variants.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-800">
            Bảng phiên bản &amp; giá
          </h3>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Phiên bản</th>
                  <th className="px-4 py-2.5 font-semibold">SKU</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Giá bán</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Tình trạng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {variants.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-3 font-medium">{variantLabel(v)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {v.sku}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[var(--color-sale-strong)]">
                      {formatVND(v.salePrice)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {v.stock > 0 ? (
                        <span className="text-[var(--color-success)]">Còn hàng</span>
                      ) : (
                        <span className="text-muted-foreground">Hết hàng</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
