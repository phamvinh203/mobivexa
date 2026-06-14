'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DialogProps {
  /** Tiêu đề hiển thị ở header + dùng cho aria-label */
  title: string
  onClose: () => void
  children: ReactNode
  /** Override độ rộng tối đa của panel (mặc định max-w-lg) */
  className?: string
}

/**
 * Modal overlay dùng chung cho admin: click ra ngoài / Esc để đóng, khoá scroll
 * nền, role=dialog. Component cha mount/unmount có điều kiện ({open && <Dialog/>}).
 */
export function Dialog({ title, onClose, children, className }: DialogProps) {
  // Giữ onClose mới nhất trong ref để effect Esc chỉ chạy 1 lần (tránh add/remove
  // listener mỗi lần form re-render theo từng phím gõ).
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn('w-full max-w-lg rounded-xl bg-white shadow-xl', className)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
