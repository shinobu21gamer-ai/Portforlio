import { useState } from 'react';
import SortableHeader from '../components/SortableHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

import LoadingSkeleton from '../components/LoadingSkeleton';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { formatDate, peso } from '../utils/helpers';
import { useEmployees } from '../hooks/useApi';
import { useIsAdmin, useIsAdminOrHR } from '../hooks/useRole';
import useConfirm from '../hooks/useConfirm.jsx';
import useDebounce from '../hooks/useDebounce';
import { icons } from '../components/ActionButton';

function useContracts(params = {}) {
  return useQuery({ queryKey: ['contracts', params], queryFn: () => api.get('/contracts', { params }).then(r => r.data.data) });
}
function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d) => api.post('/contracts', d).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }) });
}
function useUpdateContract() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }) => api.put(`/contracts/${id}`, data).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }) });
}
function useApproveContract() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => api.put(`/contracts/${id}/approve`).then(r => r.data.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['contracts'] }); qc.invalidateQueries({ queryKey: ['pending-counts'] }); } });
}
function useTerminateContract() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => api.put(`/contracts/${id}/terminate`).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }) });
}
function useRejectContract() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, remarks }) => api.put(`/contracts/${id}/reject`, { remarks }).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }) });
}
function useDeleteContract() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => api.delete(`/contracts/${id}`).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }) });
}

export default function Contracts() {
  const { confirmDelete, confirmApprove, confirmTerminate, confirmDialog } = useConfirm();
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
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [today] = useState(() => new Date().toISOString().split('T')[0]);
  const [form, setForm] = useState({ employeeId: '', contractType: 'regular', paymentFrequency: 'monthly', startDate: '', endDate: '', salary: '', terms: '', notes: '' });
  const [editForm, setEditForm] = useState({ contractType: '', paymentFrequency: 'monthly', startDate: '', endDate: '', salary: '', terms: '', notes: '' });
  const [selected, setSelected] = useState([]);
  const toast = useToast();
  const isAdmin = useIsAdmin();
  const canCreateEdit = useIsAdminOrHR();

  const { data, isLoading } = useContracts({ page, limit: 10, status: statusFilter || undefined, contractType: typeFilter || undefined, search: debouncedSearch || undefined, sortBy, sortOrder });
  const { data: empData } = useEmployees({ limit: 100, status: 'active' });
  const employees = empData?.employees || [];
  const contracts = data?.contracts || [];
  const createMut = useCreateContract();
  const updateMut = useUpdateContract();
  const approveMut = useApproveContract();
  const terminateMut = useTerminateContract();
  const rejectMut = useRejectContract();
  const deleteMut = useDeleteContract();

  const toggleSelect = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => {
    const approvable = contracts.filter(c => c.status === 'pending' && !c.approvedAt && isAdmin).map(c => c.id);
    if (selected.length === approvable.length) setSelected([]);
    else setSelected(approvable);
  };
  const handleBatchApprove = async () => {
    if (selected.length === 0) return;
    const results = await Promise.allSettled(selected.map(id => approveMut.mutateAsync(id)));
    const ok = results.filter(r => r.status === 'fulfilled').length;
    const fail = results.filter(r => r.status === 'rejected').length;
    setSelected([]);
    toast.success(`Approved: ${ok}${fail ? `, failed: ${fail}` : ''}`);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.employeeId) { toast.error('Employee is required'); return; }
    if (!form.startDate) { toast.error('Start date is required'); return; }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      toast.error('End date must be on or after start date');
      return;
    }
    if (form.salary && parseFloat(form.salary) < 0) { toast.error('Salary cannot be negative'); return; }
    try {
      await createMut.mutateAsync({ ...form, employeeId: parseInt(form.employeeId), salary: form.salary ? parseFloat(form.salary) : null });
      toast.success('Contract created - pending admin approval');
      setCreateModal(false);
      setForm({ employeeId: '', contractType: 'regular', paymentFrequency: 'monthly', startDate: '', endDate: '', salary: '', terms: '', notes: '' });
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!selectedContract) return;
    if (editForm.startDate && editForm.endDate && editForm.endDate < editForm.startDate) {
      toast.error('End date must be on or after start date');
      return;
    }
    if (editForm.salary && parseFloat(editForm.salary) < 0) { toast.error('Salary cannot be negative'); return; }
    try {
      await updateMut.mutateAsync({ id: selectedContract.id, data: { ...editForm, salary: editForm.salary ? parseFloat(editForm.salary) : null } });
      toast.success('Contract updated');
      setEditModal(false);
      setSelectedContract(null);
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirmDelete('Delete this contract?'))) return;
    try { await deleteMut.mutateAsync(id); toast.success('Contract deleted'); }
    catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleApprove = async (c) => {
    if (!(await confirmApprove('Approve this contract?'))) return;
    try {
      await approveMut.mutateAsync(c.id);
      toast.success('Contract approved');
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Approval failed');
    }
  };

  const handleTerminate = async (c) => {
    if (!(await confirmTerminate('Terminate this contract? Employee will be set to inactive.'))) return;
    try {
      await terminateMut.mutateAsync(c.id);
      toast.success('Contract terminated');
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Termination failed');
    }
  };

  const openEdit = (c) => {
    setSelectedContract(c);
    setEditForm({ contractType: c.contractType, paymentFrequency: c.paymentFrequency || 'monthly', startDate: c.startDate?.split('T')[0] || '', endDate: c.endDate?.split('T')[0] || '', salary: c.salary || '', terms: c.terms || '', notes: c.notes || '' });
    setEditModal(true);
  };

  const openView = (c) => { setSelectedContract(c); setViewModal(true); };

  const getExpiryBadge = (c) => {
    if (!c.endDate || c.status === 'terminated' || c.status === 'rejected') return null;
    const end = new Date(c.endDate);
    const now = new Date();
    const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return <span className="badge error ml-xs">Expired</span>;
    if (diffDays <= 30) return <span className="badge warning ml-xs">Expiring in {diffDays}d</span>;
    return null;
  };

  const handleRenew = (c) => {
    setSelectedContract(c);
    setForm({
      employeeId: c.employeeId || '',
      contractType: c.contractType,
      paymentFrequency: c.paymentFrequency || 'monthly',
      startDate: '',
      endDate: '',
      salary: c.salary || '',
      terms: c.terms || '',
      notes: `Renewed from contract #${c.id}`,
    });
    setCreateModal(true);
  };

  const handleReject = async () => {
    if (!selectedContract) return;
    try { await rejectMut.mutateAsync({ id: selectedContract.id, remarks: rejectRemarks }); toast.success('Contract rejected'); setRejectModal(false); setSelectedContract(null); setRejectRemarks(''); }
    catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const typeLabels = { regular: 'Regular', probationary: 'Probationary', contract: 'Contract', deployment: 'Deployment', project: 'Project' };
  const statusColors = { pending: 'info', active: 'success', expired: 'warning', terminated: 'error', completed: 'info', rejected: 'error' };

  return (
    <>
      <header className="pos-header">
        <div><h1>Contracts</h1><div className="sub">Employee contracts, deployment, and probationary periods</div></div>
        {canCreateEdit && <button className="btn btn-primary" onClick={() => setCreateModal(true)}>＋</button>}
      </header>

      <div className="flex-row flex-wrap mb-md">
        <input className="input-block" placeholder="Search employee name..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ width: 200 }} />
        <select className="input-block" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={{ width: 140 }}>
          <option value="">All Status</option>
          <option value="active">Active</option><option value="expired">Expired</option><option value="terminated">Terminated</option><option value="completed">Completed</option><option value="rejected">Rejected</option>
          {isAdmin && <option value="pending">Pending Approval</option>}
        </select>
        <select className="input-block" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} style={{ width: 160 }}>
          <option value="">All Types</option>
          {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {selected.length > 0 && isAdmin && (
          <button className="btn btn-sm btn-success ml-auto" onClick={handleBatchApprove} disabled={approveMut.isPending}>Approve ({selected.length})</button>
        )}
      </div>

      {isLoading ? <LoadingSkeleton rows={4} /> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th className="w-40"><input type="checkbox" checked={selected.length > 0 && selected.length === contracts.filter(c => c.status === 'pending' && !c.approvedAt && isAdmin).length} onChange={toggleAll} /></th><th>Employee</th><th>Department</th><th>Type</th><th>Payment</th><SortableHeader label="Start" field="startDate" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /><SortableHeader label="End" field="endDate" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /><SortableHeader label="Salary" field="salary" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /><th>Status</th><th>Approved</th><th>Actions</th></tr></thead>
            <tbody>
              {contracts.map(c => {
                const canApprove = c.status === 'pending' && !c.approvedAt && isAdmin;
                return (
                <tr key={c.id}>
                  <td>{canApprove && <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleSelect(c.id)} />}</td>
                  <td>{c.employee?.firstName} {c.employee?.middleName ? c.employee.middleName + ' ' : ''}{c.employee?.lastName}</td>
                  <td>{c.employee?.department?.name || '—'}</td>
                  <td>{typeLabels[c.contractType] || c.contractType}</td>
                  <td>{c.paymentFrequency === 'semi-monthly' ? '15th & End' : 'Monthly'}</td>
                  <td>{formatDate(c.startDate)}</td>
                  <td>{c.endDate ? <span className={getExpiryBadge(c) ? '' : ''}>{formatDate(c.endDate)}{getExpiryBadge(c)}</span> : '—'}</td>
                  <td>{c.salary ? peso(c.salary) : '—'}</td>
                  <td><span className={`badge ${statusColors[c.status]}`}>{c.status}</span></td>
                  <td>{c.approvedAt ? <span className="badge success">Yes</span> : <span className="badge warning">No</span>}</td>
                  <td>
                    <button className="btn btn-sm btn-secondary mr-xs" onClick={() => openView(c)}>{icons.view}</button>
{c.status === 'pending' && !c.approvedAt && isAdmin && <button className="btn btn-sm btn-success mr-xs" onClick={() => handleApprove(c)} disabled={approveMut.isPending}>{icons.approve}</button>}
{c.status === 'pending' && !c.approvedAt && isAdmin && <button className="btn btn-sm btn-danger mr-xs" onClick={() => { setSelectedContract(c); setRejectModal(true); }} disabled={rejectMut.isPending}>{icons.close}</button>}
                    {c.status === 'active' && isAdmin && <button className="btn btn-sm btn-danger mr-xs" onClick={() => handleTerminate(c)} disabled={terminateMut.isPending}>Terminate</button>}
                    {(c.status === 'expired' || c.status === 'completed') && canCreateEdit && <button className="btn btn-sm btn-primary mr-xs" onClick={() => handleRenew(c)}>Renew</button>}
                    {canCreateEdit && c.status !== 'terminated' && c.status !== 'rejected' && <button className="btn btn-sm btn-outline mr-xs" onClick={() => openEdit(c)}>{icons.edit}</button>}
                    {isAdmin && c.status !== 'active' && c.status !== 'approved' && <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c.id)}>{icons.delete}</button>}
                  </td>
                </tr>
              );})}
              {(!data?.contracts || data.contracts.length === 0) && <tr><td colSpan={11} className="empty-state">No contracts.</td></tr>}
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

      <Modal open={createModal} onClose={() => setCreateModal(false)} title="New Contract" wide preventClose={createMut.isPending}>
        <form onSubmit={handleCreate} className="modal-form">
          <div className="field"><label htmlFor="contract-employeeId">Employee *</label>
            <select id="contract-employeeId" className="input-block" value={form.employeeId} onChange={e => setForm({...form, employeeId: e.target.value})} required>
              <option value="">Select Employee</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.middleName ? e.middleName + ' ' : ''}{e.lastName}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="field"><label htmlFor="contract-type">Contract Type *</label>
              <select id="contract-type" className="input-block" value={form.contractType} onChange={e => setForm({...form, contractType: e.target.value})} required>
                {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="contract-paymentFreq">Payment Schedule *</label>
              <select id="contract-paymentFreq" className="input-block" value={form.paymentFrequency} onChange={e => setForm({...form, paymentFrequency: e.target.value})} required>
                <option value="monthly">Monthly (end of month)</option>
                <option value="semi-monthly">Semi-Monthly (15th &amp; end of month)</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field"><label htmlFor="contract-startDate">Start Date *</label><input id="contract-startDate" className="input-block" type="date" value={form.startDate} min={today} onChange={e => setForm({...form, startDate: e.target.value})} required /></div>
            <div className="field"><label htmlFor="contract-endDate">End Date</label><input id="contract-endDate" className="input-block" type="date" value={form.endDate} min={form.startDate || today} onChange={e => setForm({...form, endDate: e.target.value})} /></div>
          </div>
          <div className="field"><label htmlFor="contract-salary">Salary (₱)</label><input id="contract-salary" className="input-block" type="number" min="0" value={form.salary} onChange={e => setForm({...form, salary: e.target.value})} /></div>
          <div className="field"><label htmlFor="contract-terms">Terms</label><textarea id="contract-terms" className="input-block" rows={2} value={form.terms} onChange={e => setForm({...form, terms: e.target.value})} /></div>
          <div className="field"><label htmlFor="contract-notes">Notes</label><textarea id="contract-notes" className="input-block" rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setCreateModal(false)}>{icons.close}</button>
            <button type="submit" className="btn btn-primary" disabled={createMut.isPending}>{createMut.isPending && <span className="btn-spinner" />}{createMut.isPending ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Contract" wide preventClose={updateMut.isPending}>
        <form onSubmit={handleEdit} className="modal-form">
          <div className="form-row">
            <div className="field"><label htmlFor="editContract-type">Contract Type *</label>
              <select id="editContract-type" className="input-block" value={editForm.contractType} onChange={e => setEditForm({...editForm, contractType: e.target.value})} required>
                {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="editContract-paymentFreq">Payment Schedule *</label>
              <select id="editContract-paymentFreq" className="input-block" value={editForm.paymentFrequency} onChange={e => setEditForm({...editForm, paymentFrequency: e.target.value})} required>
                <option value="monthly">Monthly (end of month)</option>
                <option value="semi-monthly">Semi-Monthly (15th &amp; end of month)</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field"><label htmlFor="editContract-startDate">Start Date *</label><input id="editContract-startDate" className="input-block" type="date" value={editForm.startDate} min={today} onChange={e => setEditForm({...editForm, startDate: e.target.value})} required /></div>
            <div className="field"><label htmlFor="editContract-endDate">End Date</label><input id="editContract-endDate" className="input-block" type="date" value={editForm.endDate} min={editForm.startDate || today} onChange={e => setEditForm({...editForm, endDate: e.target.value})} /></div>
          </div>
          <div className="field"><label htmlFor="editContract-salary">Salary (₱)</label><input id="editContract-salary" className="input-block" type="number" min="0" value={editForm.salary} onChange={e => setEditForm({...editForm, salary: e.target.value})} /></div>
          <div className="field"><label htmlFor="editContract-terms">Terms</label><textarea id="editContract-terms" className="input-block" rows={2} value={editForm.terms} onChange={e => setEditForm({...editForm, terms: e.target.value})} /></div>
          <div className="field"><label htmlFor="editContract-notes">Notes</label><textarea id="editContract-notes" className="input-block" rows={2} value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setEditModal(false)}>{icons.close}</button>
            <button type="submit" className="btn btn-primary" disabled={updateMut.isPending}>{updateMut.isPending && <span className="btn-spinner" />}{updateMut.isPending ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={viewModal} onClose={() => setViewModal(false)} title="Employment Contract" wide>
        {selectedContract && (
          <div className="contract-preview print-payslip">
            <div className="contract-header">
              <h2>EMPLOYMENT CONTRACT</h2>
              <div className="text-sm text-muted mt-xs">MiniMart Corporation</div>
            </div>

            <div className="contract-body">
              <div className="mb-md">
                <p>This Employment Contract is entered into by and between:</p>
                <p><strong>EMPLOYER:</strong> MiniMart Corporation, hereinafter referred to as the "Company"</p>
                <p><strong>EMPLOYEE:</strong> {selectedContract.employee?.firstName} {selectedContract.employee?.middleName ? selectedContract.employee.middleName + ' ' : ''}{selectedContract.employee?.lastName}, {selectedContract.employee?.email}, hereinafter referred to as the "Employee"</p>
              </div>

              <div className="mb-md">
                <h3 className="detail-section-title">ARTICLE I — POSITION AND EMPLOYMENT</h3>
                <table className="print-table">
                  <tbody>
                    <tr><td className="detail-label w-200"><strong>Employee No.</strong></td><td>{selectedContract.employee?.employeeNo || '—'}</td></tr>
                    <tr><td><strong>Position</strong></td><td>{selectedContract.employee?.position?.title || '—'}</td></tr>
                    <tr><td><strong>Department</strong></td><td>{selectedContract.employee?.department?.name || '—'}</td></tr>
                    <tr><td><strong>Employment Type</strong></td><td>{typeLabels[selectedContract.contractType] || selectedContract.contractType}</td></tr>
                    <tr><td><strong>Effective Date</strong></td><td>{formatDate(selectedContract.startDate)}</td></tr>
                    {selectedContract.endDate && <tr><td><strong>End Date</strong></td><td>{formatDate(selectedContract.endDate)}</td></tr>}
                  </tbody>
                </table>
              </div>

              <div className="mb-md">
                <h3 className="detail-section-title">ARTICLE II — COMPENSATION</h3>
                <table className="print-table">
                  <tbody>
                    <tr><td className="w-200"><strong>Basic Monthly Salary</strong></td><td>{selectedContract.salary ? peso(selectedContract.salary) : '—'}</td></tr>
                    <tr><td><strong>Payment Schedule</strong></td><td>{selectedContract.paymentFrequency === 'semi-monthly' ? 'Semi-Monthly — salary is paid on the 15th and last day of each month' : 'Monthly — salary is paid on the last working day of each month'}</td></tr>
                    <tr><td><strong>Payroll Deductions</strong></td><td>SSS, PhilHealth, Pag-IBIG, and withholding tax shall be deducted in accordance with Philippine law</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="mb-md">
                <h3 className="detail-section-title">ARTICLE III — WORKING HOURS</h3>
                <p>The Employee shall render work of at least eight (8) hours per day, five (5) days a week, unless otherwise arranged with the immediate supervisor. Overtime work shall be subject to prior approval and shall be compensated in accordance with the Labor Code of the Philippines.</p>
              </div>

              <div className="mb-md">
                <h3 className="detail-section-title">ARTICLE IV — LEAVE ENTITLEMENTS</h3>
                <p>The Employee shall be entitled to leave benefits in accordance with Philippine Labor Standards, including but not limited to:</p>
                <ul className="ml-auto mt-xs" style={{ marginLeft: 20 }}>
                  <li>Sick Leave — as required by company policy</li>
                  <li>Vacation Leave — as required by company policy</li>
                  <li>Maternity/Paternity Leave — in accordance with RA 11210</li>
                  <li>Special Leave for Women — in accordance with RA 9710</li>
                </ul>
              </div>

              <div className="mb-md">
                <h3 className="detail-section-title">ARTICLE V — TERMINATION</h3>
                <p>Either party may terminate this contract by providing thirty (30) days written notice. The Company may terminate employment for just cause as provided under Article 297 of the Labor Code of the Philippines.</p>
              </div>

              <div className="mb-md">
                <h3 className="detail-section-title">ARTICLE VI — CONFIDENTIALITY</h3>
                <p>The Employee agrees to maintain the confidentiality of all proprietary information, trade secrets, and business operations of the Company during and after employment.</p>
              </div>

              {selectedContract.terms && (
                <div className="mb-md">
                  <h3 className="detail-section-title">ADDITIONAL TERMS AND CONDITIONS</h3>
                  <div className="whitespace-pre-wrap p-sm" style={{ background: 'var(--bg)', borderRadius: 6 }}>{selectedContract.terms}</div>
                </div>
              )}

              <div className="contract-footer">
                <div className="contract-sign">
                  <div className="line"><strong>EMPLOYER:</strong><br />MiniMart Corporation</div>
                </div>
                <div className="contract-sign">
                  <div className="line"><strong>EMPLOYEE:</strong><br />{selectedContract.employee?.firstName} {selectedContract.employee?.middleName ? selectedContract.employee.middleName + ' ' : ''}{selectedContract.employee?.lastName}</div>
                </div>
              </div>

              <div className="text-center text-sm text-muted mt-md">
                Contract Status: <span className={`badge uppercase ${statusColors[selectedContract.status]}`}>{selectedContract.status}</span>
                {selectedContract.approvedAt && <span className="ml-auto">Approved on {formatDate(selectedContract.approvedAt)}</span>}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={rejectModal} onClose={() => setRejectModal(false)} title="Reject Contract" preventClose={rejectMut.isPending}>
        <div className="modal-form">
          <div className="field"><label htmlFor="contract-rejectRemarks">Reason for rejection *</label><textarea id="contract-rejectRemarks" className="input-block" rows={3} value={rejectRemarks} onChange={e => setRejectRemarks(e.target.value)} required placeholder="Why is this contract being rejected?" /></div>
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setRejectModal(false)}>{icons.close}</button>
            <button className="btn btn-danger" onClick={handleReject} disabled={rejectMut.isPending}>{rejectMut.isPending ? 'Rejecting...' : 'Reject'}</button>
          </div>
        </div>
      </Modal>
    {confirmDialog}
    </>
  );
}
