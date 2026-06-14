import { Flame } from "lucide-react";
import { productApi } from "@/features/products/api";
import { categoryApi } from "@/features/categories/api";
import { brandApi } from "@/features/brands/api";
import { bannerApi } from "@/features/banners/api";
import { emptyBannersByPosition } from "@/features/banners/types";
import { HeroSection } from "@/components/home/hero-section";
import { TrustBadges } from "@/components/home/trust-badges";
import { BrandList } from "@/components/home/brand-list";
import { CategoryList } from "@/components/home/category-list";
import { FlashSaleSection } from "@/components/home/flash-sale-section";
import { ProductSection } from "@/components/home/product-section";
import { BrandShowcase } from "@/components/home/brand-showcase";
import { WideBanner } from "@/components/home/wide-banner";
import { CtaStrip } from "@/components/home/cta-strip";
import { EmptyState } from "@/components/home/empty-state";

export const revalidate = 60;

export default async function HomePage() {
  // Flash sale kết thúc 23:59:59 hôm nay
  const flashEndMs = new Date().setHours(23, 59, 59, 999);

  // Fetch song song, an toàn khi backend lỗi (Promise.allSettled)
  const [featuredR, hotR, saleR, catR, brandR, bannerR] = await Promise.allSettled([
    productApi.featured(),
    productApi.list({ tag: "hot", limit: 10 }),
    productApi.list({ tag: "giam-gia", limit: 10 }),
    categoryApi.list(),
    brandApi.list(),
    bannerApi.listGrouped(),
  ]);

  const featured = featuredR.status === "fulfilled" ? featuredR.value : [];
  const hot = hotR.status === "fulfilled" ? hotR.value : [];
  const sale = saleR.status === "fulfilled" ? saleR.value : [];
  const allCats = catR.status === "fulfilled" ? catR.value : [];
  const brands = brandR.status === "fulfilled" ? brandR.value : [];
  const banners = bannerR.status === "fulfilled" ? bannerR.value : emptyBannersByPosition();

  const flash = (sale.length ? sale : hot).slice(0, 10);
  // Lấy root categories (parentId === null), active, sắp xếp theo sortOrder, lấy 8 items
  const categories = allCats
    .filter((c) => c.parentId === null && c.isActive === true)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, 8);
  // Lấy active brands, limit 12 items
  const activeBrands = brands.filter((b) => b.isActive === true).slice(0, 12);
  const empty = featured.length === 0 && hot.length === 0;

  return (
    <div className="bg-[#f4f4f7]">
      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <HeroSection products={featured} />

      {/* ── TRUST BADGES ─────────────────────────────────────────────────── */}
      <TrustBadges />

      {/* ── HERO BANNERS (full-width, ngay dưới trust badges) ─────────────── */}
      {banners.HERO.length > 0 && (
        <div className="max-w-[1280px] mx-auto px-6 pt-6">
          <WideBanner banners={banners.HERO} />
        </div>
      )}

      <div className="max-w-[1280px] mx-auto px-6 py-6 space-y-6">
        {/* ── BRANDS ─────────────────────────────────────────────────────── */}
        <BrandList brands={activeBrands} />

        {/* ── FLASH SALE ─────────────────────────────────────────────────── */}
        <FlashSaleSection products={flash} endTime={flashEndMs} />

        {/* ── CATEGORIES ─────────────────────────────────────────────────── */}
        <CategoryList categories={categories} />

        {/* ── HORIZONTAL BANNERS (dải ngang giữa trang) ─────────────────── */}
        <WideBanner banners={banners.HORIZONTAL} />

        {/* ── HOT PRODUCTS (banner dọc trái + chip thương hiệu + lưới) ───── */}
        <BrandShowcase
          title="Điện thoại HOT"
          href="/products?tag=hot"
          products={hot}
          brands={activeBrands}
          brandsHref="/products"
          banners={banners.LEFT.map((b) => ({
            src: b.imageUrl,
            href: b.href ?? '/products',
            alt: b.alt,
          }))}
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
  );
}
