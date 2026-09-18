import { channexRatePlans, channexRoomTypes } from "./channexMiddleware";

/**
 * The source keeps a separate `CX_POOL` object (Channex's own room type / rate plan
 * inventory per property) that the mapping picker modal searches against - it wasn't
 * captured in the `state` extraction this app is otherwise built from. This is a
 * reasonable synthesis for the same purpose: for each property, every cxTitle already
 * in use plus a couple of plausible unclaimed options, so the picker has more than
 * just "already mapped" items to choose from. Not sourced from the mock verbatim.
 */
export interface PoolOption {
  id: string;
  title: string;
}

const EXTRA_ROOM_TITLES = ["Premium Twin", "Family Room", "Standard Double"];
const EXTRA_RATE_TITLES = ["Early Bird", "Long Stay Discount", "Package Rate"];

function poolFor(pid: string, existingTitles: string[], extraTitles: string[]): PoolOption[] {
  const seen = new Set(existingTitles);
  const extras = extraTitles.filter((t) => !seen.has(t));
  const all = [...existingTitles, ...extras];
  return all.map((title, i) => ({ id: `${pid}-pool-${i}`, title }));
}

export function roomTypePoolFor(pid: string): PoolOption[] {
  const titles = channexRoomTypes.filter((r) => r.pid === pid && r.cxTitle).map((r) => r.cxTitle as string);
  return poolFor(pid, titles, EXTRA_ROOM_TITLES);
}

export function ratePlanPoolFor(pid: string): PoolOption[] {
  const titles = channexRatePlans.filter((r) => r.pid === pid && r.cxTitle).map((r) => r.cxTitle as string);
  return poolFor(pid, titles, EXTRA_RATE_TITLES);
}
