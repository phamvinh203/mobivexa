# SƠ ĐỒ HOẠT ĐỘNG - MODULE ĐÁNH GIÁ (REVIEW)

**Phiên bản**: 1.0  
**Ngày**: 2026-06-20  
**Tác giả**: Workflow Architect  
**Trạng thái**: Hoàn thành  

---

## MỤC LỤC

1. [Tổng quan](#tổng-quan)
2. [Sơ đồ 1: Xem Tóm Tắt Đánh Giá](#sơ-đồ-1-xem-tóm-tắt-đánh-giá)
3. [Sơ đồ 2: Danh Sách Đánh Giá](#sơ-đồ-2-danh-sách-đánh-giá)
4. [Sơ đồ 3: Tạo Đánh Giá](#sơ-đồ-3-tạo-đánh-giá)
5. [Sơ đồ 4: Cập Nhật Đánh Giá](#sơ-đồ-4-cập nhật-đánh-giá)
6. [Sơ đồ 5: Toggle Bình Chọn Hữu Ích](#sơ-đồ-5-toggle-bình-chọn-hữu-ích)
7. [Sơ đồ 6: Admin Trả Lời Đánh Giá](#sơ-đồ-6-admin-trả-lời-đánh-giá)
8. [Phân Tích So Sánh](#phân-tích-so-sánh)

---

## TỔNG QUAN

Module Đánh Giá (Review) cho phép người dùng đánh giá sản phẩm đã mua, xem đánh giá của người khác, và cho admin quản lý đánh giá. Hệ thống hỗ trợ:

- **6 workflow chính**: Xem tóm tắt, danh sách đánh giá, tạo, cập nhật, bình chọn, admin trả lời
- **3 actor**: Public (không cần auth), Customer (cần auth), Admin (quyền staff)
- **2 service ngoài**: Prisma (Database), Cloudinary (ảnh)
- **4 trạng thái đánh giá**: APPROVED, PENDING, REJECTED, DELETED (chỉ dùng APPROVED)

---

## SƠ ĐỒ 1: XEM TÓM TẮT ĐÁNH GIÁ

**Endpoint**: `GET /api/products/:slug/reviews/summary`  
**Actor**: Public (không cần authentication)  
**Mục tiêu**: Lấy thống kê đánh giá của sản phẩm cho trang chi tiết sản phẩm

### Sơ đồ Hoạt Động

```mermaid
flowchart TD
    subgraph PUBLIC["Public / User"]
        A[Truy cập trang sản phẩm] --> B[Gọi API GET /products/:slug/reviews/summary]
    end
    
    subgraph API["API Layer"]
        B --> C[Controller: getSummary]
        C --> D[Gọi Service.getReviewSummary slug]
    end
    
    subgraph SERVICE["Service Layer"]
        D --> E[Kiểm tra sản phẩm tồn tại]
        E -->|Không tồn tại| F[Throw 404]
        E -->|Tồn tại| G[Khởi tạo 3 parallel queries]
    end
    
    subgraph PARALLEL["Parallel Queries"]
        G --> H1[Query 1: Aggregate<br/>avg + count rating]
        G --> H2[Query 2: GroupBy<br/>breakdown theo rating]
        G --> H3[Query 3: Count<br/>số ảnh có review]
    end
    
    subgraph DATABASE["Database"]
        H1 --> I1[SELECT AVG rating, COUNT id<br/>WHERE status=APPROVED]
        H2 --> I2[SELECT rating, COUNT id<br/>GROUP BY rating<br/>WHERE status=APPROVED]
        H3 --> I3[SELECT COUNT reviewPhoto.id<br/>WHERE review.status=APPROVED]
    end
    
    subgraph AGGREGATE["Aggregation"]
        I1 --> J1[Trả về avgRating + totalCount]
        I2 --> J2[Trả về breakdown 1-5 sao]
        I3 --> J3[Trả về withPhotoCount]
        J1 --> K[Combine kết quả]
        J2 --> K
        J3 --> K
    end
    
    subgraph RESPONSE["Response"]
        K --> L[Trả về JSON:<br/>- averageRating: number<br/>- totalCount: number<br/>- breakdown: {1-5}: number<br/>- withPhotoCount: number]
        L --> M[200 OK + SendSuccess]
    end
    
    F --> N[404 Not Found:<br/>Sản phẩm không tồn tại]
```

### Chi tiết từng bước

| Bước | Action | Timeout | Input | Output | Xử lý lỗi |
|------|--------|----------|-------|--------|-----------|
| 1 | Kiểm tra sản phẩm | 1s | slug: string | productId: string | 404 if not found |
| 2a | Aggregate avg/count | 2s | productId, status=APPROVED | avg, count | Timeout → retry 1x |
| 2b | GroupBy breakdown | 2s | productId, status=APPROVED | rating, count per rating | Timeout → retry 1x |
| 2c | Count photos | 2s | productId, status=APPROVED | withPhotoCount | Timeout → retry 1x |
| 3 | Combine results | 0.1s | 3 query results | Final JSON object | N/A |

### Quy tắc xác thực
- **Không cần authentication** - Public endpoint
- **Không cần authorization** - Không kiểm quyền

### Xử lý lỗi đặc biệt
```typescript
// 404 - Product not found
if (!product) throw new AppError(404, 'Sản phẩm không tồn tại')

// Timeout handling
- Query timeout → retry 1 lần với exponential backoff
- Vẫn timeout → return cached data hoặc default values
```

### Observable States

| Actor | State during operation | Database |
|-------|------------------------|----------|
| Public | Loading spinner trên UI | Không có thay đổi |
| Admin | - | Không có thay đổi |

### Performance Target
- **P95 latency**: < 200ms (3 parallel queries)
- **Timeout**: 5s tổng cộng
- **Caching**: Nên cache tại CDN/Edge (thống kê không thay đổi realtime)

---

## SƠ ĐỒ 2: DANH SÁCH ĐÁNH GIÁ

**Endpoint**: `GET /api/products/:slug/reviews`  
**Actor**: Public (không cần authentication)  
**Mục tiêu**: Lấy danh sách đánh giá đã được duyệt với bộ lọc và phân trang

### Sơ đồ Hoạt Động

```mermaid
flowchart TD
    subgraph PUBLIC["Public / User"]
        A[Xem reviews sản phẩm] --> B[Gọi API GET /products/:slug/reviews<br/>?page=1&limit=10&rating=5&hasPhoto=true&sort=helpful]
    end
    
    subgraph API["API Layer"]
        B --> C[Controller: list]
        C --> D[Gọi Service.listReviews slug, query]
    end
    
    subgraph SERVICE["Service Layer"]
        D --> E[Kiểm tra sản phẩm tồn tại]
        E -->|Không tồn tại| F[Throw 404]
        E -->|Tồn tại| G[Parse pagination]
        G --> H[Xây dựng WHERE clause]
    end
    
    subgraph FILTERS["Filter Logic"]
        H --> I{Có filter rating?}
        I -->|Có| J[WHERE rating = X]
        I -->|Không| K[Không filter rating]
        J --> L{Có filter hasPhoto?}
        K --> L
        L -->|Có| M[WHERE photos: some: {}]
        L -->|Không| N[Không filter photo]
        M --> O[Xác định ORDER BY]
        N --> O
    end
    
    subgraph SORT["Sort Logic"]
        O --> P{Sort = helpful?}
        P -->|Có| Q[ORDER BY helpful._count DESC]
        P -->|Không| R[ORDER BY createdAt DESC]
        Q --> S[Execute parallel queries]
        R --> S
    end
    
    subgraph DATABASE["Database"]
        S --> T1[Query 1: findMany<br/>WHERE + ORDER + pagination]
        S --> T2[Query 2: count<br/>WHERE clause]
    end
    
    subgraph RESPONSE["Response"]
        T1 --> U[Danh sách reviews]
        T2 --> V[Tổng số record]
        U --> W[Build pagination metadata]
        V --> W
        W --> X[Return JSON:<br/>- reviews: array<br/>- pagination: {page, limit, total, pages}]
    end
    
    F --> Y[404 Not Found]
```

### Chi tiết các bộ lọc

| Filter | Query param | Logic | Database query |
|--------|-------------|-------|----------------|
| Rating | `rating=1-5` | Chỉ lấy review X sao | `WHERE rating = X` |
| Has photo | `hasPhoto=true/false` | Review có/không ảnh | `WHERE photos: some: {}` hoặc `WHERE photos: none: {}` |
| Sort | `sort=helpful/newest` | Sắp xếp | `helpful` → `ORDER BY helpful._count DESC`<br/>`newest` → `ORDER BY createdAt DESC` |
| Pagination | `page=1, limit=10` | Phân trang | `skip=(page-1)*limit, take=limit` |

### Quy tắc xác thực
- **Không cần authentication** - Public endpoint
- **Không cần authorization** - Không kiểm quyền

### Xử lý lỗi đặc biệt
```typescript
// 404 - Product not found
if (!product) throw new AppError(404, 'Sản phẩm không tồn tại')

// Invalid filter values
- rating không phải 1-5 → ignore filter (mặc định lấy all)
- limit > LIMITS.DEFAULT → clamp về LIMITS.MAX
- page < 1 → default về page 1
```

### Observable States

| Actor | State during operation | Database |
|-------|------------------------|----------|
| Public | Loading skeleton UI + infinite scroll | Không có thay đổi |
| Admin | - | Không có thay đổi |

### Performance Target
- **P95 latency**: < 300ms
- **Timeout**: 5s
- **Query complexity**: O(n) với n = limit
- **Caching**: Nên cache theo page + filters (TTL 5 phút)

---

## SƠ ĐỒ 3: TẠO ĐÁNH GIÁ

**Endpoint**: `POST /api/order-items/:orderItemId/review`  
**Actor**: Customer (cần authentication)  
**Mục tiêu**: Tạo đánh giá cho sản phẩm đã mua và đã giao

### Sơ đồ Hoạt Động

```mermaid
flowchart TD
    subgraph CUSTOMER["Customer"]
        A[Nhấn "Viết đánh giá"] --> B[Upload tối đa 5 ảnh + Nhập rating 1-5 + content 10-2000 chars]
        B --> C[Gọi POST /api/order-items/:orderItemId/review<br/>Content-Type: multipart/form-data]
    end
    
    subgraph API["API Layer"]
        C --> D[Middleware: authenticate]
        D -->|No token| E[401 Unauthorized]
        D -->|Has token| F[Middleware: uploadImage.array photos, 5]
        F --> G[Middleware: validateCreateReview]
        G -->|Invalid| H[422 Validation Error]
        G -->|Valid| I[Controller: create]
    end
    
    subgraph SERVICE["Service Layer"]
        I --> J[Step 1: Tìm OrderItem]
        J --> K{OrderItem tồn tại<br/>+ DELIVERED + owned?}
        K -->|Không| L[404: Không tìm thấy sản phẩm trong đơn hàng đã giao]
        K -->|Có| M[Step 2: Kiểm tra review đã tồn tại]
        M --> N{Đã có review?}
        N -->|Có| O[409: Bạn đã đánh giá sản phẩm này rồi]
        N -->|Không| P[Step 3: Parallel - Resolve productId + Upload photos]
    end
    
    subgraph PARALLEL["Parallel Operations"]
        P --> Q1[Task 1: Resolve productId<br/>từ variant hoặc productName/sku]
        P --> Q2[Task 2: Upload 0-5 photos<br/>lên Cloudinary song song]
    end
    
    subgraph RESOLVE["Resolve ProductId"]
        Q1 --> R1{Có variantId?}
        R1 -->|Có| R2[Query ProductVariant → productId]
        R1 -->|Không| R3[Fallback: query by SKU hoặc productName]
        R2 --> S1[Return productId]
        R3 --> S1
    end
    
    subgraph CLOUDINARY["Cloudinary"]
        Q2 --> T1[Upload photo 1]
        Q2 --> T2[Upload photo 2]
        Q2 --> T3[Upload photo 3]
        Q2 --> T4[Upload photo 4]
        Q2 --> T5[Upload photo 5]
        T1 --> U1[Return url + publicId]
        T2 --> U2[Return url + publicId]
        T3 --> U3[Return url + publicId]
        T4 --> U4[Return url + publicId]
        T5 --> U5[Return url + publicId]
    end
    
    subgraph DATABASE["Database"]
        S1 --> V[Step 4: Create review<br/>- orderItemId, userId<br/>- productId, variantId<br/>- rating, content<br/>- status: APPROVED<br/>- photos: create 0-5 records]
    end
    
    subgraph RESPONSE["Response"]
        V --> W[Return full review object + photos]
        W --> X[201 Created + SendSuccess]
    end
    
    subgraph ERROR_HANDLING["Error Handling"]
        E --> Y[401 Unauthorized<br/>Return: { ok: false, error: 'Unauthorized' }]
        H --> Z[422 Validation Error<br/>Return: { ok: false, error: '...', code: 'VALIDATION_ERROR' }]
        L --> AA[404 Not Found<br/>Return: { ok: false, error: 'Không tìm thấy sản phẩm trong đơn hàng đã giao' }]
        O --> AB[409 Conflict<br/>Return: { ok: false, error: 'Bạn đã đánh giá sản phẩm này rồi' }]
    end
```

### Chi tiết từng bước

| Bước | Action | Timeout | Input | Output | Xử lý lỗi |
|------|--------|----------|-------|--------|-----------|
| 1 | Authenticate | 1s | Bearer token | userId | 401 if invalid |
| 2 | Validate input | 0.1s | rating, content, files | validated body | 422 if invalid |
| 3 | Find OrderItem | 2s | orderItemId, userId, status=DELIVERED | OrderItem + review? | 404 if not found |
| 4 | Check existing review | 0.1s | orderItem.review | null or review | 409 if exists |
| 5a | Resolve productId | 1s | variantId or productName/sku | productId | 400 if not resolvable |
| 5b | Upload photos | 10s | 0-5 files | array of {url, publicId} | Timeout → error |
| 6 | Create review | 1s | all data | Review object + photos | DB error |

### Quy tắc xác thực
- **Cần authentication**: Bearer token bắt buộc
- **Ownership**: Chỉ được review OrderItem của chính mình
- **Order status**: Chỉ được review khi OrderStatus = DELIVERED
- **One-time**: Không được review 2 lần cùng 1 OrderItem

### Validation rules

```typescript
// Rating validation
rating: number
  - Must be integer
  - Range: 1-5
  - Required: true

// Content validation
content: string
  - Min length: 10 chars
  - Max length: 2000 chars
  - Trim whitespace
  - Required: true

// Photos validation
photos: Express.Multer.File[]
  - Max files: 5
  - Allowed types: jpg, jpeg, png, webp
  - Max size per file: 5MB
  - Optional: true (có thể không upload ảnh)
```

### Parallel Operations

```
┌─────────────────────────────────────────────┐
│  PARALLEL EXECUTION (Step 5)                 │
├─────────────────────────────────────────────┤
│  Task 1: Resolve ProductId                  │
│  ├─ Has variantId? → ProductVariant.findUnique│
│  └─ No variantId → fallback: SKU/name lookup │
├─────────────────────────────────────────────┤
│  Task 2: Upload Photos                       │
│  ├─ photo[0] → Cloudinary upload             │
│  ├─ photo[1] → Cloudinary upload             │
│  ├─ photo[2] → Cloudinary upload             │
│  ├─ photo[3] → Cloudinary upload             │
│  └─ photo[4] → Cloudinary upload             │
└─────────────────────────────────────────────┘
Both tasks execute concurrently → await Promise.all()
```

### Xử lý lỗi đặc biệt

```typescript
// 409 - Already reviewed
if (orderItem.review) throw new AppError(409, 'Bạn đã đánh giá sản phẩm này rồi')

// 400 - Cannot resolve productId
if (!variant && !product) throw new AppError(400, 'Không xác định được sản phẩm')

// Cloudinary upload timeout
- Individual photo timeout: 5s
- Parallel upload timeout: 10s total
- Timeout → reject entire request (no orphan photos in DB)
```

### Observable States

| Actor | State during operation | Database |
|-------|------------------------|----------|
| Customer | Loading indicator + disable submit button | Không có thay đổi |
| Admin | - | Không có thay đổi |
| Cloudinary | 0-5 uploads in progress | Không có thay đổi |

### Performance Target
- **P95 latency**: < 8s (bao gồm upload 5 ảnh)
- **Timeout**: 15s tổng cộng
- **Database queries**: 4 queries (OrderItem + variant/product + create review + fetch review)
- **External calls**: 0-5 Cloudinary uploads (parallel)

---

## SƠ ĐỒ 4: CẬP NHẬT ĐÁNH GIÁ

**Endpoint**: `PUT /api/reviews/:id`  
**Actor**: Customer (cần authentication)  
**Mục tiêu**: Chỉnh sửa đánh giá đã tạo (trong 30 ngày)

### Sơ đồ Hoạt Động

```mermaid
flowchart TD
    subgraph CUSTOMER["Customer"]
        A[Nhấn "Chỉnh sửa đánh giá"] --> B[Thay đổi rating/content/photos + Upload 0-5 ảnh mới]
        B --> C[Gọi PUT /api/reviews/:id<br/>Content-Type: multipart/form-data]
    end
    
    subgraph API["API Layer"]
        C --> D[Middleware: authenticate]
        D -->|No token| E[401 Unauthorized]
        D -->|Has token| F[Middleware: uploadImage.array photos, 5]
        F --> G[Middleware: validateUpdateReview]
        G -->|Invalid| H[422 Validation Error]
        G -->|Valid| I[Controller: update]
    end
    
    subgraph SERVICE["Service Layer"]
        I --> J[Step 1: Tìm review của user]
        J --> K{Review tồn tại<br/>+ userId khớp?}
        K -->|Không| L[404: Đánh giá không tồn tại]
        K -->|Có| M[Step 2: Kiểm tra 30-day window]
        M --> N{Date.now - createdAt < 30 days?}
        N -->|Không| O[400: Đã quá 30 ngày, không thể chỉnh sửa]
        N -->|Có| P[Step 3: Chuẩn bị update data]
    end
    
    subgraph UPDATE["Update Logic"]
        P --> Q{Có files mới?}
        Q -->|Có| R[Parallel: Upload photos mới + Xóa photos cũ]
        Q -->|Không| S[Chỉ update rating/content]
        R --> T[Upload 0-5 photos lên Cloudinary]
        T --> U{Upload thành công?}
        U -->|Có| V[Update review: deleteMany photos + create new photos]
        U -->|Không| W[500: Upload failed]
        S --> X[Build update payload:<br/>- rating (nếu có)<br/>- content (nếu có)<br/>- status: APPROVED]
    end
    
    subgraph DATABASE["Database"]
        V --> Y[Execute review.update<br/>WHERE id = reviewId<br/>SET: rating, content, photos]
        X --> Y
    end
    
    subgraph CLOUDINARY["Cloudinary - Cleanup"]
        R --> Z1[Fire-and-forget: Xóa photo 1 cũ]
        R --> Z2[Fire-and-forget: Xóa photo 2 cũ]
        R --> Z3[Fire-and-forget: Xóa photo 3 cũ]
        R --> Z4[Fire-and-forget: Xóa photo 4 cũ]
        R --> Z5[Fire-and-forget: Xóa photo 5 cũ]
    end
    
    subgraph RESPONSE["Response"]
        Y --> AA[Return updated review object + new photos]
        AA --> AB[200 OK + SendSuccess]
    end
    
    subgraph ERROR_HANDLING["Error Handling"]
        E --> AC[401 Unauthorized]
        H --> AD[422 Validation Error]
        L --> AE[404 Not Found]
        O --> AF[400 Bad Request]
        W --> AG[500 Internal Server Error]
    end
```

### Chi tiết từng bước

| Bước | Action | Timeout | Input | Output | Xử lý lỗi |
|------|--------|----------|-------|--------|-----------|
| 1 | Authenticate | 1s | Bearer token | userId | 401 if invalid |
| 2 | Validate input | 0.1s | rating?, content?, files? | validated body | 422 if invalid |
| 3 | Find owned review | 2s | reviewId, userId | Review + photos | 404 if not found |
| 4 | Check 30-day window | 0.1s | review.createdAt | boolean | 400 if > 30 days |
| 5a | Upload new photos | 10s | 0-5 files | array of {url, publicId} | Timeout → error |
| 5b | Delete old photos | 5s | old photos array | fire-and-forget | Best-effort |
| 6 | Update review | 1s | data | Updated review | DB error |

### Quy tắc xác thực
- **Cần authentication**: Bearer token bắt buộc
- **Ownership**: Chỉ được edit review của chính mình
- **Time window**: Chỉ được edit trong 30 ngày kể từ createdAt
- **Auto-approve**: Update luôn set status = APPROVED (re-review)

### Validation rules

```typescript
// Rating validation (optional)
rating?: number
  - Must be integer
  - Range: 1-5
  - Optional: true (không bắt buộc gửi)

// Content validation (optional)
content?: string
  - Min length: 10 chars
  - Max length: 2000 chars
  - Trim whitespace
  - Optional: true (không bắt buộc gửi)

// Photos validation (optional)
photos?: Express.Multer.File[]
  - Max files: 5
  - Allowed types: jpg, jpeg, png, webp
  - Max size per file: 5MB
  - Replacement: Ghi đè toàn bộ photos cũ
```

### Photo Replacement Logic

```
┌─────────────────────────────────────────────┐
│  PHOTO REPLACEMENT STRATEGY                 │
├─────────────────────────────────────────────┤
│  1. Upload 0-5 photos mới (parallel)        │
│  2. Fire-and-forget xóa 0-5 photos cũ       │
│     (không await, không check error)         │
│  3. Update DB:                               │
│     - photos: { deleteMany: {} }           │
│     - photos: { create: [...] }             │
│  4. Return new photos trong response        │
└─────────────────────────────────────────────┘

NOTE: Nếu upload photos mới failed:
- Không xóa photos cũ (fire-and-forget có thể incomplete)
- Reject toàn bộ request (500 error)
- Review giữ nguyên trạng thái cũ (atomic update)
```

### Xử lý lỗi đặc biệt

```typescript
// 400 - Edit window expired
if (Date.now() - review.createdAt.getTime() > EDIT_WINDOW_MS) {
  throw new AppError(400, 'Đã quá 30 ngày, không thể chỉnh sửa đánh giá')
}

// 404 - Not found or not owned
const review = await findOwnedReview(userId, reviewId)
if (!review) throw new AppError(404, 'Đánh giá không tồn tại')

// Fire-and-forget cleanup
review.photos.forEach((p) => void destroyImage(p.publicId))
// "void" = không await, không throw nếu failed
```

### Observable States

| Actor | State during operation | Database |
|-------|------------------------|----------|
| Customer | Loading indicator + disable submit button | No change until success |
| Admin | - | No change until success |
| Cloudinary | 0-5 uploads + 0-5 deletions (best-effort) | No change |

### Performance Target
- **P95 latency**: < 8s (bao gồm upload 5 ảnh)
- **Timeout**: 15s tổng cộng
- **Database queries**: 3 queries (find review + update review + fetch updated)
- **External calls**: 0-5 Cloudinary uploads + 0-5 fire-and-forget deletes

---

## SƠ ĐỒ 5: TOGGLE BÌNH CHỌN HỮU ÍCH

**Endpoint**: `POST /api/reviews/:id/helpful`  
**Actor**: Customer (cần authentication)  
**Mục tiêu**: Thêm hoặc xóa bình chọn "hữu ích" cho đánh giá

### Sơ đồ Hoạt Động

```mermaid
flowchart TD
    subgraph CUSTOMER["Customer"]
        A[Nhấn "Hữu ích" / "Bỏ hữu ích"] --> B[Gọi POST /api/reviews/:id/helpful]
    end
    
    subgraph API["API Layer"]
        B --> C[Middleware: authenticate]
        C -->|No token| D[401 Unauthorized]
        C -->|Has token| E[Controller: helpful]
    end
    
    subgraph SERVICE["Service Layer"]
        E --> F[Parallel Step 1: Tìm review + Tìm vote existing]
        F --> G1[Query 1: review.findUnique<br/>WHERE id = reviewId<br/>SELECT id, status]
        F --> G2[Query 2: reviewHelpful.findUnique<br/>WHERE userId + reviewId]
    end
    
    subgraph DATABASE["Database - Read Phase"]
        G1 --> H1{Review tồn tại<br/>+ status = APPROVED?}
        G2 --> H2{Vote đã tồn tại?}
        H1 -->|Không| I[404: Đánh giá không tồn tại]
        H1 -->|Có| J{Decision toggle}
        H2 -->|Có| K[User đã vote → cần DELETE]
        H2 -->|Không| L[User chưa vote → cần CREATE]
    end
    
    subgraph DECISION["Toggle Logic"]
        J --> M{existing vote?}
        M -->|Có| N[Action: DELETE vote]
        M -->|Không| O[Action: CREATE vote]
        N --> P[Execute DELETE]
        O --> Q[Execute CREATE]
    end
    
    subgraph DATABASE["Database - Write Phase"]
        P --> R[reviewHelpful.delete<br/>WHERE userId_reviewId]
        Q --> S[reviewHelpful.create<br/>{ userId, reviewId }]
    end
    
    subgraph RESPONSE["Response"]
        R --> T[Query lại helpful count]
        S --> T
        T --> U[Return JSON:<br/>- helpful: boolean (true=created, false=deleted)<br/>- count: number (new count)]
        U --> V[200 OK + SendSuccess]
    end
    
    subgraph ERROR_HANDLING["Error Handling"]
        D --> W[401 Unauthorized]
        I --> X[404 Not Found]
    end
```

### Chi tiết từng bước

| Bước | Action | Timeout | Input | Output | Xử lý lỗi |
|------|--------|----------|-------|--------|-----------|
| 1 | Authenticate | 1s | Bearer token | userId | 401 if invalid |
| 2a | Find review (parallel) | 1s | reviewId | review: {id, status} | 404 if not found |
| 2b | Find existing vote (parallel) | 1s | userId, reviewId | vote or null | N/A |
| 3 | Validate review status | 0.1s | review.status | boolean | 404 if not APPROVED |
| 4a | Create vote (if not exists) | 1s | {userId, reviewId} | vote | DB error |
| 4b | Delete vote (if exists) | 1s | userId_reviewId | void | DB error |
| 5 | Query new count | 1s | reviewId | {helpful: count} | N/A |

### Quy tắc xác thực
- **Cần authentication**: Bearer token bắt buộc
- **Ownership**: Bất kỳ user đã authenticate đều có thể vote
- **Review status**: Chỉ vote được review có status = APPROVED
- **Idempotent**: POST nhiều lần = toggle state (create → delete → create)

### Toggle Logic

```typescript
// Parallel queries
const [review, existing] = await Promise.all([
  prisma.review.findUnique({ where: { id: reviewId }, select: { id: true, status: true } }),
  prisma.reviewHelpful.findUnique({ where: { userId_reviewId: { userId, reviewId } } }),
])

// Validate
if (!review || review.status !== ReviewStatus.APPROVED) {
  throw new AppError(404, 'Đánh giá không tồn tại')
}

// Toggle
if (existing) {
  // User đã vote → DELETE
  await prisma.reviewHelpful.delete({ where: { userId_reviewId: { userId, reviewId } } })
  helpful = false  // unvoted
} else {
  // User chưa vote → CREATE
  await prisma.reviewHelpful.create({ data: { userId, reviewId } })
  helpful = true   // voted
}

// Return new count
const updated = await prisma.review.findUnique({
  where: { id: reviewId },
  select: { _count: { select: { helpful: true } } },
})
return { helpful, count: updated?._count.helpful ?? 0 }
```

### Parallel Queries

```
┌─────────────────────────────────────────────┐
│  PARALLEL EXECUTION (Step 2)                 │
├─────────────────────────────────────────────┤
│  Query 1: Find Review                        │
│  ├─ WHERE id = reviewId                     │
│  └─ SELECT id, status (minimal columns)      │
├─────────────────────────────────────────────┤
│  Query 2: Find Existing Vote                │
│  ├─ WHERE userId_reviewId = { userId, reviewId } │
│  └─ SELECT * (exists check)                  │
└─────────────────────────────────────────────┘
Both execute concurrently → await Promise.all()
```

### Xử lý lỗi đặc biệt

```typescript
// 404 - Review not found or not approved
if (!review || review.status !== ReviewStatus.APPROVED) {
  throw new AppError(404, 'Đánh giá không tồn tại')
}

// Unique constraint violation (race condition)
- Nếu 2 request cùng 1 lúc tạo vote → Prisma P2002 error
- Retry 1 lần với exponential backoff
- Vẫn fail → return 409 Conflict

// Record not found on delete (race condition)
- Nếu vote bị delete giữa lúc find và lúc delete → Prisma P2025 error
- Treat as success (vote đã không tồn tại = desired state)
```

### Observable States

| Actor | State during operation | Database |
|-------|------------------------|----------|
| Customer | Button loading state → toggle icon | No change until write |
| Admin | - | Insert or delete 1 row in reviewHelpful |
| Other users | See helpful count increment/decrement | helpful._count changes |

### Performance Target
- **P95 latency**: < 100ms (2 parallel reads + 1 write)
- **Timeout**: 3s
- **Database queries**: 3 queries (2 parallel reads + 1 write + 1 count read)
- **External calls**: 0

### Idempotency

```
POST N lần → toggle state N lần:

Request 1: no vote → create → helpful=true, count=1
Request 2: has vote → delete → helpful=false, count=0
Request 3: no vote → create → helpful=true, count=1
Request 4: has vote → delete → helpful=false, count=0

UI Button: "Hữu ích" ⇄ "Bỏ hữu ích"
```

---

## SƠ ĐỒ 6: ADMIN TRẢ LỜI ĐÁNH GIÁ

**Endpoint**: `POST /api/admin/reviews/:id/reply`  
**Actor**: Admin (cần authentication + authorization)  
**Mục tiêu**: Admin trả lời đánh giá của khách hàng

### Sơ đồ Hoạt Động

```mermaid
flowchart TD
    subgraph ADMIN["Admin"]
        A[Nhấn "Trả lời" trên review] --> B[Nhập nội dung trả lời 1-1000 chars]
        B --> C[Gọi POST /api/admin/reviews/:id/reply<br/>Content-Type: application/json]
    end
    
    subgraph API["API Layer"]
        C --> D[Middleware: authenticate]
        D -->|No token| E[401 Unauthorized]
        D -->|Has token| F[Middleware: authorize STAFF_ROLES]
        F -->|Not staff| G[403 Forbidden]
        F -->|Is staff| H[Middleware: validateReplyReview]
        H -->|Invalid| I[422 Validation Error]
        H -->|Valid| J[Controller: adminReply]
    end
    
    subgraph SERVICE["Service Layer"]
        J --> K[Step 1: Update review với reply]
        K --> L[Execute review.update<br/>WHERE id = reviewId<br/>SET: replyContent, repliedAt]
    end
    
    subgraph DATABASE["Database"]
        L --> M{Review tồn tại?}
        M -->|Không| N[P2025: Record not found]
        M -->|Có| O[Update thành công:<br/>- replyContent = trimmed content<br/>- repliedAt = now()]
    end
    
    subgraph RESPONSE["Response"]
        O --> P[Return full review object + all relations:<br/>- user, product, photos<br/>- _count: { helpful }<br/>- replyContent, repliedAt]
        P --> Q[200 OK + SendSuccess]
    end
    
    subgraph ERROR_HANDLING["Error Handling"]
        E --> R[401 Unauthorized]
        G --> S[403 Forbidden]
        I --> T[422 Validation Error]
        N --> U[404 Not Found:<br/>Đánh giá không tồn tại]
    end
```

### Chi tiết từng bước

| Bước | Action | Timeout | Input | Output | Xử lý lỗi |
|------|--------|----------|-------|--------|-----------|
| 1 | Authenticate | 1s | Bearer token | userId | 401 if invalid |
| 2 | Authorize | 0.5s | userId, roles | boolean | 403 if not staff |
| 3 | Validate content | 0.1s | content: string | trimmed content | 422 if invalid |
| 4 | Update review | 2s | reviewId, content | Updated review + relations | 404 if not found |

### Quy tắc xác thực
- **Cần authentication**: Bearer token bắt buộc
- **Cần authorization**: Chỉ role ADMIN hoặc STAFF mới được quyền
- **STAFF_ROLES**: `[Role.ADMIN, Role.STAFF]`
- **Overwrite**: Nếu đã có reply, ghi đè (không check existing)

### Validation rules

```typescript
// Content validation
content: string
  - Min length: 1 char
  - Max length: 1000 chars
  - Trim whitespace
  - Required: true
```

### Xử lý lỗi đặc biệt

```typescript
// Prisma P2025 - Record not found
try {
  return await prisma.review.update({
    where: { id: reviewId },
    data: { replyContent: content.trim(), repliedAt: new Date() },
    include: REVIEW_ADMIN_INCLUDE,
  })
} catch (e: any) {
  if (e?.code === 'P2025') throw new AppError(404, 'Đánh giá không tồn tại')
  throw e
}

// REVIEW_ADMIN_INCLUDE = {
//   user: { select: { id, fullName, email } },
//   product: { select: { id, name, slug } },
//   photos: { orderBy: { sortOrder: 'asc' }, select: { id, url } },
//   _count: { select: { helpful } },
// }
```

### Observable States

| Actor | State during operation | Database |
|-------|------------------------|----------|
| Admin | Loading indicator → Reply form updates | replyContent, repliedAt columns updated |
| Customer | - | No immediate effect (public query fetches reply) |
| Public | - | No immediate effect |

### Performance Target
- **P95 latency**: < 200ms (1 query)
- **Timeout**: 5s
- **Database queries**: 1 query (update with include)
- **External calls**: 0

### Overwrite Logic

```
┌─────────────────────────────────────────────┐
│  OVERWRITE STRATEGY                           │
├─────────────────────────────────────────────┤
│  - Admin có thể reply nhiều lần              │
│  - Mỗi lần reply = ghi đè replyContent cũ    │
│  - repliedAt luôn được update = now()        │
│  - Không hiển thị history reply              │
│  - UI admin: Form edit (không phải append)   │
└─────────────────────────────────────────────┘

Ví dụ:
Reply 1: "Cảm ơn bạn đã đánh giá!" → repliedAt = T1
Reply 2: "Chúng tôi sẽ cải thiện..." → repliedAt = T2, replyContent = "Chúng tôi sẽ cải thiện..."
```

---

## PHÂN TÍCH SO SÁNH

### Bảng so sánh 6 workflows

| Workflow | Endpoint | Auth | Actor | Database queries | External calls | Timeout | P95 target |
|----------|----------|------|-------|------------------|----------------|---------|------------|
| 1. Xem tóm tắt | GET /products/:slug/reviews/summary | Không | Public | 3 (parallel) | 0 | 5s | 200ms |
| 2. Danh sách | GET /products/:slug/reviews | Không | Public | 2 (parallel) | 0 | 5s | 300ms |
| 3. Tạo review | POST /order-items/:orderItemId/review | Có | Customer | 4 | 0-5 Cloudinary | 15s | 8s |
| 4. Cập nhật | PUT /reviews/:id | Có | Customer | 3 | 0-5 Cloudinary + cleanup | 15s | 8s |
| 5. Toggle helpful | POST /reviews/:id/helpful | Có | Customer | 3 (2 parallel reads) | 0 | 3s | 100ms |
| 6. Admin reply | POST /admin/reviews/:id/reply | Có + Authorize | Admin | 1 | 0 | 5s | 200ms |

### Common patterns

#### 1. Authentication Pattern
```typescript
// Public workflows (1, 2)
router.get('/summary', controller.getSummary)
router.get('/', controller.list)
→ Không có middleware.authenticate

// Customer workflows (3, 4, 5)
router.use(authenticate) → req.user.userId available
→ 401 if missing/invalid token

// Admin workflow (6)
router.use(authenticate, authorize(...STAFF_ROLES))
→ 401 if missing token
→ 403 if not staff role
```

#### 2. Ownership Pattern
```typescript
// Workflow 3: Create review
WHERE orderItem.id = orderItemId
  AND order.order.userId = userId
  AND order.status = DELIVERED
→ Chỉ được review OrderItem của chính mình

// Workflow 4: Update review
WHERE review.id = reviewId AND review.userId = userId
→ Chỉ được edit review của chính mình

// Workflow 5: Toggle helpful
WHERE reviewHelpful.userId_reviewId = { userId, reviewId }
→ Bất kỳ user đều vote, nhưng chỉ toggle vote của chính mình
```

#### 3. Validation Pattern
```typescript
// Input validation middleware
validateCreateReview → rating 1-5, content 10-2000, photos 0-5
validateUpdateReview → rating? 1-5, content? 10-2000, photos? 0-5
validateReplyReview → content 1-1000

// Business logic validation
- OrderStatus = DELIVERED (workflow 3)
- Review không tồn tại (workflow 3 → 409)
- 30-day window (workflow 4)
- ReviewStatus = APPROVED (workflow 5)
```

#### 4. Error Handling Pattern
```typescript
// 401 - Unauthorized
→ Missing hoặc invalid JWT token

// 403 - Forbidden
→ Không có quyền (workflow 6: không phải staff)

// 404 - Not Found
→ Product không tồn tại (workflow 1, 2)
→ Review không tồn tại (workflow 4, 5, 6)
→ OrderItem không thỏa điều kiện (workflow 3)

// 409 - Conflict
→ Đã review rồi (workflow 3)

// 422 - Validation Error
→ Input không hợp lệ (rating, content, files)

// 400 - Bad Request
→ Quá 30 ngày (workflow 4)
→ Không resolve được productId (workflow 3)
```

### Photo Management Strategy

#### Upload Strategy
```typescript
// Workflow 3 & 4: Upload 0-5 photos
const uploadPromise = files?.length
  ? Promise.all(files.slice(0, MAX_PHOTOS).map((f) => uploadEntityImage(f.buffer, 'reviews')))
  : Promise.resolve([])

// Parallel upload → tối ưu tốc độ
// Max 5 files → giới hạn Cloudinary API rate limit
// Folder: 'reviews' → tổ chức storage
```

#### Replacement Strategy (Workflow 4)
```typescript
// 1. Upload photos mới (parallel)
const uploaded = await Promise.all(files.map(f => uploadEntityImage(f.buffer, 'reviews')))

// 2. Fire-and-forget xóa photos cũ
review.photos.forEach((p) => void destroyImage(p.publicId))
// "void" = không await, không throw error

// 3. Update DB (atomic)
data.photos = {
  deleteMany: {},    // Xóa all existing photos
  create: uploaded   // Tạo all new photos
}

// Why fire-and-forget?
// - Cleanup không critical cho user experience
// - Nếu cleanup failed → orphan records in Cloudinary (acceptable)
// - Dọn dẹp định kỳ bằng script
```

#### Cleanup Strategy (Workflow 4, Admin Delete)
```typescript
// Review deletion
await prisma.review.delete({ where: { id: reviewId } })
review.photos.forEach((p) => void destroyImage(p.publicId))
// Tốt hơn: nên await cleanup trong background job
// Hiện tại: fire-and-forget để tránh blocking response
```

### Idempotency Considerations

#### Idempotent workflows
```typescript
// Workflow 1 & 2: GET requests
→ Tự nhiên idempotent (không có side effects)

// Workflow 5: Toggle helpful
→ KHÔNG idempotent (toggle state)
→ POST N lần = toggle N lần
→ UI button: "Hữu ích" ⇄ "Bỏ hữu ích"
```

#### Non-idempotent workflows
```typescript
// Workflow 3: Create review
→ KHÔNG idempotent
→ POST N lần = tạo N reviews (nếu pass 409 check)
→ Guard by: 409 if review already exists

// Workflow 4: Update review
→ KHÔNG idempotent (nếu có photos)
→ Mỗi lần upload = new photos (ghi đè cũ)
→ Guard by: 30-day window

// Workflow 6: Admin reply
→ KHÔNG idempotent
→ POST N lần = update replyContent N lần (overwrite)
→ Không có guard (admin có thể reply nhiều lần)
```

### Race Condition Prevention

#### Workflow 3: Create Review
```typescript
// Race: 2 requests cùng lúc tạo review cho 1 OrderItem
// Guard: WHERE orderItem.id + userId + status = DELIVERED + review IS NULL
// DB constraint: Unique(orderItemId) trên review table
→ Request 1: CREATE success
→ Request 2: 409 Conflict (đã có review)
```

#### Workflow 5: Toggle Helpful
```typescript
// Race: 2 requests cùng lúc toggle vote
// Case 1: Cả 2 đều không thấy existing vote
→ Request 1: findUnique → null → CREATE success
→ Request 2: findUnique → null → CREATE → P2002 (unique constraint)
→ Resolution: Retry 1 lần → vẫn fail → return 409

// Case 2: Cả 2 đều thấy existing vote
→ Request 1: findUnique → exists → DELETE success
→ Request 2: findUnique → exists → DELETE → P2025 (not found)
→ Resolution: Treat as success (vote đã không tồn tại = desired state)
```

### Performance Optimization Insights

#### Parallel Queries
```
Workflow 1: 3 parallel queries (aggregate, groupBy, count)
→ Latency = max(query times) ≈ 200ms (chứ không phải 600ms)

Workflow 2: 2 parallel queries (findMany, count)
→ Latency = max(query times) ≈ 300ms

Workflow 5: 2 parallel reads (review, vote)
→ Latency = max(query times) ≈ 50ms
```

#### Database Optimization
```typescript
// Minimal SELECT columns
WHERE id = reviewId SELECT id, status (chỉ 2 columns thay vì *)

// Include optimization
REVIEW_PUBLIC_SELECT = { id, rating, content, user, photos, _count }
→ Chỉ select fields cần thiết cho public API

// Index recommendations
- reviews(productId, status) → cho workflow 1, 2
- reviews(userId, createdAt) → cho workflow 4 (30-day check)
- reviewHelpful(userId_reviewId) → unique index cho workflow 5
- orderItems(id, order(status)) → cho workflow 3
```

#### External Call Optimization
```typescript
// Cloudinary upload: Parallel 0-5 photos
→ Sequential upload: 5 × 2s = 10s
→ Parallel upload: max(5 × 2s) = 2s (ideal)
→ Realistic: 2-5s (network overhead)

// Fire-and-forget cleanup
→ Không blocking response time
→ Giảm P95 latency từ 8s → 6s
```

---

## KẾT LUẬN

Module Review với 6 workflows này đảm bảo:

1. **UX tốt**: Public workflow không cần auth, fast response
2. **Bảo mật**: Customer workflow có auth + ownership check, Admin workflow có authorize
3. **Performance**: Parallel queries, minimal selects, fire-and-forget cleanup
4. **Độ tin cậy**: Error handling rõ ràng, race condition prevention, idempotency guard
5. **Scalability**: Pagination, filter, sort, photo upload limits

**Điểm cần cải thiện**:
- Thêm caching cho workflow 1 (thống kê không thay đổi realtime)
- Thêm background job cho photo cleanup (tránh orphan records)
- Thêm rate limit cho workflow 3 (tràn spam review)
- Thêm transaction cho workflow 4 (atomic update + cleanup)
- Thủy thử common pattern sang BaseRepository hoặc BaseService

**File tham khảo**:
- Controller: `be_mobivexa/src/controllers/review.controller.ts`
- Service: `be_mobivexa/src/services/review.service.ts`
- Routes: `be_mobivexa/src/routes/review.route.ts`
- Validators: `be_mobivexa/src/validators/review.validator.ts`
- Types: `be_mobivexa/src/types/review.type.ts`

---

**Người tạo**: Workflow Architect  
**Ngày tạo**: 2026-06-20  
**Phiên bản**: 1.0  
**Trạng thái**: Hoàn thành - Ready for review
