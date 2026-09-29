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
          <div key={i} className="stat-card skeleton" style={{ height: 80 }} />
        ))}
      </div>
    );
  }

  if (type === 'grid') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12 }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} style={{ background: 'var(--muted)', padding: '12px 16px', textAlign: 'left' }}>
                <div className="skeleton" style={{ height: 14, width: '60%', borderRadius: 4 }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              {Array.from({ length: cols }).map((_, j) => (
                <td key={j} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div className="skeleton" style={{ height: 14, width: `${rowWidths[i][j]}%`, borderRadius: 4 }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
