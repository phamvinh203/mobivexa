import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { RouteGuard } from '@/components/layout/route-guard'
import { OrderDetail } from './_components/order-detail'

export const metadata: Metadata = {
  title: 'Chi tiết đơn hàng · Mobivexa',
}

export default async function MyOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <RouteGuard>
      <div className="bg-[#f2f5f6] pb-10">
        <div className="mx-auto max-w-[1280px] px-6 py-6">
          <nav aria-label="Breadcrumb" className="mb-4">
            <ol className="flex items-center gap-1 text-sm text-muted-foreground">
              <li>
                <Link href="/" className="hover:text-[var(--color-primary)]">
                  Trang chủ
                </Link>
              </li>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              <li>
                <Link href="/orders" className="hover:text-[var(--color-primary)]">
                  Đơn hàng của tôi
                </Link>
              </li>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              <li aria-current="page" className="font-medium text-gray-700">
                Chi tiết
              </li>
            </ol>
          </nav>

          <OrderDetail id={id} />
        </div>
      </div>
    </RouteGuard>
  )
}
