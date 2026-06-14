import Link from 'next/link'
import Image from 'next/image'

interface PromoBannerProps {
  imageSrc: string
  href: string
  alt: string
}

/** Banner dọc khuyến mãi. Dùng ở cột trái của BrandShowcase. */
export function PromoBanner({ imageSrc, href, alt }: PromoBannerProps) {
  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-xl border border-border"
    >
      <Image
        src={imageSrc}
        alt={alt}
        width={321}
        height={795}
        sizes="260px"
        className="h-auto w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
    </Link>
  )
}
