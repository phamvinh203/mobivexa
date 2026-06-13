import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { PrismaClient } from '../src/generated/prisma/client'
import { OrderStatus, PaymentMethod, PaymentStatus, ReviewStatus } from '../src/generated/prisma/enums'
import bcrypt from 'bcrypt'

// ─── DB client (giống src/config/db.ts) ──────────────────────────────────────
const sslConfig =
  process.env.NODE_ENV === 'production'
    ? true
    : process.env.DB_SSL_NO_VERIFY === 'true'
      ? { rejectUnauthorized: false }
      : true

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: sslConfig })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

// ─── Đọc dữ liệu crawl từ data/products.json ──────────────────────────────────
type CrawlImage = { url: string; local: string; isCover: boolean }
type CrawlProduct = {
  name: string; slug: string; brandSlug: string; categorySlug: string
  sourceUrl: string; description: string; price: number
  specs: Record<string, string>; images: CrawlImage[]
}
type CrawlData = {
  source: string; crawledAt: string; perBrand: number
  brands: { name: string; slug: string; color: string }[]
  products: CrawlProduct[]
}

function loadCrawl(): CrawlData {
  const candidates = [
    join(process.cwd(), '..', 'data', 'products.json'),
    join(__dirname, '..', '..', 'data', 'products.json'),
  ]
  const path = candidates.find(existsSync)
  if (!path) {
    console.error('❌  Không tìm thấy data/products.json')
    console.error('    Hãy chạy crawler trước:  cd ../data && node crawl.mjs')
    process.exit(1)
  }
  return JSON.parse(readFileSync(path, 'utf-8')) as CrawlData
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const round0 = (n: number) => Math.round(n)
const cleanSpec = (v?: string) => (v ? v.trim().replace(/\s+/g, ' ') : null)
const firstColor = (v?: string) => (v ? v.split(/[,/]/)[0].trim() : null)

let _orderSeq = 0
function makeOrderCode(): string {
  _orderSeq++
  return 'MBV' + Date.now().toString().slice(-7) + _orderSeq.toString().padStart(3, '0')
}

// Tags suy ra theo vị trí trong brand + giá + danh mục — đảm bảo phủ đủ hot/giảm giá
function computeTags(p: CrawlProduct, brandIdx: number, hasDiscount: boolean): string[] {
  const t = new Set<string>()
  const specsText = Object.values(p.specs).join(' ').toLowerCase()
  const is5G = /5g/.test(specsText) || /5g/i.test(p.name)
  const isFeaturePhone = p.categorySlug === 'dien-thoai-pho-thong'

  if (brandIdx === 0) t.add('hot')
  if (p.price >= 15_000_000) t.add('flagship')
  if (p.categorySlug === 'dien-thoai-gaming') t.add('gaming')
  if (is5G && !isFeaturePhone) t.add('5g')
  if (hasDiscount) t.add('giam-gia')
  if (brandIdx <= 1) t.add('moi-nhat')
  if (brandIdx >= 2) t.add('ban-chay')
  return [...t]
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const data = loadCrawl()
  console.log(`🌱  Seed Mobivexa từ ${data.source} (crawl ${data.crawledAt.slice(0, 10)})`)
  console.log(`    ${data.products.length} sản phẩm, ${data.brands.length} brands\n`)

  // ── Cleanup ────────────────────────────────────────────────────────────────
  process.stdout.write('  🗑   Xóa dữ liệu cũ... ')
  await prisma.reviewHelpful.deleteMany()
  await prisma.reviewPhoto.deleteMany()
  await prisma.review.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.cartItem.deleteMany()
  await prisma.cart.deleteMany()
  await prisma.productTag.deleteMany()
  await prisma.productImage.deleteMany()
  await prisma.productVariant.deleteMany()
  await prisma.product.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.brand.deleteMany()
  await prisma.category.deleteMany({ where: { parentId: { not: null } } })
  await prisma.category.deleteMany()
  await prisma.address.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.oAuthAccount.deleteMany()
  await prisma.user.deleteMany()
  console.log('✓')

  const passwordHash = await bcrypt.hash('Password123!', 10)

  // ── Brands (chỉ tạo brand có ít nhất 1 sản phẩm) ─────────────────────────────
  process.stdout.write('  📦  Tạo thương hiệu... ')
  const brandLogo = (label: string, bg: string) =>
    `https://placehold.co/300x300/${bg}/FFFFFF?text=${encodeURIComponent(label)}`
  const activeBrandSlugs = new Set(data.products.map((p) => p.brandSlug))
  const usedBrands = data.brands.filter((b) => activeBrandSlugs.has(b.slug))
  const brands = await Promise.all(
    usedBrands.map((b) =>
      prisma.brand.create({
        data: { name: b.name, slug: b.slug, description: `Điện thoại chính hãng ${b.name}`, logoUrl: brandLogo(b.name, b.color) },
      }),
    ),
  )
  const brand = Object.fromEntries(brands.map((b) => [b.slug, b]))
  console.log(`✓  (${brands.length} brands)`)

  // ── Categories (cây danh mục — slug khớp cellphones.com.vn) ───────────────────
  process.stdout.write('  📂  Tạo danh mục... ')
  const catPhone     = await prisma.category.create({ data: { name: 'Điện thoại', slug: 'dien-thoai', description: 'Tất cả các dòng điện thoại di động chính hãng', sortOrder: 1 } })
  const catAccessory = await prisma.category.create({ data: { name: 'Phụ kiện',   slug: 'phu-kien',   description: 'Phụ kiện điện thoại chính hãng', sortOrder: 2 } })
  const phoneChildren = await Promise.all([
    prisma.category.create({ data: { name: 'iPhone',                slug: 'iphone',                        parentId: catPhone.id, sortOrder: 1 } }),
    prisma.category.create({ data: { name: 'Điện thoại Android',    slug: 'dien-thoai-android',            parentId: catPhone.id, sortOrder: 2 } }),
    prisma.category.create({ data: { name: 'Điện thoại Gaming',     slug: 'dien-thoai-gaming',             parentId: catPhone.id, sortOrder: 3 } }),
    prisma.category.create({ data: { name: 'Điện thoại pin trâu',   slug: 'dien-thoai-pin-trau',           parentId: catPhone.id, sortOrder: 4 } }),
    prisma.category.create({ data: { name: 'Điện thoại chụp ảnh',   slug: 'dien-thoai-chup-anh-quay-phim', parentId: catPhone.id, sortOrder: 5 } }),
    prisma.category.create({ data: { name: 'Điện thoại phổ thông',  slug: 'dien-thoai-pho-thong',          parentId: catPhone.id, sortOrder: 6 } }),
  ])
  await Promise.all([
    prisma.category.create({ data: { name: 'Ốp lưng - Bao da', slug: 'bao-da-op-lung', parentId: catAccessory.id, sortOrder: 1 } }),
    prisma.category.create({ data: { name: 'Sạc - Cáp',        slug: 'sac-cap',        parentId: catAccessory.id, sortOrder: 2 } }),
    prisma.category.create({ data: { name: 'Tai nghe',         slug: 'tai-nghe',       parentId: catAccessory.id, sortOrder: 3 } }),
  ])
  const cat = Object.fromEntries(phoneChildren.map((c) => [c.slug, c]))
  console.log('✓  (2 cha + 9 con)')

  // ── Tags ───────────────────────────────────────────────────────────────────
  process.stdout.write('  🏷   Tạo tags... ')
  const tagSeed = [
    { name: 'Hot', slug: 'hot' }, { name: 'Mới nhất', slug: 'moi-nhat' },
    { name: 'Giảm giá', slug: 'giam-gia' }, { name: 'Flagship', slug: 'flagship' },
    { name: 'Bán chạy', slug: 'ban-chay' }, { name: 'Gaming', slug: 'gaming' },
    { name: '5G', slug: '5g' }, { name: 'Pin trâu', slug: 'pin-trau' },
  ]
  const tags = await Promise.all(tagSeed.map((t) => prisma.tag.create({ data: t })))
  const tag = Object.fromEntries(tags.map((t) => [t.slug, t]))
  console.log(`✓  (${tags.length} tags)`)

  // ── Products (từ crawl JSON) ─────────────────────────────────────────────────
  process.stdout.write('  📱  Tạo sản phẩm... ')
  const brandCounter: Record<string, number> = {}
  const createdProducts = []
  let totalImages = 0

  for (let i = 0; i < data.products.length; i++) {
    const p = data.products[i]
    if (!brand[p.brandSlug] || !cat[p.categorySlug]) continue
    const brandIdx = brandCounter[p.brandSlug] ?? 0
    brandCounter[p.brandSlug] = brandIdx + 1

    // brand-idx 1 và mỗi sp thứ 3 → giảm sâu (flash sale); còn lại giảm nhẹ 5%
    const deepSale = brandIdx === 1 || i % 3 === 0
    const salePrice = p.price
    const originalPrice = deepSale ? round0(salePrice / 0.85) : round0(salePrice / 0.95)
    const tagSlugs = computeTags(p, brandIdx, true)
    const isFeatured = brandIdx === 0

    const storage = cleanSpec(p.specs['Bộ nhớ trong'])
    const ram = cleanSpec(p.specs['Dung lượng RAM'])
    const color = firstColor(p.specs['Màu sắc'])
    const stock = ((i * 13) % 40) + 6

    const images = p.images.map((im, idx) => ({
      url: im.url, // URL CDN cellphones (đã thêm vào next.config remotePatterns)
      publicId: `cellphones/${p.slug}/${idx}`,
      isCover: im.isCover,
      sortOrder: idx,
    }))
    totalImages += images.length

    const created = await prisma.product.create({
      data: {
        name: p.name, slug: p.slug, description: p.description || p.name,
        categoryId: cat[p.categorySlug].id, brandId: brand[p.brandSlug].id,
        isFeatured, isActive: true,
        images: { create: images },
        variants: {
          create: [{
            sku: `MBV-${p.slug}`.toUpperCase().slice(0, 60),
            color, storage, ram,
            originalPrice, salePrice, stock, isActive: true,
          }],
        },
        productTags: { create: tagSlugs.map((s) => ({ tagId: tag[s].id })) },
      },
      include: { variants: true },
    })
    createdProducts.push(created)
  }
  console.log(`✓  (${createdProducts.length} sp, ${createdProducts.length} variants, ${totalImages} ảnh)`)

  // ── Users ──────────────────────────────────────────────────────────────────
  process.stdout.write('  👤  Tạo người dùng... ')
  await prisma.user.create({ data: { email: 'admin@mobivexa.com', fullName: 'Admin Mobivexa',     passwordHash, role: 'ADMIN', isActive: true, emailVerified: true } })
  await prisma.user.create({ data: { email: 'staff@mobivexa.com', fullName: 'Nhân Viên Mobivexa', passwordHash, role: 'STAFF', isActive: true, emailVerified: true, phone: '0901234567' } })
  const customers = await Promise.all([
    prisma.user.create({ data: { email: 'nguyen.van.an@gmail.com', fullName: 'Nguyễn Văn An', passwordHash, phone: '0912345678', role: 'CUSTOMER', isActive: true, emailVerified: true } }),
    prisma.user.create({ data: { email: 'tran.thi.binh@gmail.com', fullName: 'Trần Thị Bình', passwordHash, phone: '0923456789', role: 'CUSTOMER', isActive: true, emailVerified: true } }),
    prisma.user.create({ data: { email: 'le.minh.cuong@gmail.com', fullName: 'Lê Minh Cường', passwordHash, phone: '0934567890', role: 'CUSTOMER', isActive: true, emailVerified: true } }),
    prisma.user.create({ data: { email: 'pham.thi.dao@gmail.com',  fullName: 'Phạm Thị Đào',  passwordHash, phone: '0945678901', role: 'CUSTOMER', isActive: true, emailVerified: false } }),
    prisma.user.create({ data: { email: 'hoang.van.em@gmail.com',  fullName: 'Hoàng Văn Em',  passwordHash, phone: '0956789012', role: 'CUSTOMER', isActive: true, emailVerified: true } }),
  ])
  console.log(`✓  (2 staff + ${customers.length} khách hàng)`)

  // ── Addresses ──────────────────────────────────────────────────────────────
  process.stdout.write('  🏠  Tạo địa chỉ... ')
  const provinces = ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ']
  const districts = ['Đống Đa', 'Quận 1', 'Hải Châu', 'Lê Chân', 'Ninh Kiều']
  const wards     = ['Phương Liên', 'Bến Nghé', 'Hải Châu I', 'An Biên', 'Tân An']
  for (const [i, c] of customers.entries()) {
    await prisma.address.createMany({
      data: [
        { userId: c.id, fullName: c.fullName, phone: c.phone!, province: provinces[i], district: districts[i], ward: wards[i], streetDetail: `${i + 10} Đường Láng`, isDefault: true },
        { userId: c.id, fullName: c.fullName, phone: c.phone!, province: 'TP. Hồ Chí Minh', district: 'Quận 3', ward: 'Võ Thị Sáu', streetDetail: `${i + 20} Nguyễn Thị Minh Khai`, isDefault: false },
      ],
    })
  }
  console.log('✓')

  // ── Carts (mỗi khách 1 sản phẩm khác nhau) ───────────────────────────────────
  process.stdout.write('  🛒  Tạo giỏ hàng... ')
  for (const [i, c] of customers.entries()) {
    const prod = createdProducts[(i * 5) % createdProducts.length]
    await prisma.cart.create({
      data: { userId: c.id, items: { create: [{ variantId: prod.variants[0].id, quantity: 1 }] } },
    })
  }
  console.log('✓')

  // ── Orders ─────────────────────────────────────────────────────────────────
  process.stdout.write('  📦  Tạo đơn hàng... ')
  const pick = (n: number) => createdProducts[n % createdProducts.length]
  const orderDefs = [
    { userIdx: 0, prod: pick(0),  quantity: 1, status: OrderStatus.DELIVERED, paymentMethod: PaymentMethod.COD,           paymentStatus: PaymentStatus.PAID   },
    { userIdx: 0, prod: pick(8),  quantity: 1, status: OrderStatus.DELIVERED, paymentMethod: PaymentMethod.BANK_TRANSFER, paymentStatus: PaymentStatus.PAID   },
    { userIdx: 1, prod: pick(16), quantity: 1, status: OrderStatus.SHIPPING,  paymentMethod: PaymentMethod.COD,           paymentStatus: PaymentStatus.UNPAID },
    { userIdx: 1, prod: pick(3),  quantity: 2, status: OrderStatus.DELIVERED, paymentMethod: PaymentMethod.BANK_TRANSFER, paymentStatus: PaymentStatus.PAID   },
    { userIdx: 2, prod: pick(24), quantity: 1, status: OrderStatus.PENDING,   paymentMethod: PaymentMethod.COD,           paymentStatus: PaymentStatus.UNPAID },
    { userIdx: 3, prod: pick(32), quantity: 1, status: OrderStatus.CANCELLED, paymentMethod: PaymentMethod.COD,           paymentStatus: PaymentStatus.UNPAID, cancelReason: 'Đặt nhầm sản phẩm' },
    { userIdx: 4, prod: pick(40), quantity: 1, status: OrderStatus.DELIVERED, paymentMethod: PaymentMethod.BANK_TRANSFER, paymentStatus: PaymentStatus.PAID   },
    { userIdx: 4, prod: pick(12), quantity: 1, status: OrderStatus.CONFIRMED, paymentMethod: PaymentMethod.COD,           paymentStatus: PaymentStatus.UNPAID },
  ]

  const createdOrders = []
  for (const [idx, od] of orderDefs.entries()) {
    const customer  = customers[od.userIdx]
    const variant   = od.prod.variants[0]
    const unitPrice = Number(variant.salePrice.toString())
    const subtotal  = unitPrice * od.quantity
    const shippingFee = subtotal >= 20_000_000 ? 0 : 30_000
    const total     = subtotal + shippingFee

    const order = await prisma.order.create({
      data: {
        orderCode: makeOrderCode(), userId: customer.id,
        shippingName: customer.fullName, shippingPhone: customer.phone!,
        shippingProvince: provinces[od.userIdx], shippingDistrict: districts[od.userIdx],
        shippingWard: wards[od.userIdx], shippingDetail: `${idx + 1} Lê Lợi`,
        subtotal, shippingFee, discount: 0, total,
        status: od.status, paymentMethod: od.paymentMethod, paymentStatus: od.paymentStatus,
        cancelReason: od.cancelReason ?? null,
        paidAt: od.paymentStatus === PaymentStatus.PAID ? new Date() : null,
        items: {
          create: [{
            variantId: variant.id, productName: od.prod.name, sku: variant.sku,
            color: variant.color ?? '', storage: variant.storage ?? '', ram: variant.ram ?? '',
            unitPrice, quantity: od.quantity, subtotal: unitPrice * od.quantity,
          }],
        },
      },
      include: { items: true },
    })
    createdOrders.push(order)
  }
  console.log(`✓  (${createdOrders.length} đơn hàng)`)

  // ── Reviews ────────────────────────────────────────────────────────────────
  process.stdout.write('  ⭐  Tạo đánh giá... ')
  const reviewTexts = [
    { rating: 5, content: 'Sản phẩm tuyệt vời, đúng hàng chính hãng! Giao hàng nhanh, đóng gói cẩn thận. Màn hình đẹp, hiệu năng mạnh mẽ. Rất hài lòng!' },
    { rating: 5, content: 'Điện thoại chất lượng vượt trội, camera chụp ảnh cực đẹp nhất là ban đêm. Shop tư vấn nhiệt tình, sẽ ủng hộ tiếp lần sau!' },
    { rating: 4, content: 'Sản phẩm tốt, pin dùng thoải mái cả ngày. Camera sắc nét. Chỉ tiếc không kèm sạc, phải mua thêm. Nhìn chung hài lòng.' },
    { rating: 5, content: 'Đặt chiều hôm trước, sáng hôm sau đã có hàng. Máy nguyên seal, hiệu năng mượt mà, pin rất bền. Sẽ mua thêm cho gia đình!' },
  ]
  const deliveredOrders = createdOrders.filter((o) => o.status === OrderStatus.DELIVERED)
  for (let i = 0; i < Math.min(deliveredOrders.length, reviewTexts.length); i++) {
    const order = deliveredOrders[i]
    const orderItem = order.items[0]
    const variant = await prisma.productVariant.findUnique({ where: { id: orderItem.variantId! }, select: { productId: true } })
    if (!variant) continue
    await prisma.review.create({
      data: {
        orderItemId: orderItem.id, userId: order.userId, productId: variant.productId,
        variantId: orderItem.variantId, rating: reviewTexts[i].rating,
        content: reviewTexts[i].content, status: ReviewStatus.APPROVED,
      },
    })
  }
  const reviewCount = Math.min(deliveredOrders.length, reviewTexts.length)
  console.log(`✓  (${reviewCount} đánh giá)`)

  // ── Summary ────────────────────────────────────────────────────────────────
  const featuredCount = createdProducts.filter((p) => p.isFeatured).length
  console.log('\n  ✅  Seed hoàn thành!\n')
  console.log('  ┌──────────────────────────────────────────────┐')
  console.log('  │              Tổng kết dữ liệu                 │')
  console.log('  ├──────────────────────────────────────────────┤')
  console.log(`  │  Nguồn         : cellphones.com.vn (crawl)    │`)
  console.log(`  │  Thương hiệu   : ${String(brands.length).padEnd(28)}│`)
  console.log(`  │  Danh mục      : 11 (2 cha + 9 con)${' '.repeat(11)}│`)
  console.log(`  │  Tags          : ${String(tags.length).padEnd(28)}│`)
  console.log(`  │  Sản phẩm      : ${String(`${createdProducts.length} (${totalImages} ảnh, ${featuredCount} nổi bật)`).padEnd(28)}│`)
  console.log(`  │  Người dùng    : 7  (1 admin, 1 staff, 5)${' '.repeat(5)}│`)
  console.log(`  │  Đơn hàng      : ${String(createdOrders.length).padEnd(28)}│`)
  console.log(`  │  Đánh giá      : ${String(reviewCount).padEnd(28)}│`)
  console.log('  ├──────────────────────────────────────────────┤')
  console.log('  │  Tài khoản (Password123!)                     │')
  console.log('  │  admin@mobivexa.com         → ADMIN           │')
  console.log('  │  staff@mobivexa.com         → STAFF           │')
  console.log('  │  nguyen.van.an@gmail.com    → CUSTOMER         │')
  console.log('  └──────────────────────────────────────────────┘\n')
}

main()
  .catch((e) => { console.error('❌  Seed thất bại:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
