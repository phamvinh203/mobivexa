import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// DB_SSL_NO_VERIFY=true chỉ set trong local dev khi dùng self-signed cert
// Không bao giờ set trong production
const sslConfig = process.env.NODE_ENV === "production"
  ? true
  : process.env.DB_SSL_NO_VERIFY === "true"
    ? { rejectUnauthorized: false }
    : true

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

export async function connectDB(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("[DB] Connected to PostgreSQL successfully");
  } catch (error) {
    console.error("[DB] Connection failed:", error);
    process.exit(1);
  }
}

// Các index tìm kiếm không khai báo được trong schema.prisma (biểu thức + GIN).
// Chạy lúc khởi động, IF NOT EXISTS nên lặp lại vô hại.
//
// Lỗi ở đây chỉ warn chứ không chặn boot: thiếu index thì truy vấn chậm đi,
// nhưng vẫn cho kết quả đúng — sập server vì không tạo được index thì tệ hơn.
export async function ensureSearchIndexes(): Promise<void> {
  // Tên sản phẩm: full-text search. Dictionary 'simple' — không stem, hợp với
  // tiếng Việt và tên sản phẩm.
  try {
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_products_name_fts
      ON products USING GIN (to_tsvector('simple', name))
    `;
    console.log("[DB] FTS index ready");
  } catch (error) {
    console.warn("[DB] Could not create FTS index:", error);
  }

  // Mã đơn: admin tra bằng một mẩu giữa chuỗi ("A1B2C3", "20260817"), tức là
  // ILIKE '%...%'. Wildcard đứng đầu nên btree của @unique vô dụng — không có
  // index này thì mỗi lần gõ là quét cạn bảng orders HAI lần (findMany + count).
  // pg_trgm là loại index duy nhất phục vụ được khớp giữa chuỗi.
  try {
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_orders_order_code_trgm
      ON orders USING GIN (order_code gin_trgm_ops)
    `;
    console.log("[DB] Order code trigram index ready");
  } catch (error) {
    console.warn("[DB] Could not create order code index:", error);
  }
}

export default prisma;
