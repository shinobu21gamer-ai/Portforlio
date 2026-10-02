import { useMemo } from 'react';

const WIDTHS = [
  [65, 85, 45],
  [70, 90, 50],
  [60, 80, 40],
  [75, 85, 55],
  [65, 95, 50],
];

export default function LoadingSkeleton({ rows = 5, cols = 4, type = 'table' }) {
  const rowWidths = useMemo(() => {
    return Array.from({ length: rows }).map((_, i) =>
      Array.from({ length: cols }).map((_, j) => WIDTHS[i % WIDTHS.length][j % 3])
    );
  }, [rows, cols]);

  if (type === 'cards') {
    return (
      <div className="dashboard-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton skeleton-card" />
        ))}
      </div>
    );
  }

  if (type === 'grid') {
    return (
      <div className="products">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton skeleton-card" style={{ height: 90 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => <th key={i}>&nbsp;</th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              {Array.from({ length: cols }).map((_, j) => (
                <td key={j}><div className="skeleton skeleton-text" style={{ width: `${rowWidths[i][j]}%` }} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
