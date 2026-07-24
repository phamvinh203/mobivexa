import type { ProductVariant } from '@/features/products/types'

/** Các trục phân loại của 1 variant. Thứ tự trong mảng = thứ tự hiển thị. */
export const VARIANT_DIMENSIONS = ['storage', 'ram', 'color'] as const
export type VariantDimension = (typeof VARIANT_DIMENSIONS)[number]

export const DIMENSION_LABEL: Record<VariantDimension, string> = {
  storage: 'Dung lượng',
  ram: 'RAM',
  color: 'Màu sắc',
}

/** Lựa chọn hiện tại trên từng trục (undefined = chưa chọn). */
export type VariantSelection = Partial<Record<VariantDimension, string>>

export interface DimensionGroup {
  dimension: VariantDimension
  label: string
  values: string[]
}

/**
 * Dựng danh sách trục cần hiển thị từ tập variant.
 * Chỉ giữ trục có ít nhất 1 giá trị khác null — sản phẩm chỉ khác nhau về màu
 * thì không hiện ô "Dung lượng" rỗng.
 */
export function buildDimensions(variants: ProductVariant[]): DimensionGroup[] {
  const groups: DimensionGroup[] = []

  for (const dimension of VARIANT_DIMENSIONS) {
    // Set giữ thứ tự insert → variants đã sort theo giá tăng dần nên giá trị
    // rẻ nhất đứng trước, khớp kỳ vọng "chọn mặc định là bản rẻ nhất".
    const values = new Set<string>()
    for (const v of variants) {
      const value = v[dimension]
      if (value) values.add(value)
    }
    if (values.size > 0) {
      groups.push({
        dimension,
        label: DIMENSION_LABEL[dimension],
        values: [...values],
      })
    }
  }

  return groups
}

/** Variant khớp đúng toàn bộ lựa chọn hiện tại (null nếu không có). */
export function matchVariant(
  variants: ProductVariant[],
  dimensions: DimensionGroup[],
  selection: VariantSelection,
): ProductVariant | null {
  return (
    variants.find((v) =>
      dimensions.every((g) => (v[g.dimension] ?? undefined) === selection[g.dimension]),
    ) ?? null
  )
}

/**
 * Một giá trị còn chọn được không, xét theo các trục KHÁC đang chọn.
 * Ví dụ đã chọn "256GB" thì màu nào không có bản 256GB sẽ bị disable.
 */
export function isValueAvailable(
  variants: ProductVariant[],
  dimensions: DimensionGroup[],
  selection: VariantSelection,
  dimension: VariantDimension,
  value: string,
): boolean {
  return variants.some(
    (v) =>
      v[dimension] === value &&
      dimensions.every(
        (g) =>
          g.dimension === dimension ||
          selection[g.dimension] === undefined ||
          (v[g.dimension] ?? undefined) === selection[g.dimension],
      ),
  )
}

/** Có bản nào còn hàng ứng với giá trị này không — dùng để làm mờ chip hết hàng. */
export function isValueInStock(
  variants: ProductVariant[],
  dimensions: DimensionGroup[],
  selection: VariantSelection,
  dimension: VariantDimension,
  value: string,
): boolean {
  return variants.some(
    (v) =>
      v[dimension] === value &&
      v.stock > 0 &&
      dimensions.every(
        (g) =>
          g.dimension === dimension ||
          selection[g.dimension] === undefined ||
          (v[g.dimension] ?? undefined) === selection[g.dimension],
      ),
  )
}

/** Suy ra lựa chọn từ 1 variant cụ thể. */
export function selectionOf(
  variant: ProductVariant,
  dimensions: DimensionGroup[],
): VariantSelection {
  const selection: VariantSelection = {}
  for (const g of dimensions) {
    const value = variant[g.dimension]
    if (value) selection[g.dimension] = value
  }
  return selection
}

/** Variant mặc định: rẻ nhất mà còn hàng, không có thì lấy rẻ nhất. */
export function defaultVariant(variants: ProductVariant[]): ProductVariant | null {
  return variants.find((v) => v.stock > 0) ?? variants[0] ?? null
}

/**
 * Đổi 1 trục sang giá trị mới rồi "hàn" lại các trục còn lại cho hợp lệ.
 * Nếu tổ hợp cũ không tồn tại (vd đổi sang 512GB mà màu Hồng không có bản 512GB),
 * nhả dần các trục sau cho khớp variant gần nhất thay vì để người dùng kẹt.
 */
export function reconcileSelection(
  variants: ProductVariant[],
  dimensions: DimensionGroup[],
  selection: VariantSelection,
  dimension: VariantDimension,
  value: string,
): VariantSelection {
  const next: VariantSelection = { ...selection, [dimension]: value }
  if (matchVariant(variants, dimensions, next)) return next

  // Ưu tiên giữ trục vừa bấm, ưu tiên bản còn hàng và rẻ nhất trong số khớp.
  const candidates = variants.filter((v) => v[dimension] === value)
  const best = candidates.find((v) => v.stock > 0) ?? candidates[0]
  return best ? selectionOf(best, dimensions) : next
}
