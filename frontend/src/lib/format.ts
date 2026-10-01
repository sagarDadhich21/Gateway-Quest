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

/**
 * Display-only: converts an ISO "YYYY-MM-DD" date to "DD-MM-YYYY" for rendering in
 * tables/headers. Never use this for API query params or <input type="date"> values -
 * both require the ISO form; this only changes how a date string looks on screen.
 */
export function displayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}-${month}-${year}`;
}

export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString("en-IN");
}

/** Some OTA revisions (Booking.com cancellations in particular) carry no stay dates at all. */
export function stayRange(arrivalDate: string | null, departureDate: string | null): string {
  if (!arrivalDate || !departureDate) return "—";
  return `${arrivalDate} → ${departureDate}`;
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
