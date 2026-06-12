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

export default prisma;
