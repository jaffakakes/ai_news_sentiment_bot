import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * PrismaClient singleton (globalThis guard survives dev HMR). Prisma 7
 * connects through the pg driver adapter; DATABASE_URL comes from .env.
 */
const globalStore = globalThis as unknown as { __prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set — copy .env.example to .env and add your PostgreSQL connection string.",
    );
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export function prisma(): PrismaClient {
  return (globalStore.__prisma ??= createClient());
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
