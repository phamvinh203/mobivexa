import { ReviewStatus } from '../generated/prisma/client'

export interface CreateReviewBody {
  rating: number
  content: string
}

export interface UpdateReviewBody {
  rating?: number
  content?: string
}

export interface ReviewListQuery {
  rating?: string         // '1' | '2' | '3' | '4' | '5'
  hasPhoto?: string       // 'true'
  sort?: string           // 'newest' | 'helpful'
  page?: string
  limit?: string
}

export interface AdminReviewListQuery {
  status?: ReviewStatus
  rating?: string
  productId?: string
  page?: string
  limit?: string
}

export interface UpdateReviewStatusBody {
  status: ReviewStatus
}

export interface ReplyReviewBody {
  content: string
}
