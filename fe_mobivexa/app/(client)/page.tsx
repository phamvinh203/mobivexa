import { Flame } from 'lucide-react'
import { productApi } from '@/features/products/api'
import { categoryApi } from '@/features/categories/api'
import { brandApi } from '@/features/brands/api'
import { HeroSection } from '@/components/home/hero-section'
import { TrustBadges } from '@/components/home/trust-badges'
import { BrandList } from '@/components/home/brand-list'
import { CategoryList } from '@/components/home/category-list'
import { FlashSaleSection } from '@/components/home/flash-sale-section'
import { ProductSection } from '@/components/home/product-section'
import { BrandShowcase } from '@/components/home/brand-showcase'
import { CtaStrip } from '@/components/home/cta-strip'
import { EmptyState } from '@/components/home/empty-state'

export const revalidate = 60


export default async function HomePage() {
  // Flash sale kết thúc 23:59:59 hôm nay
  const flashEndMs = new Date().setHours(23, 59, 59, 999)

  // Fetch song song, an toàn khi backend lỗi (Promise.allSettled)
  const [featuredR, hotR, saleR, catR, brandR] = await Promise.allSettled([
    productApi.featured(),
    productApi.list({ tag: 'hot', limit: 10 }),
    productApi.list({ tag: 'giam-gia', limit: 10 }),
    categoryApi.list(),
    brandApi.list(),
  ])

  const featured = featuredR.status === 'fulfilled' ? featuredR.value : []
  const hot = hotR.status === 'fulfilled' ? hotR.value : []
  const sale = saleR.status === 'fulfilled' ? saleR.value : []
  const allCats = catR.status === 'fulfilled' ? catR.value : []
  const brands = brandR.status === 'fulfilled' ? brandR.value : []

  const flash = (sale.length ? sale : hot).slice(0, 10)
  // Lấy root categories (parentId === null), active, sắp xếp theo sortOrder, lấy 8 items
  const categories = allCats
    .filter((c) => c.parentId === null && c.isActive === true)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, 8)
  // Lấy active brands, limit 12 items
  const activeBrands = brands.filter((b) => b.isActive === true).slice(0, 12)
  const empty = featured.length === 0 && hot.length === 0

  return (
    <div className="bg-[#f4f4f7]">
      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <HeroSection products={featured} />

      {/* ── TRUST BADGES ─────────────────────────────────────────────────── */}
      <TrustBadges />

      <div className="max-w-[1280px] mx-auto px-6 py-6 space-y-6">
        {/* ── BRANDS ─────────────────────────────────────────────────────── */}
        <BrandList brands={activeBrands} />

        {/* ── FLASH SALE ─────────────────────────────────────────────────── */}
        <FlashSaleSection products={flash} endTime={flashEndMs} />

        {/* ── CATEGORIES ─────────────────────────────────────────────────── */}
        <CategoryList categories={categories} />

        {/* ── HOT PRODUCTS (banner + chip thương hiệu + lưới) ────────────── */}
        <BrandShowcase
          title="Điện thoại HOT"
          href="/products?tag=hot"
          products={hot}
          brands={activeBrands}
          brandsHref="/products"
          banners={[
            { src: '/banner_1.webp', href: '/products', alt: 'Khuyến mãi nổi bật' },
            { src: '/banner_2.webp', href: '/products', alt: 'Ưu đãi đặc biệt' },
          ]}
          barClassName="bg-primary"
          linkClassName="text-primary"
          badge={
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-black leading-none text-white">
              <Flame className="h-3 w-3 fill-white" aria-hidden />
              HOT
            </span>
          }
        />

        {/* ── FEATURED PRODUCTS ──────────────────────────────────────────── */}
        <ProductSection
          title="Sản phẩm nổi bật"
          href="/products?featured=true"
          products={featured}
          barClassName="bg-[var(--color-sale)]"
          linkClassName="text-[var(--color-sale)]"
          limit={5}
          moreHref="/products?featured=true"
        />

        {/* Empty state khi chưa seed */}
        {empty && <EmptyState />}
      </div>

      {/* ── CTA STRIP ──────────────────────────────────────────────────── */}
      <CtaStrip />
    </div>
  )
}
