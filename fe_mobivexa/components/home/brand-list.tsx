'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Brand } from '@/features/brands/types'

interface BrandListProps {
  brands: Brand[]
}

export function BrandList({ brands }: BrandListProps) {
  if (brands.length === 0) return null

  // Duplicate brands để tạo seamless infinite scroll
  const displayBrands = [...brands, ...brands, ...brands]

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="block h-5 w-1 rounded-full bg-primary" />
          <span className="uppercase tracking-wide">Thương hiệu chính hãng</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Marquee container */}
        <div className="relative overflow-hidden py-6">
          {/* Gradient masks 2 bên */}
          <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-card to-transparent z-10" />
          <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-card to-transparent z-10" />

          {/* Scrolling track */}
          <div className="flex animate-marquee hover:pause-marquee">
            {displayBrands.map((brand, index) => (
              <Link
                key={`${brand.id}-${index}`}
                href={`/products?brand=${brand.slug}`}
                className="flex flex-col items-center justify-center gap-2 px-8 flex-shrink-0 transition-transform hover:scale-110"
              >
                <div className="relative h-10 w-24">
                  {brand.logoUrl ? (
                    <Image
                      src={brand.logoUrl}
                      alt={brand.name}
                      fill
                      sizes="96px"
                      className="object-contain"
                      unoptimized={
                        // Bypass optimization nếu logoUrl từ domain không được allow trong next.config.ts
                        !brand.logoUrl.startsWith('http')
                      }
                    />
                  ) : (
                    <Image
                      src="/mobivexa-logo.svg"
                      alt={brand.name}
                      fill
                      sizes="96px"
                      className="object-contain opacity-70"
                    />
                  )}
                </div>
                <span className="text-[11px] font-semibold text-gray-700 whitespace-nowrap">
                  {brand.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
