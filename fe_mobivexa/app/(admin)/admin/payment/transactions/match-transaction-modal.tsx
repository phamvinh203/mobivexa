'use client'

import { useState, type FormEvent } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api/http'
import { formatVND, formatDateTime } from '@/lib/utils/format'
import { adminPaymentApi } from '@/features/payment/api'
import type { SePayTransaction } from '@/features/payment/types'

// Backend validate cùng định dạng này (payment.validator.ts) — check trước ở
// client để khỏi tốn một vòng 400.
const ORDER_CODE_RE = /^ORD-\d{8}-[0-9A-F]{6}$/i

interface MatchTransactionModalProps {
  tx: SePayTransaction
  onClose: () => void
  onSaved: (updated: SePayTransaction) => void
}

export function MatchTransactionModal({ tx, onClose, onSaved }: MatchTransactionModalProps) {
  // Nếu backend đã đoán được mã đơn (đúng mã nhưng lệch tiền) thì điền sẵn.
  const [orderCode, setOrderCode] = useState(tx.orderCode ?? '')
  const [force, setForce] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    const code = orderCode.trim().toUpperCase()
    if (!ORDER_CODE_RE.test(code)) {
      setError('Mã đơn không đúng định dạng (ORD-YYYYMMDD-XXXXXX)')
      return
    }

    setSubmitting(true)
    try {
      const updated = await adminPaymentApi.match(tx.id, { orderCode: code, force })
      onSaved(updated)
    } catch (err) {
      // 400 "Số tiền lệch..." → gợi ý bật cờ force thay vì bắt admin đoán
      const message = err instanceof ApiError ? err.message : 'Gán giao dịch thất bại'
      setError(message)
      if (err instanceof ApiError && err.status === 400 && /lệch/i.test(message)) {
        setForce(true)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog title="Gán giao dịch vào đơn hàng" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>
        )}

        {/* Tóm tắt giao dịch để admin đối chiếu trước khi gán */}
        <dl className="space-y-2 rounded-lg bg-gray-50 px-3 py-3 text-sm">
          <Row label="Thời gian" value={formatDateTime(tx.transactionDate)} />
          <Row label="Số tiền" value={formatVND(tx.transferAmount)} strong />
          <Row label="Ngân hàng" value={tx.gateway} />
          <Row label="Nội dung CK" value={tx.content || '—'} />
          {tx.note && <Row label="Lý do chưa khớp" value={tx.note} />}
        </dl>

        <div className="space-y-1.5">
          <Label htmlFor="orderCode">
            Mã đơn hàng <span className="text-[var(--color-danger)]">*</span>
          </Label>
          <Input
            id="orderCode"
            value={orderCode}
            onChange={(e) => setOrderCode(e.target.value)}
            placeholder="ORD-20240101-AABBCC"
            className="font-mono uppercase"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Đơn sẽ được đánh dấu đã thanh toán với thời điểm của giao dịch này.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-amber-50 px-3 py-2.5">
          <input
            type="checkbox"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-amber-600"
          />
          <span className="text-xs text-amber-800">
            <span className="flex items-center gap-1 font-medium">
              <TriangleAlert className="h-3.5 w-3.5" />
              Chấp nhận lệch số tiền
            </span>
            Chỉ tick khi khách chuyển thừa/thiếu mà bạn vẫn muốn ghi nhận đơn là
            đã thanh toán.
          </span>
        </label>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" size="lg" onClick={onClose}>
            Đóng
          </Button>
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? 'Đang gán...' : 'Xác nhận gán'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-xs uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className={`text-right ${strong ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
        {value}
      </dd>
    </div>
  )
}
