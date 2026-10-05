import { useState } from 'react';
import ErrorState from '../components/ErrorState';
import { useMyAttendance, useMyClockIn, useMyClockOut } from '../hooks/useApi';
import { useToast } from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';

const peso = (v) => v != null ? `₱${Number(v).toLocaleString()}` : '—';

export default function MyAttendance() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useMyAttendance({ page, limit: 15 });
  const clockInMut = useMyClockIn();
  const clockOutMut = useMyClockOut();

  const records = data?.attendance || [];
  const today = records.find(r => {
    const d = new Date(r.date);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  });

  const handleClockIn = async () => {
    try {
      await clockInMut.mutateAsync();
      toast.success('Clocked in successfully');
    } catch (err) {
      const errors = err.response?.data?.errors;
      const msg = errors && errors.length ? errors.join('. ') : (err.response?.data?.message || 'Clock in failed');
      toast.error(msg);
    }
  };

  const handleClockOut = async () => {
    try {
      await clockOutMut.mutateAsync();
      toast.success('Clocked out successfully');
    } catch (err) {
      const errors = err.response?.data?.errors;
      const msg = errors && errors.length ? errors.join('. ') : (err.response?.data?.message || 'Clock out failed');
      toast.error(msg);
    }
  };

  if (isError) {
    return (
      <div className="page-error-wrap">
        <ErrorState message={error?.response?.data?.message || 'Something went wrong while loading this data.'} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="hrms-page">
      <div className="page-header"><h1>My Attendance</h1></div>

      <div className="flex-gap mb-md">
        <div className="emp-info-card flex-1">
          <div className="text-sm text-muted mb-sm">Today's Status</div>
          <div className="font-semibold font-size-18">
            {today ? (
              <span className={`badge ${today.status === 'present' ? 'success' : today.status === 'late' ? 'warning' : 'info'}`}>{today.status}</span>
            ) : <span className="badge info">No record</span>}
          </div>
          {today?.clockIn && <div className="text-sm mt-xs">Clock In: {new Date(today.clockIn).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>}
          {today?.clockOut && <div className="text-sm">Clock Out: {new Date(today.clockOut).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>}
        </div>
        <div className="flex-col-gap">
          <button className="btn btn-primary" onClick={handleClockIn} disabled={clockInMut.isPending || (today?.clockIn && !today?.clockOut)}>
            {clockInMut.isPending && <span className="btn-spinner" />}{clockInMut.isPending ? 'Clocking in...' : 'Clock In'}
          </button>
          <button className="btn btn-danger" onClick={handleClockOut} disabled={clockOutMut.isPending || !today?.clockIn || today?.clockOut}>
            {clockOutMut.isPending && <span className="btn-spinner" />}{clockOutMut.isPending ? 'Clocking out...' : 'Clock Out'}
          </button>
        </div>
      </div>

      {isLoading ? <LoadingSkeleton rows={5} /> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Status</th><th>Clock In</th><th>Clock Out</th><th>Hours</th><th>OT Hours</th></tr></thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td>{new Date(r.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td><span className={`badge ${r.status === 'present' ? 'success' : r.status === 'late' ? 'warning' : 'error'}`}>{r.status}</span></td>
                  <td>{r.clockIn ? new Date(r.clockIn).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}</td>
                  <td>{r.clockOut ? new Date(r.clockOut).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}</td>
                  <td>{r.totalHours ? parseFloat(r.totalHours).toFixed(1) : '—'}</td>
                  <td>{r.overtime ? parseFloat(r.overtime).toFixed(1) : '0'}</td>
                </tr>
              ))}
              {!records.length && <tr><td colSpan={6} className="empty-state">No attendance records</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {data?.pagination?.totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>◀</button>
          <span>Page {page} / {data.pagination.totalPages}</span>
          <button className="btn btn-sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage(p => p + 1)}>▶</button>
        </div>
      )}
    </div>
  );
}
