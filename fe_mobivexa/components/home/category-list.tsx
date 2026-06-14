import Link from 'next/link'
import Image from 'next/image'
import {
  Apple,
  Smartphone,
  Gamepad2,
  BatteryFull,
  Camera,
  Phone,
  ShieldCheck,
  Cable,
  Headphones,
  Package,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Category } from '@/features/categories/types'

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  iphone: Apple,
  'dien-thoai-android': Smartphone,
  'dien-thoai-gaming': Gamepad2,
  'dien-thoai-pin-trau': BatteryFull,
  'dien-thoai-chup-anh-quay-phim': Camera,
  'dien-thoai-pho-thong': Phone,
  'bao-da-op-lung': ShieldCheck,
  'sac-cap': Cable,
  'tai-nghe': Headphones,
}

interface CategoryListProps {
  categories: Category[]
}

export function CategoryList({ categories }: CategoryListProps) {
  if (categories.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="block h-5 w-1 rounded-full bg-primary" />
          <span className="uppercase tracking-wide">Danh mục sản phẩm</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-4 gap-3 sm:grid-cols-8">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/products?category=${c.slug}`}
            className="group flex flex-col items-center gap-2 rounded-xl border border-border px-1 py-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-primary-light"
          >
            <div className="relative grid h-10 w-10 place-items-center">
              {c.imageUrl ? (
                <Image
                  src={c.imageUrl}
                  alt={c.name}
                  fill
                  sizes="40px"
                  className="object-contain transition-transform group-hover:scale-110"
                />
              ) : (
                (() => {
                  const Icon = CATEGORY_ICONS[c.slug] ?? Package
                  return (
                    <Icon
                      className="h-7 w-7 text-gray-500 transition-all group-hover:scale-110 group-hover:text-primary"
                      aria-hidden
                    />
                  )
                })()
              )}
            </div>
            <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-gray-600 group-hover:text-primary">
              {c.name}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
