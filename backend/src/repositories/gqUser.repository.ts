import { gq_user } from "@prisma/client";
import { prisma } from "./prismaClient";

/** Finds or creates the gq_user row that links a GQ session to a BQ/EQ aq_users.id. */
export async function upsertGqUserByBqUserId(bqUserId: number): Promise<gq_user> {
  return prisma.gq_user.upsert({
    where: { bq_user_id: bqUserId },
    update: {},
    create: { bq_user_id: bqUserId },
  });
}
