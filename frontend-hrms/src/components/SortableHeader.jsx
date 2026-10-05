/**
 * Shared sortable table header (kit parity across POS + HRMS).
 * Accessible: role="columnheader", aria-sort, keyboard (Enter/Space), focusable.
 */
export default function SortableHeader({ label, field, sortBy, sortOrder, onSort, className = '' }) {
  const isActive = sortBy === field;
  const clickable = typeof onSort === 'function';
  const handleKeyDown = (e) => {
    if (!clickable) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSort(field);
    }
  };
  return (
    <th
      onClick={clickable ? () => onSort(field) : undefined}
      onKeyDown={handleKeyDown}
      tabIndex={clickable ? 0 : undefined}
      role="columnheader"
      aria-sort={clickable ? (isActive ? (sortOrder === 'ASC' ? 'ascending' : 'descending') : 'none') : undefined}
      className={`dt-sortable ${isActive ? 'sort-active' : ''} ${className}`.trim()}
      style={{ whiteSpace: 'nowrap' }}
      title={clickable ? `Sort by ${label}` : undefined}
    >
      {label}
      <span className={isActive ? 'sort-indicator active' : 'sort-indicator'} aria-hidden="true">
        {isActive ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" focusable="false">
            <path d={sortOrder === 'ASC' ? 'M12 6l6 8H6z' : 'M12 18l-6-8h12z'} />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" focusable="false">
            <path d="M12 5l5 7H7zM12 19l-5-7h10z" />
          </svg>
        )}
      </span>
    </th>
  );
}
