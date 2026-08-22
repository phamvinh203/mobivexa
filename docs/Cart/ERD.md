# ERD — Entity Relationship Diagram
## Module: Cart
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## 1. Sơ đồ ERD

```mermaid
erDiagram
    USER {
        string id PK
    }

    CART {
        string   id        PK
        string   userId    UK "1 user 1 giỏ"
        datetime createdAt
        datetime updatedAt
    }

    CART_ITEM {
        string   id        PK
        string   cartId
        string   variantId
        int      quantity  "default 1; max 100 (validator)"
        datetime createdAt
        datetime updatedAt
    }

    PRODUCT_VARIANT {
        string  id       PK
        string  sku
        string  color    "nullable"
        string  storage  "nullable"
        string  ram      "nullable"
        decimal price
        decimal salePrice
        int     stock
        boolean isActive
        string  productId
    }

    PRODUCT {
        string  id   PK
        string  name
        string  slug
    }

    PRODUCT_IMAGE {
        string  id        PK
        string  productId
        string  url
        boolean isCover
    }

    USER             ||--|| CART          : "có giỏ hàng (1:1)"
    CART             ||--o{ CART_ITEM     : "chứa items (1:N Cascade)"
    CART_ITEM        }o--|| PRODUCT_VARIANT : "tham chiếu variant (N:1 Cascade)"
    PRODUCT_VARIANT  }o--|| PRODUCT        : "thuộc product (N:1)"
    PRODUCT          ||--o{ PRODUCT_IMAGE  : "có ảnh (1:N)"
```

---

## 2. Mô tả model

### Cart

| Cột | Ghi chú |
|---|---|
| `userId` | UNIQUE — 1 user chỉ có 1 giỏ; `upsert` tự tạo khi chưa có |

`onDelete: Cascade` từ User

### CartItem

| Cột | Ghi chú |
|---|---|
| `@@unique([cartId, variantId])` | Chặn trùng variant trong giỏ; dùng làm lookup key khi add |
| `onDelete: Cascade` từ Cart | Xóa Cart → xóa hết items |
| `onDelete: Cascade` từ ProductVariant | Xóa variant → xóa khỏi giỏ |

---

## 3. CART_INCLUDE (dùng cho GET /cart)

```
Cart {
  items (orderBy: createdAt ASC) {
    id, cartId, variantId, quantity, createdAt, updatedAt
    variant {
      id, sku, color, storage, ram, price, salePrice, stock, isActive, imageUrl
      product {
        id, name, slug
        images (where: isCover=true, take:1) { url }
      }
    }
  }
}
```

---

## 4. fetchCartSummary (dùng cho mutations)

```
cartItem.count WHERE cartId
→ { cartId, itemCount }
```

> Lean response sau mutations: FE chỉ cần `itemCount` để update badge đầu trang, không cần reload toàn bộ giỏ.
