import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { readdirSync, readFileSync, statSync, existsSync } from 'fs'
import { join } from 'path'
import { PrismaClient } from '../src/generated/prisma/client'
import { CouponType, UserRole } from '../src/generated/prisma/enums'
import bcrypt from 'bcrypt'
import { slugify } from '../src/utils/slug'

// ─── DB client (giống src/config/db.ts) ──────────────────────────────────────
const sslConfig =
  process.env.NODE_ENV === 'production'
    ? true
    : process.env.DB_SSL_NO_VERIFY === 'true'
      ? { rejectUnauthorized: false }
      : true

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: sslConfig })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

// ─── Thiết kế chung ───────────────────────────────────────────────────────────
//
// Seed này TÁI LẬP dữ liệu demo của Mobivexa và được chạy NHIỀU LẦN trên cả DB
// trắng lẫn DB demo đang có khách dùng, nên khác seed cũ ở ba điểm sống còn:
//
// 1. KHÔNG deleteMany — dữ liệu thật (đơn hàng, đánh giá, ảnh Cloudinary đã
//    upload...) không bao giờ bị xoá. Mọi bảng chỉ upsert theo khoá duy nhất
//    của nó: user theo email, brand/category/tag theo slug, product theo slug,
//    variant theo sku, coupon theo code.
// 2. 199 sản phẩm Cellphones đọc từ JSON crawler (data/cellphones/raw/*.json —
//    đúng nguồn đã import vào DB demo ngày 25/09). Ảnh chỉ tạo khi sản phẩm
//    chưa có: DB demo dùng ảnh Cloudinary đã upload, chạy lại seed phải giữ
//    nguyên thay vì thay bằng URL CDN nguồn.
// 3. Coupon ghi NGÀY ĐỘNG theo thời điểm chạy (bài học time-bomb 01/10: ghi
//    cứng endsAt thì demo tự chết khi lịch trôi). Cuối seed quét mã đã hết hạn
//    và tắt isActive để dashboard không còn mã chết treo trên "đang chạy".

const DAY_MS = 24 * 60 * 60 * 1000

// ─── Dữ liệu crawl: dạng file đơn của crawler cellphones ─────────────────────
type CellphoneSpec = { label: string; value: string }

type CellphoneRaw = {
  name: string
  sku: string
  price: number
  originalPrice?: number
  brand?: string
  description?: string
  images?: string[] | { url?: string; local?: string }[]
  specs?: CellphoneSpec[] | Record<string, string>
  sourceUrl?: string
  crawledAt?: string
}

type SeedProduct = {
  sku: string
  name: string
  slugBase: string
  price: number
  description: string | null
  images: string[]
  specs: CellphoneSpec[]
}

// Trang brand/series của cellphones lẫn phụ kiện, máy tính bảng, đồ gia dụng —
// backend chỉ bán điện thoại. Copy nguyên bộ lọc của crawler (data/cellphones/
// crawl.mjs) để seed chắt được đúng 199 sản phẩm đã import, không rò thêm
// món lẻ kiểu apple-airpods-5 còn sót trong thư mục raw.
const SKIP_PATTERN =
  /airpods|tai nghe|sạc dự phòng|ốp lưng|bao da|củ sạc|cáp sạc|ipad|macbook|laptop|tablet|máy tính bảng|watch|đồng hồ|buds|smart ?band|mi band|airtag|apple pencil|tivi|tủ lạnh|tủ đông|máy giặt|máy lạnh|điều hòa|lò vi sóng|nồi chiên|máy hút bụi|smart ?speaker|loa/i

// Khớp sản phẩm về brand DB — copy từ crawler. Tên brand PHẢI khớp brand có
// sẵn trong DB (seed không tự đẻ brand lạ): brand "iphone" trong DB ứng với
// Apple trên trang nguồn, "techno" ứng với Tecno.
const BRAND_MATCHERS: { db: string; re: RegExp; name: RegExp }[] = [
  { db: 'iphone', re: /^(apple|iphone)$/i, name: /iphone/i },
  { db: 'samsung', re: /^samsung$/i, name: /samsung|galaxy/i },
  { db: 'xiaomi', re: /^(xiaomi|poco|redmi)$/i, name: /xiaomi|poco|redmi/i },
  { db: 'oppo', re: /^oppo$/i, name: /oppo/i },
  { db: 'honor', re: /^honor$/i, name: /honor/i },
  { db: 'huawei', re: /^huawei$/i, name: /huawei/i },
  { db: 'realme', re: /^realme$/i, name: /realme/i },
  { db: 'techno', re: /^(tecno|techno)$/i, name: /tecno|techno|pova|camon/i },
  { db: 'meizu', re: /^meizu$/i, name: /meizu/i },
]

// Nhận tối thiểu name + brand (tuỳ chọn) — gọi được với cả bản raw lẫn bản
// đã chuẩn hoá (SeedProduct) mà không vướng kiểu null/undefined
function matchDbBrand(p: { name: string; brand?: string }): string | null {
  for (const m of BRAND_MATCHERS) {
    if (m.re.test(p.brand ?? '') || m.name.test(p.name ?? '')) return m.db
  }
  return null
}

// Chuẩn hoá một bản ghi crawl về dạng seed dùng được: specs về mảng (file
// products.json cũ dùng object), images về mảng URL trần.
function normalizeRaw(p: CellphoneRaw): SeedProduct | null {
  if (!p.name || !p.sku) return null

  // Giá bán = giá cuối crawler công bố. Crawler chỉ lưu khi price > 0, nhưng
  // giữ phòng thủ: price 0 thì đổ về originalPrice nếu có (đúng tinh thần
  // backfill 28/09: salePrice không bao giờ được để 0), vẫn 0 thì bỏ.
  const price = Number(p.price) > 0 ? Number(p.price) : Number(p.originalPrice ?? 0)
  if (!(price > 0)) return null

  const specs: CellphoneSpec[] = Array.isArray(p.specs)
    ? p.specs.filter((s) => typeof s?.label === 'string' && typeof s?.value === 'string')
    : Object.entries(p.specs ?? {}).map(([label, value]) => ({ label, value: String(value) }))

  const images = (Array.isArray(p.images) ? p.images : [])
    .map((im) => (typeof im === 'string' ? im : im?.url ?? ''))
    .filter((u): u is string => Boolean(u))

  return {
    sku: p.sku,
    name: p.name,
    slugBase: slugify(p.name) || slugify(p.sku) || 'san-pham',
    price,
    description: p.description?.trim() || null,
    images,
    specs,
  }
}

// Nguồn dữ liệu: thư mục raw của crawler (mặc định) hoặc file chỉ định qua
// SEED_PRODUCTS_FILE (thư mục, mảng, { products: [...] } hay 1 object đều nhận).
function resolveDataSource(): string {
  const override = process.env.SEED_PRODUCTS_FILE?.trim()
  const candidates = override
    ? [override]
    : [
        // Bố cục hiện tại: data/ nằm ngang be_mobivexa trong repo
        join(process.cwd(), '..', 'data', 'cellphones', 'raw'),
        join(__dirname, '..', '..', 'data', 'cellphones', 'raw'),
        // Dự phòng khi data/ được коп vào trong backend
        join(process.cwd(), 'data', 'cellphones', 'raw'),
      ]
  const found = candidates.find((c) => existsSync(c))
  if (!found) {
    console.error('❌  Không tìm thấy dữ liệu crawl (data/cellphones/raw).')
    console.error('    Chạy crawler trước:  cd ../data/cellphones && node crawl.mjs')
    console.error('    Hoặc trỏ SEED_PRODUCTS_FILE đến file/thư mục JSON sản phẩm.')
    process.exit(1)
  }
  return found
}

function loadCrawlProducts(): { products: SeedProduct[]; skipped: string[] } {
  const source = resolveDataSource()
  console.log(`🌱  Seed Mobivexa — tái lập dữ liệu demo (idempotent)`)
  console.log(`    Nguồn sản phẩm: ${source}`)

  let raws: CellphoneRaw[] = []
  if (statSync(source).isDirectory()) {
    // Bỏ file ẩn (.skipped-categories.json) và import-failures.json (sổ lỗi
    // của crawler, không phải sản phẩm). Sắp theo tên file để mỗi lần chạy
    // đọc cùng một thứ tự — thứ tự quyết định brandIdx nên phải cố định.
    const files = readdirSync(source)
      .filter((f) => f.endsWith('.json') && !f.startsWith('.') && f !== 'import-failures.json')
      .sort()
    for (const f of files) {
      try {
        const parsed = JSON.parse(readFileSync(join(source, f), 'utf8')) as CellphoneRaw
        if (parsed?.name && parsed?.sku) raws.push(parsed)
      } catch {
        console.warn(`  ⚠  Bỏ qua file hỏng: ${f}`)
      }
    }
  } else {
    const parsed = JSON.parse(readFileSync(source, 'utf8'))
    if (Array.isArray(parsed)) raws = parsed
    else if (Array.isArray(parsed?.products)) raws = parsed.products
    else raws = [parsed]
  }

  const skipped: string[] = []
  const products: SeedProduct[] = []
  for (const raw of raws) {
    // Lọc phụ kiện/máy tính bảng như crawler — airpods sót trong raw không
    // được lọt vào DB (demo bán điện thoại)
    if (SKIP_PATTERN.test(raw.name ?? '')) {
      skipped.push(raw.sku ?? raw.name)
      continue
    }
    const p = normalizeRaw(raw)
    if (!p) {
      skipped.push(raw.sku ?? raw.name ?? '(không tên)')
      continue
    }
    products.push(p)
  }

  console.log(`    Đọc được ${products.length} sản phẩm hợp lệ, bỏ ${skipped.length} mục lọc ra`)
  for (const s of skipped) console.log(`      - bỏ: ${s}`)
  return { products, skipped }
}

// ─── Taxonomy chuẩn của demo ──────────────────────────────────────────────────
//
// Đúng bộ danh mục/thương hiệu DB demo đang dùng — KHÔNG dùng bộ của seed cũ
// (gaming, pin trâu, brand "apple"...) vì DB thật có brand slug là "iphone"
// và không có brand "apple". Logo trỏ thẳng CDN Cloudinary của dự án để DB
// trắng cũng có logo y như demo.

const BRAND_SEED = [
  { slug: 'realme', logoUrl: 'https://res.cloudinary.com/duxck3juv/image/upload/v1787373377/brands/rmwvj9xkfl7fgox6mztr.webp' },
  { slug: 'iphone', logoUrl: 'https://res.cloudinary.com/duxck3juv/image/upload/v1787373395/brands/yvjskzluzv6yg0eypsba.png' },
  { slug: 'xiaomi', logoUrl: 'https://res.cloudinary.com/duxck3juv/image/upload/v1787373406/brands/wwxert27q3uywldgcbom.png' },
  { slug: 'meizu', logoUrl: 'https://res.cloudinary.com/duxck3juv/image/upload/v1787373419/brands/zukhe0yebguppv8egpcz.webp' },
  { slug: 'honor', logoUrl: 'https://res.cloudinary.com/duxck3juv/image/upload/v1787373442/brands/lv5cmmcwliwzfaobolmm.webp' },
  { slug: 'huawei', logoUrl: 'https://res.cloudinary.com/duxck3juv/image/upload/v1787373455/brands/qltwan1ica1d6n1uvb6x.png' },
  { slug: 'techno', logoUrl: 'https://res.cloudinary.com/duxck3juv/image/upload/v1787373466/brands/q77kdsvzqasyuq9aagoy.webp' },
  { slug: 'oppo', logoUrl: 'https://res.cloudinary.com/duxck3juv/image/upload/v1787373514/brands/bsvnlbfgxqyxan9ealej.webp' },
  { slug: 'samsung', logoUrl: 'https://res.cloudinary.com/duxck3juv/image/upload/v1787373549/brands/pkyvbn41v0ama9ijvw4g.png' },
]

const PARENT_CATEGORY_SEED = [
  { name: 'Điện thoại', slug: 'dien-thoai', description: 'Tất cả các dòng điện thoại di động chính hãng' },
  { name: 'Phụ kiện', slug: 'phu-kien', description: 'Phụ kiện điện thoại chính hãng' },
  { name: 'Hàng cũ', slug: 'hang-cu', description: 'Điện thoại cũ đã qua sử dụng, kiểm định đầy đủ' },
]

const CHILD_CATEGORY_SEED = [
  { name: 'iphone', slug: 'iphone', parentSlug: 'dien-thoai' },
  { name: 'android', slug: 'android', parentSlug: 'dien-thoai' },
]

// Bộ tag chuẩn cho lưới lọc trang sản phẩm. Tag lạ có sẵn trong DB (vd
// "giam-50") không bị đụng tới — chỉ thêm, không xoá.
const TAG_SEED = [
  { name: 'Hot', slug: 'hot' },
  { name: 'Mới nhất', slug: 'moi-nhat' },
  { name: 'Giảm giá', slug: 'giam-gia' },
  { name: 'Flagship', slug: 'flagship' },
  { name: 'Bán chạy', slug: 'ban-chay' },
  { name: 'Gaming', slug: 'gaming' },
  { name: '5G', slug: '5g' },
  { name: 'Pin trâu', slug: 'pin-trau' },
]

// ─── Users mẫu ────────────────────────────────────────────────────────────────
//
// Đúng bộ tài khoản demo DB đang dùng (admin1 / user6 / user1-5). Đã tồn tại
// thì KHÔNG đụng gì cả — password hash thật của demo phải giữ nguyên, seed
// chỉ đặt Password123! khi tạo mới trên DB trắng.
const USER_SEED = [
  { email: 'admin1@admin.com', fullName: 'admin1', role: UserRole.ADMIN },
  { email: 'user6@gmail.com', fullName: 'user6', role: UserRole.STAFF },
  { email: 'user1@gmail.com', fullName: 'user1', role: UserRole.CUSTOMER },
  { email: 'user2@gmail.com', fullName: 'user2', role: UserRole.CUSTOMER },
  { email: 'user3@gmail.com', fullName: 'user3', role: UserRole.CUSTOMER },
  { email: 'user4@gmail.com', fullName: 'user4', role: UserRole.CUSTOMER },
  { email: 'user5@gmail.com', fullName: 'user5', role: UserRole.CUSTOMER },
]

// ─── Coupon demo ──────────────────────────────────────────────────────────────
//
// Ngày luôn tính theo thời điểm chạy seed: startsAt lùi 7 ngày (đã mở),
// endsAt đẩy tới 30/45/60 ngày. usedCount KHÔNG nằm trong update — lượt dùng
// thật của demo phải giữ nguyên sau mỗi lần seed.
const COUPON_SEED = [
  {
    code: 'CHAOBAN10',
    description: 'Giảm 10% cho khách mới, tối đa 300k',
    type: CouponType.PERCENT,
    value: 10,
    maxDiscount: 300_000,
    minOrderValue: 0,
    usageLimit: null as number | null,
    days: 30,
  },
  {
    code: 'SALE15',
    description: 'Giảm 15% cho đơn từ 5 triệu, tối đa 1 triệu',
    type: CouponType.PERCENT,
    value: 15,
    maxDiscount: 1_000_000,
    minOrderValue: 5_000_000,
    usageLimit: 100,
    days: 45,
  },
  {
    code: 'GIAM200K',
    description: 'Giảm thẳng 200k cho đơn từ 3 triệu',
    type: CouponType.FIXED,
    value: 200_000,
    maxDiscount: null,
    minOrderValue: 3_000_000,
    usageLimit: 50,
    days: 60,
  },
]

// ─── Tags suy ra cho sản phẩm (giống tinh thần seed cũ) ───────────────────────
function computeTags(p: SeedProduct, price: number, brandIdx: number, hasDiscount: boolean): string[] {
  const t = new Set<string>()
  const specsText = p.specs.map((s) => `${s.label} ${s.value}`).join(' ').toLowerCase()
  if (brandIdx === 0) t.add('hot')
  if (price >= 15_000_000) t.add('flagship')
  if (/5g/.test(specsText) || /5g/i.test(p.name)) t.add('5g')
  if (/gaming|pova|rog/i.test(p.name)) t.add('gaming')
  if (hasDiscount) t.add('giam-gia')
  if (brandIdx <= 1) t.add('moi-nhat')
  if (brandIdx >= 2) t.add('ban-chay')
  return [...t]
}

// Sinh slug trống kế tiếp theo đúng luật generateUniqueSlug của backend
// (root, root-1, root-2...) nhưng tra trong bộ nhớ — chạy seed nhiều lần trên
// DB trắng vẫn ra cùng một slug cho cùng một sản phẩm.
function pickFreeSlug(root: string, taken: Set<string>): string {
  let slug = root
  let counter = 1
  while (taken.has(slug)) slug = `${root}-${counter++}`
  taken.add(slug)
  return slug
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const { products } = loadCrawlProducts()

  // ── Danh mục (cha trước — con cần parentId) ───────────────────────────────
  process.stdout.write('  📂  Danh mục... ')
  const categoryBySlug = new Map<string, { id: string; slug: string }>()
  for (const c of PARENT_CATEGORY_SEED) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      create: { name: c.name, slug: c.slug, description: c.description },
      update: {},
    })
    categoryBySlug.set(c.slug, row)
  }
  for (const c of CHILD_CATEGORY_SEED) {
    const parent = categoryBySlug.get(c.parentSlug)
    if (!parent) continue
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      create: { name: c.name, slug: c.slug, parentId: parent.id },
      update: {},
    })
    categoryBySlug.set(c.slug, row)
  }
  console.log(`✓  (${categoryBySlug.size} danh mục)`)

  // ── Thương hiệu ─────────────────────────────────────────────────────────────
  process.stdout.write('  📦  Thương hiệu... ')
  const brandBySlug = new Map<string, { id: string; slug: string }>()
  for (const b of BRAND_SEED) {
    const row = await prisma.brand.upsert({
      where: { slug: b.slug },
      // name duy nhất và demo đặt name === slug — tạo mới theo đúng quy ước đó
      create: { name: b.slug, slug: b.slug, logoUrl: b.logoUrl, description: `Điện thoại chính hãng ${b.slug}` },
      update: {},
    })
    brandBySlug.set(b.slug, row)
  }
  console.log(`✓  (${brandBySlug.size} brands)`)

  // ── Tags ────────────────────────────────────────────────────────────────────
  process.stdout.write('  🏷   Tags... ')
  const tagBySlug = new Map<string, { id: string; slug: string }>()
  for (const t of TAG_SEED) {
    const row = await prisma.tag.upsert({ where: { slug: t.slug }, create: t, update: {} })
    tagBySlug.set(t.slug, row)
  }
  console.log(`✓  (${tagBySlug.size} tags chuẩn)`)

  // ── Users mẫu (đã tồn tại thì giữ nguyên tuyệt đối) ────────────────────────
  process.stdout.write('  👤  Người dùng mẫu... ')
  const passwordHash = await bcrypt.hash('Password123!', 10)
  for (const u of USER_SEED) {
    await prisma.user.upsert({
      where: { email: u.email },
      create: { ...u, passwordHash, isActive: true, emailVerified: true },
      // Không đụng gì vào user đã có: đổi hash/fullName ở đây là đổi mật khẩu
      // đăng nhập demo của cả nhóm
      update: {},
    })
  }
  console.log(`✓  (${USER_SEED.length} tài khoản mẫu)`)

  // ── Preload: tra slug/sku trong bộ nhớ để không query từng cái ─────────────
  const [productRows, variantRows, imageIds, specIds] = await Promise.all([
    prisma.product.findMany({ select: { id: true, slug: true } }),
    prisma.productVariant.findMany({ select: { sku: true, productId: true } }),
    prisma.productImage.findMany({ select: { productId: true }, distinct: ['productId'] }),
    prisma.productSpec.findMany({ select: { productId: true }, distinct: ['productId'] }),
  ])
  const takenSlugs = new Set(productRows.map((p) => p.slug))
  const productBySlug = new Map(productRows.map((p) => [p.slug, p.id]))
  const variantOwner = new Map(variantRows.map((v) => [v.sku, v.productId]))
  const hasImages = new Set(imageIds.map((r) => r.productId))
  const hasSpecs = new Set(specIds.map((r) => r.productId))

  // ── Sản phẩm + biến thể (upsert, KHÔNG BAO GIỜ delete) ─────────────────────
  // Brand tra theo tên như crawler; danh mục: iPhone → "iphone", còn lại →
  // "Điện thoại" — đúng mapping của lần import 199 máy vào DB demo.
  const brandCounter: Record<string, number> = {}
  let created = 0
  let updated = 0
  let failed = 0
  const BATCH_SIZE = 5 // pg pool mặc định 10 connection — chừa nửa cho chắc

  const writeProduct = async (p: SeedProduct): Promise<void> => {
    const brandSlug = matchDbBrand(p)
    if (!brandSlug) {
      console.warn(`  ⚠  ${p.sku}: không khớp brand nào trong DB, bỏ qua`)
      failed++
      return
    }
    const brand = brandBySlug.get(brandSlug)
    if (!brand) {
      console.warn(`  ⚠  ${p.sku}: brand "${brandSlug}" chưa có trong DB, bỏ qua`)
      failed++
      return
    }

    // iPhone vào danh mục riêng, máy Android về "Điện thoại" (slug DB thật)
    const categorySlug = /iphone/i.test(p.name) ? 'iphone' : 'dien-thoai'
    const category = categoryBySlug.get(categorySlug)
    if (!category) {
      console.warn(`  ⚠  ${p.sku}: thiếu danh mục "${categorySlug}", bỏ qua`)
      failed++
      return
    }

    const brandIdx = brandCounter[brandSlug] ?? 0
    brandCounter[brandSlug] = brandIdx + 1

    // Xác định trước sản phẩm đích: nhận diện qua SKU biến thể — sku crawler
    // là duy nhất và là dấu vết của lần import 25/09, nên slug bị đổi hậu tố
    // (-1 vì trùng sản phẩm cũ) vẫn khớp đúng. Fallback theo slug cho DB
    // trắng dở dang.
    const existingId = variantOwner.get(p.sku) ?? productBySlug.get(p.slugBase)
    let productId: string

    // Ảnh CDN nguồn — chỉ dùng khi sản phẩm CHƯA có ảnh nào. DB demo đang có
    // ảnh Cloudinary upload thật, thay bằng CDN là sụt cấp chất lượng ảnh.
    const cdnImages = p.images.slice(0, 5).map((url, i) => ({
      url,
      publicId: `cellphones/${p.sku}/${i}`,
      isCover: i === 0,
      sortOrder: i,
    }))
    const specRows = p.specs
      // Cùng giới hạn với validator sản phẩm: 60 dòng, label 100, value 500
      .filter((s) => s.label.length <= 100 && s.value.length <= 500)
      .slice(0, 60)
      .map((s, i) => ({ label: s.label.trim(), value: s.value.trim(), sortOrder: i }))

    if (existingId) {
      await prisma.product.update({
        where: { id: existingId },
        // Chỉ đồng bộ phân loại — name/description là chỗ admin có thể đã
        // chỉnh tay, seed không có quyền đè lên
        data: { categoryId: category.id, brandId: brand.id },
      })
      await prisma.productVariant.upsert({
        where: { sku: p.sku },
        create: {
          productId: existingId,
          sku: p.sku,
          originalPrice: p.price,
          salePrice: p.price,
          stock: 50,
          isActive: true,
        },
        // Giá cập nhật theo nguồn; stock/color là số liệu vận hành — không đụng
        update: { originalPrice: p.price, salePrice: p.price },
      })
      if (!hasImages.has(existingId) && cdnImages.length) {
        await prisma.productImage.createMany({ data: cdnImages.map((im) => ({ ...im, productId: existingId })) })
      }
      if (!hasSpecs.has(existingId) && specRows.length) {
        await prisma.productSpec.createMany({ data: specRows.map((s) => ({ ...s, productId: existingId })) })
      }
      updated++
      productId = existingId
    } else {
      const slug = pickFreeSlug(p.slugBase, takenSlugs)
      const createdProduct = await prisma.product.create({
        data: {
          name: p.name,
          slug,
          description: p.description,
          categoryId: category.id,
          brandId: brand.id,
          // Máy đầu tiên của mỗi hãng lên trang chủ — như luật seed cũ
          isFeatured: brandIdx === 0,
          isActive: true,
        },
        select: { id: true },
      })
      await prisma.productVariant.create({
        data: {
          productId: createdProduct.id,
          sku: p.sku,
          originalPrice: p.price,
          salePrice: p.price,
          stock: 50,
          isActive: true,
        },
      })
      if (cdnImages.length) {
        await prisma.productImage.createMany({ data: cdnImages.map((im) => ({ ...im, productId: createdProduct.id })) })
      }
      if (specRows.length) {
        await prisma.productSpec.createMany({ data: specRows.map((s) => ({ ...s, productId: createdProduct.id })) })
      }
      created++
      productId = createdProduct.id
    }

    // Gắn tag theo lô skipDuplicates — chạy lại chỉ thêm cái thiếu, không đếm
    // tăng, không đụng tag lạ có sẵn
    const tagSlugs = computeTags(p, p.price, brandIdx, false)
    const tagRows = tagSlugs
      .map((s) => tagBySlug.get(s))
      .filter((t): t is { id: string; slug: string } => Boolean(t))
      .map((t) => ({ tagId: t.id, productId }))
    if (tagRows.length) {
      await prisma.productTag.createMany({ data: tagRows, skipDuplicates: true })
    }
  }

  process.stdout.write(`  📱  Sản phẩm (${products.length} mục)... `)
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    await Promise.all(products.slice(i, i + BATCH_SIZE).map(writeProduct))
  }
  console.log(`✓  (tạo mới ${created}, cập nhật ${updated}, bỏ qua/lỗi ${failed})`)

  // ── Coupon demo (ngày động) ─────────────────────────────────────────────────
  process.stdout.write('  🎟   Coupon... ')
  const now = Date.now()
  for (const c of COUPON_SEED) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      create: {
        code: c.code,
        description: c.description,
        type: c.type,
        value: c.value,
        maxDiscount: c.maxDiscount,
        minOrderValue: c.minOrderValue,
        usageLimit: c.usageLimit,
        startsAt: new Date(now - 7 * DAY_MS),
        endsAt: new Date(now + c.days * DAY_MS),
        isActive: true,
      },
      // usedCount vắng mặt trong update — lượt dùng thật không bị reset
      update: {
        description: c.description,
        type: c.type,
        value: c.value,
        maxDiscount: c.maxDiscount,
        minOrderValue: c.minOrderValue,
        usageLimit: c.usageLimit,
        startsAt: new Date(now - 7 * DAY_MS),
        endsAt: new Date(now + c.days * DAY_MS),
        isActive: true,
      },
    })
  }
  console.log(`✓  (upsert ${COUPON_SEED.length} mã, hết hạn sau 30–60 ngày kể từ hôm nay)`)

  // ── Dọn mã hết hạn (bài học time-bomb 01/10) ────────────────────────────────
  // Mã nào không được seed gia hạn mà đã qua endsAt thì tắt đi: dashboard hết
  // treo "đang chạy" những mã khách bấm vào là báo lỗi.
  process.stdout.write('  🧹  Tắt coupon hết hạn... ')
  const sweep = await prisma.coupon.updateMany({
    where: { endsAt: { lt: new Date() }, isActive: true },
    data: { isActive: false },
  })
  console.log(`✓  (${sweep.count} mã bị tắt)`)
  const expiringSoon = await prisma.coupon.findMany({
    where: { isActive: true, endsAt: { lt: new Date(now + 7 * DAY_MS) } },
    select: { code: true, endsAt: true },
  })
  for (const c of expiringSoon) {
    console.log(`      ⚠  ${c.code} sắp hết hạn (${c.endsAt.toISOString().slice(0, 10)}) — nhớ chạy lại seed để gia hạn/tắt`)
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const [nUser, nCategory, nBrand, nTag, nProduct, nVariant, nCoupon, nCouponActive] = await Promise.all([
    prisma.user.count(),
    prisma.category.count(),
    prisma.brand.count(),
    prisma.tag.count(),
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.coupon.count(),
    prisma.coupon.count({ where: { isActive: true } }),
  ])
  console.log('\n  ✅  Seed hoàn thành!\n')
  console.log('  ┌────────────────────────────────────────────────┐')
  console.log('  │              Tổng kết dữ liệu                   │')
  console.log('  ├────────────────────────────────────────────────┤')
  console.log(`  │  Người dùng    : ${String(`${nUser} (${USER_SEED.length} mẫu)`).padEnd(30)}│`)
  console.log(`  │  Danh mục      : ${String(nCategory).padEnd(30)}│`)
  console.log(`  │  Thương hiệu   : ${String(nBrand).padEnd(30)}│`)
  console.log(`  │  Tags          : ${String(nTag).padEnd(30)}│`)
  console.log(`  │  Sản phẩm      : ${String(`${nProduct} (tạo ${created})`).padEnd(30)}│`)
  console.log(`  │  Biến thể      : ${String(nVariant).padEnd(30)}│`)
  console.log(`  │  Coupon        : ${String(`${nCoupon} (${nCouponActive} đang chạy)`).padEnd(30)}│`)
  console.log('  ├────────────────────────────────────────────────┤')
  console.log('  │  Tài khoản mẫu (chỉ áp dụng khi tạo mới)        │')
  console.log('  │  admin1@admin.com  → ADMIN    (Password123!)    │')
  console.log('  │  user6@gmail.com   → STAFF    (Password123!)    │')
  console.log('  │  user1@gmail.com   → CUSTOMER (Password123!)    │')
  console.log('  └────────────────────────────────────────────────┘\n')
}

main()
  .catch((e) => { console.error('❌  Seed thất bại:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
