import type { Metadata } from 'next'
import { MyReviews } from './_components/my-reviews'

export const metadata: Metadata = {
  title: 'Đánh giá của tôi · Mobivexa',
}

export default function MyReviewsPage() {
  return <MyReviews />
}
