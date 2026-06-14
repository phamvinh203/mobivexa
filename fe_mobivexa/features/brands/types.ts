export interface Brand {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count?: { products: number }
}

export interface BrandPayload {
  name: string
  slug?: string
  description?: string
  isActive?: boolean
}
