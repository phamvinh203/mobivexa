import { productApi } from '@/features/products/api'
import { categoryApi } from '@/features/categories/api'
import { brandApi } from '@/features/brands/api'
import { tagApi } from '@/features/tags/api'
import type { Product } from '@/features/products/types'
import type { FacetData } from '@/components/product/filter-panel'
import type { PaginationMeta } from '@/types/api'
import type { ProductFilters } from './filters'

/**
 * Backend public KHÔNG lọc được isFeatured (product.service.ts chỉ xử lý
 * isFeatured trong nhánh admin), nên ?featured=true phải đi qua endpoint riêng
 * /products/featured. Endpoint đó trả tối đa 8 sản phẩm và không phân trang.
 */
async function loadProducts(
  filters: ProductFilters,
): Promise<{ products: Product[]; pagination: PaginationMeta }> {
  if (filters.featured) {
    const products = await productApi.featured()
    return {
      products,
      pagination: {
        page: 1,
        limit: products.length || 1,
        total: products.length,
        totalPages: 1,
      },
    }
  }

  return productApi.listPaged({
    page: filters.page,
    search: filters.search,
    category: filters.category,
    brand: filters.brand,
    tag: filters.tag,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    sort: filters.sort,
  })
}

export interface BrowseData {
  products: Product[]
  pagination: PaginationMeta
  facets: FacetData
  loadFailed: boolean
}

/**
 * Nạp dữ liệu cho trang duyệt sản phẩm. Facet (danh mục/hãng/nhãn) hỏng thì vẫn
 * phải hiện được lưới sản phẩm → allSettled thay vì all.
 */
export async function loadBrowseData(filters: ProductFilters): Promise<BrowseData> {
  const [productsR, categoriesR, brandsR, tagsR] = await Promise.allSettled([
    loadProducts(filters),
    categoryApi.list(),
    brandApi.list(),
    tagApi.list(),
  ])

  const { products, pagination } =
    productsR.status === 'fulfilled'
      ? productsR.value
      : {
          products: [] as Product[],
          pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
        }

  return {
    products,
    pagination,
    facets: {
      categories: categoriesR.status === 'fulfilled' ? categoriesR.value : [],
      brands: brandsR.status === 'fulfilled' ? brandsR.value : [],
      tags: tagsR.status === 'fulfilled' ? tagsR.value : [],
    },
    loadFailed: productsR.status === 'rejected',
  }
}
