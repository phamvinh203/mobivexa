import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? true
    : { rejectUnauthorized: false },
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
