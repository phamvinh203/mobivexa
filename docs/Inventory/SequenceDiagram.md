# Sequence Diagram — Luồng API
## Module: Inventory
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22

---

## SD-01: Xem tồn kho (không có filter)

```mermaid
sequenceDiagram
    autonumber
    participant S as Staff
    participant Auth as Middleware Auth
    participant Svc as ProductService (getInventory)
    participant Cache as In-memory Cache
    participant DB as PostgreSQL

    S->>Auth: GET /api/admin/inventory
    Auth-->>S: 401/403 nếu không có quyền STAFF+
    Auth->>Svc: getInventory(query)

    Svc->>Svc: parsePagination, threshold = 5

    Svc->>Cache: getInventorySummary(threshold=5)
    alt Cache còn hiệu lực
        Cache-->>Svc: InventorySummary (cached)
    else Cache hết hạn hoặc null
        par 3 query song song
            Cache->>DB: aggregate: _count.id, _sum.stock
            DB-->>Cache: { totalVariants, totalStock }
        and
            Cache->>DB: count WHERE stock = 0
            DB-->>Cache: outOfStock
        and
            Cache->>DB: count WHERE 0 < stock <= 5
            DB-->>Cache: lowStock
        end
        Cache->>Cache: Lưu cache, expiresAt = now + 60s
        Cache-->>Svc: InventorySummary
    end

    par Song song
        Svc->>DB: productVariant.findMany ORDER BY stock ASC LIMIT page/limit
        DB-->>Svc: variants[]
    and
        Svc->>DB: productVariant.count
        DB-->>Svc: total
    end

    Svc-->>S: 200 { variants, summary + threshold, pagination }
```

---

## SD-02: Xem tồn kho với Full Text Search

```mermaid
sequenceDiagram
    autonumber
    participant S as Staff
    participant Svc as ProductService
    participant DB as PostgreSQL

    S->>Svc: GET /api/admin/inventory?search=iPhone
    Svc->>Svc: toTsQuery("iPhone") → "iPhone:*" hoặc tương tự
    Svc->>Svc: Khởi động getInventorySummary song song

    alt tsQuery rỗng (không có token hợp lệ)
        Svc-->>S: 200 { variants: [], summary, pagination: total=0 }
    else tsQuery hợp lệ
        Svc->>DB: $queryRaw SELECT id FROM products WHERE tsvector @@ tsquery
        DB-->>Svc: productIds[]

        alt productIds rỗng
            Svc-->>S: 200 { variants: [], summary, pagination: total=0 }
        else có productIds
            Svc->>Svc: WHERE productId IN productIds
            par
                Svc->>DB: findMany variants (với FTS filter) ORDER BY stock ASC
                DB-->>Svc: variants[]
            and
                Svc->>DB: count variants
                DB-->>Svc: total
            and
                Svc->>DB: await summaryPromise
                DB-->>Svc: summary
            end
            Svc-->>S: 200 { variants, summary, pagination }
        end
    end
```

---

## SD-03: Lọc low_stock với ngưỡng tùy chỉnh

```mermaid
sequenceDiagram
    autonumber
    participant S as Staff
    participant Svc as ProductService
    participant DB as PostgreSQL

    S->>Svc: GET /api/admin/inventory?stockStatus=low_stock&lowThreshold=10
    Svc->>Svc: threshold = max(1, 10) = 10
    Note over Svc: Cache key = threshold=10 (khác cache threshold=5)

    Svc->>DB: getInventorySummary(threshold=10)
    Note over DB: count lowStock WHERE 0 < stock <= 10

    Svc->>DB: findMany WHERE 0 < stock <= 10 ORDER BY stock ASC
    Svc->>DB: count WHERE 0 < stock <= 10

    DB-->>Svc: variants[], total, summary

    Svc-->>S: 200 { variants (tồn thấp theo ngưỡng 10), summary, pagination }
```
