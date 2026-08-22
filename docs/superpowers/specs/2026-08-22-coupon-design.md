# Thiết kế: Mã giảm giá (Coupon)

**Ngày:** 2026-08-22
**Phạm vi:** `be_mobivexa`
**Trạng thái:** Đã chốt, chờ lập kế hoạch implement

---

## 1. Mục tiêu

Cho phép khách nhập mã giảm giá lúc thanh toán để giảm tiền đơn hàng, và cho admin
tạo/quản lý các mã đó.

Nền đã có sẵn: cột `Order.discount Decimal @default(0)` tồn tại từ đầu nhưng luôn
bị gán cứng `0` tại `order.service.ts` (`const discount = 0`). Việc cần làm là đổ
giá trị thật vào cột đó, chứ không phải dựng lại cấu trúc đơn hàng.

---

## 2. Các quyết định đã chốt

| Câu hỏi | Chốt | Lý do |
|---|---|---|
| Kiểu giảm | `PERCENT` và `FIXED` | Thêm một enum và hai cột, gần như không tốn thêm công so với chỉ làm một kiểu |
| Phạm vi áp dụng | Toàn đơn (trên `subtotal`) | Giới hạn theo danh mục/thương hiệu cần bảng nối và phải tính subtotal riêng cho phần hợp lệ — đội công đáng kể, chưa cần |
| Giới hạn lượt | Tổng lượt + **cố định 1 lượt/khách** | 1 lượt/khách bịt kín tuyệt đối bằng khoá chính `(couponId, userId)`; cho phép N > 1 sẽ để lại khe đua |
| Khách biết mã | Gõ mã + xem danh sách mã đang chạy | Chỉ thêm một endpoint `GET` |
| Thời điểm tiêu mã | Khi đặt hàng, hoàn lại khi huỷ | Đúng cơ chế tồn kho đang chạy — repo giữ một mô hình tư duy thay vì hai |

### Vì sao không tiêu mã lúc thanh toán thành công

Đúng nhất về mặt thương mại, nhưng vỡ với COD: đơn COD chỉ chuyển `PAID` lúc giao
hàng, nên suốt quá trình checkout mã không được giữ chỗ. Hai khách cùng lấy lượt
cuối, một người bị từ chối lúc shipper tới cửa — hỏng trải nghiệm đúng vào lúc khó
xử lý nhất.

### Vì sao không "tiêu mà không hoàn"

Mở lỗ hổng thật: mã giới hạn 100 lượt có thể bị đốt sạch bằng cách đặt rồi huỷ,
nhất là đơn `BANK_TRANSFER` chưa trả tiền — huỷ không mất gì.

---

## 3. Schema

```prisma
enum CouponType {
  PERCENT // value = 10 nghĩa là giảm 10%
  FIXED   // value = 100000 nghĩa là giảm thẳng 100.000đ
}

// Mã giảm giá. code luôn được chuẩn hoá UPPERCASE trước khi ghi và trước khi tra,
// nên @unique có tác dụng như so sánh không phân biệt hoa thường.
model Coupon {
  id            String     @id @default(uuid())
  code          String     @unique
  description   String?
  type          CouponType
  value         Decimal    @db.Decimal(12, 2)
  maxDiscount   Decimal?   @db.Decimal(12, 2) // trần giảm; CHỈ có nghĩa với PERCENT
  minOrderValue Decimal    @db.Decimal(12, 2) @default(0)

  usageLimit    Int?       // null = không giới hạn tổng lượt
  usedCount     Int        @default(0)

  startsAt      DateTime
  endsAt        DateTime
  isActive      Boolean    @default(true)

  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  usages        CouponUsage[]

  // Truy vấn "mã đang chạy" lọc đúng ba cột này
  @@index([isActive, startsAt, endsAt])
  @@map("coupons")
}

// Bảng RÀNG BUỘC, không phải sổ lịch sử — xem mục 3.1.
model CouponUsage {
  couponId  String
  userId    String
  orderId   String   @unique // một đơn dùng tối đa một mã
  createdAt DateTime @default(now())

  coupon Coupon @relation(fields: [couponId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  order  Order  @relation(fields: [orderId], references: [id], onDelete: Cascade)

  // Khoá chính chính là ràng buộc "1 lượt / khách / mã". DB chặn, không có khe đua.
  @@id([couponId, userId])
  @@index([userId])
  @@map("coupon_usages")
}
```

Back-relation cần thêm:

- `User`: `couponUsages CouponUsage[]`
- `Order`: `couponUsage CouponUsage?`

Cột mới trên `Order`:

```prisma
  couponCode String? // snapshot mã đã dùng, xem 3.1
```

### 3.1 Vì sao `CouponUsage` không phải sổ lịch sử

Huỷ đơn thì phải xoá dòng `CouponUsage` — nếu giữ lại, khoá chính `(couponId, userId)`
sẽ chặn khách dùng lại mã, mâu thuẫn với quyết định "hoàn lại khi huỷ".

Nên lịch sử nằm ở chỗ khác: `Order.couponCode` (chuỗi) và `Order.discount` (số tiền)
là **snapshot tại thời điểm đặt**, đúng như địa chỉ giao hàng và giá sản phẩm mà repo
đang snapshot sẵn. Admin đổi tên mã hay xoá mã về sau không làm sai lệch đơn cũ.

Chia vai:

- `CouponUsage` — trạng thái **sống**, trả lời "khách này còn dùng được mã này không"
- `Order.couponCode` + `Order.discount` — **lịch sử**, trả lời "đơn này đã giảm bao nhiêu, bằng mã nào"

---

## 4. Phép tính giảm giá

Hàm thuần, không đụng DB, đặt tại `src/utils/discount.ts`:

```ts
computeDiscount(coupon: { type, value, maxDiscount }, subtotal: number): number
```

Quy tắc:

1. `PERCENT`: `raw = subtotal * value / 100`; nếu `maxDiscount != null` thì `d = min(raw, maxDiscount)`, ngược lại `d = raw`
2. `FIXED`: `d = value`
3. Cả hai: `d = min(d, subtotal)` — **không bao giờ giảm quá subtotal**
4. `return Math.round(d)` — VND không có đơn vị nhỏ hơn đồng

Bước 3 là chốt chặn `total` âm. `total = subtotal + shippingFee - discount`; kẹp
discount ở subtotal đảm bảo `total >= shippingFee >= 0`, đúng cả khi sau này
`shippingFee` khác 0.

Tách thành hàm thuần vì đây là phần dễ sai nhất và test được trọn vẹn mà không cần
mock: `%` chạm trần, `FIXED` lớn hơn subtotal, làm tròn số lẻ.

---

## 5. Kiểm tra tính hợp lệ

Hàm dùng chung, **nguồn sự thật duy nhất** cho cả `preview` lẫn `createOrder`:

```ts
checkCouponUsable(
  coupon: Coupon | null,
  alreadyUsed: boolean,
  subtotal: number,
): { ok: true } | { ok: false, reason: string }
```

`alreadyUsed` do nơi gọi tra rồi truyền vào, hàm không tự truy vấn — nhờ vậy nó giữ
được tính thuần và test được mà không cần mock Prisma. Cả hai nơi gọi đều tra bằng
`couponUsage.findUnique({ where: { couponId_userId: { couponId, userId } } })`.

**Trả kết quả chứ không ném lỗi.** Hai nơi gọi cần hai hành vi khác nhau:

- `preview` — luôn `200`, đổ `reason` vào body
- `createOrder` — `if (!result.ok) throw new AppError(400, result.reason)`

Nếu hàm này ném lỗi thì `preview` phải bắt lại rồi dịch ngược, hoặc tệ hơn là hai
nơi tự kiểm tra riêng — dẫn tới ngày preview báo "giảm 100k" mà đặt hàng lại ăn 400.

Thứ tự kiểm tra và thông điệp:

| Điều kiện | `reason` |
|---|---|
| `coupon == null` | `Mã giảm giá không tồn tại` |
| `!coupon.isActive` | `Mã giảm giá đã ngừng áp dụng` |
| `now < startsAt` | `Mã giảm giá chưa đến thời gian áp dụng` |
| `now > endsAt` | `Mã giảm giá đã hết hạn` |
| `usageLimit != null && usedCount >= usageLimit` | `Mã giảm giá đã hết lượt sử dụng` |
| `alreadyUsed` | `Bạn đã sử dụng mã này rồi` |
| `subtotal < minOrderValue` | `Đơn hàng tối thiểu {minOrderValue}đ mới áp dụng được mã này` |

Kiểm tra theo đúng thứ tự trên và dừng ở lỗi đầu tiên — điều kiện chung (mã hỏng)
báo trước điều kiện riêng của khách và của giỏ hàng.

---

## 6. API

### 6.1 Giai đoạn 1 — Admin CRUD

Tất cả dưới `/api/admin/coupons`, sau `authenticate` + `authorize(...STAFF_ROLES)`.

| Method | Path | Ghi chú |
|---|---|---|
| `POST` | `/` | Body mục 6.4. Chuẩn hoá `code` về UPPERCASE trước khi ghi |
| `GET` | `/` | Phân trang. Lọc `search` (theo code), `status`, `isActive` |
| `GET` | `/:id` | Chi tiết, kèm `_count.usages` |
| `PUT` | `/:id` | Sửa. Đổi `code` phải kiểm tra trùng |
| `PATCH` | `/:id/status` | Bật/tắt `isActive` |
| `DELETE` | `/:id` | **409** nếu đã có `CouponUsage` — bảo admin tắt thay vì xoá |

`status` nhận ba giá trị, tính theo thời điểm hiện tại:

- `running` — `isActive && startsAt <= now <= endsAt`
- `scheduled` — `now < startsAt`
- `expired` — `now > endsAt`

Chặn `DELETE` khi đã có người dùng dù `onDelete: Cascade` sẽ tự dọn: xoá mã đang
chạy làm khách đang có mã trong giỏ mất mã giữa chừng, và mất luôn khả năng đối
chiếu. Thông điệp: `Mã đã có người sử dụng, hãy tắt thay vì xoá`.

### 6.2 Giai đoạn 2 — Khách xem và thử mã

Dưới `/api/coupons`, sau `authenticate`.

| Method | Path | Trả về |
|---|---|---|
| `GET` | `/` | `{ coupons: [...] }` — mã đang chạy và còn lượt, mỗi mã kèm `used: boolean` |
| `POST` | `/preview` | `{ valid, discount, subtotal, total, reason? }`, **luôn 200** |

`GET /` lọc `isActive && startsAt <= now <= endsAt && (usageLimit == null || usedCount < usageLimit)`.
Mã khách đã dùng **vẫn hiện** nhưng `used: true` — để FE làm mờ đi kèm lý do, thay vì
mã biến mất không rõ vì sao.

`POST /preview` nhận `{ code: string, items?: OrderItemInput[] }`.

**Không nhận `subtotal` từ client.** Endpoint dùng lại `resolveItems(userId, items)`
của `order.service` — không truyền `items` thì lấy từ giỏ hàng — rồi tự tính subtotal.
Nhận subtotal từ client là mời người ta gửi `subtotal: 999999999` để qua ải
`minOrderValue`.

Luôn trả `200` kể cả khi mã sai: đây là endpoint kiểm tra, "mã không hợp lệ" là kết
quả bình thường chứ không phải lỗi. FE đọc một cờ `valid` thay vì phân nhánh theo
bốn mã HTTP.

### 6.3 Giai đoạn 3 — Ghép vào đặt hàng

`POST /api/orders` nhận thêm `couponCode?: string` trong body. Đây là **thay đổi hợp
đồng API**, nên để cuối: hai giai đoạn trước deploy được mà không đụng gì tới checkout
đang chạy.

### 6.4 Body tạo/sửa coupon

```ts
{
  code: string            // bắt buộc, 3-32 ký tự, chỉ [A-Z0-9_-] sau khi uppercase
  description?: string
  type: 'PERCENT' | 'FIXED'
  value: number           // PERCENT: 0 < value <= 100 | FIXED: value > 0
  maxDiscount?: number    // chỉ hợp lệ khi type = PERCENT
  minOrderValue?: number  // >= 0, mặc định 0
  usageLimit?: number     // null hoặc số nguyên > 0
  startsAt: string        // ISO datetime
  endsAt: string          // ISO datetime, phải > startsAt
  isActive?: boolean      // mặc định true
}
```

Validator từ chối `maxDiscount` khi `type = FIXED` (**400**) thay vì bỏ qua im lặng —
admin đặt trần cho mã tiền cố định là đang hiểu nhầm, báo còn hơn để họ tưởng đã đặt được.

---

## 7. Chống đua

### 7.1 Lúc đặt hàng

Chia hai chặng, giống cách `createOrder` đang xử lý tồn kho:

**Ngoài transaction** — tra mã, chạy `checkCouponUsable`, tính `discount` bằng
`computeDiscount`. Hỏng ở đây thì `throw AppError(400, reason)` và chưa có gì được ghi.
Chặng này lo việc đưa ra thông điệp cụ thể để khách sửa.

**Trong transaction** — hai bước dưới, chạy sau khi tạo đơn và trừ tồn kho. Chặng này
KHÔNG kiểm tra lại điều kiện nghiệp vụ, chỉ chống đua: trạng thái có thể đã đổi giữa
lúc đọc và lúc ghi.


**Bước 1 — trừ lượt tổng.** Nếu `usageLimit != null`:

```ts
const { count } = await tx.coupon.updateMany({
  where: { id: coupon.id, usedCount: { lt: coupon.usageLimit } },
  data:  { usedCount: { increment: 1 } },
})
if (count === 0) throw new AppError(409, 'Mã giảm giá vừa hết lượt sử dụng')
```

`coupon.usageLimit` là giá trị đã đọc ở bước kiểm tra. Không cần so sánh cột-với-cột:
nếu một transaction khác vừa tăng `usedCount` chạm trần thì `WHERE` không khớp và
`count === 0`. Đây đúng là khuôn `updateMany` có guard đang dùng cho tồn kho.

Nếu `usageLimit == null` thì `update` tăng thẳng, không cần guard.

**Bước 2 — ghi lượt của khách.**

```ts
await tx.couponUsage.create({ data: { couponId, userId, orderId: order.id } })
```

`P2002` ở đây nghĩa là chính khách này vừa đặt một đơn khác cùng mã ở request song
song → `409 'Bạn đã sử dụng mã này rồi'`. Khoá chính `(couponId, userId)` là thứ
chặn, không phải logic ứng dụng.

Thứ tự bắt buộc: tạo đơn trước (cần `orderId`), rồi tồn kho, rồi mã. Bất kỳ lỗi nào
cũng rollback toàn bộ.

### 7.2 Lúc huỷ đơn

Bên trong `cancelAndRestoreStock`, sau khi guard trạng thái đã khớp:

```ts
const usage = await tx.couponUsage.findUnique({ where: { orderId: order.id } })
if (usage) {
  await tx.couponUsage.delete({
    where: { couponId_userId: { couponId: usage.couponId, userId: usage.userId } },
  })
  await tx.coupon.updateMany({
    where: { id: usage.couponId, usedCount: { gt: 0 } },
    data:  { usedCount: { decrement: 1 } },
  })
}
```

Không cần guard chống hoàn hai lần: `cancelAndRestoreStock` đã có guard `status` ở
lệnh `update` đầu tiên, nên chỉ đúng một request đi được tới đây. `usedCount: { gt: 0 }`
là chốt phòng thân để số đếm không bao giờ âm.

---

## 8. File

**Tạo mới**

```
src/types/coupon.type.ts
src/validators/coupon.validator.ts
src/services/coupon.service.ts
src/controllers/coupon.controller.ts
src/routes/coupon.route.ts
src/utils/discount.ts
src/__tests__/coupon.test.ts
```

**Sửa**

```
prisma/schema.prisma          Coupon, CouponUsage, Order.couponCode, 2 back-relation
src/routes/index.route.ts     mount /api/coupons và /api/admin/coupons
src/types/order.type.ts       CreateOrderBody thêm couponCode?
src/services/order.service.ts createOrder + cancelAndRestoreStock
src/__tests__/order.test.ts   ca đặt hàng có mã, ca huỷ hoàn mã
```

---

## 9. Kiểm thử

**Đơn vị, không cần mock** (`utils/discount.ts` và `checkCouponUsable`) — phần giá
trị nhất vì đây là chỗ dễ sai nhất:

- `PERCENT` thường; `PERCENT` chạm trần `maxDiscount`; `PERCENT` không có trần
- `FIXED` bình thường; `FIXED` lớn hơn `subtotal` → kẹp lại đúng `subtotal`
- Làm tròn: `subtotal` lẻ ra số thập phân
- Đủ 7 nhánh từ chối ở mục 5, và đúng thứ tự ưu tiên

**Tích hợp** (`coupon.test.ts`, mock Prisma theo khuôn `favorite.test.ts`):

- Admin CRUD: tạo, trùng code → 409, sửa, xoá khi đã dùng → 409, phân trang, lọc `status`
- Validator: `maxDiscount` với `FIXED` → 400; `endsAt <= startsAt` → 400; `PERCENT` value > 100 → 400
- `GET /api/coupons`: chỉ mã đang chạy, cờ `used` đúng
- `POST /preview`: mã hợp lệ; mã sai vẫn **200** kèm `reason`; không tin `subtotal` client gửi
- 401 khi thiếu token

**Đặt hàng** (mở rộng `order.test.ts`):

- Đặt hàng có mã → `discount` và `couponCode` đúng trên đơn
- Mã không hợp lệ → 400
- `updateMany` trả `count: 0` → 409, và đơn không được tạo
- `couponUsage.create` ném P2002 → 409
- Huỷ đơn có mã → xoá usage và giảm `usedCount`

---

## 10. Ngoài phạm vi

Cố ý không làm, và lý do:

- **Giảm phí ship** — `shippingFee` đang luôn `0`, làm bây giờ là viết code chết
- **Nhiều mã trên một đơn** — `orderId @unique` chốt một mã/đơn; gỡ ra sau được nếu cần
- **Mã riêng cho từng khách** — cần thêm cột `targetUserId`, chưa có nhu cầu
- **Tự sinh mã hàng loạt** — admin gõ tay đủ dùng ở quy mô này
- **Giới hạn theo danh mục/thương hiệu** — đã chốt phạm vi toàn đơn
- **Cho phép N > 1 lượt mỗi khách** — đã chốt cố định 1 lượt để bịt kín bằng khoá chính

---

## 11. Migration

Dự án dùng `prisma db push`, không dùng migration file (`prisma/migrations` không tồn tại).

Sau khi sửa `schema.prisma`:

```bash
npx prisma generate
npx prisma db push
```

Thay đổi thuần cộng thêm: hai bảng mới và một cột nullable trên `orders`. Xem trước
SQL nếu muốn chắc:

```bash
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
```
