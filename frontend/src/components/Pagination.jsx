export default function Pagination({ pagination, onPageChange, filteredCount, pageSize, onPageSizeChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, hasPrevPage, hasNextPage } = pagination;
  const total = pagination.total ?? pagination.totalItems;

  return (
    <div className="dt-pagination">
      <div className="dt-pagination-left">
        {onPageSizeChange && (
          <select
            className="dt-page-size"
            value={pageSize || 10}
            onChange={e => onPageSizeChange(Number(e.target.value))}
          >
            {[10, 25, 50, 100].map(n => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </select>
        )}
      </div>
      <div className="dt-pagination-center">
        <button
          className="dt-page-btn"
          disabled={!hasPrevPage}
          onClick={() => onPageChange(1)}
          title="First page"
        >
          «
        </button>
        <button
          className="dt-page-btn"
          disabled={!hasPrevPage}
          onClick={() => onPageChange(page - 1)}
        >
          ‹
        </button>
        <span className="dt-page-current">{page}</span>
        <span className="dt-page-of">of {totalPages}</span>
        <button
          className="dt-page-btn"
          disabled={!hasNextPage}
          onClick={() => onPageChange(page + 1)}
        >
          ›
        </button>
        <button
          className="dt-page-btn"
          disabled={!hasNextPage}
          onClick={() => onPageChange(totalPages)}
          title="Last page"
        >
          »
        </button>
      </div>
      <div className="dt-pagination-right">
        {total != null && (
          <span className="dt-total-label">{total.toLocaleString()} total</span>
        )}
      </div>
    </div>
  );
}
