# Activity Diagram
## Module: Cart
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## AD-01: Thêm sản phẩm (addItem)

```mermaid
flowchart TD
    Start([POST /api/cart/items]) --> Auth{Đã đăng nhập?}
    Auth -- Không --> E401[401]
    Auth -- Có --> Validate[validateAddItem\nvariantId checkId\nquantity 1-100]
    Validate --> ValOK{Hợp lệ?}
    ValOK -- Không --> E400[400]
    ValOK -- Có --> Parallel[Song song:\nfindUnique variant id, isActive, stock\ncart.upsert WHERE userId select id]
    Parallel --> Active{variant tồn tại\nvà isActive?}
    Active -- Không --> E404[404 Sản phẩm không tồn tại\nhoặc đã ngừng bán]
    Active -- Có --> StockAdd{stock >= quantity?}
    StockAdd -- Không --> E400b[400 Không đủ hàng\ncòn N]
    StockAdd -- Có --> FindExisting[cartItem.findUnique\nWHERE cartId_variantId]
    FindExisting --> Exists{Đã có trong giỏ?}
    Exists -- Có --> CalcNew[newQty = existing.qty + quantity]
    CalcNew --> StockMerge{newQty <= stock?}
    StockMerge -- Không --> E400c[400 Vượt tồn kho\ncòn N]
    StockMerge -- Có --> Update[cartItem.update\nquantity = newQty]
    Exists -- Không --> Create[cartItem.create\ncartId, variantId, quantity]
    Update & Create --> Summary[fetchCartSummary cartId\ncount CartItem WHERE cartId]
    Summary --> R200[200 cartId, itemCount]
```

---

## AD-02: Cập nhật số lượng (updateItem)

```mermaid
flowchart TD
    Start([PUT /api/cart/items/:itemId]) --> Auth{Đã đăng nhập?}
    Auth -- Không --> E401[401]
    Auth -- Có --> Validate[validateUpdateItem\nquantity 1-100]
    Validate --> ValOK{Hợp lệ?}
    ValOK -- Không --> E400[400]
    ValOK -- Có --> GetCart[getCartOrThrow userId\ncart.findUnique WHERE userId]
    GetCart --> CartExist{Tồn tại?}
    CartExist -- Không --> E404[404 Giỏ hàng không tồn tại]
    CartExist -- Có --> FindItem[findOwnedItem cartId, itemId\ncartItem.findFirst WHERE id AND cartId]
    FindItem --> ItemExist{Tồn tại?}
    ItemExist -- Không --> E404b[404 Không tìm thấy\nsản phẩm trong giỏ]
    ItemExist -- Có --> GetStock[productVariant.findUnique\nWHERE id=item.variantId select stock]
    GetStock --> StockOK{quantity <= stock?}
    StockOK -- Không --> E400b[400 Vượt tồn kho]
    StockOK -- Có --> Update[cartItem.update quantity]
    Update --> Summary[fetchCartSummary]
    Summary --> R200[200 cartId, itemCount]
```

---

## AD-03: Xem giỏ hàng (getCart)

```mermaid
flowchart TD
    Start([GET /api/cart]) --> Auth{Đã đăng nhập?}
    Auth -- Không --> E401[401]
    Auth -- Có --> Upsert[cart.upsert WHERE userId\ncreate nếu chưa có\ninclude CART_INCLUDE]
    Upsert --> R200[200 Cart + items + variant + product + images]
```
