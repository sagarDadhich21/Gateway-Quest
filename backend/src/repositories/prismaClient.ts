import { PrismaClient } from "@prisma/client";

/**
 * Single shared Prisma client for GQ's own database, following the same
 * one-instance-per-process convention used by eq/bq's `get_prisma_client()`.
 */
export const prisma = new PrismaClient();

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
