/**
 * Every screen using mock data carries this so it's never mistaken for live output -
 * these pages scaffold the app's full shape ahead of the backend endpoints they'd need.
 */
export function MockDataNotice() {
  return (
    <div className="mock-notice">
      Sample data for layout preview — not connected to a live backend yet.
    </div>
  );
}
