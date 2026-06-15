const COLOR_MAP: [string[], string][] = [
  [['đen', 'black', 'jet black', 'midnight', 'titan đen', 'space black'], '#2c2c2e'],
  [['trắng', 'white', 'starlight', 'bạch', 'cream', 'ivory'], '#c0c0c5'],
  [['bạc', 'silver', 'platinum', 'bạch kim', 'satin'], '#9090a0'],
  [['titan', 'titanium', 'natural titanium'], '#8d9198'],
  [['xám', 'gray', 'grey', 'graphite', 'slate', 'space gray'], '#6b7280'],
  [['vàng', 'gold', 'yellow', 'amber'], '#d4a017'],
  [['xanh biển', 'blue', 'sierra blue', 'alpine', 'sky', 'pacific', 'xanh dương'], '#2e7de9'],
  [['xanh lá', 'green', 'sage', 'midnight green', 'forest', 'olive'], '#3d9a5c'],
  [['xanh', 'teal', 'cyan', 'aqua', 'mint'], '#0ea5b0'],
  [['đỏ', 'red', 'product red', 'crimson', 'ruby', 'coral'], '#e03131'],
  [['hồng', 'pink', 'rose', 'blush', 'flamingo', 'light pink'], '#e64980'],
  [['tím', 'purple', 'violet', 'lavender', 'mauve', 'deep purple'], '#7048e8'],
  [['cam', 'orange', 'peach', 'apricot'], '#e8590c'],
  [['nâu', 'brown', 'bronze', 'copper', 'mocha'], '#8b5c3a'],
]

/** Danh sách màu preset dẫn xuất từ COLOR_MAP — dùng trong ColorPickerInput. */
export const COLOR_PRESETS = COLOR_MAP.map(([keywords, hex]) => ({
  name: keywords[0].charAt(0).toUpperCase() + keywords[0].slice(1),
  hex,
}))

/** Chuyển tên màu tiếng Việt/Anh → CSS hex. Fallback: HSL sinh từ hash chuỗi. */
export function resolveColor(colorStr: string | null): string {
  if (!colorStr) return '#94a3b8'
  const s = colorStr.toLowerCase()
  for (const [keywords, color] of COLOR_MAP) {
    if (keywords.some((k) => s.includes(k))) return color
  }
  let h = 0
  for (let i = 0; i < colorStr.length; i++) {
    h = colorStr.charCodeAt(i) + ((h << 5) - h)
  }
  return `hsl(${((h % 360) + 360) % 360}, 58%, 48%)`
}
