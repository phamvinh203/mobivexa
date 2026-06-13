export interface Tag {
  id: string
  name: string
  slug: string
  _count?: { productTags: number }
}

export interface TagPayload {
  name: string
}
