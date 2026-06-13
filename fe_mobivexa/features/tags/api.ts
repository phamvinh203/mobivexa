import { http } from '@/lib/api/http'
import type { Tag, TagPayload } from './types'

// Khớp src/routes/tag.route.ts
export const tagApi = {
  // Public: /tags
  list: () => http.get<Tag[]>('/tags', { auth: false }),
}

// Admin: /admin/tags (STAFF + ADMIN)
export const adminTagApi = {
  create: (body: TagPayload) => http.post<Tag>('/admin/tags', body),
  remove: (id: string) => http.delete<{ message: string }>(`/admin/tags/${id}`),
}
