import { resolveColor } from '@/lib/utils/color'
import type { InventoryVariant, StockStatus } from './types'

const LOW_THRESHOLD = 5

export interface ColorGroup {
  colorKey: string
  colorDisplay: string
  colorCss: string
  variants: InventoryVariant[]
  totalStock: number
  worstLevel: StockStatus
}

export interface ProductGroup {
  productId: string
  name: string
  categoryName: string | null
  brandName: string | null
  coverUrl: string | null
  colorGroups: ColorGroup[]
}

export function stockLevel(stock: number): StockStatus {
  if (stock === 0) return 'out_of_stock'
  if (stock <= LOW_THRESHOLD) return 'low_stock'
  return 'in_stock'
}

export function groupByProduct(variants: InventoryVariant[]): ProductGroup[] {
  const pgMap = new Map<string, ProductGroup>()
  const cgMaps = new Map<string, Map<string, ColorGroup>>()

  for (const v of variants) {
    const pid = v.product.id
    if (!pgMap.has(pid)) {
      pgMap.set(pid, {
        productId: pid,
        name: v.product.name,
        categoryName: v.product.category?.name ?? null,
        brandName: v.product.brand?.name ?? null,
        coverUrl: v.product.images?.[0]?.url ?? null,
        colorGroups: [],
      })
      cgMaps.set(pid, new Map())
    }
    const pg = pgMap.get(pid)!
    const cgMap = cgMaps.get(pid)!

    const colorKey = v.color ?? '__none__'
    let cg = cgMap.get(colorKey)
    if (!cg) {
      cg = { colorKey, colorDisplay: v.color ?? 'Không xác định', colorCss: resolveColor(v.color), variants: [], totalStock: 0, worstLevel: 'in_stock' }
      cgMap.set(colorKey, cg)
      pg.colorGroups.push(cg)
    }
    cg.variants.push(v)
    cg.totalStock += v.stock
    if (v.stock === 0) cg.worstLevel = 'out_of_stock'
    else if (v.stock <= LOW_THRESHOLD && cg.worstLevel !== 'out_of_stock') cg.worstLevel = 'low_stock'
  }
  return Array.from(pgMap.values())
}
