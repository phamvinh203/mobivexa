import { http } from '@/lib/api/http'
import type { Tag, TagPayload } from './types'

// Khớp src/routes/tag.route.ts. Backend bọc { tags } / { tag } → unwrap tại đây.
export const tagApi = {
  // Public: /tags — cache 5 phút (tag rất ít đổi)
  list: () =>
    http.get<{ tags: Tag[] }>('/tags', { auth: false, revalidate: 300 }).then((r) => r.tags ?? []),
}

// Admin: /admin/tags (STAFF + ADMIN)
export const adminTagApi = {
  list: () =>
    http.get<{ tags: Tag[] }>('/admin/tags').then((r) => r.tags ?? []),

  create: (body: TagPayload) =>
    http.post<{ tag: Tag }>('/admin/tags', body).then((r) => r.tag),

  remove: (id: string) =>
    http.delete<{ message: string }>(`/admin/tags/${id}`),
}
