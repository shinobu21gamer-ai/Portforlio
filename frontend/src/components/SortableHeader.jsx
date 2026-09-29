export default function SortableHeader({ label, field, sortBy, sortOrder, onSort }) {
  const isActive = sortBy === field;
  const handleClick = () => onSort?.(field);
  return (
    <th
      onClick={handleClick}
      className={isActive ? 'sort-active' : ''}
      style={{
        cursor: onSort ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap',
        background: isActive ? 'rgba(99,102,241,.06)' : undefined,
        color: isActive ? 'var(--primary)' : undefined,
        transition: 'background .15s, color .15s',
      }}
      title={onSort ? `Sort by ${label}` : undefined}
    >
      {label}
      <span className={isActive ? 'sort-indicator active' : 'sort-indicator'}>
        {isActive ? (sortOrder === 'ASC' ? '▲' : '▼') : onSort ? '⇅' : null}
      </span>
    </th>
  );
}
