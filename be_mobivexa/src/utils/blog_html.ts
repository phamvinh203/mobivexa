import sanitizeHtml from 'sanitize-html'

// ─── Sanitize nội dung bài viết (ADR-blog-005, BR-blog-023, NFR-blog-004) ──────

const ALLOWED_TAGS = [
  'p', 'br', 'hr', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's',
  'blockquote', 'ul', 'ol', 'li', 'code', 'pre', 'a', 'img',
]

const ALLOWED_ATTRIBUTES = {
  a:   ['href', 'target', 'rel'],
  img: ['src', 'alt', 'width', 'height'],
}

// Cloud Cloudinary của hệ thống, đọc từ CLOUDINARY_URL (cloudinary://key:secret@cloud_name).
// Không parse được (thiếu biến, sai định dạng) → không cloud nào coi là hợp lệ, ảnh nội
// dung nào cũng bị loại — an toàn hơn là chấp nhận bừa mọi res.cloudinary.com/*.
function cloudinaryCloudName(): string | null {
  const raw = process.env.CLOUDINARY_URL
  if (!raw) return null
  try {
    return new URL(raw).hostname || null
  } catch {
    return null
  }
}

// RVW-008: so khớp bằng `startsWith` trên chuỗi thô bị lách qua 2 đường — (a) `..` trong
// path (`https://res.cloudinary.com/<cloud>/../evil/x.png`, trình duyệt/CDN chuẩn hoá lại
// thành domain/thư mục khác); (b) delivery type `image/fetch` của Cloudinary
// (`https://res.cloudinary.com/<cloud>/image/fetch/https://evil.com/a.png` — proxy ảnh
// ngoài, tốn quota, vẫn là "ảnh ngoài hệ thống" theo FR-blog-017). Dùng `new URL()` để
// `..` được chuẩn hoá TRƯỚC khi so khớp, và ép đúng path `/image/upload/` (kiểu upload
// thật `uploadEntityImage()` luôn sinh ra) để loại delivery type khác.
function isAllowedContentImage(src: string | undefined, cloudName: string | null): boolean {
  if (!src || !cloudName) return false
  try {
    const url = new URL(src)
    return url.protocol === 'https:' && url.host === 'res.cloudinary.com' && url.pathname.startsWith(`/${cloudName}/image/upload/`)
  } catch {
    return false
  }
}

// Loại bỏ script/event-handler/style/class/id và MỌI thẻ ngoài whitelist; ảnh chỉ chấp
// nhận từ Cloudinary của chính hệ thống (chống nhúng ảnh ngoài — FR-blog-017, EC-blog-009).
export function sanitizeBlogHtml(html: string): string {
  const cloudName = cloudinaryCloudName()

  return sanitizeHtml(html ?? '', {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: {
      h1: 'h2', // H1 của trang là tiêu đề bài, nội dung không được có H1 riêng
      a: (tagName, attribs) => {
        if (attribs.target === '_blank') attribs.rel = 'noopener noreferrer'
        return { tagName, attribs }
      },
    },
    exclusiveFilter: (frame) => {
      if (frame.tag !== 'img') return false
      return !isAllowedContentImage(frame.attribs.src, cloudName)
    },
  })
}

// ─── Text thuần từ HTML (đếm từ, cắt mô tả SEO) ────────────────────────────────

// RVW-003: sanitize-html strip thẻ nhưng (a) KHÔNG chèn khoảng trắng ở ranh giới khối
// ("...bảng.</p><p>Cấu hình..." → dính thành "...bảng.Cấu hình..." nếu strip thẳng), và
// (b) giữ nguyên entity đã mã hoá (`&amp;` không được giải mã lại thành `&`). Cả hai đều
// làm sai `seo.description` (BR-blog-017), RSS `<description>` (escapeXml phải nhận input
// đã là ký tự thô — nếu không sẽ escape 2 lần thành `&amp;amp;`), và số từ đếm cho
// `computeReadingTime`.
const BLOCK_BOUNDARY_RE = /<br\s*\/?>|<\/(p|h[1-6]|li|blockquote|pre)>/gi

export function htmlToText(html: string): string {
  const spaced = (html ?? '').replace(BLOCK_BOUNDARY_RE, ' ')
  const stripped = sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} })
  const decoded = stripped
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&') // PHẢI thay CUỐI CÙNG, không thì "&amp;lt;" giải mã ngược thành "<"
  return decoded.replace(/\s+/g, ' ').trim()
}

// BR-blog-016: làm tròn lên (số từ / 200), tối thiểu 1 phút — kể cả bài toàn ảnh gần
// như không chữ (EC-blog-019).
export function computeReadingTime(html: string): number {
  const words = htmlToText(html).split(' ').filter(Boolean)
  return Math.max(1, Math.ceil(words.length / 200))
}

// BR-blog-017: SEO description fallback cắt 160 ký tự đầu, ở ranh giới từ.
export function truncatePlainText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  const cut = text.slice(0, maxLen)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim()
}

// ─── XML (sitemap, RSS) ─────────────────────────────────────────────────────────

const XML_ESCAPE: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}

export function escapeXml(input: string): string {
  return (input ?? '').replace(/[&<>"']/g, (c) => XML_ESCAPE[c] as string)
}
