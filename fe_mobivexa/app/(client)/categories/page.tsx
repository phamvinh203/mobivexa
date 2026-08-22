import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { LayoutGrid } from 'lucide-react'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { EmptyBox } from '@/components/ui/empty-box'
import { categoryApi } from '@/features/categories/api'
import type { Category } from '@/features/categories/types'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Tất cả danh mục · Mobivexa',
  description:
    'Khám phá toàn bộ danh mục sản phẩm tại Mobivexa — điện thoại, phụ kiện, tai nghe, sạc cáp và nhiều hơn nữa.',
}

export default async function CategoriesPage() {
  // Danh mục hỏng thì hiện trạng thái rỗng, không để cả trang crash
  const all = await categoryApi.list().catch(() => [] as Category[])
  const active = all.filter((c) => c.isActive)

  // Backend trả phẳng → tự dựng cây 2 cấp để nhóm danh mục con dưới cha
  const roots = active.filter((c) => c.parentId === null)
  const childrenOf = (parentId: string) => active.filter((c) => c.parentId === parentId)

  return (
    <div className="bg-[#f2f5f6] pb-10">
      <div className="mx-auto max-w-[1280px] px-6 py-6">
        <Breadcrumb items={[{ label: 'Trang chủ', href: '/' }, { label: 'Danh mục' }]} />

        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Tất cả danh mục</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {active.length > 0
              ? `${active.length} danh mục đang có sản phẩm`
              : 'Chọn danh mục để xem sản phẩm'}
          </p>
        </header>

        {roots.length === 0 ? (
          <EmptyBox title="Chưa có danh mục nào" hint="Vui lòng quay lại sau." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roots.map((cat) => (
              <CategoryCard key={cat.id} category={cat} subCategories={childrenOf(cat.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CategoryCard({
  category,
  subCategories,
}: {
  category: Category
  subCategories: Category[]
}) {
  const count = category._count?.products

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white transition-shadow hover:shadow-md">
      <Link
        href={`/categories/${category.slug}`}
        className="group flex items-center gap-4 p-4"
      >
        <div className="relative grid h-16 w-16 flex-shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">
          {category.imageUrl ? (
            <Image
              src={category.imageUrl}
              alt={category.name}
              fill
              sizes="64px"
              className="object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <LayoutGrid className="h-7 w-7 text-muted-foreground" aria-hidden />
          )}
        </div>

        <div className="min-w-0">
          <h2 className="truncate font-bold text-gray-900 group-hover:text-[var(--color-primary)]">
            {category.name}
          </h2>
          {count != null && (
            <p className="text-sm text-muted-foreground">{count} sản phẩm</p>
          )}
          {category.description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {category.description}
            </p>
          )}
        </div>
      </Link>

      {subCategories.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border bg-gray-50/60 px-4 py-3">
          {subCategories.map((child) => (
            <Link
              key={child.id}
              href={`/categories/${child.slug}`}
              className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600 ring-1 ring-border transition-colors hover:text-[var(--color-primary)]"
            >
              {child.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
