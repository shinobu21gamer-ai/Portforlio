export default function SortableHeader({ label, field, sortBy, sortOrder, onSort }) {
  const isActive = sortBy === field;
  const clickable = typeof onSort === 'function';
  const handleClick = () => onSort?.(field);
  const handleKeyDown = (e) => {
    if (!clickable) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort(field); }
  };
  return (
    <th
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={clickable ? 0 : undefined}
      role="columnheader"
      aria-sort={clickable ? (isActive ? (sortOrder === 'ASC' ? 'ascending' : 'descending') : 'none') : undefined}
      className={isActive ? 'sort-active' : ''}
      style={{
        cursor: clickable ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap',
        background: isActive ? 'rgba(99,102,241,.06)' : undefined,
        color: isActive ? 'var(--primary)' : undefined,
        transition: 'background .15s, color .15s',
      }}
      title={clickable ? `Sort by ${label}` : undefined}
    >
      {label}
      <span className={isActive ? 'sort-indicator active' : 'sort-indicator'}>
        {isActive ? (sortOrder === 'ASC' ? '▲' : '▼') : onSort ? '⇅' : null}
      </span>
    </th>
  );
}
