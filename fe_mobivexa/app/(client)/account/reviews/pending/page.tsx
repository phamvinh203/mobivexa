import type { Metadata } from 'next'
import { PendingReviews } from './_components/pending-reviews'

export const metadata: Metadata = {
  title: 'Chờ đánh giá · Mobivexa',
}

export default function PendingReviewsPage() {
  return <PendingReviews />
}
