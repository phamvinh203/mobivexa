// ─────────────────────────────────────────────────────────────────────────────
// Mô tả sản phẩm được admin soạn bằng RichTextEditor (contentEditable) và lưu
// nguyên HTML — backend KHÔNG sanitize. Đổ thẳng vào dangerouslySetInnerHTML sẽ
// thành lỗ stored XSS, nên ở đây bóc tag về text và chỉ giữ lại cấu trúc
// dòng/gạch đầu dòng. An toàn tuyệt đối vì không có HTML nào được inject.
//
// Muốn hiển thị đúng rich text (đậm/nghiêng/link/ảnh) thì cần thêm thư viện
// sanitize (sanitize-html hoặc isomorphic-dompurify) rồi mới render HTML.
// ─────────────────────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;|&apos;/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
}

export interface DescriptionLine {
  text: string
  /** Dòng nằm trong <li> — hiển thị dạng gạch đầu dòng */
  bullet: boolean
}

/**
 * HTML mô tả → danh sách dòng đã bóc tag.
 * Text thuần (dữ liệu seed hiện tại) đi qua vẫn giữ nguyên xuống dòng.
 */
export function htmlToLines(html: string | null | undefined): DescriptionLine[] {
  if (!html) return []

  const withMarkers = html
    // Bỏ hẳn nội dung script/style trước khi bóc tag
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    // Đánh dấu item danh sách để giữ lại dấu chấm đầu dòng
    .replace(/<li\b[^>]*>/gi, '\n•\t')
    // Tag khối và <br> → ngắt dòng
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|section)>/gi, '\n')
    // Còn lại: bóc sạch
    .replace(/<[^>]*>/g, '')

  return decodeEntities(withMarkers)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) =>
      line.startsWith('•')
        ? { text: line.replace(/^•\s*/, '').trim(), bullet: true }
        : { text: line, bullet: false },
    )
    .filter((line) => line.text.length > 0)
}
