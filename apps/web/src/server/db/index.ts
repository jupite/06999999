import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const globalDb = globalThis as unknown as { siteDb?: PrismaClient };
export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("数据库尚未配置");
  if (!globalDb.siteDb)
    globalDb.siteDb = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
  return globalDb.siteDb;
}
