import { randomBytes } from "crypto";
import { getBqProperty } from "../../clients/bq/bq.client";
import {
  createChannexWebhook,
  listChannexWebhooks,
  updateChannexWebhook,
} from "../../clients/channex/channex.client";
import { ChannexWebhookCreateRequest } from "../../clients/channex/channex.types";
import { env } from "../../config/env";
import { AppError, accountConfigNotFoundError, accountConfigScopeTakenError } from "../../errors/AppError";
import { WEBHOOK_SECRET_HEADER } from "../booking/booking.routes";
import * as accountConfigRepo from "../../repositories/gqAccountConfig.repository";
import { logger } from "../../services/logger";
import {
  AccountConfigCreatedResponseDto,
  AccountConfigResponseDto,
  RegisterAccountConfigResponseDto,
  toAccountConfigCreatedResponseDto,
  toAccountConfigResponseDto,
  toRegisterAccountConfigResponseDto,
} from "./accountConfig.dto";
import { CreateAccountConfigInput } from "./accountConfig.schema";

const WEBHOOK_PATH = "/api/gq/webhooks/channex";

function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

/**
 * The webhook secret is always generated here, never accepted from the request body -
 * that's the only way to guarantee it's actually random rather than whatever a caller
 * happens to type in. It's returned once, on creation, and never again (see
 * AccountConfigResponseDto).
 *
 * webhookUrl/apiKey/environment are no longer caller-supplied (see
 * createAccountConfigSchema's comment) - webhookUrl is always derived from
 * env.PUBLIC_WEBHOOK_BASE_URL, environment always mirrors env.CHANNEX_ENVIRONMENT, and
 * there is no apiKey column at all any more (it was never read by anything).
 *
 * Two partial unique indexes on bq_property_id (schema.prisma) guarantee at most one row
 * per scope at the database level - this pre-checks the same thing first so a caller
 * gets a clear 409 pointing at rotateAccountConfigSecret() instead of a raw constraint
 * violation.
 */
export async function createAccountConfig(
  input: CreateAccountConfigInput,
  correlationId: string
): Promise<AccountConfigCreatedResponseDto> {
  const bqPropertyId = input.bqPropertyId ?? null;

  const existing = await accountConfigRepo.findAccountConfigByScope(bqPropertyId);
  if (existing) {
    throw accountConfigScopeTakenError(existing.id);
  }

  const row = await accountConfigRepo.createAccountConfig({
    bq_property_id: bqPropertyId,
    webhook_url: `${env.PUBLIC_WEBHOOK_BASE_URL}${WEBHOOK_PATH}`,
    webhook_secret: generateWebhookSecret(),
    environment: env.CHANNEX_ENVIRONMENT,
    send_data: input.sendData ?? false,
  });

  logger.info("gq_account_config_created", { correlationId, accountConfigId: row.id, bqPropertyId: row.bq_property_id });

  return toAccountConfigCreatedResponseDto(row);
}

/**
 * Generates a fresh secret for an EXISTING config, in place - same row, same id, same
 * cx_webhook_id once re-registered. This is the supported way to change a config's
 * secret: it replaces the old create-a-new-row-and-remember-to-deactivate-the-old-one
 * dance (the actual source of the duplicate-row pileup this table kept accumulating)
 * with a single action on the one row that scope will ever have. The new secret isn't
 * live on Channex until registerAccountConfigWithChannex() is called again - exactly the
 * same two-step shape creating a config already had, so the exposure window (between
 * generating the secret here and clicking Register) is no larger than it already was.
 */
export async function rotateAccountConfigSecret(
  id: string,
  correlationId: string
): Promise<AccountConfigCreatedResponseDto> {
  const row = await accountConfigRepo.findAccountConfigById(id);
  if (!row) {
    throw accountConfigNotFoundError();
  }

  const updated = await accountConfigRepo.setWebhookSecret(id, generateWebhookSecret());

  logger.info("gq_account_config_secret_rotated", { correlationId, accountConfigId: id });

  return toAccountConfigCreatedResponseDto(updated);
}

export async function listAccountConfigs(): Promise<AccountConfigResponseDto[]> {
  const rows = await accountConfigRepo.listAccountConfigs();
  return rows.map(toAccountConfigResponseDto);
}

/**
 * True only for the one specific Channex validation error this flow needs to recover
 * from: "only one webhook for callback url and event mask allowed" (a real 422,
 * confirmed live against Channex). Channex enforces at most one webhook per
 * (callback_url, event_mask) pair account-wide, so creating a webhook for a URL that
 * already has one - an earlier manual registration, or a second gq_account_config row
 * sharing the same URL - fails here instead of creating a duplicate.
 */
function isDuplicateWebhookConflict(err: unknown): boolean {
  if (!(err instanceof AppError) || err.code !== "CHANNEX_UPSTREAM_ERROR") {
    return false;
  }
  const fieldErrors = (err.details as { channexErrors?: { details?: Record<string, unknown> } } | undefined)
    ?.channexErrors?.details;
  if (!fieldErrors || typeof fieldErrors !== "object") {
    return false;
  }
  return Object.values(fieldErrors).some(
    (messages) =>
      Array.isArray(messages) && messages.some((m) => typeof m === "string" && m.includes("only one webhook"))
  );
}

function isChannexNotFound(err: unknown): boolean {
  return err instanceof AppError && err.code === "CHANNEX_UPSTREAM_ERROR" && err.httpStatus === 404;
}

/**
 * Creates the Channex webhook for a brand-new registration, or - if the duplicate
 * conflict above fires - finds the existing one for this (callback_url, event_mask)
 * pair and adopts it via PUT instead of failing. Returns the Channex-side webhook id
 * either way.
 */
async function createOrAdoptChannexWebhook(
  webhook: ChannexWebhookCreateRequest["webhook"],
  correlationId: string
): Promise<string> {
  try {
    const created = await createChannexWebhook({ webhook }, correlationId);
    return created.data.id;
  } catch (err) {
    if (!isDuplicateWebhookConflict(err)) {
      throw err;
    }

    const { data: existingWebhooks } = await listChannexWebhooks(correlationId);
    const match = existingWebhooks.find(
      (w) => w.attributes.callback_url === webhook.callback_url && w.attributes.event_mask === webhook.event_mask
    );
    if (!match) {
      // Channex says one already exists but we didn't find it (e.g. pagination, or a
      // race) - the original conflict error is more useful than a generic not-found.
      throw err;
    }

    const updated = await updateChannexWebhook(match.id, { webhook }, correlationId);
    return updated.data.id;
  }
}

/**
 * The actual Channex-side registration this whole feature exists to automate - until
 * now this was a manual `POST {CHANNEX_BASE_URL}/webhooks` curl call, pasting the
 * secret from createAccountConfig()'s one-time response into Channex by hand.
 *
 * Safe to call more than once: if this config was already registered (`cx_webhook_id`
 * set), it's updated in place via `PUT /webhooks/{id}` rather than creating a second
 * one - Channex only allows one webhook per (callback_url, event_mask) pair, so a
 * second `POST` would be rejected anyway. First-time registration that collides with a
 * webhook Channex already has for this URL (made outside this flow) is detected and
 * adopted the same way, rather than failing.
 */
export async function registerAccountConfigWithChannex(
  id: string,
  correlationId: string
): Promise<RegisterAccountConfigResponseDto> {
  const row = await accountConfigRepo.findAccountConfigById(id);
  if (!row) {
    throw accountConfigNotFoundError();
  }

  let cxPropertyId: string | null = null;
  if (row.bq_property_id !== null) {
    const bqProperty = await getBqProperty(row.bq_property_id, correlationId);
    cxPropertyId = bqProperty.cx_property_id || null;
  }

  const webhook: ChannexWebhookCreateRequest["webhook"] = {
    callback_url: row.webhook_url,
    event_mask: "*",
    property_id: cxPropertyId,
    is_global: cxPropertyId === null,
    headers: { [WEBHOOK_SECRET_HEADER]: row.webhook_secret },
    // Always true, deliberately NOT row.is_active - registering is the explicit act of
    // making this webhook live on Channex, and row.is_active is GQ's own, separate,
    // local on/off switch for findActiveWebhookSecrets() (see setAccountConfigActive's
    // own comment). Coupling the two meant deactivating a config locally, then later
    // re-registering it, would silently push is_active:false to the real Channex
    // webhook too - a real bug, not the documented "local only" behavior.
    is_active: true,
    send_data: row.send_data,
  };

  let cxWebhookId: string;
  if (row.cx_webhook_id) {
    try {
      cxWebhookId = (await updateChannexWebhook(row.cx_webhook_id, { webhook }, correlationId)).data.id;
    } catch (err) {
      // The stored id is stale (e.g. deleted on Channex's side outside this flow) -
      // fall back to create-or-adopt instead of leaving the config unregistered.
      if (!isChannexNotFound(err)) {
        throw err;
      }
      cxWebhookId = await createOrAdoptChannexWebhook(webhook, correlationId);
    }
  } else {
    cxWebhookId = await createOrAdoptChannexWebhook(webhook, correlationId);
  }

  const updated = await accountConfigRepo.setChannexWebhookId(id, cxWebhookId);
  const sharedWithOtherActiveConfigs = await accountConfigRepo.countOtherActiveConfigsWithWebhookId(cxWebhookId, id);

  logger.info("gq_account_config_registered_with_channex", {
    correlationId,
    accountConfigId: id,
    cxWebhookId,
    sharedWithOtherActiveConfigs,
  });

  return toRegisterAccountConfigResponseDto(updated, sharedWithOtherActiveConfigs);
}

/**
 * Soft on/off switch for a config's own webhook-secret verification (findActiveWebhookSecrets)
 * - deliberately does not touch the Channex-side webhook, which other active configs
 * sharing the same cx_webhook_id may still depend on (see RegisterAccountConfigResponseDto).
 */
export async function setAccountConfigActive(
  id: string,
  isActive: boolean,
  correlationId: string
): Promise<AccountConfigResponseDto> {
  const row = await accountConfigRepo.findAccountConfigById(id);
  if (!row) {
    throw accountConfigNotFoundError();
  }

  const updated = await accountConfigRepo.setAccountConfigActive(id, isActive);

  logger.info("gq_account_config_active_changed", { correlationId, accountConfigId: id, isActive });

  return toAccountConfigResponseDto(updated);
}
