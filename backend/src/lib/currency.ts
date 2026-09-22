/**
 * ISO 4217 minor-unit (decimal place) counts. Per this phase's explicit requirement -
 * "convert prices to Channex minor units using the property's currency precision; do
 * NOT hardcode x100" - most currencies use 2 decimal places, but some (JPY, KRW...)
 * use 0 and a few (KWD, BHD, OMR...) use 3. Falls back to 2 for anything not listed,
 * which covers every currency this integration has actually seen in BQ data so far.
 */
const ZERO_DECIMAL_CURRENCIES = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "HUF"]);
const THREE_DECIMAL_CURRENCIES = new Set(["KWD", "BHD", "OMR", "JOD", "TND"]);

export function minorUnitDecimals(currencyCode: string): number {
  const code = currencyCode.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3;
  return 2;
}

/** Converts a major-unit amount (e.g. 4500.0 rupees) to an integer minor-unit amount (e.g. 450000 paise). */
export function toMinorUnits(majorAmount: number, currencyCode: string): number {
  const decimals = minorUnitDecimals(currencyCode);
  return Math.round(majorAmount * 10 ** decimals);
}
