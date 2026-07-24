'use client'

import Image from 'next/image'
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react'

interface ProductGalleryProps {
  images: { id: string; url: string }[]
  productName: string
  /** Index ảnh đang xem — controlled bởi ProductViewer để đồng bộ với màu đã chọn */
  activeIndex: number
  onSelect: (index: number) => void
  /** % giảm giá của variant đang chọn — 0 thì ẩn badge */
  discount: number
}

export function ProductGallery({
  images,
  productName,
  activeIndex,
  onSelect,
  discount,
}: ProductGalleryProps) {
  const active = images[activeIndex]
  const hasMany = images.length > 1

  function step(delta: number) {
    // Cuộn vòng để bấm mũi tên ở ảnh cuối quay lại ảnh đầu
    onSelect((activeIndex + delta + images.length) % images.length)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-white">
        {discount > 0 && (
          <span className="absolute left-4 top-4 z-10 rounded-full bg-[var(--color-sale-strong)] px-3 py-1 text-xs font-black leading-none text-white shadow-sm">
            -{discount}%
          </span>
        )}

        {active ? (
          <Image
            key={active.id}
            src={active.url}
            alt={`${productName} — ảnh ${activeIndex + 1}`}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 520px"
            className="object-contain p-8 transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center gap-2 text-muted-foreground">
            <ImageOff className="h-10 w-10" aria-hidden />
            <span className="text-sm">Chưa có ảnh sản phẩm</span>
          </div>
        )}

        {hasMany && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Ảnh trước"
              className="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-border bg-white/90 text-gray-700 opacity-0 shadow-sm transition-opacity hover:bg-white focus-visible:opacity-100 group-hover:opacity-100"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Ảnh kế tiếp"
              className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-border bg-white/90 text-gray-700 opacity-0 shadow-sm transition-opacity hover:bg-white focus-visible:opacity-100 group-hover:opacity-100"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </>
        )}
      </div>

      {hasMany && (
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => onSelect(i)}
              aria-label={`Xem ảnh ${i + 1}`}
              aria-current={i === activeIndex}
              className={`relative aspect-square w-[68px] flex-shrink-0 overflow-hidden rounded-xl border bg-white transition-all ${
                i === activeIndex
                  ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20'
                  : 'border-border hover:border-[var(--color-primary)]/50'
              }`}
            >
              <Image
                src={img.url}
                alt=""
                fill
                sizes="68px"
                className="object-contain p-1.5"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
