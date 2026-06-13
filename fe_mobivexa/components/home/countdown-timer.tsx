'use client'

import { useState, useEffect } from 'react'

function getTimeLeft(end: number) {
  const diff = Math.max(0, end - Date.now())
  return {
    h: Math.floor(diff / 3_600_000),
    m: Math.floor((diff % 3_600_000) / 60_000),
    s: Math.floor((diff % 60_000) / 1_000),
  }
}

/** Đồng hồ đếm ngược flash sale. Nhận timestamp (ms) để tránh lỗi serialize Date. */
export function CountdownTimer({ endTime }: { endTime: number }) {
  const [mounted, setMounted] = useState(false)
  const [t, setT] = useState(() => getTimeLeft(endTime))

  useEffect(() => {
    setMounted(true)
    const id = setInterval(() => setT(getTimeLeft(endTime)), 1000)
    return () => clearInterval(id)
  }, [endTime])

  const pad = (n: number) => String(n).padStart(2, '0')
  const cells = [t.h, t.m, t.s].map(pad)

  // Tránh hydration mismatch - chỉ render khi mounted client-side
  if (!mounted) {
    return (
      <div className="flex items-center gap-1.5" aria-label="Thời gian còn lại">
        <span className="text-white/90 font-black text-sm">00:00:00</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5" aria-label="Thời gian còn lại">
      {cells.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && (
            <span className="text-white/90 font-black text-sm">:</span>
          )}
          <span className="inline-flex items-center justify-center rounded-md bg-white/95 px-2 py-1 text-sm font-mono font-black tabular-nums text-[#b4380a] shadow-sm min-w-[28px]">
            {c}
          </span>
        </span>
      ))}
    </div>
  )
}

