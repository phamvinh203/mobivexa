import { PackageOpen } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function EmptyState() {
  return (
    <Card className="py-20 text-center">
      <CardContent>
        <PackageOpen className="mx-auto mb-3 h-14 w-14 text-gray-300" aria-hidden />
        <div className="font-semibold text-gray-600">Chưa có sản phẩm nào</div>
        <div className="mt-1 text-sm text-gray-400">
          Chạy{' '}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
            npm run seed
          </code>{' '}
          ở backend để nạp dữ liệu mẫu.
        </div>
      </CardContent>
    </Card>
  )
}
