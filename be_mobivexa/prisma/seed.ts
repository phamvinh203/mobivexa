import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { PrismaClient } from '../src/generated/prisma/client'
import { OrderStatus, PaymentMethod, PaymentStatus, ReviewStatus } from '../src/generated/prisma/enums'
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
  // Hai đường đầu là vị trí HIỆN TẠI của file (data/ nằm trong be_mobivexa),
  // tính cả khi chạy từ gốc backend lẫn từ trong prisma/. Hai đường sau giữ lại
  // cho bố cục cũ khi data/ nằm ngang hàng với be_mobivexa.
  const candidates = [
    join(process.cwd(), 'data', 'products.json'),
    join(__dirname, '..', 'data', 'products.json'),
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

// Thứ tự hiển thị thông số kỹ thuật.
//
// File crawl giữ thứ tự của trang nguồn, mà mỗi trang một kiểu — sản phẩm này
// mở đầu bằng "Hệ điều hành", sản phẩm kia bằng "Camera sau". Xếp lại theo một
// danh sách chung để mọi bảng thông số đọc cùng một mạch: cấu hình -> màn hình
// -> camera -> pin -> kết nối.
//
// Khoá lạ (crawl về sau này có thêm) không bị bỏ: xếp xuống cuối, giữ nguyên thứ
// tự vốn có của chúng.
const SPEC_ORDER = [
  'Hệ điều hành',
  'Chipset',
  'Loại CPU',
  'GPU',
  'Dung lượng RAM',
  'Bộ nhớ trong',
  'Kích thước màn hình',
  'Công nghệ màn hình',
  'Độ phân giải màn hình',
  'Tính năng màn hình',
  'Camera sau',
  'Camera trước',
  'Pin',
  'Hỗ trợ mạng',
  'Thẻ SIM',
  'Công nghệ NFC',
  'Cảm biến',
  'Tương thích',
  'Thời điểm ra mắt',
]

// Giá trị crawl còn sót thực thể HTML (&quot; trong '1/1.57&quot;', &amp; trong
// tên công nghệ). FE hiển thị thông số dưới dạng TEXT nên không tự giải mã —
// để nguyên thì khách đọc được đúng chữ "&quot;" trên bảng.
//
// &amp; phải thay CUỐI CÙNG, nếu không '&amp;quot;' sẽ thành '&quot;' rồi bị
// vòng sau giải mã tiếp thành dấu nháy — sai với dữ liệu gốc.
const decodeEntities = (v: string) =>
  v
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

// Đổi object specs của bản crawl thành các dòng cho bảng product_specs.
// sortOrder chính là vị trí sau khi sắp — backend đọc ra đã đúng thứ tự hiển thị.
function buildSpecs(specs: Record<string, string>) {
  const rank = (label: string) => {
    const i = SPEC_ORDER.indexOf(label)
    return i === -1 ? SPEC_ORDER.length : i
  }

  return Object.entries(specs)
    .map(([label, value]) => ({ label: label.trim(), value: cleanSpec(decodeEntities(value)) }))
    // Bỏ dòng rỗng: bảng thông số có một hàng trắng không nhãn trông như lỗi render
    .filter((s): s is { label: string; value: string } => Boolean(s.label && s.value))
    .sort((a, b) => rank(a.label) - rank(b.label))
    .map((s, sortOrder) => ({ ...s, sortOrder }))
}

/**
 * SKU cho sản phẩm nhập từ file crawl.
 *
 * `MBV-<slug>` cắt thẳng ở 60 ký tự là SAI: slug của nguồn Shopee dài tới ~60 ký
 * tự và phần phân biệt (mã sản phẩm) nằm ở CUỐI, cắt đầu là hai sản phẩm khác
 * nhau ra cùng một SKU rồi vỡ unique constraint. Nên cắt ở GIỮA, giữ cả đầu lẫn
 * đuôi. Kèm bộ đếm chống trùng để không bao giờ phụ thuộc vào may rủi của dữ liệu.
 */
function makeSku(slug: string, used: Set<string>): string {
  const body = slug.toUpperCase()
  let sku = `MBV-${body}`
  if (sku.length > 60) sku = `MBV-${body.slice(0, 40)}-${body.slice(-15)}`

  let candidate = sku
  for (let n = 2; used.has(candidate); n++) candidate = `${sku.slice(0, 56)}-${n}`
  used.add(candidate)
  return candidate
}

/** Ba danh mục phụ kiện — dùng để biết file crawl đã có hàng thật hay chưa */
const ACCESSORY_SLUGS = new Set(['bao-da-op-lung', 'sac-cap', 'tai-nghe'])

// ─── Phụ kiện ─────────────────────────────────────────────────────────────────
//
// Điện thoại lấy từ file crawl, nhưng crawler chỉ quét máy nên ba danh mục phụ
// kiện (ốp lưng, sạc cáp, tai nghe) rỗng trơn. Phần dưới sinh dữ liệu phụ kiện
// từ các mẫu bên dưới — KHÔNG ngẫu nhiên: cùng một file crawl thì mỗi lần seed
// ra đúng một bộ dữ liệu, để ảnh chụp màn hình và test không đổi sau mỗi lần chạy.
//
// Hãng lấy từ chính danh sách hãng đã có (Apple, Samsung, Xiaomi...) chứ không
// đẻ thêm hãng phụ kiện mới: thêm hãng là đổi luôn lưới thương hiệu ở trang chủ.

interface AccessoryTemplate {
  /** `%s` thay bằng tên hãng hoặc tên máy, tuỳ danh mục */
  name: string
  /** Giá bán (VND) trước khi áp giảm giá */
  price: number
  specs: [string, string][]
  /** Mỗi phần tử là một biến thể; nhãn hiện ở trang chi tiết */
  variants: { color?: string; storage?: string }[]
}

const CASE_COLORS = [{ color: 'Đen' }, { color: 'Trong suốt' }, { color: 'Xanh navy' }]
const CHARGER_COLORS = [{ color: 'Trắng' }, { color: 'Đen' }]
const EARPHONE_COLORS = [{ color: 'Đen' }, { color: 'Trắng' }]

// Ốp lưng / bao da — đặt tên theo MẪU MÁY vì phụ kiện loại này mua theo máy
const CASE_TEMPLATES: AccessoryTemplate[] = [
  { name: 'Ốp lưng silicon %s', price: 190_000, variants: CASE_COLORS,
    specs: [['Chất liệu', 'Silicon dẻo phủ nhung bên trong'], ['Kiểu dáng', 'Ốp lưng ôm sát'], ['Chống sốc', 'Viền cao hơn mặt kính 1.2mm'], ['Trọng lượng', '32 g'], ['Bảo hành', '3 tháng']] },
  { name: 'Ốp lưng trong suốt chống ố %s', price: 150_000, variants: [{ color: 'Trong suốt' }],
    specs: [['Chất liệu', 'Nhựa TPU + PC chống ngả vàng'], ['Kiểu dáng', 'Trong suốt toàn phần'], ['Chống sốc', 'Đệm khí 4 góc'], ['Trọng lượng', '28 g'], ['Bảo hành', '3 tháng']] },
  { name: 'Ốp lưng chống sốc quân đội %s', price: 320_000, variants: CASE_COLORS,
    specs: [['Chất liệu', 'PC cứng + TPU dẻo hai lớp'], ['Tiêu chuẩn', 'MIL-STD-810G chống rơi 2m'], ['Chống sốc', 'Đệm khí 4 góc, viền nâng camera'], ['Trọng lượng', '58 g'], ['Bảo hành', '6 tháng']] },
  { name: 'Ốp lưng da PU %s', price: 380_000, variants: [{ color: 'Nâu' }, { color: 'Đen' }],
    specs: [['Chất liệu', 'Da PU cao cấp, lót nỉ'], ['Kiểu dáng', 'Ốp lưng liền khối'], ['Chống sốc', 'Viền TPU mềm'], ['Trọng lượng', '45 g'], ['Bảo hành', '6 tháng']] },
  { name: 'Bao da gập có ngăn thẻ %s', price: 290_000, variants: [{ color: 'Đen' }, { color: 'Nâu' }],
    specs: [['Chất liệu', 'Da PU, khung nhựa PC'], ['Kiểu dáng', 'Bao da gập ngang, 2 ngăn thẻ'], ['Tiện ích', 'Gập làm giá đỡ xem phim'], ['Trọng lượng', '76 g'], ['Bảo hành', '6 tháng']] },
  { name: 'Ốp lưng MagSafe %s', price: 450_000, variants: [{ color: 'Đen' }, { color: 'Trong suốt' }],
    specs: [['Chất liệu', 'TPU + vòng nam châm N52'], ['Tương thích', 'Sạc không dây MagSafe 15W'], ['Chống sốc', 'Viền nâng 1.5mm quanh camera'], ['Trọng lượng', '42 g'], ['Bảo hành', '12 tháng']] },
  { name: 'Ốp lưng nhám chống vân tay %s', price: 170_000, variants: CASE_COLORS,
    specs: [['Chất liệu', 'Nhựa PC phủ nhám'], ['Kiểu dáng', 'Siêu mỏng 0.8mm'], ['Ưu điểm', 'Bề mặt nhám không bám vân tay'], ['Trọng lượng', '24 g'], ['Bảo hành', '3 tháng']] },
  { name: 'Ốp lưng viền kim loại %s', price: 260_000, variants: [{ color: 'Bạc' }, { color: 'Đen' }],
    specs: [['Chất liệu', 'Viền nhôm CNC, lưng kính cường lực'], ['Kiểu dáng', 'Viền vuông'], ['Chống sốc', 'Đệm silicon bên trong'], ['Trọng lượng', '64 g'], ['Bảo hành', '6 tháng']] },
  { name: 'Ốp lưng kèm dây đeo %s', price: 210_000, variants: [{ color: 'Đen' }, { color: 'Xanh navy' }],
    specs: [['Chất liệu', 'TPU dẻo, dây dù'], ['Kiểu dáng', 'Ốp lưng kèm dây đeo chéo'], ['Tiện ích', 'Tháo rời dây bằng khoá xoay'], ['Trọng lượng', '68 g'], ['Bảo hành', '3 tháng']] },
  { name: 'Bao da đứng %s', price: 240_000, variants: [{ color: 'Đen' }],
    specs: [['Chất liệu', 'Da PU, lót nhung'], ['Kiểu dáng', 'Bao da đứng, nắp gập trên'], ['Tiện ích', 'Có móc treo thắt lưng'], ['Trọng lượng', '82 g'], ['Bảo hành', '6 tháng']] },
]

// Sạc / cáp — đặt tên theo HÃNG, vì mua theo chuẩn sạc chứ không theo mẫu máy
const CHARGER_TEMPLATES: AccessoryTemplate[] = [
  { name: 'Củ sạc nhanh %s 20W PD', price: 290_000, variants: CHARGER_COLORS,
    specs: [['Công suất', '20W'], ['Cổng ra', '1 × USB-C'], ['Chuẩn sạc nhanh', 'Power Delivery 3.0'], ['Điện áp vào', '100–240V, 50/60Hz'], ['Bảo hành', '12 tháng']] },
  { name: 'Củ sạc nhanh %s 33W', price: 390_000, variants: CHARGER_COLORS,
    specs: [['Công suất', '33W'], ['Cổng ra', '1 × USB-A'], ['Chuẩn sạc nhanh', 'Quick Charge 4+'], ['Điện áp vào', '100–240V, 50/60Hz'], ['Bảo hành', '12 tháng']] },
  { name: 'Củ sạc nhanh %s 67W hai cổng', price: 590_000, variants: CHARGER_COLORS,
    specs: [['Công suất', '67W tổng'], ['Cổng ra', '1 × USB-C + 1 × USB-A'], ['Chuẩn sạc nhanh', 'PD 3.0 + QC 4+'], ['Công nghệ', 'GaN, thân nhỏ hơn 30%'], ['Bảo hành', '12 tháng']] },
  { name: 'Cáp sạc %s USB-C to USB-C 1m', price: 190_000, variants: [{ color: 'Trắng' }, { color: 'Đen' }],
    specs: [['Chiều dài', '1 m'], ['Đầu nối', 'USB-C sang USB-C'], ['Dòng tối đa', '5A / 100W'], ['Chất liệu', 'Dây dù bện chống đứt'], ['Bảo hành', '12 tháng']] },
  { name: 'Cáp sạc %s USB-C to Lightning 1m', price: 250_000, variants: [{ color: 'Trắng' }],
    specs: [['Chiều dài', '1 m'], ['Đầu nối', 'USB-C sang Lightning'], ['Chuẩn', 'MFi certified'], ['Dòng tối đa', '3A'], ['Bảo hành', '12 tháng']] },
  { name: 'Cáp sạc %s USB-C 2m chống đứt', price: 260_000, variants: [{ color: 'Đen' }],
    specs: [['Chiều dài', '2 m'], ['Đầu nối', 'USB-C sang USB-C'], ['Dòng tối đa', '5A / 100W'], ['Chất liệu', 'Vỏ dù bện, chịu 20.000 lần gập'], ['Bảo hành', '12 tháng']] },
  { name: 'Sạc dự phòng %s 10.000mAh', price: 490_000, variants: [{ color: 'Đen', storage: '10.000mAh' }, { color: 'Trắng', storage: '10.000mAh' }],
    specs: [['Dung lượng', '10.000 mAh'], ['Công suất', '22.5W'], ['Cổng ra', '1 × USB-C + 1 × USB-A'], ['Cổng vào', 'USB-C'], ['Bảo hành', '12 tháng']] },
  { name: 'Sạc dự phòng %s 20.000mAh', price: 790_000, variants: [{ color: 'Đen', storage: '20.000mAh' }],
    specs: [['Dung lượng', '20.000 mAh'], ['Công suất', '30W'], ['Cổng ra', '2 × USB-C + 1 × USB-A'], ['Tiện ích', 'Màn LED báo % pin'], ['Bảo hành', '12 tháng']] },
  { name: 'Sạc không dây %s 15W', price: 450_000, variants: CHARGER_COLORS,
    specs: [['Công suất', '15W'], ['Chuẩn', 'Qi2 / MagSafe'], ['Kiểu dáng', 'Đế đứng, góc nghiêng 60°'], ['Tiện ích', 'Vẫn sạc được khi đeo ốp dày 5mm'], ['Bảo hành', '12 tháng']] },
  { name: 'Đế sạc %s 3 trong 1', price: 890_000, variants: [{ color: 'Đen' }],
    specs: [['Công suất', '15W + 5W + 5W'], ['Chuẩn', 'Qi2, sạc đồng thời máy + tai nghe + đồng hồ'], ['Kiểu dáng', 'Đế gập gọn mang đi'], ['Phụ kiện kèm', 'Củ sạc 30W + cáp 1.5m'], ['Bảo hành', '12 tháng']] },
]

// Tai nghe — đặt tên theo HÃNG
const EARPHONE_TEMPLATES: AccessoryTemplate[] = [
  { name: 'Tai nghe Bluetooth %s TWS Air', price: 690_000, variants: EARPHONE_COLORS,
    specs: [['Kiểu tai nghe', 'True Wireless nhét tai'], ['Kết nối', 'Bluetooth 5.3'], ['Thời lượng pin', '5 giờ, 24 giờ kèm hộp sạc'], ['Chống nước', 'IPX4'], ['Bảo hành', '12 tháng']] },
  { name: 'Tai nghe Bluetooth %s TWS Pro chống ồn', price: 1_490_000, variants: EARPHONE_COLORS,
    specs: [['Kiểu tai nghe', 'True Wireless nhét tai'], ['Chống ồn', 'ANC chủ động tối đa 42dB'], ['Kết nối', 'Bluetooth 5.3, đa điểm 2 thiết bị'], ['Thời lượng pin', '6 giờ, 30 giờ kèm hộp sạc'], ['Chống nước', 'IPX5'], ['Bảo hành', '12 tháng']] },
  { name: 'Tai nghe chụp tai %s Studio', price: 2_890_000, variants: [{ color: 'Đen' }, { color: 'Xám' }],
    specs: [['Kiểu tai nghe', 'Chụp tai over-ear'], ['Chống ồn', 'ANC lai 2 micro'], ['Kết nối', 'Bluetooth 5.2 + jack 3.5mm'], ['Thời lượng pin', '40 giờ (bật ANC 30 giờ)'], ['Trọng lượng', '268 g'], ['Bảo hành', '12 tháng']] },
  { name: 'Tai nghe nhét tai %s có dây', price: 190_000, variants: [{ color: 'Trắng' }],
    specs: [['Kiểu tai nghe', 'Nhét tai có dây'], ['Đầu cắm', 'USB-C'], ['Điều khiển', 'Nút chỉnh âm lượng trên dây'], ['Chiều dài dây', '1.2 m'], ['Bảo hành', '6 tháng']] },
  { name: 'Tai nghe thể thao %s móc vành tai', price: 890_000, variants: [{ color: 'Đen' }, { color: 'Xanh lá' }],
    specs: [['Kiểu tai nghe', 'Móc vành tai, ôm chắc khi chạy'], ['Kết nối', 'Bluetooth 5.3'], ['Thời lượng pin', '8 giờ, 32 giờ kèm hộp sạc'], ['Chống nước', 'IPX7 chịu mưa và mồ hôi'], ['Bảo hành', '12 tháng']] },
  { name: 'Tai nghe gaming %s độ trễ thấp', price: 1_190_000, variants: [{ color: 'Đen' }],
    specs: [['Kiểu tai nghe', 'True Wireless, chế độ game'], ['Độ trễ', '45ms ở chế độ game'], ['Kết nối', 'Bluetooth 5.3'], ['Thời lượng pin', '7 giờ, 28 giờ kèm hộp sạc'], ['Tiện ích', 'Đèn RGB trên hộp sạc'], ['Bảo hành', '12 tháng']] },
  { name: 'Tai nghe %s Lite bản tiêu chuẩn', price: 390_000, variants: EARPHONE_COLORS,
    specs: [['Kiểu tai nghe', 'True Wireless nhét tai'], ['Kết nối', 'Bluetooth 5.2'], ['Thời lượng pin', '4 giờ, 18 giờ kèm hộp sạc'], ['Chống nước', 'IPX4'], ['Bảo hành', '12 tháng']] },
  { name: 'Tai nghe %s bán nhét tai', price: 590_000, variants: EARPHONE_COLORS,
    specs: [['Kiểu tai nghe', 'Bán nhét tai, không bí tai'], ['Kết nối', 'Bluetooth 5.3'], ['Thời lượng pin', '5 giờ, 20 giờ kèm hộp sạc'], ['Micro', '2 micro khử ồn khi gọi'], ['Bảo hành', '12 tháng']] },
  { name: 'Tai nghe %s Max chống ồn cao cấp', price: 5_990_000, variants: [{ color: 'Đen' }, { color: 'Bạc' }],
    specs: [['Kiểu tai nghe', 'Chụp tai over-ear'], ['Chống ồn', 'ANC thích ứng, 8 micro'], ['Kết nối', 'Bluetooth 5.3, LDAC'], ['Thời lượng pin', '30 giờ bật ANC'], ['Chất liệu', 'Khung nhôm, đệm da cừu'], ['Bảo hành', '12 tháng']] },
  { name: 'Tai nghe kẹp vành tai %s open-ear', price: 1_690_000, variants: [{ color: 'Đen' }, { color: 'Be' }],
    specs: [['Kiểu tai nghe', 'Kẹp vành tai, không bịt ống tai'], ['Ưu điểm', 'Vẫn nghe được tiếng xung quanh khi đi đường'], ['Kết nối', 'Bluetooth 5.3'], ['Thời lượng pin', '6 giờ, 24 giờ kèm hộp sạc'], ['Bảo hành', '12 tháng']] },
]

interface AccessoryGroup {
  categoryId: string
  templates: AccessoryTemplate[]
  /** Ốp lưng đặt tên theo mẫu máy; sạc và tai nghe đặt theo hãng */
  nameBy: 'model' | 'brand'
}

interface PhoneRef {
  name: string
  brandSlug: string
}

/**
 * Sinh toàn bộ dữ liệu phụ kiện — hàm THUẦN, không chạm database.
 *
 * Tách riêng để kiểm chứng được (đếm số lượng, kiểm slug/SKU trùng) mà không
 * phải chạy `npm run seed`, vốn xoá sạch mọi bảng trước khi dựng lại.
 */
function buildAccessories(
  groups: AccessoryGroup[],
  phones: PhoneRef[],
  brandBySlug: Record<string, { id: string; name: string }>,
  copiesPerTemplate: number,
) {
  const rows = []
  const usedSlugs = new Set<string>()
  // Sạc và tai nghe đặt tên theo hãng, nên phải XOAY VÒNG QUA DANH SÁCH HÃNG.
  // Lấy hãng của máy thứ 0,1,2 như nhóm ốp lưng thì ra ba lần cùng một hãng
  // (file crawl gom máy theo hãng), tức ba sản phẩm trùng tên y hệt nhau.
  const brandList = Object.values(brandBySlug)
  let seq = 0

  for (const group of groups) {
    for (let ti = 0; ti < group.templates.length; ti++) {
      const tpl = group.templates[ti]

      for (let copy = 0; copy < copiesPerTemplate; copy++) {
        seq++
        // Lấy hãng và tên máy từ chính danh sách máy đang bán: ốp lưng phải hợp
        // với máy có thật trong shop, và hãng thì khỏi phải bịa thêm
        const phone = phones[(ti * copiesPerTemplate + copy) % phones.length]
        const owner =
          group.nameBy === 'brand'
            ? brandList[(ti * copiesPerTemplate + copy) % brandList.length]
            : brandBySlug[phone.brandSlug]
        if (!owner) continue

        // "Điện thoại iPhone 16 Pro Max" -> "iPhone 16 Pro Max": tên phụ kiện đã
        // có sẵn loại hàng ở đầu ("Ốp lưng ..."), giữ chữ "Điện thoại" là thừa
        const model = phone.name.replace(/^Điện thoại\s+/i, '').trim()
        const name = tpl.name.replace('%s', group.nameBy === 'model' ? model : owner.name)

        // Cùng luật giảm giá với điện thoại: cứ 3 sản phẩm có 1 cái giảm sâu
        const deepSale = seq % 3 === 0
        const salePrice = tpl.price
        const originalPrice = deepSale ? round0(salePrice / 0.85) : round0(salePrice / 0.95)

        const tagSlugs = [deepSale ? 'giam-gia' : 'ban-chay']
        if (copy === 0) tagSlugs.push('moi-nhat')

        // Slug sạch, chỉ thêm hậu tố khi thật sự đụng nhau — URL sản phẩm là thứ
        // khách nhìn thấy, không nên dính đuôi kỹ thuật nếu không cần
        let slug = slugify(name)
        for (let n = 2; usedSlugs.has(slug); n++) slug = `${slugify(name)}-${n}`
        usedSlugs.add(slug)

        rows.push({
          name,
          slug,
          description: `<p>${name} chính hãng, phân phối bởi Mobivexa. ${tpl.specs[0][0]}: ${tpl.specs[0][1]}.</p>`,
          categoryId: group.categoryId,
          brandId: owner.id,
          // Phụ kiện KHÔNG bao giờ nổi bật: `/products/featured` sắp theo mới
          // nhất mà phụ kiện tạo sau cùng, nên chỉ cần vài cái nổi bật là chúng
          // chiếm hết đầu hàng — mà ảnh phụ kiện lại là ảnh dựng sẵn (khối màu
          // phẳng), đứng cạnh ảnh máy chụp thật trông như lỗi tải ảnh.
          isFeatured: false,
          tagSlugs,
          images: accessoryImages(name),
          variants: tpl.variants.map((v, vi) => ({
            sku: `MBV-PK${seq}-${vi + 1}`,
            color: v.color ?? null,
            storage: v.storage ?? null,
            ram: null,
            originalPrice,
            salePrice,
            // Tồn kho rải đều nhưng cố định theo seq -> chạy lại seed ra y hệt
            stock: ((seq * 7 + vi * 3) % 40) + 5,
            isActive: true,
          })),
          specs: tpl.specs.map(([label, value], i) => ({ label, value, sortOrder: i })),
        })
      }
    }
  }

  return rows
}

/**
 * Ảnh phụ kiện là ảnh dựng sẵn — crawler không quét phụ kiện nên không có ảnh thật.
 *
 * Màu XÁM NHẠT, chữ xám, cố ý không dùng màu nền rực theo từng nhóm hàng: lưới
 * sản phẩm trộn lẫn máy (ảnh chụp thật) với phụ kiện, mà một ô tím/xanh lá đặc
 * đứng cạnh ảnh máy trông như lỗi tải ảnh chứ không như ảnh sản phẩm. Nền nhạt
 * đọc ra đúng nghĩa "chưa có ảnh" và không cướp mắt người xem.
 */
function accessoryImages(label: string) {
  const text = (s: string) => encodeURIComponent(s.slice(0, 26))
  const publicId = slugify(label)
  return [
    { url: `https://placehold.co/800x800/EEF2F7/64748B?text=${text(label)}`, publicId: `mobivexa/phu-kien/${publicId}/0`, isCover: true, sortOrder: 0 },
    { url: `https://placehold.co/800x800/E2E8F0/64748B?text=${text('Mặt sau')}`, publicId: `mobivexa/phu-kien/${publicId}/1`, isCover: false, sortOrder: 1 },
  ]
}

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
  // Tiền tố publicId của ảnh: lấy theo nguồn thật thay vì hardcode "cellphones",
  // vì file crawl giờ có thể đến từ nguồn khác
  const sourceKey = slugify(String(data.source || 'crawl').split(' ')[0]) || 'crawl'
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
  await prisma.productSpec.deleteMany()
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
  const [catCase, catCharger, catEarphone] = await Promise.all([
    prisma.category.create({ data: { name: 'Ốp lưng - Bao da', slug: 'bao-da-op-lung', parentId: catAccessory.id, sortOrder: 1 } }),
    prisma.category.create({ data: { name: 'Sạc - Cáp',        slug: 'sac-cap',        parentId: catAccessory.id, sortOrder: 2 } }),
    prisma.category.create({ data: { name: 'Tai nghe',         slug: 'tai-nghe',       parentId: catAccessory.id, sortOrder: 3 } }),
  ])
  // Gồm CẢ danh mục phụ kiện: vòng tạo sản phẩm bỏ qua bản ghi nào không tìm
  // thấy `cat[p.categorySlug]`, nên thiếu ở đây là toàn bộ ốp lưng / sạc cáp /
  // tai nghe trong file crawl bị loại âm thầm, không một dòng cảnh báo.
  const cat = Object.fromEntries(
    [...phoneChildren, catCase, catCharger, catEarphone].map((c) => [c.slug, c]),
  )
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
  let totalSpecs = 0
  const usedSkus = new Set<string>()

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
      publicId: `${sourceKey}/${p.slug}/${idx}`,
      isCover: im.isCover,
      sortOrder: idx,
    }))
    totalImages += images.length

    // Thông số kỹ thuật lấy thẳng từ bản crawl — cùng nguồn với ảnh và mô tả,
    // không phải số liệu tự nghĩ ra
    const productSpecs = buildSpecs(p.specs)
    totalSpecs += productSpecs.length

    const created = await prisma.product.create({
      data: {
        name: p.name, slug: p.slug, description: p.description || p.name,
        categoryId: cat[p.categorySlug].id, brandId: brand[p.brandSlug].id,
        isFeatured, isActive: true,
        images: { create: images },
        variants: {
          create: [{
            sku: makeSku(p.slug, usedSkus),
            color, storage, ram,
            originalPrice, salePrice, stock, isActive: true,
          }],
        },
        productTags: { create: tagSlugs.map((s) => ({ tagId: tag[s].id })) },
        specs: productSpecs.length ? { create: productSpecs } : undefined,
      },
      include: { variants: true },
    })
    createdProducts.push(created)
  }
  console.log(`✓  (${createdProducts.length} sp, ${createdProducts.length} variants, ${totalImages} ảnh, ${totalSpecs} thông số)`)

  // ── Phụ kiện (sinh từ mẫu) ───────────────────────────────────────────────────
  //
  // CHỈ chạy khi file crawl không có phụ kiện. Trộn hàng thật với hàng dựng tay
  // thì trong cùng một danh mục sẽ có sản phẩm ảnh thật đứng cạnh ảnh placeholder
  // xám, giá thật cạnh giá bịa — nhìn là biết dữ liệu hỏng.
  const crawlHasAccessories = data.products.some((p) => ACCESSORY_SLUGS.has(p.categorySlug))
  if (crawlHasAccessories) {
    console.log(`  🎧  Phụ kiện: dùng ${data.products.filter((p) => ACCESSORY_SLUGS.has(p.categorySlug)).length} sp THẬT từ file crawl, bỏ qua phần dựng tay`)
  }
  process.stdout.write('  🎧  Tạo phụ kiện... ')

  // Mỗi mẫu nhân ra 3 sản phẩm -> 10 mẫu × 3 = 30 sản phẩm mỗi danh mục
  const accessories = crawlHasAccessories ? [] : buildAccessories(
    [
      { categoryId: catCase.id,     templates: CASE_TEMPLATES,     nameBy: 'model' },
      { categoryId: catCharger.id,  templates: CHARGER_TEMPLATES,  nameBy: 'brand' },
      { categoryId: catEarphone.id, templates: EARPHONE_TEMPLATES, nameBy: 'brand' },
    ],
    data.products,
    brand,
    3,
  )

  for (const a of accessories) {
    await prisma.product.create({
      data: {
        name: a.name,
        slug: a.slug,
        description: a.description,
        categoryId: a.categoryId,
        brandId: a.brandId,
        isFeatured: a.isFeatured,
        isActive: true,
        images: { create: a.images },
        variants: { create: a.variants },
        productTags: { create: a.tagSlugs.map((s) => ({ tagId: tag[s].id })) },
        specs: { create: a.specs },
      },
    })
  }
  const accessoryVariants = accessories.reduce((n, a) => n + a.variants.length, 0)
  console.log(`✓  (${accessories.length} sp, ${accessoryVariants} variants, 3 danh mục)`)

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
  console.log(`  │  Điện thoại    : ${String(`${createdProducts.length} (${totalImages} ảnh, ${featuredCount} nổi bật)`).padEnd(28)}│`)
  console.log(`  │  Phụ kiện      : ${String(`${accessories.length} (30 mỗi danh mục)`).padEnd(28)}│`)
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
