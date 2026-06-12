import Redis from 'ioredis'

// Redis là optional — nếu không set REDIS_URL thì cache bị bỏ qua, app vẫn chạy bình thường
const REDIS_URL = process.env.REDIS_URL

let redis: Redis | null = null

if (REDIS_URL) {
  redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
  })

  redis.on('connect', () => console.log('[Redis] Connected'))
  redis.on('error', (err) => {
    console.warn('[Redis] Connection error — cache disabled:', err.message)
    redis = null
  })
}

export default redis
