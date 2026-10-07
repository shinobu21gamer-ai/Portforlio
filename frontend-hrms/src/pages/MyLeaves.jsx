import { useState } from 'react';
import Modal from '../components/Modal';
import ErrorState from '../components/ErrorState';
import { useMyLeaves, useMyLeaveBalance, useCreateMyLeave } from '../hooks/useApi';
import { useToast } from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';

const LEAVE_TYPES = ['sick', 'vacation', 'personal', 'maternity', 'paternity', 'bereavement', 'other'];

export default function MyLeaves() {
  const toast = useToast();
  const today = new Date().toISOString().split('T')[0];
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ leaveType: 'sick', startDate: '', endDate: '', reason: '' });
  const { data, isLoading, isError, error, refetch } = useMyLeaves({ page, limit: 15 });
  const { data: balance } = useMyLeaveBalance();
  const createMut = useCreateMyLeave();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.endDate && form.startDate && form.endDate < form.startDate) {
      toast.error('End date cannot be before start date');
      return;
    }
    try {
      await createMut.mutateAsync(form);
      toast.success('Leave request submitted');
      setShowForm(false);
      setForm({ leaveType: 'sick', startDate: '', endDate: '', reason: '' });
    } catch (err) {
      const errors = err.response?.data?.errors;
      const msg = errors && errors.length ? errors.join('. ') : (err.response?.data?.message || 'Failed to submit leave');
      toast.error(msg);
    }
  };

  const leaves = data?.leaves || [];

  if (isError) {
    return (
      <div className="page-error-wrap">
        <ErrorState message={error?.response?.data?.message || 'Something went wrong while loading this data.'} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="hrms-page">
      <div className="page-header">
        <h1>My Leaves</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>＋</button>
      </div>

      {balance && (
        <div className="flex-gap mb-md">
          <div className="stat-card-inline">
            <div className="text-xs text-muted mb-xs">Total Days</div>
            <div className="font-bold font-size-18">{Object.values(balance).reduce((s, b) => s + (b.total || 0), 0)}</div>
          </div>
          <div className="stat-card-inline">
            <div className="text-xs text-muted mb-xs">Used</div>
            <div className="font-bold font-size-18 text-warning">{Object.values(balance).reduce((s, b) => s + (b.used || 0), 0)}</div>
          </div>
          <div className="stat-card-inline">
            <div className="text-xs text-muted mb-xs">Remaining</div>
            <div className="font-bold font-size-18 text-success">{Object.values(balance).reduce((s, b) => s + (b.remaining || 0), 0)}</div>
          </div>
        </div>
      )}

      {isLoading ? <LoadingSkeleton rows={5} /> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Type</th><th>Start</th><th>End</th><th>Days</th><th>Reason</th><th>Status</th></tr></thead>
            <tbody>
              {leaves.map(l => (
                <tr key={l.id}>
                  <td className="uppercase">{l.leaveType}</td>
                  <td>{new Date(l.startDate).toLocaleDateString('en-PH')}</td>
                  <td>{new Date(l.endDate).toLocaleDateString('en-PH')}</td>
                  <td>{l.days || '—'}</td>
                  <td>{l.reason || '—'}</td>
                  <td><span className={`badge ${l.status === 'admin-approved' ? 'success' : l.status === 'hr-reviewed' ? 'info' : l.status === 'rejected' ? 'error' : 'warning'}`}>{l.status === 'admin-approved' ? 'approved' : l.status}</span></td>
                </tr>
              ))}
              {!leaves.length && <tr><td colSpan={6} className="empty-state">No leave requests</td></tr>}
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

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Request Leave"
      >
        <div className="modal-form" style={{ maxWidth: 560 }}>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Leave Type *</label>
              <select className="input-block" value={form.leaveType} onChange={e => setForm({...form, leaveType: e.target.value})} required>
                {LEAVE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="field"><label>Start Date *</label><input type="date" className="input-block" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} min={today} required /></div>
              <div className="field"><label>End Date *</label><input type="date" className="input-block" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} min={form.startDate || today} required /></div>
            </div>
            <div className="field"><label>Reason *</label><textarea className="input-block" rows={4} value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} minLength={5} required /></div>
            <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={createMut.isPending}>{createMut.isPending && <span className="btn-spinner" />}{createMut.isPending ? 'Submitting...' : 'Save'}</button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
