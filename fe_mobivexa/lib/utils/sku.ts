function removeDiacritics(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, (c) => (c === 'đ' ? 'd' : 'D'))
}

/**
 * Tự động tạo SKU từ tên sản phẩm + thuộc tính biến thể.
 *
 * Format: [TÊN_VIẾT_TẮT]-[MÀU]-[RAM]-[DUNG_LƯỢNG]
 * Ví dụ: "iPhone 15 Pro" + "Titan Đen" + "8GB" + "256GB" → "IPH15P-TDN-8G-256G"
 */
export function buildSku(
  productName: string,
  color?: string,
  ram?: string,
  storage?: string,
): string {
  // Tên: lấy chữ cái đầu mỗi từ, tối đa 6 ký tự
  const namePart = removeDiacritics(productName)
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, '')[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 6)

  // Màu: bỏ dấu + khoảng trắng, 3 ký tự đầu
  const colorPart = color
    ? removeDiacritics(color).replace(/\s+/g, '').toUpperCase().slice(0, 3)
    : ''

  // RAM: "8GB" → "8G", "12GB" → "12G"
  const ramPart = ram
    ? removeDiacritics(ram)
        .replace(/\s+/g, '')
        .toUpperCase()
        .replace(/GB$/i, 'G')
        .replace(/MB$/i, 'M')
    : ''

  // Dung lượng: "256GB" → "256G", "1TB" → "1T"
  const storagePart = storage
    ? removeDiacritics(storage)
        .replace(/\s+/g, '')
        .toUpperCase()
        .replace(/GB$/i, 'G')
        .replace(/TB$/i, 'T')
        .replace(/MB$/i, 'M')
    : ''

  return [namePart, colorPart, ramPart, storagePart].filter(Boolean).join('-')
}
