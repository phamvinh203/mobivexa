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

// Tạo GIN index cho full-text search nếu chưa có
// Dùng 'simple' dictionary — không stem, phù hợp cho tiếng Việt + tên sản phẩm
export async function ensureFtsIndexes(): Promise<void> {
  try {
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_products_name_fts
      ON products USING GIN (to_tsvector('simple', name))
    `;
    console.log("[DB] FTS index ready");
  } catch (error) {
    console.warn("[DB] Could not create FTS index:", error);
  }
}

export default prisma;
