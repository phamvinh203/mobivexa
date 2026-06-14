/**
 * Cập nhật lạc quan 1 danh sách: nếu item đã có (theo id) thì thay thế,
 * chưa có thì thêm vào cuối. Dùng cho handleSaved của các trang CRUD admin
 * (categories, brands, banners...) sau khi modal trả về bản ghi vừa lưu.
 */
export function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id)
    ? list.map((x) => (x.id === item.id ? item : x))
    : [...list, item]
}
