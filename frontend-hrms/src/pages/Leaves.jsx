import { useState } from 'react';
import SortableHeader from '../components/SortableHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

import LoadingSkeleton from '../components/LoadingSkeleton';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { formatDate } from '../utils/helpers';
import { useEmployees } from '../hooks/useApi';
import { useIsAdmin, useIsHR, useIsAdminOrHR } from '../hooks/useRole';
import useDebounce from '../hooks/useDebounce';
import { icons } from '../components/ActionButton';

function useLeaves(params = {}) {
  return useQuery({ queryKey: ['leaves', params], queryFn: () => api.get('/leaves', { params }).then(r => r.data.data) });
}
function useCreateLeave() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d) => api.post('/leaves', d).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['leaves'] }) });
}
function useHrReview() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, remarks }) => api.put(`/leaves/${id}/hr-review`, { remarks }).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['leaves'] }) });
}
function useAdminApprove() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => api.put(`/leaves/${id}/admin-approve`).then(r => r.data.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaves'] }); qc.invalidateQueries({ queryKey: ['pending-counts'] }); } });
}
function useAdminReject() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, remarks }) => api.put(`/leaves/${id}/admin-reject`, { remarks }).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['leaves'] }) });
}
function useLeaveBalance(employeeId) {
  return useQuery({
    queryKey: ['leave-balance', employeeId],
    queryFn: () => api.get(`/leaves/balance/${employeeId}`).then(r => r.data.data),
    enabled: !!employeeId,
  });
}

export default function Leaves() {
  const today = new Date().toISOString().split('T')[0];
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('DESC');
  const handleSort = (field) => {
    if (sortBy === field) setSortOrder((o) => (o === 'ASC' ? 'DESC' : 'ASC'));
    else { setSortBy(field); setSortOrder('DESC'); }
        setPage(1);
  };
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [reviewModal, setReviewModal] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [form, setForm] = useState({ employeeId: '', leaveType: 'sick', startDate: '', endDate: '', reason: '' });
  const [hrRemarks, setHrRemarks] = useState('');
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [selected, setSelected] = useState([]);
  const toast = useToast();
  const isAdmin = useIsAdmin();
  const isHR = useIsHR();

  const { data, isLoading } = useLeaves({ page, limit: 10, status: statusFilter || undefined, leaveType: typeFilter || undefined, search: debouncedSearch || undefined, sortBy, sortOrder });
  const { data: empData } = useEmployees({ limit: 100, status: 'active' });
  const employees = empData?.employees || [];
  const leaves = data?.leaves || [];
  const createMut = useCreateLeave();
  const hrReviewMut = useHrReview();
  const adminApproveMut = useAdminApprove();
  const adminRejectMut = useAdminReject();
  const { data: balanceData } = useLeaveBalance(form.employeeId);

  const toggleSelect = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => {
    const approvable = leaves.filter(l => (isAdmin && l.status === 'hr-reviewed') || (isHR && l.status === 'pending')).map(l => l.id);
    if (selected.length === approvable.length) setSelected([]);
    else setSelected(approvable);
  };
  const handleBatchApprove = async () => {
    if (selected.length === 0) return;
    const results = await Promise.allSettled(selected.map(id => adminApproveMut.mutateAsync(id)));
    const ok = results.filter(r => r.status === 'fulfilled').length;
    const fail = results.filter(r => r.status === 'rejected').length;
    setSelected([]);
    toast.success(`Approved: ${ok}${fail ? `, failed: ${fail}` : ''}`);
  };
  const handleBatchHrReview = async () => {
    if (selected.length === 0) return;
    const results = await Promise.allSettled(selected.map(id => hrReviewMut.mutateAsync({ id, remarks: '' })));
    const ok = results.filter(r => r.status === 'fulfilled').length;
    const fail = results.filter(r => r.status === 'rejected').length;
    setSelected([]);
    toast.success(`Reviewed: ${ok}${fail ? `, failed: ${fail}` : ''}`);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      toast.error('End date must be on or after start date');
      return;
    }
    try {
      await createMut.mutateAsync({ ...form, employeeId: parseInt(form.employeeId) });
      toast.success('Leave request submitted');
      setCreateModal(false);
      setForm({ employeeId: '', leaveType: 'sick', startDate: '', endDate: '', reason: '' });
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleHrReview = async () => {
    if (!selectedLeave) return;
    try { await hrReviewMut.mutateAsync({ id: selectedLeave.id, remarks: hrRemarks }); toast.success('Leave reviewed'); setReviewModal(false); setSelectedLeave(null); setHrRemarks(''); }
    catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleAdminApprove = async (id) => {
    try { await adminApproveMut.mutateAsync(id); toast.success('Leave approved'); }
    catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const openView = (l) => { setSelectedLeave(l); setViewModal(true); };

  const handleAdminReject = async () => {
    if (!selectedLeave) return;
    try { await adminRejectMut.mutateAsync({ id: selectedLeave.id, remarks: rejectRemarks }); toast.success('Leave rejected'); setRejectModal(false); setSelectedLeave(null); setRejectRemarks(''); }
    catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const leaveLabels = { sick: 'Sick Leave', vacation: 'Vacation Leave', personal: 'Personal Leave', maternity: 'Maternity Leave', paternity: 'Paternity Leave', bereavement: 'Bereavement', other: 'Other' };
  const statusLabels = { pending: 'Pending', 'hr-reviewed': 'HR Reviewed', 'admin-approved': 'Approved', rejected: 'Rejected', cancelled: 'Cancelled' };
  const statusColors = { pending: 'warning', 'hr-reviewed': 'info', 'admin-approved': 'success', rejected: 'error', cancelled: 'neutral' };

  return (
    <>
      <header className="pos-header">
        <div><h1>Leave Requests</h1><div className="sub">{isAdmin ? 'Review and approve leave requests' : 'HR reviews, Admin approves'}</div></div>
        <button className="btn btn-primary" onClick={() => setCreateModal(true)}>＋</button>
      </header>

      <div className="flex-wrap-gap items-center mb-md">
        <input className="input-block w-200" placeholder="Search employee name..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select className="input-block w-160" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="pending">Pending</option><option value="hr-reviewed">HR Reviewed</option><option value="admin-approved">Admin Approved</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option>
        </select>
        <select className="input-block w-160" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          {Object.entries(leaveLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {selected.length > 0 && (
          <div className="flex-gap-sm ml-auto">
            {isHR && selected.some(id => leaves.find(l => l.id === id)?.status === 'pending') && <button className="btn btn-sm btn-primary" onClick={handleBatchHrReview} disabled={hrReviewMut.isPending}>Review ({selected.length})</button>}
            {isAdmin && selected.some(id => leaves.find(l => l.id === id)?.status === 'hr-reviewed') && <button className="btn btn-sm btn-success" onClick={handleBatchApprove} disabled={adminApproveMut.isPending}>Approve ({selected.length})</button>}
          </div>
        )}
      </div>

      {isLoading ? <LoadingSkeleton rows={4} /> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th className="w-40"><input type="checkbox" checked={selected.length > 0 && selected.length === leaves.filter(l => (isAdmin && l.status === 'hr-reviewed') || (isHR && l.status === 'pending')).length} onChange={toggleAll} /></th><th>Employee</th><th>Department</th><th>Type</th><SortableHeader label="From" field="startDate" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /><SortableHeader label="To" field="endDate" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /><SortableHeader label="Days" field="days" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {(data?.leaves || []).map(l => {
                const canSelect = (isAdmin && l.status === 'hr-reviewed') || (isHR && l.status === 'pending');
                return (
                <tr key={l.id}>
                  <td>{canSelect && <input type="checkbox" checked={selected.includes(l.id)} onChange={() => toggleSelect(l.id)} />}</td>
                  <td>{l.employee?.firstName} {l.employee?.middleName ? l.employee.middleName + ' ' : ''}{l.employee?.lastName}</td>
                  <td>{l.employee?.department?.name || '—'}</td>
                  <td>{leaveLabels[l.leaveType] || l.leaveType}</td>
                  <td>{formatDate(l.startDate)}</td>
                  <td>{formatDate(l.endDate)}</td>
                  <td>{l.days}</td>
                  <td className="truncate">{l.reason}</td>
                  <td><span className={`badge ${statusColors[l.status]}`}>{statusLabels[l.status] || l.status}</span></td>
                  <td>
                    <button className="btn btn-sm btn-secondary mr-xs" onClick={() => openView(l)}>{icons.view}</button>
                    {l.status === 'pending' && isHR && <button className="btn btn-sm btn-outline mr-xs" onClick={() => { setSelectedLeave(l); setReviewModal(true); }}>📋</button>}
                    {l.status === 'hr-reviewed' && isAdmin && <>
                      <button className="btn btn-sm btn-success mr-xs" onClick={() => handleAdminApprove(l.id)} disabled={adminApproveMut.isPending}>{icons.approve}</button>
                      <button className="btn btn-sm btn-danger" onClick={() => { setSelectedLeave(l); setRejectModal(true); }}>Reject</button>
                    </>}
                    {l.status === 'pending' && isAdmin && <span className="badge warning ml-xs">Awaiting HR</span>}
                  </td>
                </tr>
              );})}
              {(!data?.leaves || data.leaves.length === 0) && <tr><td colSpan={10} className="empty-state">No leave requests.</td></tr>}
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

      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Request Leave" preventClose={createMut.isPending}>
        <form onSubmit={handleCreate} className="modal-form">
          <div className="field"><label htmlFor="leave-employeeId">Employee *</label>
            <select id="leave-employeeId" className="input-block" value={form.employeeId} onChange={e => setForm({...form, employeeId: e.target.value})} required>
              <option value="">Select Employee</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.middleName ? e.middleName + ' ' : ''}{e.lastName}</option>)}
            </select>
          </div>
          {balanceData && (
            <div className="flex-wrap-gap-sm mb-sm p-sm" style={{ background: 'var(--bg)', borderRadius: 6, fontSize: 12 }}>
              <span><strong>Sick:</strong> {balanceData.sick?.remaining ?? '—'} remaining</span>
              <span><strong>Vacation:</strong> {balanceData.vacation?.remaining ?? '—'} remaining</span>
              <span><strong>Personal:</strong> {balanceData.personal?.remaining ?? '—'} remaining</span>
            </div>
          )}
          <div className="field"><label htmlFor="leave-leaveType">Leave Type *</label>
            <select id="leave-leaveType" className="input-block" value={form.leaveType} onChange={e => setForm({...form, leaveType: e.target.value})} required>
              {Object.entries(leaveLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="field"><label htmlFor="leave-startDate">Start Date *</label><input id="leave-startDate" className="input-block" type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} min={today} required /></div>
            <div className="field"><label htmlFor="leave-endDate">End Date *</label><input id="leave-endDate" className="input-block" type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} min={today} required /></div>
          </div>
          <div className="field"><label htmlFor="leave-reason">Reason *</label><textarea id="leave-reason" className="input-block" rows={3} value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} required placeholder="Reason for leave..." /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setCreateModal(false)}>{icons.close}</button>
            <button type="submit" className="btn btn-primary" disabled={createMut.isPending}>{createMut.isPending && <span className="btn-spinner" />}{createMut.isPending ? 'Submitting...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={reviewModal} onClose={() => setReviewModal(false)} title="HR Review" preventClose={hrReviewMut.isPending}>
        <div className="modal-form">
          <div className="text-sm mb-sm leading-relaxed">
            <div><strong>Employee:</strong> {selectedLeave?.employee?.firstName} {selectedLeave?.employee?.middleName ? selectedLeave.employee.middleName + ' ' : ''}{selectedLeave?.employee?.lastName}</div>
            <div><strong>Type:</strong> {leaveLabels[selectedLeave?.leaveType]}</div>
            <div><strong>Period:</strong> {formatDate(selectedLeave?.startDate)} – {formatDate(selectedLeave?.endDate)} ({selectedLeave?.days} days)</div>
            <div><strong>Reason:</strong> {selectedLeave?.reason}</div>
          </div>
          <div className="field"><label htmlFor="leave-hrRemarks">Remarks</label><textarea id="leave-hrRemarks" className="input-block" rows={2} value={hrRemarks} onChange={e => setHrRemarks(e.target.value)} placeholder="Optional remarks..." /></div>
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setReviewModal(false)}>{icons.close}</button>
            <button className="btn btn-primary" onClick={handleHrReview} disabled={hrReviewMut.isPending}>{hrReviewMut.isPending && <span className="btn-spinner" />}{hrReviewMut.isPending ? 'Reviewing...' : 'Save'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={rejectModal} onClose={() => setRejectModal(false)} title="Reject Leave" preventClose={adminRejectMut.isPending}>
        <div className="modal-form">
          <div className="field"><label htmlFor="leave-rejectRemarks">Reason for rejection *</label><textarea id="leave-rejectRemarks" className="input-block" rows={3} value={rejectRemarks} onChange={e => setRejectRemarks(e.target.value)} required placeholder="Why is this leave being rejected?" /></div>
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setRejectModal(false)}>{icons.close}</button>
            <button className="btn btn-danger" onClick={handleAdminReject} disabled={adminRejectMut.isPending}>{adminRejectMut.isPending && <span className="btn-spinner" />}{adminRejectMut.isPending ? 'Rejecting...' : 'Reject'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={viewModal} onClose={() => setViewModal(false)} title="Leave Details">
        {selectedLeave && (
          <div className="text-sm leading-relaxed">
            <div className="mb-sm">
              <div><strong>Employee:</strong> {selectedLeave.employee?.firstName} {selectedLeave.employee?.middleName ? selectedLeave.employee.middleName + ' ' : ''}{selectedLeave.employee?.lastName}</div>
              <div><strong>Department:</strong> {selectedLeave.employee?.department?.name || '—'}</div>
              <div><strong>Leave Type:</strong> {leaveLabels[selectedLeave.leaveType] || selectedLeave.leaveType}</div>
              <div><strong>Period:</strong> {formatDate(selectedLeave.startDate)} – {formatDate(selectedLeave.endDate)} ({selectedLeave.days} days)</div>
              <div><strong>Status:</strong> <span className={`badge ${statusColors[selectedLeave.status]}`}>{statusLabels[selectedLeave.status] || selectedLeave.status}</span></div>
            </div>
            <div className="mb-sm"><strong>Reason:</strong><div className="mt-xs whitespace-pre-wrap">{selectedLeave.reason || '—'}</div></div>
{selectedLeave.remarks && <div className="mb-sm"><strong>Remarks:</strong><div className="mt-xs whitespace-pre-wrap">{selectedLeave.remarks}</div></div>}
          </div>
        )}
      </Modal>
    </>
  );
}
