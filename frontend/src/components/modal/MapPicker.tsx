import { useState } from "react";
import { Pill } from "../Pill";
import { PoolOption } from "../../mockData/channexPool";

interface MapPickerProps {
  pool: PoolOption[];
  currentId: string | null;
  onPick: (option: PoolOption) => void;
  placeholder: string;
}

/** Matches the source's map-search / map-list / mapmodal-item pattern in openMapModal(). */
export function MapPicker({ pool, currentId, onPick, placeholder }: MapPickerProps) {
  const [search, setSearch] = useState("");
  const filtered = pool.filter((o) => o.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <input placeholder={placeholder} value={search} onChange={(e) => setSearch(e.target.value)} />
      <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, marginTop: 10 }}>
        {filtered.length === 0 && <div className="muted small" style={{ padding: 12 }}>No matches.</div>}
        {filtered.map((o) => (
          <div
            key={o.id}
            className={"map-modal-item" + (o.id === currentId ? " map-modal-item--picked" : "")}
            onClick={() => onPick(o)}
          >
            <span>{o.title}</span>
            {o.id === currentId && <Pill label="Selected" tone="info" />}
          </div>
        ))}
      </div>
    </>
  );
}
