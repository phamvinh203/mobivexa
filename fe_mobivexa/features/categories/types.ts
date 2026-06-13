export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  imageUrl: string | null
  parentId: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  children?: Category[]
  _count?: { products: number }
}

export interface CategoryPayload {
  name: string
  description?: string
  parentId?: string | null
  sortOrder?: number
}
