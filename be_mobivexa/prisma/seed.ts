import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
const img = (label: string, bg = '1a1a2e', fg = 'FFFFFF') =>
  `https://placehold.co/600x800/${bg}/${fg}?text=${encodeURIComponent(label)}`

let _orderSeq = 0
function makeOrderCode(): string {
  _orderSeq++
  return 'MBV' + Date.now().toString().slice(-7) + _orderSeq.toString().padStart(3, '0')
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('🌱  Bắt đầu seed database Mobivexa...\n')

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
  // Category tự tham chiếu — xóa con trước
  await prisma.category.deleteMany({ where: { parentId: { not: null } } })
  await prisma.category.deleteMany()
  await prisma.address.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.oAuthAccount.deleteMany()
  await prisma.user.deleteMany()
  console.log('✓')

  const passwordHash = await bcrypt.hash('Password123!', 10)

  // ── Brands ─────────────────────────────────────────────────────────────────
  process.stdout.write('  📦  Tạo thương hiệu... ')
  const [apple, samsung, xiaomi, oppo, vivo, oneplus] = await Promise.all([
    prisma.brand.create({ data: { name: 'Apple',   slug: 'apple',   description: 'Thương hiệu công nghệ hàng đầu thế giới từ Mỹ',               logoUrl: img('Apple',   '000000') } }),
    prisma.brand.create({ data: { name: 'Samsung', slug: 'samsung', description: 'Tập đoàn điện tử đa quốc gia Hàn Quốc',                        logoUrl: img('Samsung', '1428A0') } }),
    prisma.brand.create({ data: { name: 'Xiaomi',  slug: 'xiaomi',  description: 'Công ty công nghệ Trung Quốc nổi tiếng với hiệu năng/giá tốt', logoUrl: img('Xiaomi',  'FF6900') } }),
    prisma.brand.create({ data: { name: 'OPPO',    slug: 'oppo',    description: 'Thương hiệu điện thoại chuyên về camera và thiết kế',          logoUrl: img('OPPO',    '1D8348') } }),
    prisma.brand.create({ data: { name: 'Vivo',    slug: 'vivo',    description: 'Thương hiệu điện thoại cao cấp đến từ Trung Quốc',             logoUrl: img('Vivo',    '415A77') } }),
    prisma.brand.create({ data: { name: 'OnePlus', slug: 'oneplus', description: 'Flagship killer — hiệu năng cao, giá hợp lý',                  logoUrl: img('OnePlus', 'EB0028') } }),
  ])
  console.log('✓  (6 brands)')

  // ── Categories ─────────────────────────────────────────────────────────────
  process.stdout.write('  📂  Tạo danh mục... ')
  const catPhone     = await prisma.category.create({ data: { name: 'Điện thoại di động',   slug: 'dien-thoai-di-dong', description: 'Tất cả các dòng điện thoại di động',  sortOrder: 1 } })
  const catAccessory = await prisma.category.create({ data: { name: 'Phụ kiện điện thoại',  slug: 'phu-kien-dien-thoai', description: 'Phụ kiện chính hãng và cao cấp',      sortOrder: 2 } })
  const [catIPhone, catAndroid] = await Promise.all([
    prisma.category.create({ data: { name: 'iPhone',   slug: 'iphone',    parentId: catPhone.id,     sortOrder: 1 } }),
    prisma.category.create({ data: { name: 'Android',  slug: 'android',   parentId: catPhone.id,     sortOrder: 2 } }),
    prisma.category.create({ data: { name: 'Tai nghe', slug: 'tai-nghe',  parentId: catAccessory.id, sortOrder: 1 } }),
    prisma.category.create({ data: { name: 'Ốp lưng',  slug: 'op-lung',   parentId: catAccessory.id, sortOrder: 2 } }),
  ])
  console.log('✓  (2 cha + 4 con)')

  // ── Tags ───────────────────────────────────────────────────────────────────
  process.stdout.write('  🏷   Tạo tags... ')
  const [tagHot, tagNew, tagSale, tagFlagship, tagBestSeller, tagGaming, tag5G, tagBigBattery] =
    await Promise.all([
      { name: 'Hot',        slug: 'hot'       },
      { name: 'Mới nhất',   slug: 'moi-nhat'  },
      { name: 'Giảm giá',   slug: 'giam-gia'  },
      { name: 'Flagship',   slug: 'flagship'  },
      { name: 'Bán chạy',   slug: 'ban-chay'  },
      { name: 'Gaming',     slug: 'gaming'    },
      { name: '5G',         slug: '5g'        },
      { name: 'Pin trâu',   slug: 'pin-trau'  },
    ].map(t => prisma.tag.create({ data: t })))
  console.log('✓  (8 tags)')

  // ── Products ───────────────────────────────────────────────────────────────
  type TagRef  = typeof tagHot
  type ImgSeed = { url: string; publicId: string; isCover: boolean; sortOrder: number }
  type VarSeed = { sku: string; color: string; storage: string; ram: string; originalPrice: number; salePrice: number; stock: number }
  type ProdSeed = {
    name: string; slug: string; description: string
    categoryId: string; brandId: string; isFeatured: boolean
    tags: TagRef[]; images: ImgSeed[]; variants: VarSeed[]
  }

  const products: ProdSeed[] = [
    // ── Apple / iPhone ───────────────────────────────────────────────────────
    {
      name: 'iPhone 16 Pro Max', slug: 'iphone-16-pro-max',
      description: 'iPhone 16 Pro Max với chip A18 Pro, màn hình Super Retina XDR 6.9 inch, hệ thống camera Pro 48MP cùng nút Camera Control hoàn toàn mới.',
      categoryId: catIPhone.id, brandId: apple.id, isFeatured: true,
      tags: [tagHot, tagFlagship, tagNew, tag5G],
      images: [
        { url: img('16 Pro Max', '1C1C1E'), publicId: 'mobivexa/ip16pm-1', isCover: true,  sortOrder: 0 },
        { url: img('16 Pro Max Side', '2C2C2E'), publicId: 'mobivexa/ip16pm-2', isCover: false, sortOrder: 1 },
      ],
      variants: [
        { sku: 'IP16PM-BTI-256', color: 'Đen Titanium',    storage: '256GB', ram: '8GB', originalPrice: 36990000, salePrice: 34990000, stock: 15 },
        { sku: 'IP16PM-TTI-512', color: 'Titan Trắng',     storage: '512GB', ram: '8GB', originalPrice: 42990000, salePrice: 40990000, stock: 10 },
        { sku: 'IP16PM-DTI-1TB', color: 'Titan Sa Mạc',    storage: '1TB',   ram: '8GB', originalPrice: 52990000, salePrice: 49990000, stock:  5 },
      ],
    },
    {
      name: 'iPhone 16 Pro', slug: 'iphone-16-pro',
      description: 'iPhone 16 Pro với chip A18 Pro, màn hình 6.3 inch OLED ProMotion, hệ thống camera chuyên nghiệp 3 ống kính.',
      categoryId: catIPhone.id, brandId: apple.id, isFeatured: true,
      tags: [tagFlagship, tagNew, tag5G],
      images: [{ url: img('16 Pro', '2C2C2E'), publicId: 'mobivexa/ip16p-1', isCover: true, sortOrder: 0 }],
      variants: [
        { sku: 'IP16P-BTI-128', color: 'Đen Titanium',   storage: '128GB', ram: '8GB', originalPrice: 28990000, salePrice: 27490000, stock: 20 },
        { sku: 'IP16P-BTI-256', color: 'Đen Titanium',   storage: '256GB', ram: '8GB', originalPrice: 32990000, salePrice: 30990000, stock: 15 },
        { sku: 'IP16P-TTN-256', color: 'Titan Tự Nhiên', storage: '256GB', ram: '8GB', originalPrice: 32990000, salePrice: 30990000, stock: 12 },
      ],
    },
    {
      name: 'iPhone 16 Plus', slug: 'iphone-16-plus',
      description: 'iPhone 16 Plus với màn hình lớn 6.7 inch OLED, chip A18, thời lượng pin lên đến 27 giờ xem video.',
      categoryId: catIPhone.id, brandId: apple.id, isFeatured: false,
      tags: [tagNew, tag5G, tagBigBattery],
      images: [{ url: img('16 Plus', '3A3A3C'), publicId: 'mobivexa/ip16pl-1', isCover: true, sortOrder: 0 }],
      variants: [
        { sku: 'IP16PL-HONG-128', color: 'Hồng', storage: '128GB', ram: '8GB', originalPrice: 24990000, salePrice: 23490000, stock: 18 },
        { sku: 'IP16PL-TIM-256',  color: 'Tím',  storage: '256GB', ram: '8GB', originalPrice: 28990000, salePrice: 27490000, stock: 10 },
      ],
    },
    {
      name: 'iPhone 16', slug: 'iphone-16',
      description: 'iPhone 16 tiêu chuẩn với chip A18, màn hình 6.1 inch OLED, nút Camera Control và Action Button tiện lợi.',
      categoryId: catIPhone.id, brandId: apple.id, isFeatured: false,
      tags: [tagNew, tag5G, tagBestSeller],
      images: [{ url: img('iPhone 16', '1D1D1F'), publicId: 'mobivexa/ip16-1', isCover: true, sortOrder: 0 }],
      variants: [
        { sku: 'IP16-DEN-128',   color: 'Đen',   storage: '128GB', ram: '8GB', originalPrice: 22990000, salePrice: 21990000, stock: 30 },
        { sku: 'IP16-XANH-128',  color: 'Xanh',  storage: '128GB', ram: '8GB', originalPrice: 22990000, salePrice: 21990000, stock: 25 },
        { sku: 'IP16-TRANG-256', color: 'Trắng', storage: '256GB', ram: '8GB', originalPrice: 27490000, salePrice: 25990000, stock: 20 },
      ],
    },
    {
      name: 'iPhone 15', slug: 'iphone-15',
      description: 'iPhone 15 với chip A16 Bionic, Dynamic Island, cổng USB-C, camera 48MP ấn tượng.',
      categoryId: catIPhone.id, brandId: apple.id, isFeatured: false,
      tags: [tagSale, tagBestSeller, tag5G],
      images: [{ url: img('iPhone 15', '1D3557'), publicId: 'mobivexa/ip15-1', isCover: true, sortOrder: 0 }],
      variants: [
        { sku: 'IP15-DEN-128',  color: 'Đen',      storage: '128GB', ram: '6GB', originalPrice: 19990000, salePrice: 17990000, stock: 40 },
        { sku: 'IP15-HONG-128', color: 'Hồng',     storage: '128GB', ram: '6GB', originalPrice: 19990000, salePrice: 17990000, stock: 30 },
        { sku: 'IP15-XANH-256', color: 'Xanh Lam', storage: '256GB', ram: '6GB', originalPrice: 23490000, salePrice: 21490000, stock: 20 },
      ],
    },

    // ── Samsung ───────────────────────────────────────────────────────────────
    {
      name: 'Samsung Galaxy S25 Ultra', slug: 'samsung-galaxy-s25-ultra',
      description: 'Galaxy S25 Ultra với S Pen tích hợp AI, chip Snapdragon 8 Elite, camera 200MP Zoom Space.',
      categoryId: catAndroid.id, brandId: samsung.id, isFeatured: true,
      tags: [tagHot, tagFlagship, tagNew, tag5G],
      images: [{ url: img('S25 Ultra', '1428A0'), publicId: 'mobivexa/s25u-1', isCover: true, sortOrder: 0 }],
      variants: [
        { sku: 'S25U-TDEN-256', color: 'Titan Đen', storage: '256GB', ram: '12GB', originalPrice: 33990000, salePrice: 31990000, stock: 15 },
        { sku: 'S25U-TXAM-512', color: 'Titan Xám', storage: '512GB', ram: '12GB', originalPrice: 39990000, salePrice: 37990000, stock:  8 },
      ],
    },
    {
      name: 'Samsung Galaxy S25+', slug: 'samsung-galaxy-s25-plus',
      description: 'Galaxy S25+ với màn hình QHD+ 6.7 inch, pin 4900mAh sạc nhanh 45W, Galaxy AI toàn diện.',
      categoryId: catAndroid.id, brandId: samsung.id, isFeatured: false,
      tags: [tagFlagship, tagNew, tag5G],
      images: [{ url: img('S25+', '003087'), publicId: 'mobivexa/s25pl-1', isCover: true, sortOrder: 0 }],
      variants: [
        { sku: 'S25PL-BAC-256', color: 'Bạc',  storage: '256GB', ram: '12GB', originalPrice: 26990000, salePrice: 24990000, stock: 18 },
        { sku: 'S25PL-DEN-512', color: 'Đen',  storage: '512GB', ram: '12GB', originalPrice: 30990000, salePrice: 28990000, stock: 10 },
      ],
    },
    {
      name: 'Samsung Galaxy S25', slug: 'samsung-galaxy-s25',
      description: 'Galaxy S25 compact với chip Snapdragon 8 Elite, màn 6.2 inch FHD+, Galaxy AI thông minh.',
      categoryId: catAndroid.id, brandId: samsung.id, isFeatured: false,
      tags: [tagNew, tag5G, tagBestSeller],
      images: [{ url: img('S25', '0057B7'), publicId: 'mobivexa/s25-1', isCover: true, sortOrder: 0 }],
      variants: [
        { sku: 'S25-XNAV-128', color: 'Xanh Navy', storage: '128GB', ram: '12GB', originalPrice: 22990000, salePrice: 21490000, stock: 25 },
        { sku: 'S25-TRAN-256', color: 'Trắng',     storage: '256GB', ram: '12GB', originalPrice: 25990000, salePrice: 24490000, stock: 15 },
      ],
    },
    {
      name: 'Samsung Galaxy A56', slug: 'samsung-galaxy-a56',
      description: 'Galaxy A56 với camera AI 50MP, màn hình Super AMOLED 6.7 inch 120Hz, chip Exynos 1580.',
      categoryId: catAndroid.id, brandId: samsung.id, isFeatured: false,
      tags: [tagNew, tag5G],
      images: [{ url: img('A56', '2980B9'), publicId: 'mobivexa/a56-1', isCover: true, sortOrder: 0 }],
      variants: [
        { sku: 'A56-XANH-128', color: 'Xanh',  storage: '128GB', ram: '8GB', originalPrice:  9990000, salePrice:  8990000, stock: 35 },
        { sku: 'A56-DEN-256',  color: 'Đen',   storage: '256GB', ram: '8GB', originalPrice: 11490000, salePrice: 10490000, stock: 25 },
      ],
    },
    {
      name: 'Samsung Galaxy A36', slug: 'samsung-galaxy-a36',
      description: 'Galaxy A36 với màn hình AMOLED 90Hz, camera 50MP, pin 5000mAh sạc nhanh 45W.',
      categoryId: catAndroid.id, brandId: samsung.id, isFeatured: false,
      tags: [tagBestSeller, tagBigBattery],
      images: [{ url: img('A36', '7F8C8D'), publicId: 'mobivexa/a36-1', isCover: true, sortOrder: 0 }],
      variants: [
        { sku: 'A36-HONG-128', color: 'Hồng', storage: '128GB', ram: '8GB', originalPrice: 7990000, salePrice: 6990000, stock: 40 },
        { sku: 'A36-TIM-128',  color: 'Tím',  storage: '128GB', ram: '8GB', originalPrice: 7990000, salePrice: 6990000, stock: 35 },
      ],
    },

    // ── Xiaomi ────────────────────────────────────────────────────────────────
    {
      name: 'Xiaomi 15 Ultra', slug: 'xiaomi-15-ultra',
      description: 'Xiaomi 15 Ultra với camera Leica 200MP, chip Snapdragon 8 Elite, sạc không dây 80W.',
      categoryId: catAndroid.id, brandId: xiaomi.id, isFeatured: true,
      tags: [tagHot, tagFlagship, tagNew, tag5G],
      images: [{ url: img('Mi 15 Ultra', 'FF6900'), publicId: 'mobivexa/mi15u-1', isCover: true, sortOrder: 0 }],
      variants: [
        { sku: 'MI15U-DEN-256',  color: 'Đen',   storage: '256GB', ram: '16GB', originalPrice: 24990000, salePrice: 22990000, stock: 12 },
        { sku: 'MI15U-TRAN-512', color: 'Trắng', storage: '512GB', ram: '16GB', originalPrice: 29990000, salePrice: 27490000, stock:  8 },
      ],
    },
    {
      name: 'Xiaomi 15', slug: 'xiaomi-15',
      description: 'Xiaomi 15 với chip Snapdragon 8 Elite, camera Leica 50MP, sạc nhanh 90W HyperCharge.',
      categoryId: catAndroid.id, brandId: xiaomi.id, isFeatured: false,
      tags: [tagNew, tag5G, tagBestSeller],
      images: [{ url: img('Mi 15', 'E74C3C'), publicId: 'mobivexa/mi15-1', isCover: true, sortOrder: 0 }],
      variants: [
        { sku: 'MI15-XANH-256', color: 'Xanh Ngọc', storage: '256GB', ram: '12GB', originalPrice: 18990000, salePrice: 16990000, stock: 20 },
        { sku: 'MI15-DEN-512',  color: 'Đen',       storage: '512GB', ram: '16GB', originalPrice: 22990000, salePrice: 20990000, stock: 12 },
      ],
    },
    {
      name: 'Xiaomi Redmi Note 14 Pro+', slug: 'xiaomi-redmi-note-14-pro-plus',
      description: 'Redmi Note 14 Pro+ với camera 200MP, pin 6000mAh, sạc nhanh 90W, chip Dimensity 9300+.',
      categoryId: catAndroid.id, brandId: xiaomi.id, isFeatured: false,
      tags: [tagBestSeller, tagBigBattery, tag5G],
      images: [{ url: img('Note 14 Pro+', 'C0392B'), publicId: 'mobivexa/rn14pp-1', isCover: true, sortOrder: 0 }],
      variants: [
        { sku: 'RN14PP-DEN-256', color: 'Đen Huyền Bí',  storage: '256GB', ram: '12GB', originalPrice:  9990000, salePrice:  8490000, stock: 30 },
        { sku: 'RN14PP-TIM-256', color: 'Tím Mộng Mơ',   storage: '256GB', ram: '16GB', originalPrice: 11490000, salePrice:  9990000, stock: 25 },
      ],
    },

    // ── OPPO ──────────────────────────────────────────────────────────────────
    {
      name: 'OPPO Find X8 Pro', slug: 'oppo-find-x8-pro',
      description: 'Find X8 Pro với camera Hasselblad 50MP, chip Dimensity 9400, màn hình AMOLED cong 120Hz.',
      categoryId: catAndroid.id, brandId: oppo.id, isFeatured: true,
      tags: [tagHot, tagFlagship, tag5G, tagNew],
      images: [{ url: img('Find X8 Pro', '1D8348'), publicId: 'mobivexa/fx8p-1', isCover: true, sortOrder: 0 }],
      variants: [
        { sku: 'FX8P-DEN-256',  color: 'Đen',   storage: '256GB', ram: '12GB', originalPrice: 26990000, salePrice: 24990000, stock: 10 },
        { sku: 'FX8P-TRAN-512', color: 'Trắng', storage: '512GB', ram: '16GB', originalPrice: 31990000, salePrice: 29990000, stock:  6 },
      ],
    },
    {
      name: 'OPPO Reno 13 Pro', slug: 'oppo-reno-13-pro',
      description: 'Reno 13 Pro với camera AI 50MP, màn hình AMOLED cong 6.8 inch, pin 5600mAh sạc 80W.',
      categoryId: catAndroid.id, brandId: oppo.id, isFeatured: false,
      tags: [tagNew, tagBigBattery],
      images: [{ url: img('Reno 13 Pro', '27AE60'), publicId: 'mobivexa/r13p-1', isCover: true, sortOrder: 0 }],
      variants: [
        { sku: 'R13P-XANH-256', color: 'Xanh Ngọc Bích', storage: '256GB', ram: '12GB', originalPrice: 16490000, salePrice: 14990000, stock: 20 },
        { sku: 'R13P-HONG-256', color: 'Hồng Phấn',      storage: '256GB', ram: '12GB', originalPrice: 16490000, salePrice: 14990000, stock: 15 },
      ],
    },
    {
      name: 'OPPO A3 Pro', slug: 'oppo-a3-pro',
      description: 'OPPO A3 Pro với thiết kế chống nước IP65, pin 5100mAh bền bỉ, camera AI 50MP.',
      categoryId: catAndroid.id, brandId: oppo.id, isFeatured: false,
      tags: [tagBestSeller, tagBigBattery],
      images: [{ url: img('A3 Pro', '229954'), publicId: 'mobivexa/a3p-1', isCover: true, sortOrder: 0 }],
      variants: [
        { sku: 'A3P-XANH-128', color: 'Xanh Biển', storage: '128GB', ram: '8GB', originalPrice: 7990000, salePrice: 6990000, stock: 45 },
        { sku: 'A3P-TIM-128',  color: 'Tím',       storage: '128GB', ram: '8GB', originalPrice: 7990000, salePrice: 6990000, stock: 40 },
      ],
    },

    // ── Vivo ──────────────────────────────────────────────────────────────────
    {
      name: 'Vivo X200 Pro', slug: 'vivo-x200-pro',
      description: 'Vivo X200 Pro với camera ZEISS 50mm, chip Dimensity 9400, màn 6.78 inch LTPO AMOLED.',
      categoryId: catAndroid.id, brandId: vivo.id, isFeatured: true,
      tags: [tagHot, tagFlagship, tag5G, tagNew],
      images: [{ url: img('X200 Pro', '415A77'), publicId: 'mobivexa/x200p-1', isCover: true, sortOrder: 0 }],
      variants: [
        { sku: 'X200P-DEN-256',  color: 'Đen Vũ Trụ',            storage: '256GB', ram: '16GB', originalPrice: 23990000, salePrice: 21990000, stock: 12 },
        { sku: 'X200P-XANH-512', color: 'Xanh Địa Trung Hải',    storage: '512GB', ram: '16GB', originalPrice: 27990000, salePrice: 25990000, stock:  8 },
      ],
    },
    {
      name: 'Vivo V40', slug: 'vivo-v40',
      description: 'Vivo V40 với camera ZEISS 50MP, thiết kế thời thượng mỏng nhẹ, chip Snapdragon 7 Gen 3.',
      categoryId: catAndroid.id, brandId: vivo.id, isFeatured: false,
      tags: [tagNew, tagBestSeller],
      images: [{ url: img('V40', '5D6D7E'), publicId: 'mobivexa/v40-1', isCover: true, sortOrder: 0 }],
      variants: [
        { sku: 'V40-HONG-256', color: 'Hồng Sương Sớm', storage: '256GB', ram: '12GB', originalPrice: 13490000, salePrice: 11990000, stock: 25 },
        { sku: 'V40-DEN-256',  color: 'Đen Huyền',      storage: '256GB', ram: '12GB', originalPrice: 13490000, salePrice: 11990000, stock: 20 },
      ],
    },

    // ── OnePlus ───────────────────────────────────────────────────────────────
    {
      name: 'OnePlus 13', slug: 'oneplus-13',
      description: 'OnePlus 13 với camera Hasselblad, chip Snapdragon 8 Elite, sạc SUPERVOOC 100W cực nhanh.',
      categoryId: catAndroid.id, brandId: oneplus.id, isFeatured: true,
      tags: [tagHot, tagFlagship, tag5G, tagNew],
      images: [{ url: img('OnePlus 13', 'EB0028'), publicId: 'mobivexa/op13-1', isCover: true, sortOrder: 0 }],
      variants: [
        { sku: 'OP13-XANH-256', color: 'Xanh Băng Giá',  storage: '256GB', ram: '12GB', originalPrice: 19990000, salePrice: 17990000, stock: 18 },
        { sku: 'OP13-DEN-512',  color: 'Đen Bóng Đêm',   storage: '512GB', ram: '16GB', originalPrice: 24990000, salePrice: 22490000, stock: 10 },
      ],
    },
    {
      name: 'OnePlus Nord 4', slug: 'oneplus-nord-4',
      description: 'OnePlus Nord 4 với thiết kế unibody kim loại, chip Snapdragon 7+ Gen 3, sạc nhanh 100W.',
      categoryId: catAndroid.id, brandId: oneplus.id, isFeatured: false,
      tags: [tagNew, tagBestSeller, tag5G],
      images: [{ url: img('Nord 4', 'C0392B'), publicId: 'mobivexa/nord4-1', isCover: true, sortOrder: 0 }],
      variants: [
        { sku: 'NORD4-DEN-256', color: 'Obsidian Midnight', storage: '256GB', ram: '12GB', originalPrice: 12490000, salePrice: 10990000, stock: 30 },
        { sku: 'NORD4-SIL-128', color: 'Mercurial Silver',  storage: '128GB', ram:  '8GB', originalPrice:  9990000, salePrice:  8990000, stock: 25 },
      ],
    },
  ]

  process.stdout.write('  📱  Tạo sản phẩm... ')
  const createdProducts = []
  for (const p of products) {
    const created = await prisma.product.create({
      data: {
        name: p.name, slug: p.slug, description: p.description,
        categoryId: p.categoryId, brandId: p.brandId,
        isFeatured: p.isFeatured, isActive: true,
        images:      { create: p.images },
        variants:    { create: p.variants.map(v => ({ ...v, isActive: true })) },
        productTags: { create: p.tags.map(t => ({ tagId: t.id })) },
      },
      include: { variants: true },
    })
    createdProducts.push(created)
  }
  console.log(`✓  (${createdProducts.length} sản phẩm)`)

  // ── Users ──────────────────────────────────────────────────────────────────
  process.stdout.write('  👤  Tạo người dùng... ')
  await prisma.user.create({ data: { email: 'admin@mobivexa.com', fullName: 'Admin Mobivexa',      passwordHash, role: 'ADMIN',    isActive: true, emailVerified: true } })
  await prisma.user.create({ data: { email: 'staff@mobivexa.com', fullName: 'Nhân Viên Mobivexa',  passwordHash, role: 'STAFF',    isActive: true, emailVerified: true, phone: '0901234567' } })
  const customers = await Promise.all([
    prisma.user.create({ data: { email: 'nguyen.van.an@gmail.com',  fullName: 'Nguyễn Văn An',  passwordHash, phone: '0912345678', role: 'CUSTOMER', isActive: true, emailVerified: true  } }),
    prisma.user.create({ data: { email: 'tran.thi.binh@gmail.com',  fullName: 'Trần Thị Bình',  passwordHash, phone: '0923456789', role: 'CUSTOMER', isActive: true, emailVerified: true  } }),
    prisma.user.create({ data: { email: 'le.minh.cuong@gmail.com',  fullName: 'Lê Minh Cường',  passwordHash, phone: '0934567890', role: 'CUSTOMER', isActive: true, emailVerified: true  } }),
    prisma.user.create({ data: { email: 'pham.thi.dao@gmail.com',   fullName: 'Phạm Thị Đào',   passwordHash, phone: '0945678901', role: 'CUSTOMER', isActive: true, emailVerified: false } }),
    prisma.user.create({ data: { email: 'hoang.van.em@gmail.com',   fullName: 'Hoàng Văn Em',   passwordHash, phone: '0956789012', role: 'CUSTOMER', isActive: true, emailVerified: true  } }),
  ])
  console.log(`✓  (2 staff + ${customers.length} khách hàng)`)

  // ── Addresses ──────────────────────────────────────────────────────────────
  process.stdout.write('  🏠  Tạo địa chỉ... ')
  const provinces  = ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ']
  const districts  = ['Đống Đa', 'Quận 1', 'Hải Châu', 'Lê Chân', 'Ninh Kiều']
  const wards      = ['Phương Liên', 'Bến Nghé', 'Hải Châu I', 'An Biên', 'Tân An']
  for (const [i, c] of customers.entries()) {
    await prisma.address.createMany({
      data: [
        { userId: c.id, fullName: c.fullName, phone: c.phone!, province: provinces[i], district: districts[i], ward: wards[i], streetDetail: `${i + 10} Đường Láng`, isDefault: true  },
        { userId: c.id, fullName: c.fullName, phone: c.phone!, province: 'TP. Hồ Chí Minh', district: 'Quận 3', ward: 'Võ Thị Sáu', streetDetail: `${i + 20} Nguyễn Thị Minh Khai`, isDefault: false },
      ],
    })
  }
  console.log('✓')

  // ── Carts ──────────────────────────────────────────────────────────────────
  process.stdout.write('  🛒  Tạo giỏ hàng... ')
  const cartVariants = [
    createdProducts[3].variants[0],   // iPhone 16 - Đen 128GB
    createdProducts[7].variants[0],   // Galaxy S25 - Xanh 128GB
    createdProducts[12].variants[0],  // Redmi Note 14 Pro+ - Đen 256GB
    createdProducts[0].variants[0],   // iPhone 16 Pro Max - Đen Titanium
    createdProducts[5].variants[0],   // Galaxy S25 Ultra - Titan Đen
  ]
  for (const [i, c] of customers.entries()) {
    await prisma.cart.create({
      data: {
        userId: c.id,
        items: { create: [{ variantId: cartVariants[i].id, quantity: 1 }] },
      },
    })
  }
  console.log('✓')

  // ── Orders ─────────────────────────────────────────────────────────────────
  process.stdout.write('  📦  Tạo đơn hàng... ')

  type OrderDef = {
    userIdx: number
    variantRef: { id: string; salePrice: { toString(): string }; sku: string; color: string | null; storage: string | null; ram: string | null }
    productName: string
    quantity: number
    status: OrderStatus
    paymentMethod: PaymentMethod
    paymentStatus: PaymentStatus
    cancelReason?: string
  }

  const orderDefs: OrderDef[] = [
    { userIdx: 0, variantRef: createdProducts[0].variants[0], productName: createdProducts[0].name,  quantity: 1, status: OrderStatus.DELIVERED,  paymentMethod: PaymentMethod.COD,           paymentStatus: PaymentStatus.PAID   },
    { userIdx: 0, variantRef: createdProducts[5].variants[0], productName: createdProducts[5].name,  quantity: 1, status: OrderStatus.DELIVERED,  paymentMethod: PaymentMethod.BANK_TRANSFER, paymentStatus: PaymentStatus.PAID   },
    { userIdx: 1, variantRef: createdProducts[6].variants[0], productName: createdProducts[6].name,  quantity: 1, status: OrderStatus.SHIPPING,   paymentMethod: PaymentMethod.COD,           paymentStatus: PaymentStatus.UNPAID },
    { userIdx: 1, variantRef: createdProducts[3].variants[0], productName: createdProducts[3].name,  quantity: 2, status: OrderStatus.DELIVERED,  paymentMethod: PaymentMethod.BANK_TRANSFER, paymentStatus: PaymentStatus.PAID   },
    { userIdx: 2, variantRef: createdProducts[10].variants[0], productName: createdProducts[10].name, quantity: 1, status: OrderStatus.PENDING,    paymentMethod: PaymentMethod.COD,           paymentStatus: PaymentStatus.UNPAID },
    { userIdx: 3, variantRef: createdProducts[13].variants[0], productName: createdProducts[13].name, quantity: 1, status: OrderStatus.CANCELLED,  paymentMethod: PaymentMethod.COD,           paymentStatus: PaymentStatus.UNPAID, cancelReason: 'Đặt nhầm sản phẩm' },
    { userIdx: 4, variantRef: createdProducts[18].variants[0], productName: createdProducts[18].name, quantity: 1, status: OrderStatus.DELIVERED,  paymentMethod: PaymentMethod.BANK_TRANSFER, paymentStatus: PaymentStatus.PAID   },
    { userIdx: 4, variantRef: createdProducts[7].variants[0],  productName: createdProducts[7].name,  quantity: 1, status: OrderStatus.CONFIRMED,  paymentMethod: PaymentMethod.COD,           paymentStatus: PaymentStatus.UNPAID },
  ]

  const createdOrders = []
  for (const [idx, od] of orderDefs.entries()) {
    const customer   = customers[od.userIdx]
    const unitPrice  = Number(od.variantRef.salePrice.toString())
    const subtotal   = unitPrice * od.quantity
    const shippingFee = subtotal >= 20_000_000 ? 0 : 30_000
    const total      = subtotal + shippingFee

    const order = await prisma.order.create({
      data: {
        orderCode:       makeOrderCode(),
        userId:          customer.id,
        shippingName:    customer.fullName,
        shippingPhone:   customer.phone!,
        shippingProvince: provinces[od.userIdx],
        shippingDistrict: districts[od.userIdx],
        shippingWard:    wards[od.userIdx],
        shippingDetail:  `${idx + 1} Lê Lợi`,
        subtotal, shippingFee, discount: 0, total,
        status:        od.status,
        paymentMethod: od.paymentMethod,
        paymentStatus: od.paymentStatus,
        cancelReason:  od.cancelReason ?? null,
        paidAt:        od.paymentStatus === PaymentStatus.PAID ? new Date() : null,
        items: {
          create: [{
            variantId:   od.variantRef.id,
            productName: od.productName,
            sku:         od.variantRef.sku,
            color:       od.variantRef.color   ?? '',
            storage:     od.variantRef.storage  ?? '',
            ram:         od.variantRef.ram      ?? '',
            unitPrice, quantity: od.quantity,
            subtotal:    unitPrice * od.quantity,
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
  const deliveredOrders = createdOrders.filter(o => o.status === OrderStatus.DELIVERED)
  for (let i = 0; i < Math.min(deliveredOrders.length, reviewTexts.length); i++) {
    const order     = deliveredOrders[i]
    const orderItem = order.items[0]
    const variant   = await prisma.productVariant.findUnique({ where: { id: orderItem.variantId! }, select: { productId: true } })
    if (!variant) continue
    await prisma.review.create({
      data: {
        orderItemId: orderItem.id,
        userId:      order.userId,
        productId:   variant.productId,
        variantId:   orderItem.variantId,
        rating:      reviewTexts[i].rating,
        content:     reviewTexts[i].content,
        status:      ReviewStatus.APPROVED,
      },
    })
  }
  console.log(`✓  (${Math.min(deliveredOrders.length, reviewTexts.length)} đánh giá)`)

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n  ✅  Seed hoàn thành!\n')
  console.log('  ┌─────────────────────────────────────────────┐')
  console.log('  │              Tổng kết dữ liệu               │')
  console.log('  ├─────────────────────────────────────────────┤')
  console.log(`  │  Thương hiệu   : 6                          │`)
  console.log(`  │  Danh mục      : 6  (2 cha + 4 con)         │`)
  console.log(`  │  Tags          : 8                          │`)
  console.log(`  │  Sản phẩm      : ${createdProducts.length}  (${createdProducts.reduce((s, p) => s + p.variants.length, 0)} variants)         │`)
  console.log(`  │  Người dùng    : 7  (1 admin, 1 staff, 5)   │`)
  console.log(`  │  Đơn hàng      : ${createdOrders.length}                          │`)
  console.log(`  │  Đánh giá      : ${Math.min(deliveredOrders.length, reviewTexts.length)}                          │`)
  console.log('  ├─────────────────────────────────────────────┤')
  console.log('  │  Tài khoản (Password123!)                   │')
  console.log('  │  admin@mobivexa.com         → ADMIN         │')
  console.log('  │  staff@mobivexa.com         → STAFF         │')
  console.log('  │  nguyen.van.an@gmail.com    → CUSTOMER       │')
  console.log('  └─────────────────────────────────────────────┘\n')
}

main()
  .catch(e => { console.error('❌  Seed thất bại:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
