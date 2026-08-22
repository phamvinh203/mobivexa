# Sequence Diagram — Luồng API
## Module: Payment
### Dự án: Mobivexa E-Commerce Platform

> **Phiên bản:** 2.0 | **Ngày:** 2026-08-22

---

## SD-01: Khách lấy QR và polling trạng thái

```mermaid
sequenceDiagram
    autonumber
    participant FE as Frontend (Customer)
    participant Svc as payment.service
    participant DB as PostgreSQL

    FE->>Svc: GET /api/orders/:id/payment
    Svc->>DB: order.findFirst WHERE id+userId\nselect orderCode, total, paymentMethod, paymentStatus
    DB-->>Svc: order | null
    Svc-->>FE: 404 nếu null
    Svc-->>FE: 400 nếu COD
    Svc-->>FE: 400 nếu đã PAID
    Svc->>Svc: buildQrUrl(orderCode, amount)
    Svc-->>FE: 200 { bankId, accountNo, accountName, amount, content, qrUrl }

    loop Polling mỗi 2-3 giây
        FE->>Svc: GET /api/orders/:id/payment/status
        Svc->>DB: order.findFirst select id, orderCode, paymentStatus, status, paidAt
        DB-->>Svc: order
        Svc-->>FE: 200 { paymentStatus, orderStatus, isPaid, paidAt }
        alt isPaid = true
            FE->>FE: Hiển thị "Thanh toán thành công"
        end
    end
```

---

## SD-02: Webhook SePay — tự động đối soát

```mermaid
sequenceDiagram
    autonumber
    participant SP as SePay
    participant WH as verifySePaySecret + validateSePayWebhook
    participant Svc as payment.service (ingestTransaction)
    participant DB as PostgreSQL

    SP->>WH: POST /api/webhooks/sepay { id, transferType, transferAmount, transactionDate, content, ... }
    WH-->>SP: 400 nếu payload thiếu field bắt buộc
    WH->>Svc: processSePayWebhook(payload) → normalizeWebhook → ingestTransaction

    Svc->>DB: sePayTransaction.findUnique WHERE sepayId=tx.sepayId
    alt Đã tồn tại (SePay retry)
        DB-->>Svc: existing tx
        Svc-->>SP: 200 { duplicate: true }
    else Chưa có
        DB-->>Svc: null
        Svc->>Svc: resolveAndRecord(tx)

        alt transferType = 'out'
            Svc->>DB: sePayTx.create status=IGNORED
            Svc-->>SP: 200 IGNORED
        else Không tìm thấy ORDER_CODE_RE / Đơn không tồn tại / Đã PAID / Số tiền lệch
            Svc->>DB: sePayTx.create status=UNMATCHED, note=reason
            Svc-->>SP: 200 UNMATCHED
        else Khớp hoàn toàn
            Svc->>DB: BEGIN TRANSACTION
            Svc->>DB: order.updateMany WHERE id AND paymentStatus=UNPAID\nSET PAID, paidAt\n(+ CONFIRMED nếu PENDING)
            DB-->>Svc: { count }
            alt count = 0 (race: đơn vừa được thanh toán)
                Svc->>DB: sePayTx.create UNMATCHED "vừa được thanh toán bởi giao dịch khác"
                Svc->>DB: COMMIT
                Svc-->>SP: 200 UNMATCHED
            else count > 0
                Svc->>DB: sePayTx.create MATCHED orderId, orderCode
                Svc->>DB: COMMIT
                Svc-->>SP: 200 { handled: true, status: MATCHED }
            end
        end
    end
```

---

## SD-03: Admin gán tay giao dịch

```mermaid
sequenceDiagram
    autonumber
    participant A as Admin
    participant Svc as payment.service
    participant DB as PostgreSQL

    A->>Svc: POST /admin/payment/transactions/:txId/match\n{ orderCode, force? }
    Svc->>DB: sePayTransaction.findUnique WHERE id=txId
    DB-->>Svc: tx | null
    Svc-->>A: 404 nếu null
    Svc-->>A: 400 nếu tx.status=MATCHED
    Svc-->>A: 400 nếu transferType='out'

    Svc->>DB: order.findUnique WHERE orderCode (uppercase)
    DB-->>Svc: order | null
    Svc-->>A: 404 nếu null
    Svc-->>A: 400 nếu order.paymentStatus=PAID

    alt tx.transferAmount !== order.total AND !force
        Svc-->>A: 400 "Số tiền lệch: ... Gửi force=true để xác nhận"
    end

    Svc->>DB: BEGIN TRANSACTION
    Svc->>DB: markOrderPaid (updateMany WHERE paymentStatus=UNPAID)
    DB-->>Svc: { count }
    alt count = 0
        Svc->>DB: ROLLBACK
        Svc-->>A: 409 "Đơn hàng vừa được thanh toán"
    end
    Svc->>DB: sePayTx.update status=MATCHED\nmatchedBy=adminId, matchedAt=now\nnote=...
    Svc->>DB: COMMIT
    Svc-->>A: 200 tx (omit rawPayload)
```

---

## SD-04: Admin sync từ SePay API

```mermaid
sequenceDiagram
    autonumber
    participant A as Admin
    participant Svc as payment.service
    participant SP as SePay UserAPI
    participant DB as PostgreSQL

    A->>Svc: POST /admin/payment/sync { limit?, from?, to? }
    Svc->>SP: GET /userapi/transactions/list (Bearer token, timeout 15s)
    alt Timeout / lỗi mạng
        Svc-->>A: 502
    else HTTP error
        Svc-->>A: 502
    else OK
        SP-->>Svc: { transactions: [...] }
        loop Tuần tự (for...of) — tránh race condition
            Svc->>DB: ingestTransaction(normalizeApiTx(item))
            Note over DB: Giao dịch đã có → skip (sepayId UNIQUE)
        end
        Svc-->>A: 200 { fetched, matched, unmatched, ignored, duplicate }
    end
```
