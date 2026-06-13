'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Brand } from '@/features/brands/types'

interface BrandChipsProps {
  brands: Brand[]
  /** Link cho nút "Xem tất cả" */
  allHref: string
}

/** Hàng chip thương hiệu cuộn ngang + nút mũi tên < > + "Xem tất cả" ghim bên phải. */
export function BrandChips({ brands, allHref }: BrandChipsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  const updateArrows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setAtStart(el.scrollLeft <= 1)
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    updateArrows()
    window.addEventListener('resize', updateArrows)
    return () => window.removeEventListener('resize', updateArrows)
  }, [updateArrows, brands])

  const scrollByDir = (dir: 1 | -1) => {
    scrollRef.current?.scrollBy({ left: dir * 260, behavior: 'smooth' })
  }

  if (brands.length === 0) return null

  return (
    <div className="flex items-center gap-1.5">
      {/* Mũi tên trái */}
      <button
        type="button"
        onClick={() => scrollByDir(-1)}
        disabled={atStart}
        aria-label="Cuộn trái"
        className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full border border-border bg-card text-gray-600 transition-all hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-0"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>

      {/* Vùng chip cuộn ngang */}
      <div
        ref={scrollRef}
        onScroll={updateArrows}
        className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {brands.map((brand) => (
          <Link
            key={brand.id}
            href={`/products?brand=${brand.slug}`}
            className="flex-shrink-0 whitespace-nowrap rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:border-primary hover:bg-primary-light hover:text-primary"
          >
            {brand.name}
          </Link>
        ))}
      </div>

      {/* Mũi tên phải */}
      <button
        type="button"
        onClick={() => scrollByDir(1)}
        disabled={atEnd}
        aria-label="Cuộn phải"
        className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full border border-border bg-card text-gray-600 transition-all hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-0"
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>

      {/* Xem tất cả - ghim cố định bên phải */}
      <Link
        href={allHref}
        className="inline-flex flex-shrink-0 items-center gap-0.5 whitespace-nowrap pl-1 text-sm font-semibold text-primary hover:underline"
      >
        Xem tất cả
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  )
}
