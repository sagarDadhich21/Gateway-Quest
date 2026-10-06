import { ReactNode } from "react";
import { TablePagination } from "./TablePagination";
import { usePagination } from "./usePagination";

export interface DataTableColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  emptyMessage?: string;
  /** Rows per page - pagination is hidden entirely when rows.length <= pageSize. */
  pageSize?: number;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyMessage = "No records.",
  pageSize = 20,
}: DataTableProps<T>) {
  const { page, totalPages, start, end, setPage } = usePagination(rows.length, pageSize);
  const visibleRows = rows.slice(start, end);

  return (
    <div className="data-table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{ textAlign: col.align ?? "left" }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="data-table__empty">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            visibleRows.map((row) => (
              <tr key={getRowKey(row)}>
                {columns.map((col) => (
                  <td key={col.key} style={{ textAlign: col.align ?? "left" }}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {rows.length > pageSize && (
        <TablePagination page={page} totalPages={totalPages} start={start} end={end} total={rows.length} onPageChange={setPage} />
      )}
    </div>
  );
}
