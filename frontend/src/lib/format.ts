/**
 * Formatting helpers ported from gateway_quest_channex.html's fmt()/money()/cur()
 * (lines 628-631), so numbers/currency read exactly as they do in the source mock.
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export function currencySymbol(code: string | null | undefined): string {
  if (!code) return "₹";
  return CURRENCY_SYMBOLS[code] ?? code;
}

export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString("en-IN");
}

/** `minor` is in minor currency units (paise), matching every rate/amount value in the mock data. */
export function money(minor: number | null | undefined, currencyCode?: string | null): string {
  if (minor === null || minor === undefined) return "—";
  const symbol = currencySymbol(currencyCode);
  return (
    symbol +
    " " +
    (minor / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}
