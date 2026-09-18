import { useMemo, useState } from "react";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { MockDataNotice } from "../../components/MockDataNotice";
import { PageHeader } from "../../components/PageHeader";
import { AuditLogRow, auditLogRows } from "../../mockData/admin";

const CATEGORIES = ["All", ...Array.from(new Set(auditLogRows.map((r) => r.cat)))];

const columns: DataTableColumn<AuditLogRow>[] = [
  { key: "at", label: "At", render: (r) => r.at },
  { key: "who", label: "Who", render: (r) => r.who },
  { key: "cat", label: "Category", render: (r) => r.cat },
  { key: "what", label: "What", render: (r) => r.what },
];

export function AuditLog() {
  const [category, setCategory] = useState("All");

  const filtered = useMemo(
    () => (category === "All" ? auditLogRows : auditLogRows.filter((r) => r.cat === category)),
    [category]
  );

  return (
    <div>
      <PageHeader title="Audit Log" description="Every inbound message, decision and push" />
      <MockDataNotice />
      <div className="card">
        <label className="field" style={{ maxWidth: 220 }}>
          <span className="field__label">Category</span>
          <select className="field__input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <DataTable columns={columns} rows={filtered} getRowKey={(r) => r.id} />
      </div>
    </div>
  );
}
