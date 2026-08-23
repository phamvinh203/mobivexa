# Chatbot tư vấn sản phẩm (Gemini) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm trợ lý hội thoại trả lời câu hỏi về sản phẩm dựa trên dữ liệu thật trong database, qua `POST /api/chat/messages`.

**Architecture:** Gemini không nhận dữ liệu sản phẩm nhồi sẵn trong prompt mà tự gọi bốn **tool chỉ đọc**; backend chạy tool bằng cách gọi lại `listProducts`/`getProductBySlug` sẵn có nên giá và tồn kho luôn là dữ liệu tại thời điểm hỏi, và định nghĩa "sản phẩm nào được phép hiện ra" chỉ tồn tại một bản. Vòng lặp gọi tool bị chặn ở 3 vòng. Hai bảng mới `ChatSession`/`ChatMessage` lưu hội thoại cho cả khách vãng lai lẫn user đã đăng nhập.

**Tech Stack:** Express 5, TypeScript, Prisma 7 + PostgreSQL, `@google/genai`, Vitest + Supertest.

**Spec:** `docs/superpowers/specs/2026-08-23-chatbot-gemini-design.md`

## Global Constraints

- Thư mục làm việc: `be_mobivexa/`. Mọi đường dẫn dưới đây tính từ đó (trừ spec/plan nằm ở `../docs/`).
- Tầng lớp bắt buộc: `route → validator → controller → service`. Controller bọc `asyncHandler`, trả qua `sendSuccess`. Service ném `AppError(status, message)`, không chạm `req`/`res`.
- Mọi thông điệp lỗi hướng tới người dùng viết bằng **tiếng Việt**.
- Comment giải thích **tại sao**, không phải cái gì. Tiếng Việt, theo văn phong sẵn có trong repo.
- Kiểm tra id dạng chuỗi dùng `checkId(res, value, message)` từ `src/validators/common.validator.ts`.
- Dự án dùng `npx prisma db push`, **KHÔNG** dùng migration file.
- Model mặc định `gemini-2.5-flash`, đọc từ `GEMINI_MODEL`; API key đọc từ `GEMINI_API_KEY`. Key chỉ tồn tại ở backend.
- Hằng số cứng: `MAX_TOOL_ROUNDS = 3`, `HISTORY_LIMIT = 10`, `MAX_MESSAGE_LENGTH = 2000`, `MAX_PRODUCTS = 8`, `GEMINI_TIMEOUT_MS = 30_000`.
- `npx tsc --noEmit` phải exit 0 và `npx vitest run` phải xanh trước mỗi lần commit.
- Test **không bao giờ** gọi Gemini API thật — client luôn bị mock.

---

## Sơ đồ file

**Tạo mới**

| File | Trách nhiệm |
|---|---|
| `src/config/gemini.ts` | Đọc + kiểm tra env, khởi tạo client. Nơi duy nhất chạm vào SDK khi khởi tạo. |
| `src/types/chat.type.ts` | Kiểu request/response/trace, không có logic |
| `src/services/chatbot_tools.ts` | Khai báo tool cho model + thực thi tool + rút gọn dữ liệu. Không biết gì về hội thoại. |
| `src/services/chat.service.ts` | Quản lý phiên + vòng lặp hội thoại. Không biết tool nào tồn tại, chỉ gọi `executeTool`. |
| `src/controllers/chat.controller.ts` | Chuyển req/res |
| `src/validators/chat.validator.ts` | Kiểm tra body |
| `src/routes/chat.route.ts` | Xuất `chatRoutes` |
| `src/__tests__/gemini_config.test.ts` | Test ràng buộc env, không mock |
| `src/__tests__/chatbot_tools.test.ts` | Test tool, mock Prisma |
| `src/__tests__/chat_service.test.ts` | Test vòng lặp hội thoại, mock Prisma + Gemini |
| `src/__tests__/chat.test.ts` | Test HTTP, mock Prisma + Gemini |

**Sửa**

| File | Thay đổi |
|---|---|
| `prisma/schema.prisma` | `enum ChatRole`, `model ChatSession`, `model ChatMessage`, quan hệ ngược ở `User` |
| `src/middlewares/auth.middleware.ts` | Thêm `optionalAuthenticate` |
| `src/middlewares/rate_limit.middleware.ts` | Thêm `chatLimiter` |
| `src/routes/index.route.ts` | Mount `/api/chat` |
| `vitest.config.ts` | Thêm `GEMINI_API_KEY` vào `env` |
| `package.json` | Thêm `@google/genai` |

Ranh giới quan trọng: `chatbot_tools.ts` không import `chat.service.ts` và ngược lại `chat.service.ts` không import Prisma model sản phẩm. Muốn thêm tool mới thì chỉ sửa một file; muốn đổi cách quản lý phiên cũng chỉ sửa một file.

---

## Task 1: Schema hai bảng chat

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: không
- Produces: model Prisma `chatSession` (`{ id, userId, title, createdAt, updatedAt }`), `chatMessage` (`{ id, sessionId, role, content, toolCalls, createdAt }`), enum `ChatRole = USER | MODEL`

- [ ] **Step 1: Thêm enum `ChatRole`**

Đặt ngay sau `enum BannerPosition` (khoảng dòng 49–54), cùng cụm với các enum khác:

```prisma
enum ChatRole {
  USER
  MODEL
}
```

- [ ] **Step 2: Thêm quan hệ ngược vào model `User`**

Trong `model User`, thêm một dòng ngay sau `favorites     Favorite[]`:

```prisma
  chatSessions  ChatSession[]
```

- [ ] **Step 3: Thêm hai model vào cuối file**

```prisma
// Một phiên trò chuyện với chatbot.
//
// userId nullable vì khách CHƯA đăng nhập vẫn phải chat được — đó chính là nhóm
// cần tư vấn nhất. Xoá tài khoản thì SetNull chứ không Cascade: hội thoại là dữ
// liệu thống kê về chất lượng tư vấn, mất theo tài khoản là mất luôn số liệu.
model ChatSession {
  id        String   @id @default(uuid())
  userId    String?
  title     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user     User?         @relation(fields: [userId], references: [id], onDelete: SetNull)
  messages ChatMessage[]

  @@index([userId, updatedAt])
  @@map("chat_sessions")
}

// Một tin nhắn trong phiên. role = USER là người hỏi, MODEL là bot trả lời.
//
// toolCalls lưu vết bot đã tra cứu gì ở lượt đó (tên tool, tham số, số kết quả).
// Không có nó thì khi bot trả lời sai không cách nào biết là do tra cứu ra dữ
// liệu sai hay do model diễn đạt sai.
model ChatMessage {
  id        String   @id @default(uuid())
  sessionId String
  role      ChatRole
  content   String
  toolCalls Json?
  createdAt DateTime @default(now())

  session ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  // Truy vấn duy nhất trên bảng này là "N tin gần nhất của phiên X" — index gộp
  // phục vụ trọn cả lọc lẫn sắp xếp.
  @@index([sessionId, createdAt])
  @@map("chat_messages")
}
```

- [ ] **Step 4: Kiểm tra schema hợp lệ**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid`

- [ ] **Step 5: Đẩy schema lên DB và sinh lại client**

```bash
npx prisma db push
```

```bash
npx prisma generate
```

Expected: `db push` báo hai bảng mới được tạo, `generate` chạy xong không lỗi.

- [ ] **Step 6: Xác nhận client đã có model mới**

```bash
ls src/generated/prisma/models | grep -i chat
```

Expected: in ra `ChatMessage.ts` và `ChatSession.ts`

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(chat): add ChatSession and ChatMessage models"
```

`src/generated/prisma` nằm trong `.gitignore` — client sinh ra không được commit, mỗi máy tự chạy `prisma generate`.

---

## Task 2: Cấu hình Gemini client

**Files:**
- Create: `src/config/gemini.ts`
- Modify: `vitest.config.ts`
- Modify: `package.json` (qua `npm install`)
- Test: `src/__tests__/gemini_config.test.ts`

**Interfaces:**
- Consumes: không
- Produces:
  - `genAI: GoogleGenAI` — client dùng chung
  - `GEMINI_MODEL: string`
  - `GEMINI_TIMEOUT_MS: number` (= 30000)

- [ ] **Step 1: Cài SDK**

```bash
npm install @google/genai
```

- [ ] **Step 2: Đối chiếu bề mặt SDK thực tế**

Phiên bản SDK có thể khác tài liệu. Kiểm tra ba thứ mà code sẽ dùng:

```bash
grep -rn "functionCalls\|systemInstruction\|functionDeclarations" node_modules/@google/genai/dist/*.d.ts | head -20
```

Expected: cả ba tên đều xuất hiện. Nếu tên khác, ghi lại tên thật và dùng tên đó ở Task 4 — `callGemini` trong `chat.service.ts` là **nơi duy nhất** chạm vào hình dạng response, nên chỉ sửa ở đó.

- [ ] **Step 3: Thêm key vào `.env.local`**

Thêm hai dòng (lấy key ở https://aistudio.google.com/apikey):

```
GEMINI_API_KEY=<key thật>
GEMINI_MODEL=gemini-2.5-flash
```

- [ ] **Step 4: Thêm key giả vào `vitest.config.ts`**

Trong `test.env`, thêm một dòng sau `SEPAY_ACCOUNT_NUMBER`:

```ts
      GEMINI_API_KEY: 'test-gemini-key',
```

Không có dòng này thì mọi test import tới `app.ts` sẽ chết ngay khi load module, vì `config/gemini.ts` ném lỗi lúc thiếu key.

- [ ] **Step 5: Viết test cho ràng buộc env**

Tạo `src/__tests__/gemini_config.test.ts`. File này đứng riêng, **không** gộp vào `chat_service.test.ts`: Task 4 sẽ `vi.mock('../config/gemini')` cho cả file đó, mà module đã bị mock thì `await import('../config/gemini')` trả về bản giả — hai nhóm test này không sống chung được.

```ts
import { vi, describe, it, expect, afterEach } from 'vitest'

// ─── config/gemini ────────────────────────────────────────────────────────────

describe('config/gemini', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('ném lỗi ngay khi import nếu thiếu GEMINI_API_KEY', async () => {
    vi.stubEnv('GEMINI_API_KEY', '')
    vi.resetModules()

    await expect(import('../config/gemini')).rejects.toThrow(/GEMINI_API_KEY/)
  })

  it('dùng gemini-2.5-flash khi không set GEMINI_MODEL', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    vi.stubEnv('GEMINI_MODEL', '')
    vi.resetModules()

    const { GEMINI_MODEL } = await import('../config/gemini')
    expect(GEMINI_MODEL).toBe('gemini-2.5-flash')
  })
})
```

- [ ] **Step 6: Chạy test để thấy nó fail**

```bash
npx vitest run src/__tests__/gemini_config.test.ts
```

Expected: FAIL — `Cannot find module '../config/gemini'`

- [ ] **Step 7: Viết `src/config/gemini.ts`**

```ts
import { GoogleGenAI } from '@google/genai'

// Kiểm tra ngay lúc import, không đợi tới request đầu tiên.
//
// Thiếu key mà vẫn cho server khởi động thì lỗi chỉ lộ ra khi có khách thật bấm
// gửi tin nhắn — lúc đó nó là lỗi 500 giữa giờ chạy, thay vì một dòng báo lỗi
// lúc deploy.
const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  throw new Error('Thiếu GEMINI_API_KEY trong biến môi trường — chatbot không khởi động được')
}

// flash: độ trễ thấp, chi phí thấp, đủ cho tư vấn sản phẩm. Đọc từ env để đổi
// sang model mạnh hơn mà không phải sửa code.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

// Người dùng đợi quá 30 giây là đã đóng tab. Thà trả lỗi "trợ lý đang bận" còn
// hơn giữ connection treo cho tới khi Express tự cắt.
export const GEMINI_TIMEOUT_MS = 30_000

export const genAI = new GoogleGenAI({ apiKey })
```

- [ ] **Step 8: Chạy test để thấy nó pass**

```bash
npx vitest run src/__tests__/gemini_config.test.ts
```

Expected: PASS, 2 test

- [ ] **Step 9: Kiểm tra kiểu**

```bash
npx tsc --noEmit
```

Expected: exit 0

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/config/gemini.ts src/__tests__/gemini_config.test.ts
git commit -m "feat(chat): add Gemini client config with startup env check"
```

---

## Task 3: Bộ tool chỉ đọc cho model

**Files:**
- Create: `src/types/chat.type.ts`
- Create: `src/services/chatbot_tools.ts`
- Test: `src/__tests__/chatbot_tools.test.ts`

**Interfaces:**
- Consumes: `listProducts(query, opts?)`, `getProductBySlug(slug)` từ `src/services/product.service.ts`; `getCategories()` từ `category.service.ts`; `getBrands()` từ `brand.service.ts`
- Produces:
  - `CHAT_TOOL_DECLARATIONS: FunctionDeclaration[]`
  - `executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult>`
  - `interface ToolResult { data: unknown; products: ChatProductCard[] }`
  - `interface ChatProductCard { id, name, slug, salePrice, originalPrice, imageUrl }` (từ `chat.type.ts`)
  - `interface ToolCallTrace { name, args, resultCount }`
  - `interface SendMessageBody { sessionId?: string; message: string }`
  - `interface ChatReply { sessionId: string; reply: string; products: ChatProductCard[] }`

- [ ] **Step 1: Viết `src/types/chat.type.ts`**

```ts
// Body của POST /api/chat/messages. sessionId không bắt buộc: thiếu thì service
// tạo phiên mới, nhờ vậy lượt chat đầu tiên chỉ tốn một request.
export interface SendMessageBody {
  sessionId?: string
  message: string
}

// Sản phẩm rút gọn để frontend render thành card bấm được.
//
// salePrice/originalPrice để kiểu string vì Prisma trả Decimal — ép sang number
// là mất chính xác với số tiền lớn, mà VND thì thường xuyên chạm hàng chục triệu.
export interface ChatProductCard {
  id: string
  name: string
  slug: string
  salePrice: string
  originalPrice: string
  imageUrl: string | null
}

export interface ChatReply {
  sessionId: string
  reply: string
  products: ChatProductCard[]
}

// Vết tra cứu lưu vào ChatMessage.toolCalls
export interface ToolCallTrace {
  name: string
  args: Record<string, unknown>
  resultCount: number
}
```

- [ ] **Step 2: Viết test cho tool (fail trước)**

Tạo `src/__tests__/chatbot_tools.test.ts`:

```ts
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  product:  { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
  category: { findMany: vi.fn() },
  brand:    { findMany: vi.fn() },
  $queryRaw: vi.fn(),
}))

vi.mock('../config/db', () => ({ default: mockPrisma }))

import { executeTool, CHAT_TOOL_DECLARATIONS } from '../services/chatbot_tools'

const VARIANT = {
  id: 'var-1',
  color: 'Đen',
  storage: '256GB',
  ram: '8GB',
  salePrice: 9990000,
  originalPrice: 11990000,
  stock: 5,
  isActive: true,
}

const PRODUCT_ROW = {
  id: 'prod-1',
  name: 'iPhone 15',
  slug: 'iphone-15',
  isActive: true,
  category: { id: 'cat-1', name: 'Điện thoại', slug: 'dien-thoai' },
  brand:    { id: 'brand-1', name: 'Apple', slug: 'apple' },
  variants: [VARIANT],
  images:   [{ url: 'https://cdn/iphone.jpg', isCover: true }],
}

beforeEach(() => vi.clearAllMocks())

// ─── Khai báo tool ────────────────────────────────────────────────────────────

describe('CHAT_TOOL_DECLARATIONS', () => {
  it('khai báo đúng bốn tool chỉ đọc', () => {
    const names = CHAT_TOOL_DECLARATIONS.map((t) => t.name).sort()
    expect(names).toEqual(['getProductDetail', 'listBrands', 'listCategories', 'searchProducts'])
  })
})

// ─── searchProducts ───────────────────────────────────────────────────────────

describe('executeTool: searchProducts', () => {
  it('chỉ tìm trong sản phẩm đang bán', async () => {
    mockPrisma.product.findMany.mockResolvedValue([PRODUCT_ROW])
    mockPrisma.product.count.mockResolvedValue(1)

    await executeTool('searchProducts', { categorySlug: 'dien-thoai' })

    const where = mockPrisma.product.findMany.mock.calls[0][0].where
    expect(where.isActive).toBe(true)
  })

  it('trả card sản phẩm kèm giá của biến thể rẻ nhất', async () => {
    mockPrisma.product.findMany.mockResolvedValue([PRODUCT_ROW])
    mockPrisma.product.count.mockResolvedValue(1)

    const result = await executeTool('searchProducts', { categorySlug: 'dien-thoai' })

    expect(result.products).toEqual([
      {
        id: 'prod-1',
        name: 'iPhone 15',
        slug: 'iphone-15',
        salePrice: '9990000',
        originalPrice: '11990000',
        imageUrl: 'https://cdn/iphone.jpg',
      },
    ])
  })

  it('chặn limit vượt quá 8', async () => {
    mockPrisma.product.findMany.mockResolvedValue([])
    mockPrisma.product.count.mockResolvedValue(0)

    await executeTool('searchProducts', { limit: 50 })

    expect(mockPrisma.product.findMany.mock.calls[0][0].take).toBeLessThanOrEqual(8)
  })

  it('khoảng giá ngược trả về error thay vì ném lỗi', async () => {
    const result = await executeTool('searchProducts', { priceMin: 20000000, priceMax: 1000000 })

    expect(result.data).toHaveProperty('error')
    expect(result.products).toEqual([])
  })
})

// ─── getProductDetail ─────────────────────────────────────────────────────────

describe('executeTool: getProductDetail', () => {
  it('cắt thẻ HTML khỏi mô tả', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      ...PRODUCT_ROW,
      description: '<p>Máy <b>rất</b> tốt</p>',
      specs: [{ label: 'CPU', value: 'A17' }],
      productTags: [],
    })

    const result = await executeTool('getProductDetail', { slug: 'iphone-15' })

    expect(JSON.stringify(result.data)).not.toContain('<p>')
    expect(JSON.stringify(result.data)).toContain('Máy rất tốt')
  })

  it('bỏ qua biến thể đã ngừng bán', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      ...PRODUCT_ROW,
      description: null,
      specs: [],
      productTags: [],
      variants: [VARIANT, { ...VARIANT, id: 'var-2', color: 'Trắng', isActive: false }],
    })

    const result = await executeTool('getProductDetail', { slug: 'iphone-15' })

    expect(JSON.stringify(result.data)).not.toContain('Trắng')
  })

  it('sản phẩm không tồn tại trả về error, không ném lỗi', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null)

    const result = await executeTool('getProductDetail', { slug: 'khong-co' })

    expect(result.data).toHaveProperty('error')
  })
})

// ─── Tool lạ ──────────────────────────────────────────────────────────────────

describe('executeTool: tên tool lạ', () => {
  it('trả về error thay vì ném lỗi', async () => {
    const result = await executeTool('deleteAllProducts', {})

    expect(result.data).toHaveProperty('error')
  })
})
```

- [ ] **Step 3: Chạy test để thấy nó fail**

```bash
npx vitest run src/__tests__/chatbot_tools.test.ts
```

Expected: FAIL — `Cannot find module '../services/chatbot_tools'`

- [ ] **Step 4: Viết `src/services/chatbot_tools.ts`**

```ts
import { Type, type FunctionDeclaration } from '@google/genai'
import { listProducts, getProductBySlug } from './product.service'
import { getCategories } from './category.service'
import { getBrands } from './brand.service'
import type { ChatProductCard } from '../types/chat.type'

// Trần cứng ở phía server. Model có thể xin limit bao nhiêu tuỳ nó, con số thật
// vẫn do đây quyết định — tham số từ model là gợi ý, không phải lệnh.
const MAX_PRODUCTS = 8
const MAX_DESCRIPTION_CHARS = 500
const MAX_VARIANTS_SHOWN = 5

export interface ToolResult {
  // Dữ liệu gửi lại cho model đọc
  data: unknown
  // Card gửi thẳng về frontend, không qua model
  products: ChatProductCard[]
}

// ─── Khai báo cho model ───────────────────────────────────────────────────────

export const CHAT_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'searchProducts',
    description:
      'Tìm sản phẩm đang bán trong cửa hàng theo từ khoá, danh mục, thương hiệu hoặc khoảng giá. ' +
      'Dùng khi khách hỏi gợi ý sản phẩm hoặc hỏi cửa hàng có bán gì. Giá tính bằng VND.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        keyword:      { type: Type.STRING, description: 'Từ khoá trong tên sản phẩm, ví dụ "iphone 15"' },
        categorySlug: { type: Type.STRING, description: 'Slug danh mục, lấy từ listCategories' },
        brandSlug:    { type: Type.STRING, description: 'Slug thương hiệu, lấy từ listBrands' },
        priceMin:     { type: Type.NUMBER, description: 'Giá thấp nhất tính bằng VND' },
        priceMax:     { type: Type.NUMBER, description: 'Giá cao nhất tính bằng VND' },
        limit:        { type: Type.NUMBER, description: `Số sản phẩm muốn lấy, tối đa ${MAX_PRODUCTS}` },
      },
    },
  },
  {
    name: 'getProductDetail',
    description:
      'Lấy chi tiết một sản phẩm: mô tả, thông số kỹ thuật, và từng biến thể kèm giá với tồn kho. ' +
      'Dùng khi khách hỏi sâu về một máy cụ thể hoặc muốn so sánh hai máy.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        slug: { type: Type.STRING, description: 'Slug sản phẩm, lấy từ kết quả searchProducts' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'listCategories',
    description: 'Liệt kê các danh mục sản phẩm cửa hàng đang bán. Dùng khi cần biết cửa hàng có những loại hàng nào.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'listBrands',
    description: 'Liệt kê các thương hiệu cửa hàng đang bán.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
]

// ─── Rút gọn dữ liệu ──────────────────────────────────────────────────────────

// Kết quả Prisma KHÔNG được đưa nguyên vẹn cho model: description chứa HTML của
// RichTextEditor với ảnh dán vào dạng base64, một sản phẩm có thể nặng vài MB.
// Đưa thẳng vào prompt là vừa đốt token vừa chạm trần context.

type VariantLike = {
  isActive: boolean
  color: string | null
  storage: string | null
  ram: string | null
  salePrice: unknown
  originalPrice: unknown
  stock: number
}

type ProductLike = {
  id: string
  name: string
  slug: string
  category?: { name: string } | null
  brand?: { name: string } | null
  variants: VariantLike[]
  images: { url: string }[]
}

const activeVariants = (variants: VariantLike[]) => variants.filter((v) => v.isActive)

// Biến thể rẻ nhất quyết định con số hiển thị trên card, khớp với cách trang
// listing đang làm (variants đã được sắp theo salePrice tăng dần).
function toCard(product: ProductLike): ChatProductCard | null {
  const cheapest = activeVariants(product.variants)[0]
  if (!cheapest) return null

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    salePrice: String(cheapest.salePrice),
    originalPrice: String(cheapest.originalPrice),
    imageUrl: product.images[0]?.url ?? null,
  }
}

function toCompact(product: ProductLike) {
  const variants = activeVariants(product.variants)

  return {
    name: product.name,
    slug: product.slug,
    category: product.category?.name ?? null,
    brand: product.brand?.name ?? null,
    priceFrom: variants[0] ? String(variants[0].salePrice) : null,
    variants: variants.slice(0, MAX_VARIANTS_SHOWN).map((v) => ({
      color: v.color,
      storage: v.storage,
      ram: v.ram,
      salePrice: String(v.salePrice),
      stock: v.stock,
    })),
  }
}

// Mô tả là HTML người soạn dán vào — model không cần thẻ, chỉ cần chữ.
function stripHtml(html: string | null): string | null {
  if (!html) return null

  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return text.length > MAX_DESCRIPTION_CHARS ? `${text.slice(0, MAX_DESCRIPTION_CHARS)}...` : text
}

// ─── Thực thi ─────────────────────────────────────────────────────────────────

function clampLimit(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 1) return MAX_PRODUCTS
  return Math.min(Math.floor(n), MAX_PRODUCTS)
}

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined

const optionalNumber = (value: unknown): string | undefined =>
  Number.isFinite(Number(value)) && value !== null && value !== '' ? String(Number(value)) : undefined

async function searchProducts(args: Record<string, unknown>): Promise<ToolResult> {
  // Gọi lại listProducts ở chế độ public thay vì viết query mới: nó đã có
  // full-text search qua GIN index, lọc theo slug danh mục/thương hiệu, lọc
  // khoảng giá theo biến thể, và tự ép isActive = true. Viết query song song sẽ
  // tạo ra bản định nghĩa thứ hai về "sản phẩm nào được phép hiện ra", và sớm
  // muộn hai bản sẽ lệch nhau.
  const { products } = await listProducts({
    search:   optionalString(args.keyword),
    category: optionalString(args.categorySlug),
    brand:    optionalString(args.brandSlug),
    minPrice: optionalNumber(args.priceMin),
    maxPrice: optionalNumber(args.priceMax),
    limit:    String(clampLimit(args.limit)),
  })

  const list = products as unknown as ProductLike[]

  return {
    data: { count: list.length, products: list.map(toCompact) },
    products: list.map(toCard).filter((c): c is ChatProductCard => c !== null),
  }
}

async function getProductDetail(args: Record<string, unknown>): Promise<ToolResult> {
  const slug = optionalString(args.slug)
  if (!slug) return { data: { error: 'Thiếu slug sản phẩm' }, products: [] }

  const product = await getProductBySlug(slug)
  const typed = product as unknown as ProductLike & {
    description: string | null
    specs: { label: string; value: string }[]
  }

  const card = toCard(typed)

  return {
    data: {
      ...toCompact(typed),
      description: stripHtml(typed.description),
      specs: typed.specs.map((s) => ({ label: s.label, value: s.value })),
    },
    products: card ? [card] : [],
  }
}

async function listCategoriesTool(): Promise<ToolResult> {
  const categories = (await getCategories()) as { name: string; slug: string }[]

  return {
    data: { categories: categories.map((c) => ({ name: c.name, slug: c.slug })) },
    products: [],
  }
}

async function listBrandsTool(): Promise<ToolResult> {
  const brands = (await getBrands()) as { name: string; slug: string }[]

  return {
    data: { brands: brands.map((b) => ({ name: b.name, slug: b.slug })) },
    products: [],
  }
}

const HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<ToolResult>> = {
  searchProducts,
  getProductDetail,
  listCategories: listCategoriesTool,
  listBrands: listBrandsTool,
}

// Mọi lỗi đều biến thành { error } gửi lại cho model, không ném ra ngoài.
//
// Model tra một slug không tồn tại là chuyện bình thường — nó đoán từ ngữ cảnh.
// Để lỗi đó nổi lên tận HTTP thì cả câu hỏi hỏng, trong khi model hoàn toàn có
// thể đọc { error } rồi tự nói "bên mình chưa có mẫu đó" và hỏi lại khách.
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const handler = HANDLERS[name]
  if (!handler) return { data: { error: `Không có công cụ tên ${name}` }, products: [] }

  try {
    return await handler(args)
  } catch (err) {
    console.error(`[Chatbot] Tool ${name} lỗi:`, err)
    const message = err instanceof Error ? err.message : 'Không tra cứu được'
    return { data: { error: message }, products: [] }
  }
}
```

- [ ] **Step 5: Chạy test để thấy nó pass**

```bash
npx vitest run src/__tests__/chatbot_tools.test.ts
```

Expected: PASS, 9 test

- [ ] **Step 6: Kiểm tra kiểu**

```bash
npx tsc --noEmit
```

Expected: exit 0

- [ ] **Step 7: Commit**

```bash
git add src/types/chat.type.ts src/services/chatbot_tools.ts src/__tests__/chatbot_tools.test.ts
git commit -m "feat(chat): add read-only Gemini tools backed by product services"
```

---

## Task 4: Vòng lặp hội thoại

**Files:**
- Create: `src/services/chat.service.ts`
- Create: `src/__tests__/chat_service.test.ts`

**Interfaces:**
- Consumes: `executeTool`, `CHAT_TOOL_DECLARATIONS` (Task 3); `genAI`, `GEMINI_MODEL`, `GEMINI_TIMEOUT_MS` (Task 2); model Prisma `chatSession`, `chatMessage` (Task 1)
- Produces:
  - `createSession(userId?: string): Promise<{ sessionId: string }>`
  - `sendMessage(body: SendMessageBody, userId?: string): Promise<ChatReply>`
  - `getMessages(sessionId: string, userId?: string): Promise<{ sessionId: string; messages: {...}[] }>`

- [ ] **Step 1: Viết test vòng lặp**

Tạo `src/__tests__/chat_service.test.ts`:

```ts
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  chatSession: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  chatMessage: { findMany: vi.fn(), createMany: vi.fn() },
}))

const mockGenAI = vi.hoisted(() => ({
  models: { generateContent: vi.fn() },
}))

vi.mock('../config/db', () => ({ default: mockPrisma }))
vi.mock('../config/gemini', () => ({
  genAI: mockGenAI,
  GEMINI_MODEL: 'gemini-2.5-flash',
  GEMINI_TIMEOUT_MS: 30_000,
}))
vi.mock('../services/chatbot_tools', () => ({
  CHAT_TOOL_DECLARATIONS: [{ name: 'searchProducts' }],
  executeTool: vi.fn(),
}))

import { sendMessage, getMessages } from '../services/chat.service'
import { executeTool } from '../services/chatbot_tools'
import { AppError } from '../helpers/app_error'

const SESSION = { id: 'sess-1', userId: null, title: 'câu hỏi cũ' }

const textReply = (text: string) => ({ text, functionCalls: [] })

const toolReply = (name: string, args: Record<string, unknown>) => ({
  text: '',
  functionCalls: [{ name, args }],
})

const CARD = {
  id: 'prod-1',
  name: 'iPhone 15',
  slug: 'iphone-15',
  salePrice: '9990000',
  originalPrice: '11990000',
  imageUrl: null,
}

// ─── sendMessage ──────────────────────────────────────────────────────────────

describe('chat.service: sendMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.chatSession.findUnique.mockResolvedValue(SESSION)
    mockPrisma.chatMessage.findMany.mockResolvedValue([])
    mockPrisma.chatMessage.createMany.mockResolvedValue({ count: 2 })
    mockPrisma.chatSession.update.mockResolvedValue(SESSION)
  })

  it('tạo phiên mới khi không truyền sessionId', async () => {
    mockPrisma.chatSession.create.mockResolvedValue({ id: 'sess-new', userId: null, title: null })
    mockGenAI.models.generateContent.mockResolvedValue(textReply('Chào bạn!'))

    const result = await sendMessage({ message: 'xin chào' })

    expect(mockPrisma.chatSession.create).toHaveBeenCalled()
    expect(result.sessionId).toBe('sess-new')
    expect(result.reply).toBe('Chào bạn!')
  })

  it('lưu cả tin của khách lẫn tin của bot', async () => {
    mockGenAI.models.generateContent.mockResolvedValue(textReply('Chào bạn!'))

    await sendMessage({ sessionId: 'sess-1', message: 'xin chào' })

    const rows = mockPrisma.chatMessage.createMany.mock.calls[0][0].data
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ role: 'USER', content: 'xin chào' })
    expect(rows[1]).toMatchObject({ role: 'MODEL', content: 'Chào bạn!' })
  })

  it('chạy tool rồi gửi kết quả lại cho model', async () => {
    vi.mocked(executeTool).mockResolvedValue({ data: { count: 1 }, products: [CARD] })
    mockGenAI.models.generateContent
      .mockResolvedValueOnce(toolReply('searchProducts', { keyword: 'iphone' }))
      .mockResolvedValueOnce(textReply('Bên mình có iPhone 15 giá 9.990.000đ'))

    const result = await sendMessage({ sessionId: 'sess-1', message: 'có iphone không' })

    expect(executeTool).toHaveBeenCalledWith('searchProducts', { keyword: 'iphone' })
    expect(mockGenAI.models.generateContent).toHaveBeenCalledTimes(2)
    expect(result.reply).toContain('iPhone 15')
    expect(result.products).toEqual([CARD])
  })

  it('dừng ở vòng thứ ba khi model gọi tool liên tục', async () => {
    vi.mocked(executeTool).mockResolvedValue({ data: { count: 0 }, products: [] })
    mockGenAI.models.generateContent.mockResolvedValue(toolReply('searchProducts', {}))

    const result = await sendMessage({ sessionId: 'sess-1', message: 'tìm giúp tôi' })

    expect(mockGenAI.models.generateContent).toHaveBeenCalledTimes(3)
    expect(result.reply).not.toBe('')
  })

  it('lưu vết tool đã gọi vào toolCalls', async () => {
    vi.mocked(executeTool).mockResolvedValue({ data: { count: 1 }, products: [CARD] })
    mockGenAI.models.generateContent
      .mockResolvedValueOnce(toolReply('searchProducts', { keyword: 'iphone' }))
      .mockResolvedValueOnce(textReply('Có nhé'))

    await sendMessage({ sessionId: 'sess-1', message: 'có iphone không' })

    const botRow = mockPrisma.chatMessage.createMany.mock.calls[0][0].data[1]
    expect(botRow.toolCalls).toEqual([
      { name: 'searchProducts', args: { keyword: 'iphone' }, resultCount: 1 },
    ])
  })

  it('chỉ gửi 10 tin gần nhất làm ngữ cảnh', async () => {
    mockGenAI.models.generateContent.mockResolvedValue(textReply('ok'))

    await sendMessage({ sessionId: 'sess-1', message: 'tiếp đi' })

    expect(mockPrisma.chatMessage.findMany.mock.calls[0][0].take).toBe(10)
  })

  it('đặt title từ tin nhắn đầu tiên của phiên chưa có title', async () => {
    mockPrisma.chatSession.findUnique.mockResolvedValue({ id: 'sess-1', userId: null, title: null })
    mockGenAI.models.generateContent.mockResolvedValue(textReply('ok'))

    await sendMessage({ sessionId: 'sess-1', message: 'tư vấn giúp tôi điện thoại' })

    expect(mockPrisma.chatSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: 'tư vấn giúp tôi điện thoại' }) }),
    )
  })

  it('gán phiên ẩn danh cho user vừa đăng nhập', async () => {
    mockGenAI.models.generateContent.mockResolvedValue(textReply('ok'))

    await sendMessage({ sessionId: 'sess-1', message: 'xin chào' }, 'user-1')

    expect(mockPrisma.chatSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1' }) }),
    )
  })

  it('404 khi phiên thuộc về người khác', async () => {
    mockPrisma.chatSession.findUnique.mockResolvedValue({ id: 'sess-1', userId: 'user-2', title: null })

    await expect(sendMessage({ sessionId: 'sess-1', message: 'hi' }, 'user-1')).rejects.toThrow(AppError)
    await expect(sendMessage({ sessionId: 'sess-1', message: 'hi' }, 'user-1')).rejects.toMatchObject({ status: 404 })
  })

  it('404 khi phiên không tồn tại', async () => {
    mockPrisma.chatSession.findUnique.mockResolvedValue(null)

    await expect(sendMessage({ sessionId: 'sess-x', message: 'hi' })).rejects.toMatchObject({ status: 404 })
  })

  it('503 khi Gemini lỗi, không lộ chi tiết lỗi gốc', async () => {
    mockGenAI.models.generateContent.mockRejectedValue(new Error('API key quota exceeded for project 12345'))

    const err = await sendMessage({ sessionId: 'sess-1', message: 'hi' }).catch((e) => e)

    expect(err).toBeInstanceOf(AppError)
    expect(err.status).toBe(503)
    expect(err.message).toBe('Trợ lý đang bận, vui lòng thử lại sau ít phút')
    expect(err.message).not.toContain('quota')
  })
})

// ─── getMessages ──────────────────────────────────────────────────────────────

describe('chat.service: getMessages', () => {
  beforeEach(() => vi.clearAllMocks())

  it('trả lịch sử theo thứ tự thời gian tăng dần', async () => {
    mockPrisma.chatSession.findUnique.mockResolvedValue(SESSION)
    mockPrisma.chatMessage.findMany.mockResolvedValue([
      { id: 'm1', role: 'USER', content: 'hỏi', createdAt: new Date('2026-08-23T10:00:00Z') },
      { id: 'm2', role: 'MODEL', content: 'đáp', createdAt: new Date('2026-08-23T10:00:05Z') },
    ])

    const result = await getMessages('sess-1')

    expect(result.messages.map((m) => m.role)).toEqual(['USER', 'MODEL'])
    expect(mockPrisma.chatMessage.findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: 'asc' })
  })

  it('404 khi phiên thuộc về người khác', async () => {
    mockPrisma.chatSession.findUnique.mockResolvedValue({ id: 'sess-1', userId: 'user-2', title: null })

    await expect(getMessages('sess-1', 'user-1')).rejects.toMatchObject({ status: 404 })
  })
})
```

- [ ] **Step 2: Chạy test để thấy nó fail**

```bash
npx vitest run src/__tests__/chat_service.test.ts
```

Expected: FAIL — `Cannot find module '../services/chat.service'`

- [ ] **Step 3: Viết `src/services/chat.service.ts`**

```ts
import prisma from '../config/db'
import { genAI, GEMINI_MODEL, GEMINI_TIMEOUT_MS } from '../config/gemini'
import { AppError } from '../helpers/app_error'
import { CHAT_TOOL_DECLARATIONS, executeTool } from './chatbot_tools'
import type {
  ChatProductCard,
  ChatReply,
  SendMessageBody,
  ToolCallTrace,
} from '../types/chat.type'

// Model có thể xin tra cứu mãi không dừng, mỗi vòng là một lần gọi API tính phí
// cộng một lần truy vấn DB. Ba vòng đủ cho tình huống nặng nhất trong thực tế:
// liệt kê danh mục -> tìm sản phẩm -> xem chi tiết để so sánh.
const MAX_TOOL_ROUNDS = 3

// Toàn bộ lịch sử được gửi lại ở MỖI lượt, nên phiên càng dài chi phí càng tăng.
// Mười tin (khoảng năm lượt qua lại) đủ giữ mạch "cái đó", "máy kia".
const HISTORY_LIMIT = 10

const MAX_TITLE_CHARS = 60
const MAX_CARDS = 8

const FALLBACK_REPLY =
  'Mình chưa tra cứu đủ thông tin để trả lời chính xác. Bạn mô tả cụ thể hơn giúp mình nhé — ' +
  'ví dụ tầm giá, hãng, hoặc tên máy bạn đang quan tâm.'

const SYSTEM_PROMPT = `Bạn là nhân viên tư vấn của một cửa hàng bán điện thoại và thiết bị công nghệ.

Nguyên tắc bắt buộc:
1. Chỉ nói về sản phẩm, giá, tồn kho dựa trên dữ liệu các công cụ trả về. Tuyệt đối không tự bịa tên máy, giá hay thông số.
2. Chưa gọi công cụ thì chưa được nêu bất kỳ con số giá nào.
3. Công cụ không trả về kết quả nào thì nói thẳng là cửa hàng chưa có mặt hàng đó, rồi gợi ý sản phẩm gần nhất.
4. Chỉ trao đổi quanh sản phẩm và dịch vụ của cửa hàng. Câu hỏi ngoài phạm vi thì từ chối lịch sự và hỏi khách cần tư vấn gì.
5. Không hứa hẹn khuyến mãi, thời gian giao hàng hay chính sách mà dữ liệu không thể hiện.
6. Trả lời bằng tiếng Việt, ngắn gọn, thân thiện, xưng "mình" và gọi khách là "bạn". Giá viết theo định dạng 9.990.000đ.`

// Kiểu tối giản của response — chỉ khai báo phần thực sự dùng tới, để đổi phiên
// bản SDK không kéo theo sửa cả file.
interface GeminiCall {
  name?: string
  args?: Record<string, unknown>
}

interface GeminiResponse {
  text?: string
  functionCalls?: GeminiCall[]
}

type Content = { role: 'user' | 'model'; parts: unknown[] }

// ─── Phiên ────────────────────────────────────────────────────────────────────

interface SessionRow {
  id: string
  userId: string | null
  title: string | null
}

// Phiên của người khác trả 404 chứ không phải 403: 403 là lời xác nhận rằng
// sessionId đó có thật, tức là biến endpoint thành máy dò phiên.
async function resolveSession(sessionId: string | undefined, userId?: string): Promise<SessionRow> {
  if (!sessionId) {
    return prisma.chatSession.create({
      data: { userId: userId ?? null },
      select: { id: true, userId: true, title: true },
    })
  }

  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true, title: true },
  })

  if (!session) throw new AppError(404, 'Không tìm thấy phiên trò chuyện')
  if (session.userId && session.userId !== userId) {
    throw new AppError(404, 'Không tìm thấy phiên trò chuyện')
  }

  return session
}

export async function createSession(userId?: string): Promise<{ sessionId: string }> {
  const session = await prisma.chatSession.create({
    data: { userId: userId ?? null },
    select: { id: true },
  })

  return { sessionId: session.id }
}

export async function getMessages(sessionId: string, userId?: string) {
  await resolveSession(sessionId, userId)

  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, role: true, content: true, createdAt: true },
  })

  return { sessionId, messages }
}

// ─── Gọi model ────────────────────────────────────────────────────────────────

// Promise.race thay vì AbortSignal của SDK: cách này không phụ thuộc phiên bản
// SDK có hỗ trợ huỷ hay không, và đây là chỗ duy nhất cần sửa nếu đổi SDK.
async function callGemini(contents: Content[]): Promise<GeminiResponse> {
  let timer: NodeJS.Timeout | undefined

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Gemini timeout')), GEMINI_TIMEOUT_MS)
  })

  try {
    return (await Promise.race([
      genAI.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: [{ functionDeclarations: CHAT_TOOL_DECLARATIONS }],
        },
      }),
      timeout,
    ])) as GeminiResponse
  } finally {
    clearTimeout(timer)
  }
}

// ─── Vòng lặp hội thoại ───────────────────────────────────────────────────────

export async function sendMessage(body: SendMessageBody, userId?: string): Promise<ChatReply> {
  const session = await resolveSession(body.sessionId, userId)

  const history = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_LIMIT,
    select: { role: true, content: true },
  })

  const contents: Content[] = history
    .reverse()
    .map((m) => ({ role: m.role === 'USER' ? ('user' as const) : ('model' as const), parts: [{ text: m.content }] }))

  contents.push({ role: 'user', parts: [{ text: body.message }] })

  const traces: ToolCallTrace[] = []
  const cards = new Map<string, ChatProductCard>()
  let reply = ''

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await callGemini(contents)
      const calls = response.functionCalls ?? []

      if (calls.length === 0) {
        reply = response.text?.trim() ?? ''
        break
      }

      contents.push({
        role: 'model',
        parts: calls.map((c) => ({ functionCall: { name: c.name, args: c.args ?? {} } })),
      })

      const parts: unknown[] = []
      for (const call of calls) {
        const name = call.name ?? ''
        const args = call.args ?? {}
        const result = await executeTool(name, args)

        result.products.slice(0, MAX_CARDS).forEach((p) => cards.set(p.id, p))
        traces.push({ name, args, resultCount: result.products.length })
        parts.push({ functionResponse: { name, response: { result: result.data } } })
      }

      contents.push({ role: 'user', parts })
    }
  } catch (err) {
    // Chi tiết lỗi từ Gemini (quota, project id, key) chỉ nằm ở log server.
    console.error('[Chatbot] Gemini lỗi:', err)
    throw new AppError(503, 'Trợ lý đang bận, vui lòng thử lại sau ít phút')
  }

  // Chạm trần vòng lặp mà model vẫn chưa chốt câu trả lời: trả câu mặc định chứ
  // không ném lỗi — khách hỏi mơ hồ không phải là sự cố hệ thống.
  if (!reply) reply = FALLBACK_REPLY

  await prisma.chatMessage.createMany({
    data: [
      { sessionId: session.id, role: 'USER', content: body.message },
      {
        sessionId: session.id,
        role: 'MODEL',
        content: reply,
        toolCalls: traces.length > 0 ? traces : undefined,
      },
    ],
  })

  // Title đặt một lần từ câu hỏi đầu tiên; userId gán khi khách đăng nhập giữa
  // chừng để phiên theo về tài khoản. Gộp chung một lần update.
  const patch: { title?: string; userId?: string } = {}
  if (!session.title) patch.title = body.message.slice(0, MAX_TITLE_CHARS)
  if (!session.userId && userId) patch.userId = userId

  if (Object.keys(patch).length > 0) {
    await prisma.chatSession.update({ where: { id: session.id }, data: patch })
  }

  return { sessionId: session.id, reply, products: [...cards.values()] }
}
```

- [ ] **Step 4: Chạy test để thấy nó pass**

```bash
npx vitest run src/__tests__/chat_service.test.ts
```

Expected: PASS, 13 test

- [ ] **Step 5: Kiểm tra kiểu**

```bash
npx tsc --noEmit
```

Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add src/services/chat.service.ts src/__tests__/chat_service.test.ts
git commit -m "feat(chat): add conversation loop with capped tool rounds"
```

---

## Task 5: Middleware auth tuỳ chọn và rate limit

**Files:**
- Modify: `src/middlewares/auth.middleware.ts`
- Modify: `src/middlewares/rate_limit.middleware.ts`
- Test: `src/__tests__/chat.test.ts` (tạo mới, phần còn lại thêm ở Task 6)

**Interfaces:**
- Consumes: `verifyAccessToken` từ `src/utils/token_manager.ts`; `makeLimiter` (hàm nội bộ trong `rate_limit.middleware.ts`)
- Produces:
  - `optionalAuthenticate(req, res, next): void`
  - `chatLimiter: RequestHandler`

- [ ] **Step 1: Viết test cho `optionalAuthenticate`**

Tạo `src/__tests__/chat.test.ts`:

```ts
import { vi, describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'

import { optionalAuthenticate } from '../middlewares/auth.middleware'
import { signAccessToken } from '../utils/token_manager'

function probeApp() {
  const app = express()
  app.get('/probe', optionalAuthenticate, (req, res) => {
    res.json({ userId: req.user?.userId ?? null })
  })
  return app
}

describe('optionalAuthenticate', () => {
  it('gắn user khi token hợp lệ', async () => {
    const token = signAccessToken({ userId: 'user-1', email: 'a@test.com', role: 'CUSTOMER' })

    const res = await request(probeApp()).get('/probe').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.userId).toBe('user-1')
  })

  it('cho qua khi không có header', async () => {
    const res = await request(probeApp()).get('/probe')

    expect(res.status).toBe(200)
    expect(res.body.userId).toBeNull()
  })

  it('cho qua khi token hỏng, không trả 401', async () => {
    const res = await request(probeApp()).get('/probe').set('Authorization', 'Bearer rac-ruoi')

    expect(res.status).toBe(200)
    expect(res.body.userId).toBeNull()
  })
})
```

- [ ] **Step 2: Chạy test để thấy nó fail**

```bash
npx vitest run src/__tests__/chat.test.ts
```

Expected: FAIL — `optionalAuthenticate is not a function` hoặc lỗi import

- [ ] **Step 3: Thêm `optionalAuthenticate` vào `src/middlewares/auth.middleware.ts`**

Thêm vào cuối file, sau hàm `authenticate`:

```ts
// Bản mềm của authenticate, dành cho endpoint phục vụ cả khách vãng lai.
//
// Token hỏng hoặc hết hạn KHÔNG trả 401: với chatbot, khách mở lại tab cũ mang
// theo token quá hạn vẫn nên chat được như người chưa đăng nhập, thay vì bị chặn
// giữa chừng bởi một thứ họ không biết là gì.
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (authHeader?.startsWith('Bearer ')) {
    try {
      req.user = verifyAccessToken(authHeader.slice(7))
    } catch {
      // Bỏ qua: coi như khách chưa đăng nhập
    }
  }

  next()
}
```

- [ ] **Step 4: Thêm `chatLimiter` vào `src/middlewares/rate_limit.middleware.ts`**

Thêm vào cuối file:

```ts
// Mỗi tin nhắn tốn quota Gemini chứ không chỉ tốn CPU, nên siết chặt hơn các
// limiter khác. 15 tin/phút vẫn thoải mái cho người gõ thật — nhanh hơn thế là
// script.
export const chatLimiter = rateLimit(
  makeLimiter(15, 60_000, 'Bạn nhắn quá nhanh, vui lòng chờ một lát')
)
```

- [ ] **Step 5: Chạy test để thấy nó pass**

```bash
npx vitest run src/__tests__/chat.test.ts
```

Expected: PASS, 3 test

- [ ] **Step 6: Kiểm tra kiểu**

```bash
npx tsc --noEmit
```

Expected: exit 0

- [ ] **Step 7: Commit**

```bash
git add src/middlewares/auth.middleware.ts src/middlewares/rate_limit.middleware.ts src/__tests__/chat.test.ts
git commit -m "feat(chat): add optionalAuthenticate and chatLimiter"
```

---

## Task 6: Validator, controller, route và mount

**Files:**
- Create: `src/validators/chat.validator.ts`
- Create: `src/controllers/chat.controller.ts`
- Create: `src/routes/chat.route.ts`
- Modify: `src/routes/index.route.ts`
- Test: `src/__tests__/chat.test.ts` (thêm describe HTTP)

**Interfaces:**
- Consumes: `createSession`, `sendMessage`, `getMessages` (Task 4); `optionalAuthenticate`, `chatLimiter` (Task 5)
- Produces: `chatRoutes: Router` mounted tại `/api/chat`

- [ ] **Step 1: Thêm test HTTP vào `src/__tests__/chat.test.ts`**

Đổi dòng import vitest ở đầu file thành:

```ts
import { vi, describe, it, expect, beforeEach } from 'vitest'
```

Rồi thêm ngay bên dưới nó (trước các import khác, vì `vi.mock` phải hoist):

```ts
const mockChatService = vi.hoisted(() => ({
  createSession: vi.fn(),
  sendMessage: vi.fn(),
  getMessages: vi.fn(),
}))

vi.mock('../services/chat.service', () => mockChatService)
vi.mock('../config/db', () => ({ default: {} }))
```

Rồi thêm vào **cuối file**:

```ts
import { createApp } from '../app'
import { AppError } from '../helpers/app_error'

const app = createApp()
const USER_TOKEN = `Bearer ${signAccessToken({ userId: 'user-1', email: 'user@test.com', role: 'CUSTOMER' })}`

const REPLY = { sessionId: 'sess-1', reply: 'Chào bạn!', products: [] }

// ─── POST /api/chat/messages ──────────────────────────────────────────────────

describe('POST /api/chat/messages', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - khách vãng lai chat được, không cần token', async () => {
    mockChatService.sendMessage.mockResolvedValue(REPLY)

    const res = await request(app).post('/api/chat/messages').send({ message: 'xin chào' })

    expect(res.status).toBe(200)
    expect(res.body.reply).toBe('Chào bạn!')
    expect(mockChatService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'xin chào' }),
      undefined,
    )
  })

  it('200 - user đăng nhập thì userId được truyền xuống service', async () => {
    mockChatService.sendMessage.mockResolvedValue(REPLY)

    await request(app)
      .post('/api/chat/messages')
      .set('Authorization', USER_TOKEN)
      .send({ sessionId: 'sess-1', message: 'xin chào' })

    expect(mockChatService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'sess-1' }),
      'user-1',
    )
  })

  it('400 - tin nhắn rỗng', async () => {
    const res = await request(app).post('/api/chat/messages').send({ message: '   ' })

    expect(res.status).toBe(400)
    expect(mockChatService.sendMessage).not.toHaveBeenCalled()
  })

  it('400 - tin nhắn vượt 2000 ký tự', async () => {
    const res = await request(app).post('/api/chat/messages').send({ message: 'a'.repeat(2001) })

    expect(res.status).toBe(400)
    expect(mockChatService.sendMessage).not.toHaveBeenCalled()
  })

  it('400 - sessionId sai kiểu', async () => {
    const res = await request(app).post('/api/chat/messages').send({ sessionId: 123, message: 'hi' })

    expect(res.status).toBe(400)
  })

  it('cắt khoảng trắng thừa trước khi xuống service', async () => {
    mockChatService.sendMessage.mockResolvedValue(REPLY)

    await request(app).post('/api/chat/messages').send({ message: '  xin chào  ' })

    expect(mockChatService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'xin chào' }),
      undefined,
    )
  })

  it('503 - Gemini lỗi, không lộ chi tiết lỗi gốc', async () => {
    mockChatService.sendMessage.mockRejectedValue(
      new AppError(503, 'Trợ lý đang bận, vui lòng thử lại sau ít phút'),
    )

    const res = await request(app).post('/api/chat/messages').send({ message: 'hi' })

    expect(res.status).toBe(503)
    expect(res.body.message).toBe('Trợ lý đang bận, vui lòng thử lại sau ít phút')
  })

  it('404 - phiên của người khác', async () => {
    mockChatService.sendMessage.mockRejectedValue(new AppError(404, 'Không tìm thấy phiên trò chuyện'))

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', USER_TOKEN)
      .send({ sessionId: 'sess-cua-nguoi-khac', message: 'hi' })

    expect(res.status).toBe(404)
  })
})

// ─── POST /api/chat/sessions ──────────────────────────────────────────────────

describe('POST /api/chat/sessions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('201 - tạo phiên mới', async () => {
    mockChatService.createSession.mockResolvedValue({ sessionId: 'sess-new' })

    const res = await request(app).post('/api/chat/sessions')

    expect(res.status).toBe(201)
    expect(res.body.sessionId).toBe('sess-new')
  })
})

// ─── GET /api/chat/sessions/:id/messages ──────────────────────────────────────

describe('GET /api/chat/sessions/:id/messages', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 - trả lịch sử phiên', async () => {
    mockChatService.getMessages.mockResolvedValue({
      sessionId: 'sess-1',
      messages: [{ id: 'm1', role: 'USER', content: 'hỏi', createdAt: new Date() }],
    })

    const res = await request(app).get('/api/chat/sessions/sess-1/messages')

    expect(res.status).toBe(200)
    expect(res.body.messages).toHaveLength(1)
  })

  it('404 - phiên của người khác', async () => {
    mockChatService.getMessages.mockRejectedValue(new AppError(404, 'Không tìm thấy phiên trò chuyện'))

    const res = await request(app)
      .get('/api/chat/sessions/sess-cua-nguoi-khac/messages')
      .set('Authorization', USER_TOKEN)

    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Chạy test để thấy nó fail**

```bash
npx vitest run src/__tests__/chat.test.ts
```

Expected: FAIL — các request tới `/api/chat/...` trả 404 vì route chưa tồn tại

- [ ] **Step 3: Viết `src/validators/chat.validator.ts`**

```ts
import { Request, Response, NextFunction } from 'express'
import { sendError } from '../helpers/response'
import { checkId } from './common.validator'

// Mỗi ký tự đều thành token gửi lên Gemini. 2000 ký tự đã dài hơn mọi câu hỏi
// mua hàng thật; dài hơn nữa là dán nội dung rác hoặc thử phá prompt.
const MAX_MESSAGE_LENGTH = 2000

export function validateSendMessage(req: Request, res: Response, next: NextFunction): void {
  const { sessionId, message } = req.body

  // sessionId không bắt buộc — thiếu thì service tự tạo phiên mới.
  if (sessionId !== undefined && !checkId(res, sessionId, 'sessionId không hợp lệ')) return

  if (typeof message !== 'string' || message.trim() === '') {
    sendError(res, 400, 'Nội dung tin nhắn không được để trống')
    return
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    sendError(res, 400, `Tin nhắn không được vượt quá ${MAX_MESSAGE_LENGTH} ký tự`)
    return
  }

  // Ghi đè tại chỗ: khoảng trắng thừa vừa tốn token vừa làm title xấu.
  req.body.message = message.trim()
  next()
}
```

- [ ] **Step 4: Viết `src/controllers/chat.controller.ts`**

```ts
import { Request, Response } from 'express'
import { asyncHandler } from '../helpers/async_handler'
import { sendSuccess } from '../helpers/response'
import * as chatService from '../services/chat.service'

export const create = asyncHandler(async (req: Request, res: Response) => {
  const result = await chatService.createSession(req.user?.userId)
  sendSuccess(res, result, 201)
})

export const send = asyncHandler(async (req: Request, res: Response) => {
  const result = await chatService.sendMessage(req.body, req.user?.userId)
  sendSuccess(res, result)
})

export const messages = asyncHandler(async (req: Request, res: Response) => {
  const result = await chatService.getMessages(req.params.id as string, req.user?.userId)
  sendSuccess(res, result)
})
```

- [ ] **Step 5: Viết `src/routes/chat.route.ts`**

```ts
import { Router } from 'express'
import { optionalAuthenticate } from '../middlewares/auth.middleware'
import { chatLimiter } from '../middlewares/rate_limit.middleware'
import { validateSendMessage } from '../validators/chat.validator'
import * as controller from '../controllers/chat.controller'

const router: Router = Router()

// optionalAuthenticate cho cả nhóm: khách vãng lai chat được, còn user đăng nhập
// thì phiên tự gắn về tài khoản của họ.
router.use(optionalAuthenticate)

router.post('/sessions',              chatLimiter,                        controller.create)
router.post('/messages',              chatLimiter, validateSendMessage,   controller.send)
router.get('/sessions/:id/messages',                                      controller.messages)

export const chatRoutes: Router = router
```

- [ ] **Step 6: Mount route trong `src/routes/index.route.ts`**

Thêm import cùng cụm với các import route khác:

```ts
import { chatRoutes } from './chat.route'
```

Rồi thêm một dòng vào cụm "Public + auth", ngay sau dòng `app.use(`${v}/coupons`, couponRoutes)`:

```ts
  app.use(`${v}/chat`, chatRoutes)
```

- [ ] **Step 7: Chạy test để thấy nó pass**

```bash
npx vitest run src/__tests__/chat.test.ts
```

Expected: PASS, 14 test

- [ ] **Step 8: Chạy toàn bộ test và kiểm tra kiểu**

```bash
npx vitest run
```

Expected: toàn bộ test xanh, không có suite nào hỏng vì `GEMINI_API_KEY`

```bash
npx tsc --noEmit
```

Expected: exit 0

- [ ] **Step 9: Commit**

```bash
git add src/validators/chat.validator.ts src/controllers/chat.controller.ts src/routes/chat.route.ts src/routes/index.route.ts src/__tests__/chat.test.ts
git commit -m "feat(chat): expose /api/chat endpoints"
```

---

## Task 7: Kiểm chứng với Gemini thật

Toàn bộ test ở trên đều mock model. Task này là lần đầu code chạm API thật, nên nó có thể lộ ra khác biệt về hình dạng response mà mock không bắt được.

**Files:**
- Có thể phải sửa: `src/services/chat.service.ts` (chỉ hàm `callGemini` và các kiểu `GeminiResponse`)

- [ ] **Step 1: Khởi động server**

```bash
npm run dev
```

Expected: log `[DB] Connected to PostgreSQL successfully`, không có lỗi về `GEMINI_API_KEY`

- [ ] **Step 2: Hỏi một câu không cần tra cứu**

```bash
curl -s -X POST http://localhost:3000/api/chat/messages -H "Content-Type: application/json" -d "{\"message\":\"xin chào\"}"
```

Expected: JSON có `sessionId` và `reply` là lời chào tiếng Việt, `products` rỗng.

- [ ] **Step 3: Hỏi một câu buộc phải tra cứu**

```bash
curl -s -X POST http://localhost:3000/api/chat/messages -H "Content-Type: application/json" -d "{\"message\":\"shop co dien thoai nao tam 10 trieu khong\"}"
```

Expected: `reply` nêu tên sản phẩm có thật trong DB, `products` là mảng không rỗng với `salePrice` khớp `ProductVariant.salePrice`.

Nếu `products` rỗng nhưng `reply` vẫn nêu tên máy, nghĩa là model đang bịa — kiểm tra lại `response.functionCalls` có được đọc đúng tên trường không (Step 2 của Task 2).

- [ ] **Step 4: Kiểm tra bot không nói về sản phẩm đang ẩn**

Chọn một sản phẩm có `isActive = false` trong DB, hỏi thẳng tên nó:

```bash
curl -s -X POST http://localhost:3000/api/chat/messages -H "Content-Type: application/json" -d "{\"message\":\"shop con ban <ten san pham dang an> khong\"}"
```

Expected: bot nói cửa hàng không có mặt hàng đó. Nếu nó mô tả được sản phẩm, `listProducts` đang bị gọi ở chế độ admin — kiểm tra lại `searchProducts` trong `chatbot_tools.ts` không truyền tham số `opts`.

- [ ] **Step 5: Kiểm tra câu hỏi ngoài phạm vi**

```bash
curl -s -X POST http://localhost:3000/api/chat/messages -H "Content-Type: application/json" -d "{\"message\":\"viet giup toi mot bai tho ve mua thu\"}"
```

Expected: bot từ chối lịch sự và kéo về chủ đề mua sắm.

- [ ] **Step 6: Kiểm tra lịch sử được lưu**

```bash
npx prisma studio
```

Expected: bảng `chat_sessions` có phiên vừa tạo với `title` là câu hỏi đầu tiên; `chat_messages` có các cặp USER/MODEL, và tin của bot ở bước 3 có `toolCalls` ghi lại `searchProducts`.

- [ ] **Step 7: Commit nếu có sửa**

```bash
git add -A src/services/chat.service.ts
git commit -m "fix(chat): align Gemini response handling with live API"
```

Không phải sửa gì thì bỏ qua bước này.

---

## Ghi chú cho người triển khai

**Thứ tự bắt buộc.** Task 1 → 2 → 3 → 4 → 5 → 6 → 7. Task 4 import Task 3, Task 6 import Task 4 và Task 5.

**Chỗ dễ sai nhất** là hình dạng response của `@google/genai`. Mọi test đều mock model, nên mock sai thì test vẫn xanh trong khi chạy thật lại hỏng. Đó là lý do Task 7 tồn tại và không được bỏ qua. Nếu SDK trả về khác dự kiến, chỉ sửa `callGemini` và interface `GeminiResponse` trong `chat.service.ts` — không lan ra file khác.

**Không thêm tool ghi dữ liệu.** Bốn tool hiện tại đều chỉ đọc. Ngày nào còn như vậy thì kịch bản xấu nhất của prompt injection chỉ là bot trả lời lạc đề. Thêm một tool ghi là bài toán an toàn đổi hẳn tính chất, và phải quay lại brainstorm chứ không phải thêm vào `HANDLERS`.

**Không nới `MAX_TOOL_ROUNDS` để chữa câu trả lời kém.** Model tra cứu vòng vo thường là do mô tả tool chưa rõ. Sửa trường `description` trong `CHAT_TOOL_DECLARATIONS` trước.
