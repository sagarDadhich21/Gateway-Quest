import "dotenv/config";
import { z } from "zod";

/**
 * All configuration is read from environment variables here, once, at startup.
 * Nothing in the rest of the app should call process.env directly - this keeps
 * secrets (Channex API key, GQ JWT secret, DB URL) out of application code and
 * gives a single fail-fast point if something required is missing.
 */

const CHANNEX_STAGING_BASE_URL = "https://staging.channex.io/api/v1";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
    GQ_PORT: z.coerce.number().int().positive().default(4000),

    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    GQ_JWT_SECRET: z.string().min(16, "GQ_JWT_SECRET must be set and reasonably long"),
    GQ_JWT_EXPIRES_IN_MINUTES: z.coerce.number().int().positive().default(240),

    AQ_BASE_URL: z.string().url("AQ_BASE_URL must be a valid URL"),
    BQ_BASE_URL: z.string().url("BQ_BASE_URL must be a valid URL"),

    CHANNEX_ENVIRONMENT: z.enum(["staging", "production"]).default("staging"),
    CHANNEX_BASE_URL: z.string().url().optional(),
    CHANNEX_API_KEY: z.string().min(1, "CHANNEX_API_KEY is required"),

    UPSTREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  })
  .transform((raw) => {
    let channexBaseUrl = raw.CHANNEX_BASE_URL;
    if (!channexBaseUrl) {
      if (raw.CHANNEX_ENVIRONMENT === "staging") {
        channexBaseUrl = CHANNEX_STAGING_BASE_URL;
      } else {
        // Channex's production base URL was not confirmed from Channex's own
        // documentation during this integration's research (see
        // CHANNEX_BQ_API_DB_MAPPING.md, section 9, item 7). Refusing to guess it.
        throw new Error(
          "CHANNEX_ENVIRONMENT=production requires CHANNEX_BASE_URL to be set explicitly - " +
            "the production base URL is not guessed by this service."
        );
      }
    }
    return { ...raw, CHANNEX_BASE_URL: channexBaseUrl };
  });

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    // Fail fast and loud - never start the server with missing/invalid config.
    throw new Error(`Invalid GQ environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
