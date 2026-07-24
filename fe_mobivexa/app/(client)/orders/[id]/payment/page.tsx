import { RouteGuard } from '@/components/layout/route-guard'
import { PaymentView } from './_components/payment-view'

export default async function OrderPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <RouteGuard>
      <div className="max-w-[900px] mx-auto px-6 py-8">
        <PaymentView orderId={id} />
      </div>
    </RouteGuard>
  )
}
