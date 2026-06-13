import { RouteGuard } from '@/components/layout/route-guard'
import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default function CheckoutPage() {
  return (
    <RouteGuard>
      <div className="max-w-[1280px] mx-auto px-6 py-8">
        <PagePlaceholder
          title="Thanh toán"
          endpoint="POST /orders · orderApi.create()"
          todos={[
            'Chọn địa chỉ (userApi.listAddresses)',
            'Chọn phương thức TT: COD / BANK_TRANSFER',
            'Đặt hàng → nếu BANK_TRANSFER thì sang trang QR thanh toán',
          ]}
        />
      </div>
    </RouteGuard>
  )
}
