import { useEffect, useState } from "react";

export interface Pagination {
  page: number;
  totalPages: number;
  start: number;
  end: number;
}

/**
 * Resets to page 1 whenever the row COUNT changes (a filter was applied, new data
 * loaded) rather than on every new array reference - tables built from an inline
 * `.filter()` create a fresh array on every parent re-render even when nothing
 * actually changed, which would otherwise bounce the user back to page 1 mid-browse.
 */
export function usePagination(totalRows: number, pageSize: number): Pagination & { setPage: (page: number) => void } {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalRows]);

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const end = Math.min(start + pageSize, totalRows);

  return { page: safePage, totalPages, start, end, setPage };
}
