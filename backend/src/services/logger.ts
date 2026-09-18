/**
 * Minimal structured logger. No external logging library is added in this phase -
 * this writes single-line JSON to stdout/stderr, which is enough to be picked up by
 * any log aggregator later without committing to one now.
 *
 * Hard rule: never pass password, token, apiKey, or other secret/payment fields into
 * `fields`. Callers are responsible for only including safe, already-redacted data
 * (correlation id, BQ property id, Channex property id, operation name, outcome).
 */

type LogFields = Record<string, unknown>;

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "accesstoken",
  "refreshtoken",
  "apikey",
  "authorization",
  "secret",
  "cardnumber",
  "cvv",
]);

function redact(fields: LogFields): LogFields {
  const safe: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    safe[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : value;
  }
  return safe;
}

function write(level: "info" | "warn" | "error", message: string, fields: LogFields = {}) {
  const line = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...redact(fields),
  };
  const target = level === "error" ? console.error : console.log;
  target(JSON.stringify(line));
}

export const logger = {
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields),
};
