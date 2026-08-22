# Activity Diagram
## Module: Favorite
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22

---

## AD-01: Thêm yêu thích

```mermaid
flowchart TD
    Start([Customer gửi POST /favorites]) --> Auth{Đã đăng nhập?}
    Auth -- Không --> E401[401 Unauthorized]
    Auth -- Có --> ValidateId{productId hợp lệ?}
    ValidateId -- Không --> E400[400 productId không hợp lệ]
    ValidateId -- Có --> FindProduct[product.findUnique productId\nSELECT isActive]
    FindProduct --> ActiveCheck{product tồn tại\nvà isActive=true?}
    ActiveCheck -- Không --> E404[404 Sản phẩm không tồn tại\nhoặc đã ngừng bán]
    ActiveCheck -- Có --> Create[favorite.create\n userId, productId ]
    Create -- P2002 đã thích rồi --> RFalse[200 created: false]
    Create -- OK --> RTrue[200 created: true]
```

---

## AD-02: Bỏ yêu thích

```mermaid
flowchart TD
    Start([Customer gửi DELETE /favorites/:productId]) --> Auth{Đã đăng nhập?}
    Auth -- Không --> E401[401]
    Auth -- Có --> Delete[favorite.deleteMany\n where userId + productId ]
    Delete --> R200[200 OK\n count=0 cũng không lỗi ]
```

---

## AD-03: Xem danh sách yêu thích

```mermaid
flowchart TD
    Start([Customer gửi GET /favorites]) --> Auth{Đã đăng nhập?}
    Auth -- Không --> E401[401]
    Auth -- Có --> Paginate[parsePagination page, limit]
    Paginate --> Query[favorite.findMany\nwhere userId + product.isActive=true\norderBy createdAt DESC\nselect FAVORITE_PRODUCT_SELECT]
    Query --> Count[favorite.count cùng where]
    Count --> R200[200 favorites + pagination]
```

---

## AD-04: Lấy danh sách ID yêu thích

```mermaid
flowchart TD
    Start([Customer gửi GET /favorites/ids]) --> Auth{Đã đăng nhập?}
    Auth -- Không --> E401[401]
    Auth -- Có --> Query[favorite.findMany\nwhere userId\nselect productId only]
    Query --> Map[map rows → productId array]
    Map --> R200[200 ids: string array ]
```

---

## AD-05: Sản phẩm bị ẩn (Admin tắt)

```mermaid
flowchart TD
    Trigger([Admin đặt product.isActive=false]) --> DB[(Favorite record GIỮ NGUYÊN)]
    DB --> GetList[Customer GET /favorites]
    GetList --> Filter[WHERE product.isActive=true → lọc ra]
    Filter --> Hidden[Sản phẩm không xuất hiện]
    Hidden --> AdminOn([Admin bật lại isActive=true])
    AdminOn --> Show[Tự động hiện lại\nKhách không cần thích lại]
```
