import redis from '../config/redis'

export const TTL = {
  PRODUCT_LIST:     5 * 60,   // 5 phút — list thay đổi khi admin sửa
  PRODUCT_DETAIL:   5 * 60,   // 5 phút
  PRODUCT_FEATURED: 10 * 60,  // 10 phút — ít thay đổi hơn
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null
  try {
    const raw = await redis.get(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!redis) return
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value))
  } catch {
    // cache failure không được ảnh hưởng đến response
  }
}

// Xóa tất cả keys khớp pattern (dùng SCAN thay KEYS để an toàn với production)
export async function cacheBust(pattern: string): Promise<void> {
  if (!redis) return
  try {
    let cursor = '0'
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
      cursor = next
      if (keys.length > 0) await redis.del(...keys)
    } while (cursor !== '0')
  } catch {
    // silent
  }
}
