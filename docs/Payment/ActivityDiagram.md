# Activity Diagram
## Module: Payment
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## AD-01: ingestTransaction — Core xử lý giao dịch

```mermaid
flowchart TD
    Start([ingestTransaction tx]) --> ValidId{isFinite sepayId\nvà valid transactionDate?}
    ValidId -- Không --> EarlyCrit[handled=false reason=...]
    ValidId -- Có --> Dedup[findUnique SePayTransaction\nWHERE sepayId=tx.sepayId]
    Dedup --> IsDup{Tồn tại?}
    IsDup -- Có --> RetDup[duplicate=true]
    IsDup -- Không --> TryResolve[resolveAndRecord tx]
    TryResolve --> P2002{P2002?}
    P2002 -- Có --> RetDup2[duplicate=true\n2 webhook song song qua dedup]
    P2002 -- Không --> ResolveResult[IngestResult]

    subgraph resolveAndRecord
        R1{transferType = in?} -- Không --> Ignored[Ghi IGNORED\ntransferType=out]
        R1 -- Có --> R2[Tìm ORDER_CODE_RE\ntrong tx.content]
        R2 --> R2OK{Match?}
        R2OK -- Không --> UM1[Ghi UNMATCHED\nkhông tìm thấy mã đơn]
        R2OK -- Có --> R3[findUnique order\nby orderCode]
        R3 --> R3OK{Tồn tại?}
        R3OK -- Không --> UM2[Ghi UNMATCHED\nkhông tìm thấy đơn]
        R3OK -- Có --> R4{order.paymentStatus\n= PAID?}
        R4 -- Có --> UM3[Ghi UNMATCHED\nđã thanh toán trước đó]
        R4 -- Không --> R5{transferAmount\n=== order.total?}
        R5 -- Không --> UM4[Ghi UNMATCHED\nsố tiền lệch]
        R5 -- Có --> TX[BEGIN TRANSACTION\nmarkOrderPaid\ncreate SePayTx MATCHED]
        TX --> Cnt{count > 0?}
        Cnt -- Không --> UM5[Ghi UNMATCHED\nrace condition]
        Cnt -- Có --> Matched[MATCHED\nhandled=true]
    end
```

---

## AD-02: markOrderPaid

```mermaid
flowchart TD
    Start([markOrderPaid order, paidAt]) --> Update[order.updateMany\nWHERE id=order.id\nAND paymentStatus=UNPAID\nSET paymentStatus=PAID, paidAt=paidAt]
    Update --> IsPending{order.status\n= PENDING?}
    IsPending -- Có --> AlsoConfirm[+ SET status=CONFIRMED]
    IsPending -- Không --> SkipStatus[không đổi status]
    AlsoConfirm & SkipStatus --> Return[Trả count]
```

---

## AD-03: Admin gán tay (matchTransaction)

```mermaid
flowchart TD
    Start([POST /admin/payment/transactions/:txId/match]) --> Auth{STAFF+?}
    Auth -- Không --> E401_403[401/403]
    Auth -- Có --> Validate[validateMatchTransaction\norderCode format ORD-YYYYMMDD-XXXXXX]
    Validate --> ValOK{Hợp lệ?}
    ValOK -- Không --> E400[400]
    ValOK -- Có --> FindTx[Tìm SePayTransaction\nby txId]
    FindTx --> TxExist{Tồn tại?}
    TxExist -- Không --> E404[404]
    TxExist -- Có --> TxMatched{status=MATCHED?}
    TxMatched -- Có --> E400b[400 Đã gán rồi]
    TxMatched -- Không --> IsIn{transferType=in?}
    IsIn -- Không --> E400c[400 Không thể gán tiền ra]
    IsIn -- Có --> FindOrder[findUnique order\nby orderCode uppercase]
    FindOrder --> OrdExist{Tồn tại?}
    OrdExist -- Không --> E404b[404]
    OrdExist -- Có --> OrdPaid{paymentStatus=PAID?}
    OrdPaid -- Có --> E400d[400 Đã thanh toán]
    OrdPaid -- Không --> AmtMatch{amount === expected?}
    AmtMatch -- Không --> HasForce{force=true?}
    HasForce -- Không --> E400e[400 Số tiền lệch\ngợi ý dùng force=true]
    HasForce -- Có --> TX[BEGIN TRANSACTION\nmarkOrderPaid\nupdate tx MATCHED\nmatchedBy, matchedAt]
    AmtMatch -- Có --> TX
    TX --> TxCnt{count > 0?}
    TxCnt -- Không --> E409[ROLLBACK\n409 race condition]
    TxCnt -- Có --> R200[200 tx đã gán]
```

---

## AD-04: Sync từ SePay API

```mermaid
flowchart TD
    Start([POST /admin/payment/sync]) --> Auth{STAFF+?}
    Auth -- Không --> E401_403[401/403]
    Auth -- Có --> CheckToken{SEPAY_API_TOKEN\ncấu hình?}
    CheckToken -- Không --> E500[500 Chưa cấu hình]
    CheckToken -- Có --> FetchAPI[fetch SePay UserAPI\ntimeout 15s]
    FetchAPI --> Timeout{Timeout hoặc\nlỗi mạng?}
    Timeout -- Có --> E502[502]
    Timeout -- Không --> HttpOK{res.ok?}
    HttpOK -- Không --> E502b[502 SePay trả lỗi HTTP]
    HttpOK -- Có --> Loop[Lặp tuần tự\nfor item of transactions]
    Loop --> Ingest[ingestTransaction normalizeApiTx item]
    Ingest --> NextItem{Còn item?}
    NextItem -- Có --> Loop
    NextItem -- Không --> Summary[200 fetched/matched/unmatched/ignored/duplicate]
```
