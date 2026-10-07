import React, { useState, useRef, useMemo, useEffect } from 'react';
import SortableHeader from './SortableHeader';
import Pagination from './Pagination';

export default function DataTable({
  columns,
  data,
  pagination,
  onPageChange,
  sortBy,
  sortOrder,
  onSort,
  isLoading,
  emptyMessage = 'No data found',
  title,
  children,
  renderRow,
  headerRight,
  pageSize: pageSizeProp,
  onPageSizeChange,
  // See the HRMS DataTable: a client filter cannot search rows the server has
  // not sent, so it is only shown for tables that are not server-paginated.
  filterable = !pagination,
}) {
  const [visibleCols, setVisibleCols] = useState(() => columns.map(c => c.key));
  const [showColToggle, setShowColToggle] = useState(false);
  const [filter, setFilter] = useState('');
  const tableRef = useRef(null);
  const colToggleRef = useRef(null);

  useEffect(() => {
    if (!showColToggle) return;
    const handleClickOutside = (e) => {
      if (colToggleRef.current && !colToggleRef.current.contains(e.target)) {
        setShowColToggle(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColToggle]);

  const toggleCol = (key) => {
    setVisibleCols(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const extractText = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (val?.props?.children) return extractText(val.props.children);
    if (Array.isArray(val)) return val.map(extractText).join(' ');
    return '';
  };

  const filteredData = useMemo(() => {
    if (!filter || !filterable) return data;
    const q = filter.toLowerCase();
    return data.filter(row =>
      columns.some(c => {
        const val = typeof c.accessor === 'function' ? c.accessor(row) : row[c.key];
        return extractText(val).toLowerCase().includes(q);
      })
    );
  }, [data, filter, columns, filterable]);

  const exportCSV = () => {
    const visHeaders = columns.filter(c => visibleCols.includes(c.key));
    const headerRow = visHeaders.map(c => `"${c.label}"`).join(',');
    const rows = filteredData.map(row =>
      visHeaders.map(c => {
        let val = typeof c.accessor === 'function' ? c.accessor(row) : row[c.key];
        val = extractText(val).replace(/"/g, '""');
        return `"${val}"`;
      }).join(',')
    );
    const csv = [headerRow, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'data'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const visHeaders = columns.filter(c => visibleCols.includes(c.key));

  // Keyboard navigation: ArrowUp/Down + Home/End move focus between rows.
  const onTableKeyDown = (e) => {
    const row = e.target.closest('tr[data-dt-row]');
    if (!row) return;
    const rows = Array.from(tableRef.current.querySelectorAll('tbody tr[data-dt-row]'));
    const i = rows.indexOf(row);
    if (i === -1) return;
    let target = null;
    if (e.key === 'ArrowDown') target = rows[i + 1];
    else if (e.key === 'ArrowUp') target = rows[i - 1];
    else if (e.key === 'Home') target = rows[0];
    else if (e.key === 'End') target = rows[rows.length - 1];
    if (target) { e.preventDefault(); target.focus(); }
  };

  const pageSize = pagination?.pageSize || pagination?.limit || pageSizeProp || 10;
  const total = pagination?.total ?? pagination?.totalItems ?? filteredData.length;
  const startIdx = pagination ? ((pagination.page || 1) - 1) * pageSize : 0;
  const endIdx = Math.min(startIdx + filteredData.length, total);

  if (isLoading) {
    return (
      <div className="table-wrap" style={{ padding: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[1,2,3].map(i => (
            <div key={i} className="skeleton-line" style={{ height: 32, flex: 1 }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="skeleton-line" style={{ height: 14, flex: 1 }} />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-line" style={{ height: 44, marginBottom: 2, animationDelay: `${i * 0.08}s` }} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="dt-header">
        <div className="dt-header-left">
          {title && <h3 style={{ margin: 0 }}>{title}</h3>}
          {pagination && (
            <span className="dt-count">
              {total > 0
                ? `Showing ${startIdx + 1}–${endIdx} of ${total}`
                : 'No results'}
            </span>
          )}
        </div>
        <div className="dt-header-right">
          {headerRight}
          {filterable && (
            <div className="dt-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                type="text"
                placeholder="Search..."
                value={filter}
                onChange={e => { setFilter(e.target.value); onPageChange && onPageChange(1); }}
              />
              {filter && (
                <button className="dt-search-clear" onClick={() => setFilter('')} title="Clear search">✕</button>
              )}
            </div>
          )}
          <button className="btn btn-secondary btn-sm" onClick={exportCSV} title="Export CSV">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </button>
          <div style={{ position: 'relative' }} ref={colToggleRef}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowColToggle(!showColToggle)}
              title="Toggle columns"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              Columns
            </button>
            {showColToggle && (
              <div className="col-toggle-dropdown" style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 8, padding: 8, zIndex: 100, minWidth: 160,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              }}>
                {columns.map(c => (
                  <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={visibleCols.includes(c.key)}
                      onChange={() => toggleCol(c.key)}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="table-wrap" ref={tableRef}>
        <table onKeyDown={onTableKeyDown} aria-rowcount={filteredData.length}>
          <thead>
            <tr>
              {visHeaders.map(c =>
                c.sortable ? (
                  <SortableHeader
                    key={c.key}
                    label={c.label}
                    field={c.sortKey || c.key}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={onSort}
                  />
                ) : (
                  <th key={c.key}>{c.label}</th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={visHeaders.length}>
                  <div className="empty-state" style={{ padding: '40px 20px' }}>
                    <div className="icon">📭</div>
                    <h3>{filter ? 'No matching results' : emptyMessage}</h3>
                  </div>
                </td>
              </tr>
            ) : renderRow ? (
              filteredData.map((row, idx) => {
                const el = renderRow(row, idx, visHeaders);
                if (el && el.type === 'tr') {
                  return React.cloneElement(el, {
                    'data-dt-row': true,
                    tabIndex: 0,
                    'aria-rowindex': idx + 1,
                    style: { outlineOffset: -2, ...(el.props?.style || {}) },
                  });
                }
                return el;
              })
            ) : (
              filteredData.map((row, idx) => (
                <tr
                  key={row.id || idx}
                  data-dt-row
                  tabIndex={0}
                  aria-rowindex={idx + 1}
                  className={idx % 2 === 1 ? 'dt-row-alt' : ''}
                  style={{ outlineOffset: -2 }}
                >
                  {visHeaders.map(c => (
                    <td key={c.key}>
                      {typeof c.accessor === 'function' ? c.accessor(row, idx) : row[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        pagination={pagination}
        onPageChange={onPageChange}
        filteredCount={filteredData.length}
        pageSize={pageSizeProp}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
