export interface CreateBrandBody {
  name: string
  slug?: string
  description?: string
  isActive?: boolean
}

export type UpdateBrandBody = Partial<CreateBrandBody>
