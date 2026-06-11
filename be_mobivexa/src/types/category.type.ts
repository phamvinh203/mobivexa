export interface CreateCategoryBody {
  name: string
  slug?: string
  description?: string
  parentId?: string | null
  sortOrder?: number
  isActive?: boolean
}

export type UpdateCategoryBody = Partial<CreateCategoryBody>
