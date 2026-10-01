import { removeVietnameseDiacritics } from '../../utils/slug'

// ─── Chuẩn hoá query tìm kiếm ─────────────────────────────────────────────────
//
// FTS 'simple' trên products.name không hiểu dấu tiếng Việt lẫn viết tắt ("ip",
// "ss") — khách gõ "chi ei may choi gam duoi 8tr" là FTS trả 0 dòng. Chuẩn hoá
// TRƯỚC khi đưa vào search_products: bỏ dấu, hạ chữ thường, map viết tắt theo
// catalog (mục D.2: ip, ss, xmi...), nở "5tr"/"5 trieu" thành 5000000 và tách
// chữ-số dính nhau ("ip15" → "iphone 15").

// Slug thương hiệu thật trong DB — NGUỒN DUY NHẤT cho danh sách brand: tool
// description (chat/tools.ts) và GLUED_BRAND_NAMES bên dưới đều sinh từ đây.
export const BRAND_SLUGS = [
  'iphone',
  'samsung',
  'xiaomi',
  'oppo',
  'realme',
  'honor',
  'huawei',
  'meizu',
  'techno',
] as const

// Viết tắt thương hiệu phổ biến — chỉ map token ĐỨNG MỘT MÌNH để không đụng từ
// khác ("ss" trong "boss" phải được giữ nguyên).
const ABBREV_MAP: Record<string, string> = {
  ip: 'iphone',
  ss: 'samsung',
  xmi: 'xiaomi',
}

// Typo nhẹ gặp thường xuyên trong bộ câu hỏi (catalog C2: "xow"). Map trực tiếp
// thay vì edit-distance vì từ điển sản phẩm quá nhỏ, tự sửa sai còn tệ hơn.
const TYPO_MAP: Record<string, string> = {
  xow: 'vao',
}

// Tên thương hiệu viết đầy đủ hay bị dính số ("iphone15") — chỉ tách với prefix
// ĐÃ BIẾT (cùng nguồn BRAND_SLUGS): "s23"/"a54" là tên model thật, tách chung
// chung là FTS gãy ngay.
const GLUED_BRAND_NAMES = new Set<string>(BRAND_SLUGS)

// Hậu tố phiên bản đi sau số ("15pro") — đủ nhỏ để không nuốt từ thường.
const SPEC_SUFFIXES = /^(pro|max|plus|ultra|fe)$/

function expandPriceToken(value: string, unit: 'tr' | 'k'): string | null {
  const num = parseFloat(value.replace(',', '.'))
  if (!Number.isFinite(num)) return null
  const amount = unit === 'tr' ? num * 1_000_000 : num * 1_000
  return String(Math.round(amount))
}

export function normalizeSearchQuery(raw: string): string {
  const text = removeVietnameseDiacritics(raw).toLowerCase()
  const tokens = text.split(/\s+/).filter(Boolean)

  const normalized: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const token = TYPO_MAP[tokens[i]] ?? tokens[i]

    // "5tr" / "5,5tr" dính đơn vị — nở ngay thành giá trị tiền
    const gluedPrice = token.match(/^(\d+(?:[.,]\d+)?)(tr|k)$/)
    if (gluedPrice) {
      const expanded = expandPriceToken(gluedPrice[1], gluedPrice[2] as 'tr' | 'k')
      if (expanded) {
        normalized.push(expanded)
        continue
      }
    }

    // Số đứng trước đơn vị viết rời ("8 trieu", "8 tr") — nở số rồi bỏ token đơn vị
    if (/^\d+(?:[.,]\d+)?$/.test(token) && (tokens[i + 1] === 'tr' || tokens[i + 1] === 'trieu')) {
      const expanded = expandPriceToken(token, 'tr')
      if (expanded) {
        normalized.push(expanded)
        i++
        continue
      }
    }

    // Thương hiệu dính số ("ip15", "iphone15") → "iphone 15" — chỉ tách prefix đã
    // biết, giữ nguyên "s23"/"a54" (tên model thật)
    const gluedModel = token.match(/^([a-z]+)(\d.*)$/)
    if (gluedModel) {
      const brand = ABBREV_MAP[gluedModel[1]] ?? (GLUED_BRAND_NAMES.has(gluedModel[1]) ? gluedModel[1] : null)
      if (brand) {
        normalized.push(`${brand} ${gluedModel[2]}`)
        continue
      }
    }

    // Số + hậu tố phiên bản dính nhau ("15pro" → "15 pro")
    const specSuffix = token.match(/^(\d+)([a-z]+)$/)
    if (specSuffix && SPEC_SUFFIXES.test(specSuffix[2])) {
      normalized.push(specSuffix[1], specSuffix[2])
      continue
    }

    // Token còn lại: map viết tắt nếu có, không thì giữ nguyên
    normalized.push(ABBREV_MAP[token] ?? token)
  }

  return normalized.join(' ').trim()
}

// Từ ngữ Ý ĐỊNH chung chung khách hay kèm trong câu ("may choi game", "pin trau")
// — không bao giờ xuất hiện trong tên sản phẩm nên đưa vào FTS chỉ làm trả 0 kết
// quả. Lọc bỏ trước khi search, giữ lại token thương hiệu/model/spec ("iphone",
// "15", "pro max", "128g"). Chỉ khớp token NGUYÊN nên không hại tên máy thật.
const INTENT_STOPWORDS = new Set([
  'dien',
  'thoai',
  'may',
  'choi',
  'game',
  'chup',
  'anh',
  'pin',
  'trau',
  'sac',
  'nhanh',
  'dep',
  'muot',
  'lon',
  'nhe',
  'mong',
  'mua',
  'tim',
  'cho',
  'xin',
  'em',
  'chi',
  'shop',
  'ban',
  'co',
  'khong',
  'kh',
  'dc',
  'duoc',
  'nao',
  'tot',
  'nhat',
  'gia',
  'tien',
  'khoang',
  'duoi',
  'tren',
  'hon',
  'hay',
  'hoac',
  'va',
  'con',
  'hang',
  'vay',
  'vs',
  'so',
  'sanh',
  'giua',
  'nen',
  'giup',
])

export function stripIntentWords(query: string): string {
  const kept = query.split(/\s+/).filter((t) => t && !INTENT_STOPWORDS.has(t))
  return kept.join(' ').trim()
}
