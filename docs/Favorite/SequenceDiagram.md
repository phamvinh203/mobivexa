# Sequence Diagram — Luồng API
## Module: Favorite
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22

---

## SD-01: Thêm yêu thích

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant V as Validator
    participant S as FavoriteService
    participant DB as PostgreSQL

    C->>V: POST /api/favorites { productId }
    V-->>C: 400 nếu productId rỗng/thiếu
    V->>S: addFavorite(userId, productId)

    S->>DB: product.findUnique(productId) SELECT isActive
    DB-->>S: product | null

    alt Không tồn tại hoặc isActive=false
        S-->>C: 404 Sản phẩm không tồn tại hoặc đã ngừng bán
    else OK
        S->>DB: favorite.create({ userId, productId })
        alt P2002 — đã thích rồi
            DB-->>S: UniqueConstraintError
            S-->>C: 200 { created: false }
        else OK
            DB-->>S: Favorite record
            S-->>C: 200 { created: true }
        end
    end
```

---

## SD-02: Bỏ yêu thích

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant S as FavoriteService
    participant DB as PostgreSQL

    C->>S: DELETE /api/favorites/:productId
    S->>DB: favorite.deleteMany WHERE userId + productId
    Note over DB: count=0 nếu chưa từng thích — không lỗi
    DB-->>S: { count: N }
    S-->>C: 200 OK
```

---

## SD-03: Xem danh sách yêu thích

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant S as FavoriteService
    participant DB as PostgreSQL

    C->>S: GET /api/favorites?page=1&limit=20
    S->>S: parsePagination(query, LIMITS.PRODUCT)

    par Song song
        S->>DB: favorite.findMany WHERE userId + product.isActive=true\nORDER BY createdAt DESC\nSELECT createdAt + FAVORITE_PRODUCT_SELECT
        DB-->>S: favorites[]
    and
        S->>DB: favorite.count WHERE userId + product.isActive=true
        DB-->>S: total
    end

    S->>S: paginationMeta(page, limit, total)
    S-->>C: 200 { favorites, pagination }
```

> `FAVORITE_PRODUCT_SELECT` = `{ id, name, slug, brand, variants(active, sortByPrice), images(cover) }` — khớp `listProducts`.

---

## SD-04: Lấy danh sách ID yêu thích

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant S as FavoriteService
    participant DB as PostgreSQL

    C->>S: GET /api/favorites/ids
    S->>DB: favorite.findMany WHERE userId SELECT productId
    DB-->>S: [{ productId }, ...]
    S->>S: map rows → productId[]
    S-->>C: 200 { ids: ["uuid1", "uuid2", ...] }
```

> Không phân trang. FE dùng mảng này để đối chiếu và tô tim trên mọi card.

---

## SD-05: Product bị ẩn — ảnh hưởng đến danh sách

```mermaid
sequenceDiagram
    autonumber
    participant Admin
    participant DB as PostgreSQL
    participant C as Customer

    Admin->>DB: product.update isActive=false
    Note over DB: Favorite record của customer KHÔNG bị xóa
    C->>DB: GET /api/favorites (SD-03)
    Note over DB: WHERE product.isActive=true → product ẩn bị lọc
    DB-->>C: Danh sách không có product đó
    Admin->>DB: product.update isActive=true
    C->>DB: GET /api/favorites
    DB-->>C: Product xuất hiện lại tự động
```
