function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Default 7-day window (today..+6) every ARI page opens with - same window used when seeding/testing this data on the backend. */
export function defaultDateRange(): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const end = new Date(today.getTime() + 6 * 86400000);
  return { dateFrom: toIsoDate(today), dateTo: toIsoDate(end) };
}
