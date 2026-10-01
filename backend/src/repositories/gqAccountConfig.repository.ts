import { prisma } from "./prismaClient";
import { gq_account_config } from "@prisma/client";

export interface CreateAccountConfigInput {
  bq_property_id: number | null;
  webhook_url: string;
  webhook_secret: string;
  api_key: string;
  environment: string;
  send_data: boolean;
}

/**
 * All active webhook secrets GQ has configured with Channex - used to verify an
 * inbound webhook's shared-secret header. Not scoped per-property here because the
 * webhook's own property_id (a Channex uuid) can't be resolved to a BQ property until
 * after the secret check passes - see booking.routes.ts. Channex documents no
 * cryptographic signature scheme, only a custom shared-secret header, so a plain match
 * against any known active secret is the real, complete verification available.
 */
export async function findActiveWebhookSecrets(): Promise<string[]> {
  const rows = await prisma.gq_account_config.findMany({
    where: { is_active: true },
    select: { webhook_secret: true },
  });
  return rows.map((r) => r.webhook_secret);
}

export async function createAccountConfig(input: CreateAccountConfigInput): Promise<gq_account_config> {
  return prisma.gq_account_config.create({ data: input });
}

export async function listAccountConfigs(): Promise<gq_account_config[]> {
  return prisma.gq_account_config.findMany({ orderBy: { created_at: "desc" } });
}
