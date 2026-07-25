import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { EmptyBox } from '@/components/ui/empty-box'
import { brandApi } from '@/features/brands/api'
import type { Brand } from '@/features/brands/types'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Tất cả thương hiệu · Mobivexa',
  description:
    'Các thương hiệu điện thoại và phụ kiện chính hãng đang bán tại Mobivexa — Apple, Samsung, Xiaomi, OPPO và nhiều hãng khác.',
}

export default async function BrandsPage() {
  const all = await brandApi.list().catch(() => [] as Brand[])
  // Sắp xếp theo số sản phẩm giảm dần — hãng nhiều hàng lên trước
  const brands = all
    .filter((b) => b.isActive)
    .sort((a, b) => (b._count?.products ?? 0) - (a._count?.products ?? 0))

  return (
    <div className="bg-[#f2f5f6] pb-10">
      <div className="mx-auto max-w-[1280px] px-6 py-6">
        <Breadcrumb items={[{ label: 'Trang chủ', href: '/' }, { label: 'Thương hiệu' }]} />

        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Tất cả thương hiệu</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {brands.length > 0
              ? `${brands.length} thương hiệu chính hãng`
              : 'Chọn thương hiệu để xem sản phẩm'}
          </p>
        </header>

        {brands.length === 0 ? (
          <EmptyBox title="Chưa có thương hiệu nào" hint="Vui lòng quay lại sau." />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {brands.map((brand) => (
              <BrandCard key={brand.id} brand={brand} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BrandCard({ brand }: { brand: Brand }) {
  const count = brand._count?.products

  return (
    <Link
      href={`/brands/${brand.slug}`}
      className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-white p-5 text-center transition-all hover:border-[var(--color-primary)] hover:shadow-md"
    >
      <div className="relative grid h-16 w-full place-items-center">
        {brand.logoUrl ? (
          <Image
            src={brand.logoUrl}
            alt={brand.name}
            fill
            sizes="160px"
            className="object-contain p-1 transition-transform group-hover:scale-105"
          />
        ) : (
          <span className="text-2xl font-bold text-muted-foreground">
            {brand.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div className="min-w-0">
        <h2 className="truncate font-semibold text-gray-900 group-hover:text-[var(--color-primary)]">
          {brand.name}
        </h2>
        {count != null && (
          <p className="text-xs text-muted-foreground">{count} sản phẩm</p>
        )}
      </div>
    </Link>
  )
}
