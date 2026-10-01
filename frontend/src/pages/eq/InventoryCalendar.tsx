import { Fragment, useEffect, useState } from "react";
import { useCurrentPropertyId } from "../../auth/useCurrentProperty";
import { extractErrorMessage } from "../../api/client";
import { getAri, getAriAvailability, getRoomTypes, listRatePlans } from "../../api/gqApi";
import { DailyAvailabilityRow, RatePlan, RestrictionRow, RoomTypeSummary } from "../../api/types";
import { Icon } from "../../components/Icon";
import { PageHeader } from "../../components/PageHeader";
import { defaultDateRange } from "../../lib/dateRange";
import { money } from "../../lib/format";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function eachDate(dateFrom: string, dateTo: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${dateFrom}T00:00:00Z`);
  const end = new Date(`${dateTo}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(toIsoDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function isWeekend(isoDate: string): boolean {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function shiftRange(dateFrom: string, dateTo: string, direction: 1 | -1): { dateFrom: string; dateTo: string } {
  const spanDays = Math.round(
    (new Date(`${dateTo}T00:00:00Z`).getTime() - new Date(`${dateFrom}T00:00:00Z`).getTime()) / 86400000
  ) + 1;
  const shiftMs = direction * spanDays * 86400000;
  return {
    dateFrom: toIsoDate(new Date(new Date(`${dateFrom}T00:00:00Z`).getTime() + shiftMs)),
    dateTo: toIsoDate(new Date(new Date(`${dateTo}T00:00:00Z`).getTime() + shiftMs)),
  };
}

/**
 * Mirrors the real Channex "Inventory Management" screen's structure, confirmed from
 * docs.channex.io/application-documentation/inventory-management (not guessed): a
 * property selector + date navigation up top, and a grid grouped Room Type -> Rate
 * Plan -> shortcoded rows (RATE, MSA = min stay arrival, MXS = max stay, CTA/CTD =
 * closed to arrival/departure, SS = stop sell, AVL = availability). AVL lives at the
 * room-type level and everything else at the rate-plan level, same as Channex's own
 * grid and same as how GQ's data is already split (BQ availability vs gq_rate_plan
 * restrictions) - built entirely from GQ's existing ARI endpoints, no new backend.
 *
 * GQ has no property selector here since a GQ user is scoped to exactly one property
 * (see useCurrentPropertyId) - Channex's multi-property picker has nothing to select
 * between in this app.
 */
export function InventoryCalendar() {
  const propertyId = useCurrentPropertyId();
  const initialRange = defaultDateRange();
  const [dateFrom, setDateFrom] = useState(initialRange.dateFrom);
  const [dateTo, setDateTo] = useState(initialRange.dateTo);
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>("all");
  const [ratePlanFilter, setRatePlanFilter] = useState<string>("all");
  const [roomTypes, setRoomTypes] = useState<RoomTypeSummary[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [availability, setAvailability] = useState<DailyAvailabilityRow[]>([]);
  const [restrictionByPlanAndDate, setRestrictionByPlanAndDate] = useState<Map<string, RestrictionRow>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propertyId === null) return;
    if (dateFrom > dateTo) return;
    setLoading(true);
    setError(null);
    Promise.all([
      getRoomTypes(propertyId),
      listRatePlans(propertyId),
      getAriAvailability(propertyId, dateFrom, dateTo),
      getAri(propertyId, dateFrom, dateTo),
    ])
      .then(([types, plans, live, ari]) => {
        setRoomTypes(types);
        setRatePlans(plans);
        setAvailability(live);
        setRestrictionByPlanAndDate(new Map(ari.restrictions.map((r) => [`${r.ratePlanId}|${r.date}`, r])));
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [propertyId, dateFrom, dateTo]);

  if (propertyId === null) {
    return (
      <div>
        <PageHeader title="Inventory Calendar" description="Read-only — rate and availability for every room type, by day" />
        <div className="card">
          <p className="muted">Your account has no assigned property, so there is nothing to load here.</p>
        </div>
      </div>
    );
  }

  const dates = eachDate(dateFrom, dateTo);

  const visibleRoomTypes =
    roomTypeFilter === "all" ? roomTypes : roomTypes.filter((rt) => String(rt.id) === roomTypeFilter);
  const ratePlansForFilter =
    roomTypeFilter === "all" ? ratePlans : ratePlans.filter((rp) => String(rp.roomTypeId) === roomTypeFilter);

  function shift(direction: 1 | -1) {
    const next = shiftRange(dateFrom, dateTo, direction);
    setDateFrom(next.dateFrom);
    setDateTo(next.dateTo);
  }

  function availabilityFor(roomTypeId: number, date: string): { value: number | null; total: number } {
    const live = availability.find((a) => a.roomTypeId === roomTypeId && a.date === date);
    return {
      value: live?.availableRooms ?? null,
      total: live?.totalRooms ?? roomTypes.find((rt) => rt.id === roomTypeId)?.totalRooms ?? 0,
    };
  }

  function availTone(value: number | null, total: number): string {
    if (value === null) return "";
    if (value === 0) return "inv-cell--none";
    if (total > 0 && value / total <= 0.25) return "inv-cell--low";
    return "inv-cell--good";
  }

  return (
    <div>
      <PageHeader title="Inventory Calendar" description="Read-only — rate and availability for every room type, by day" />

      <div className="card inv-controls">
        <div className="inv-controls__nav">
          <div className="inv-controls__dates">
            <button
              type="button"
              className="button button--ghost inv-controls__nav-btn"
              onClick={() => shift(-1)}
              aria-label="Shift range back"
            >
              <Icon name="chevron-left" size="sm" />
            </button>
            <label className="inv-controls__field">
              <span className="field__label">From</span>
              <input type="date" className="field__input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </label>
            <span className="inv-controls__date-sep">–</span>
            <label className="inv-controls__field">
              <span className="field__label">To</span>
              <input type="date" className="field__input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </label>
            <button
              type="button"
              className="button button--ghost inv-controls__nav-btn"
              onClick={() => shift(1)}
              aria-label="Shift range forward"
            >
              <Icon name="chevron-right" size="sm" />
            </button>
          </div>

          <div className="inv-controls__filters">
            <label className="inv-controls__field">
              <span className="field__label">Room type</span>
              <select
                className="field__input"
                value={roomTypeFilter}
                onChange={(e) => {
                  setRoomTypeFilter(e.target.value);
                  setRatePlanFilter("all");
                }}
              >
                <option value="all">All room types</option>
                {roomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>{rt.name}</option>
                ))}
              </select>
            </label>
            <label className="inv-controls__field">
              <span className="field__label">Rate plan</span>
              <select className="field__input" value={ratePlanFilter} onChange={(e) => setRatePlanFilter(e.target.value)}>
                <option value="all">All rate plans</option>
                {ratePlansForFilter.map((rp) => (
                  <option key={rp.id} value={rp.id}>{rp.name}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {dateFrom > dateTo && <p className="form-error" style={{ margin: 0 }}>"From" must not be after "To".</p>}
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="form-error" role="alert">{error}</p>
        </div>
      )}

      <div className="card">
        <div className="data-table-wrapper">
          <table className="data-table inv-grid">
            <thead>
              <tr>
                <th className="inv-grid__pin">Room type / Rate plan</th>
                {dates.map((d) => (
                  <th key={d} className={isWeekend(d) ? "inv-grid__weekend" : ""}>
                    <div className="inv-date-head">
                      <span className="inv-date-head__day">{WEEKDAY_LABELS[new Date(`${d}T00:00:00Z`).getUTCDay()]}</span>
                      <span className="inv-date-head__num">{d.slice(8, 10)}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRoomTypes.length === 0 ? (
                <tr>
                  <td colSpan={dates.length + 1} className="data-table__empty">
                    {loading ? "Loading…" : "No room types match this filter."}
                  </td>
                </tr>
              ) : (
                visibleRoomTypes.map((rt) => {
                  const roomTypePlans = ratePlans.filter(
                    (rp) => rp.roomTypeId === rt.id && (ratePlanFilter === "all" || rp.id === ratePlanFilter)
                  );
                  return (
                    <Fragment key={rt.id}>
                      <tr className="inv-grid__room-row">
                        <td className="inv-grid__pin">
                          <strong>{rt.name}</strong>
                          <span className="inv-shortcode">AVL</span>
                          <div className="muted small">{rt.totalRooms} rooms total</div>
                        </td>
                        {dates.map((d) => {
                          const a = availabilityFor(rt.id, d);
                          return (
                            <td key={d} className={isWeekend(d) ? "inv-grid__weekend" : ""}>
                              <div className={`inv-cell ${availTone(a.value, a.total)}`}>{a.value ?? "—"}</div>
                            </td>
                          );
                        })}
                      </tr>

                      {roomTypePlans.length === 0 && (
                        <tr key={`${rt.id}-noplan`}>
                          <td className="inv-grid__pin inv-grid__sub">
                            <span className="muted small">
                              {ratePlanFilter === "all" ? "No rate plans for this room type" : "No rate plan matches this filter"}
                            </span>
                          </td>
                          {dates.map((d) => (
                            <td key={d} className={isWeekend(d) ? "inv-grid__weekend" : ""} />
                          ))}
                        </tr>
                      )}

                      {roomTypePlans.map((rp) => (
                        <Fragment key={rp.id}>
                          <tr>
                            <td className="inv-grid__pin inv-grid__sub">
                              {rp.name}
                              <span className="inv-shortcode">RATE</span>
                            </td>
                            {dates.map((d) => {
                              const r = restrictionByPlanAndDate.get(`${rp.id}|${d}`);
                              return (
                                <td key={d} className={isWeekend(d) ? "inv-grid__weekend" : ""}>
                                  <div className="inv-cell inv-cell--rate">{r ? money(r.rate, rp.currency) : "—"}</div>
                                </td>
                              );
                            })}
                          </tr>
                          <tr key={`${rp.id}-stay`}>
                            <td className="inv-grid__pin inv-grid__sub">
                              <span className="inv-shortcode">MSA / MXS</span>
                            </td>
                            {dates.map((d) => {
                              const r = restrictionByPlanAndDate.get(`${rp.id}|${d}`);
                              return (
                                <td key={d} className={isWeekend(d) ? "inv-grid__weekend" : ""}>
                                  <div className="inv-cell inv-cell--stay">
                                    {r ? `${r.minStayArrival ?? r.minStay ?? "—"} / ${r.maxStay ?? "—"}` : "—"}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                          <tr key={`${rp.id}-flags`}>
                            <td className="inv-grid__pin inv-grid__sub">
                              <span className="inv-shortcode">CTA / CTD / SS</span>
                            </td>
                            {dates.map((d) => {
                              const r = restrictionByPlanAndDate.get(`${rp.id}|${d}`);
                              return (
                                <td key={d} className={isWeekend(d) ? "inv-grid__weekend" : ""}>
                                  {r ? (
                                    <div className="inv-flags">
                                      {r.closedToArrival && <span className="inv-flag inv-flag--warn">CTA</span>}
                                      {r.closedToDeparture && <span className="inv-flag inv-flag--warn">CTD</span>}
                                      {r.stopSell && <span className="inv-flag inv-flag--danger">SS</span>}
                                      {!r.closedToArrival && !r.closedToDeparture && !r.stopSell && (
                                        <span className="muted small">—</span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="muted small">—</div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        </Fragment>
                      ))}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
