# Activity Diagram
## Module: Inventory
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 1.0 | **Ngày:** 2026-08-22

---

## AD-01: Xem tồn kho (tổng quan)

```mermaid
flowchart TD
    Start([Staff/Admin gửi GET /admin/inventory]) --> Auth{role STAFF+?}
    Auth -- Không --> E403[403 Forbidden]
    Auth -- Có --> Parse[parsePagination\nLIMITS.INVENTORY / MAX_INVENTORY]
    Parse --> Threshold[threshold = max 1, lowThreshold hoặc 5 ]
    Threshold --> SummaryCache{Cache còn hiệu lực\nvà threshold khớp?}
    SummaryCache -- Có --> UseCachedSummary[Dùng cache summary]
    SummaryCache -- Không --> CalcSummary[Tính lại Summary\nqua 3 query song song\naggregate + count outOfStock + count lowStock]
    CalcSummary --> SaveCache[Lưu cache + expiresAt = now + 60s]
    UseCachedSummary & SaveCache --> BuildWhere[Build WHERE từ filter]
    BuildWhere --> HasSearch{Có search?}
    HasSearch -- Có --> FTS[FTS: SELECT id FROM products\nWHERE tsvector @@ tsquery]
    FTS --> FTSResult{Có productId nào?}
    FTSResult -- Không --> EmptyResult[Trả kết quả rỗng\nvới summary]
    FTSResult -- Có --> AddProductIdFilter[WHERE productId IN ids]
    HasSearch -- Không --> SkipFTS[Bỏ qua]
    AddProductIdFilter & SkipFTS --> BrandFilter{Có brandSlug?}
    BrandFilter -- Có --> AddBrand[WHERE product.brand.slug = ?]
    BrandFilter -- Không --> SkipBrand[Bỏ qua]
    AddBrand & SkipBrand --> StockFilter{Có stockStatus?}
    StockFilter -- out_of_stock --> AddOut[WHERE stock = 0]
    StockFilter -- low_stock --> AddLow[WHERE 0 < stock <= threshold]
    StockFilter -- in_stock --> AddIn[WHERE stock > threshold]
    StockFilter -- Không --> SkipStock[Bỏ qua]
    AddOut & AddLow & AddIn & SkipStock --> ParallelQuery[Song song:\nfindMany stock ASC\n+ count variants\n+ await summaryPromise]
    ParallelQuery --> R200[200 variants + summary + threshold + pagination]
```

---

## AD-02: In-memory Cache cho Summary

```mermaid
flowchart TD
    Call([getInventorySummary threshold ]) --> CheckCache{cache tồn tại\nvà threshold === cache.threshold\nvà now < cache.expiresAt?}
    CheckCache -- Có --> Return[Trả cache.data]
    CheckCache -- Không --> Query[3 query song song:\naggregate totalVariants + totalStock\ncount outOfStock stock=0\ncount lowStock 0<stock≤threshold]
    Query --> Build[Dựng InventorySummary object]
    Build --> Save[inventorySummaryCache = data, expiresAt=now+60s ]
    Save --> Return2[Trả data]
```
