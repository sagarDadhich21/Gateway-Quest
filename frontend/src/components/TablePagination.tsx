interface TablePaginationProps {
  page: number;
  totalPages: number;
  start: number;
  end: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** Hidden by the caller when everything fits on one page - see DataTable/ReportTable. */
export function TablePagination({ page, totalPages, start, end, total, onPageChange }: TablePaginationProps) {
  return (
    <div className="table-pagination">
      <span className="small muted">
        Showing {total === 0 ? 0 : start + 1}–{end} of {total}
      </span>
      <div className="table-pagination__controls">
        <button
          type="button"
          className="button button--ghost"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <span className="small muted">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="button button--ghost"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
