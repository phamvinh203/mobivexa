'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api/http'
import { adminOrderApi } from '@/features/orders/api'
import type { Order } from '@/features/orders/types'
import { OrderStatus } from '@/types/api'

interface CancelOrderModalProps {
  order: Order
  onClose: () => void
  onSaved: (updated: Order) => void
}

export function CancelOrderModal({ order, onClose, onSaved }: CancelOrderModalProps) {
  const [reason, setReason] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    // Backend yêu cầu cancelReason không rỗng khi CANCELLED — validate client trước
    // để tránh 400 (thay vì dùng prompt() không validate được).
    if (reason.trim().length < 3) {
      setError('Vui lòng nhập lý do huỷ (tối thiểu 3 ký tự)')
      return
    }

    setSubmitting(true)
    try {
      const updated = await adminOrderApi.updateStatus(order.id, {
        status: OrderStatus.CANCELLED,
        cancelReason: reason.trim(),
      })
      onSaved(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Huỷ đơn thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog title={`Huỷ đơn ${order.orderCode}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="reason">
            Lý do huỷ <span className="text-[var(--color-danger)]">*</span>
          </Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Khách yêu cầu huỷ, hết hàng, sai thông tin..."
            rows={3}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">Lý do sẽ hiển thị cho khách hàng và hoàn lại tồn kho.</p>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" size="lg" onClick={onClose}>
            Đóng
          </Button>
          <Button type="submit" variant="destructive" size="lg" disabled={submitting}>
            {submitting ? 'Đang huỷ...' : 'Xác nhận huỷ'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
