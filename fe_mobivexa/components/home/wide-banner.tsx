import Link from 'next/link'
import Image from 'next/image'
import type { Banner } from '@/features/banners/types'

interface WideBannerProps {
  banners: Banner[]
}

/** Banner ngang dài (HERO full-width hoặc HORIZONTAL dải giữa trang). */
export function WideBanner({ banners }: WideBannerProps) {
  if (banners.length === 0) return null

  return (
    <div className={`flex flex-col gap-3 ${banners.length > 1 ? 'sm:flex-row' : ''}`}>
      {banners.map((b) => (
        <Link
          key={b.id}
          href={b.href ?? '/products'}
          className="group relative block flex-1 overflow-hidden rounded-xl border border-border"
        >
          <Image
            src={b.imageUrl}
            alt={b.alt}
            width={1280}
            height={400}
            className="h-auto w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </Link>
      ))}
    </div>
  )
}
