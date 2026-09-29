import { useMyContracts } from '../hooks/useApi';
import LoadingSkeleton from '../components/LoadingSkeleton';

const peso = (v) => v != null ? `₱${Number(v).toLocaleString()}` : '—';

export default function MyContracts() {
  const { data, isLoading, error } = useMyContracts();
  const contracts = data?.contracts || data || [];

  if (error) return <div className="hrms-page"><div className="empty-state">Failed to load contracts</div></div>;

  return (
    <div className="hrms-page">
      <div className="page-header"><h1>My Contracts</h1></div>

      {isLoading ? <LoadingSkeleton rows={3} /> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Type</th><th>Start</th><th>End</th><th>Salary</th><th>Status</th></tr></thead>
            <tbody>
              {contracts.map(c => (
                <tr key={c.id}>
                  <td style={{ textTransform: 'capitalize' }}>{c.contractType}</td>
                  <td>{new Date(c.startDate).toLocaleDateString('en-PH')}</td>
                  <td>{c.endDate ? new Date(c.endDate).toLocaleDateString('en-PH') : 'Ongoing'}</td>
                  <td>{peso(c.salary)}</td>
                  <td><span className={`badge ${c.status === 'active' ? 'success' : c.status === 'expired' ? 'error' : 'warning'}`}>{c.status}</span></td>
                </tr>
              ))}
              {!contracts.length && <tr><td colSpan={5} className="empty-state">No contracts found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
