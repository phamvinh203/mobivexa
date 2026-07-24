import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { RouteGuard } from '@/components/layout/route-guard'
import { CartView } from './_components/cart-view'

export const metadata: Metadata = {
  title: 'Giỏ hàng · Mobivexa',
}

export default function CartPage() {
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
              <li aria-current="page" className="font-medium text-gray-700">
                Giỏ hàng
              </li>
            </ol>
          </nav>

          <h1 className="mb-5 text-2xl font-bold text-gray-900">Giỏ hàng</h1>

          <CartView />
        </div>
      </div>
    </RouteGuard>
  )
}
