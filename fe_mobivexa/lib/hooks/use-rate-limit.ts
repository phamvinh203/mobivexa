'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Giới hạn số lần submit phía client (lớp UX, giảm spam). Backend vẫn enforce
// rate-limit thật (authLimiter 10 req/15 phút) — đây không thay thế được.
export function useRateLimit(maxAttempts = 5, cooldownSec = 30) {
  const [cooldown, setCooldown] = useState(0)
  const attempts = useRef(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [])

  const startCooldown = useCallback(() => {
    setCooldown(cooldownSec)
    timer.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          if (timer.current) clearInterval(timer.current)
          return 0
        }
        return s - 1
      })
    }, 1000)
  }, [cooldownSec])

  // Gọi khi 1 lần thử thất bại — đủ ngưỡng sẽ kích hoạt cooldown
  const registerFailure = useCallback(() => {
    attempts.current += 1
    if (attempts.current >= maxAttempts) {
      attempts.current = 0
      startCooldown()
    }
  }, [maxAttempts, startCooldown])

  const reset = useCallback(() => {
    attempts.current = 0
  }, [])

  return { cooldown, blocked: cooldown > 0, registerFailure, reset }
}
