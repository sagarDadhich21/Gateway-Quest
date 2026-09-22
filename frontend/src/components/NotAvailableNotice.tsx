/** Shown on pages with no live gq/backend endpoint yet - this integration's scope so far covers property/room-type/rate-plan onboarding and ARI (availability, rates, restrictions) only. No sample/mock data is rendered here. */
export function NotAvailableNotice() {
  return (
    <div className="mock-notice">
      This feature has no live gq/backend API yet - it isn't part of this integration's scope so far (property/room-type/rate-plan
      onboarding and ARI). Nothing is shown here rather than sample data.
    </div>
  );
}
