'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BadgeCheck,
  Copy,
  Check,
  Landmark,
  Loader2,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button, buttonVariants } from '@/components/ui/button'
import { ApiError } from '@/lib/api/http'
import { formatVND } from '@/lib/utils/format'
import { paymentApi } from '@/features/payment/api'
import type { PaymentInfo, OrderPaymentStatus } from '@/features/payment/types'

// Nhịp hỏi backend xem tiền đã về chưa. 3s đủ nhanh để cảm giác "tức thì"
// mà không tạo tải đáng kể (endpoint chỉ select vài cột).
const POLL_MS = 3_000
// Sau 15 phút không thấy tiền về thì dừng polling, mời khách tự kiểm tra lại.
const POLL_TIMEOUT_MS = 15 * 60_000

export function PaymentView({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [startedAt] = useState(() => Date.now())
  const [expired, setExpired] = useState(false)

  // Thông tin QR — chỉ tải một lần, không đổi trong suốt phiên thanh toán.
  const {
    data: info,
    isLoading: infoLoading,
    error: infoError,
  } = useQuery<PaymentInfo>({
    queryKey: ['payment-info', orderId],
    queryFn: () => paymentApi.getInfo(orderId),
    retry: false, // 400/404 là lỗi nghiệp vụ (đơn COD, đã trả) — không retry
    staleTime: Infinity,
  })

  // Polling trạng thái. Dừng khi đã thanh toán, hết hạn, hoặc QR lỗi.
  const { data: status, isFetching: statusFetching } = useQuery<OrderPaymentStatus>({
    queryKey: ['payment-status', orderId],
    queryFn: () => paymentApi.getStatus(orderId),
    enabled: !!info && !expired,
    refetchInterval: (query) => (query.state.data?.isPaid ? false : POLL_MS),
    // Ghi đè staleTime mặc định (3 phút) của QueryClient — polling cần luôn fetch mới
    staleTime: 0,
  })

  const isPaid = status?.isPaid ?? false

  // Hết thời gian chờ → ngừng polling để không gọi API vô hạn khi khách bỏ tab mở.
  useEffect(() => {
    if (isPaid) return
    const remain = POLL_TIMEOUT_MS - (Date.now() - startedAt)
    const timer = setTimeout(() => setExpired(true), Math.max(0, remain))
    return () => clearTimeout(timer)
  }, [isPaid, startedAt])

  // Tiền đã về → chuyển sang trang chi tiết đơn sau 2s cho khách kịp đọc thông báo.
  useEffect(() => {
    if (!isPaid) return
    const timer = setTimeout(() => router.replace(`/orders/${orderId}`), 2_000)
    return () => clearTimeout(timer)
  }, [isPaid, orderId, router])

  if (infoLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-gray-500">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin" />
          Đang tạo mã thanh toán...
        </div>
      </div>
    )
  }

  if (infoError || !info) {
    return <PaymentUnavailable orderId={orderId} error={infoError} />
  }

  if (isPaid) {
    return <PaymentSucceeded orderId={orderId} amount={info.amount} />
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-800">Thanh toán chuyển khoản</h1>
        <p className="text-sm text-gray-500">
          Quét mã QR bằng ứng dụng ngân hàng. Đơn sẽ tự động xác nhận ngay khi
          chúng tôi nhận được tiền — bạn không cần bấm gì thêm.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        {/* QR */}
        <div className="rounded-xl bg-white p-4 text-center ring-1 ring-border">
          <div className="relative mx-auto aspect-square w-full max-w-[240px]">
            <Image
              src={info.qrUrl}
              alt={`Mã QR thanh toán đơn ${info.content}`}
              fill
              sizes="240px"
              className="object-contain"
              unoptimized // ảnh QR sinh động theo số tiền, tối ưu lại không có lợi
              priority
            />
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Hỗ trợ mọi ứng dụng ngân hàng có quét VietQR
          </p>
        </div>

        {/* Thông tin chuyển khoản thủ công */}
        <div className="space-y-4 rounded-xl bg-white p-5 ring-1 ring-border">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Landmark className="h-4 w-4 text-gray-400" />
            Hoặc chuyển khoản thủ công
          </div>

          <dl className="space-y-3">
            <CopyRow label="Ngân hàng" value={info.bankId} copyable={false} />
            <CopyRow label="Số tài khoản" value={info.accountNo} />
            <CopyRow label="Chủ tài khoản" value={info.accountName} copyable={false} />
            <CopyRow label="Số tiền" value={String(info.amount)} display={formatVND(info.amount)} />
            <CopyRow label="Nội dung" value={info.content} highlight />
          </dl>

          <div className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Nhập <strong>đúng nội dung</strong> và <strong>đúng số tiền</strong>.
              Sai một trong hai, đơn sẽ không tự xác nhận và cần nhân viên đối
              soát thủ công.
            </p>
          </div>
        </div>
      </div>

      {/* Trạng thái chờ */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-5 py-4 ring-1 ring-border">
        {expired ? (
          <>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <TriangleAlert className="h-4 w-4 text-amber-500" />
              Đã dừng kiểm tra tự động. Nếu bạn vừa chuyển khoản, hãy kiểm tra lại.
            </div>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4" />
              Kiểm tra lại
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--color-primary)]" />
              Đang chờ nhận tiền...
              {statusFetching && <span className="text-xs text-gray-400">(đang kiểm tra)</span>}
            </div>
            <Link
              href={`/orders/${orderId}`}
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              Xem chi tiết đơn
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Màn hình phụ ─────────────────────────────────────────────────────────────

function PaymentSucceeded({ orderId, amount }: { orderId: string; amount: number }) {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="max-w-sm space-y-4 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50">
          <BadgeCheck className="h-8 w-8 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Thanh toán thành công</h1>
          <p className="mt-1 text-sm text-gray-500">
            Chúng tôi đã nhận được {formatVND(amount)}. Đơn hàng đang được xác nhận.
          </p>
        </div>
        <Link href={`/orders/${orderId}`} className={buttonVariants({ size: 'lg' })}>
          Xem đơn hàng
        </Link>
        <p className="text-xs text-gray-400">Đang tự động chuyển...</p>
      </div>
    </div>
  )
}

// Đơn COD, đơn đã thanh toán, hoặc đơn không tồn tại đều rơi vào đây —
// backend trả 400/404 kèm message cụ thể nên hiển thị thẳng message đó.
function PaymentUnavailable({ orderId, error }: { orderId: string; error: unknown }) {
  const message =
    error instanceof ApiError ? error.message : 'Không tạo được mã thanh toán'

  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="max-w-sm space-y-4 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-50">
          <TriangleAlert className="h-8 w-8 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Không thể thanh toán</h1>
          <p className="mt-1 text-sm text-gray-500">{message}</p>
        </div>
        <Link href={`/orders/${orderId}`} className={buttonVariants({ size: 'lg' })}>
          Xem đơn hàng
        </Link>
      </div>
    </div>
  )
}

// ─── Dòng thông tin có nút copy ───────────────────────────────────────────────

function CopyRow({
  label,
  value,
  display,
  copyable = true,
  highlight = false,
}: {
  label: string
  value: string
  /** Text hiển thị nếu khác giá trị được copy (vd: số tiền đã format) */
  display?: string
  copyable?: boolean
  highlight?: boolean
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1_500)
    return () => clearTimeout(timer)
  }, [copied])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      /* trình duyệt chặn clipboard — khách vẫn đọc và gõ tay được */
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed pb-3 last:border-0 last:pb-0">
      <dt className="text-xs uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="flex items-center gap-2">
        <span
          className={
            highlight
              ? 'font-mono text-sm font-bold text-[var(--color-primary)]'
              : 'text-sm font-medium text-gray-800'
          }
        >
          {display ?? value}
        </span>
        {copyable && (
          <button
            type="button"
            onClick={handleCopy}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label={`Sao chép ${label}`}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </dd>
    </div>
  )
}
