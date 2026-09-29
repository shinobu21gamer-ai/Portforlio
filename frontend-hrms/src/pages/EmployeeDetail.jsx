import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

import LoadingSkeleton from '../components/LoadingSkeleton';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { formatDate, peso } from '../utils/helpers';
import { useDepartments, usePositions, useSchedules, useAssignPosAccess, useRevokePosAccess } from '../hooks/useApi';
import { useIsAdmin, useIsAdminOrHR } from '../hooks/useRole';
import { confirmTerminate, confirmDelete } from '../utils/swal';
import { icons } from '../components/ActionButton';

const POS_ROLES = [
  { slug: 'cashier', label: 'Cashier' },
  { slug: 'manager', label: 'Manager' },
  { slug: 'inventory_staff', label: 'Inventory Staff' },
];

function useEmployeeDetail(id) {
  return useQuery({ queryKey: ['employee-detail', id], queryFn: () => api.get(`/employees/${id}/detail`).then(r => r.data.data), enabled: !!id });
}

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isAdmin = useIsAdmin();
  const canCreateEdit = useIsAdminOrHR();
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview');
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const { data, isLoading } = useEmployeeDetail(id);
  const { data: deptData } = useDepartments({ limit: 100 });
  const { data: posData } = usePositions({ limit: 100 });
  const { data: schedData } = useSchedules({ limit: 100 });
  const depts = deptData?.departments || [];
  const positions = posData?.positions || [];
  const schedules = schedData?.schedules || [];
  const assignPosMut = useAssignPosAccess();
  const revokePosMut = useRevokePosAccess();
  const [posModal, setPosModal] = useState(false);
  const [posRole, setPosRole] = useState('cashier');
  const fileInputRef = useRef(null);
  const [docType, setDocType] = useState('other');
  const [docNotes, setDocNotes] = useState('');

  const docsQuery = useQuery({
    queryKey: ['emp-documents', id],
    queryFn: () => api.get(`/employees/${id}/documents`).then(r => r.data.data),
    enabled: !!id,
  });
  const docs = docsQuery.data || [];

  const uploadDocMut = useMutation({
    mutationFn: (formData) => api.post(`/employees/${id}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['emp-documents', id] }); toast.success('Document uploaded'); setDocType('other'); setDocNotes(''); },
    onError: (e) => toast.error(e.response?.data?.message || 'Upload failed'),
  });

  const deleteDocMut = useMutation({
    mutationFn: (docId) => api.delete(`/employee-documents/${docId}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['emp-documents', id] }); toast.success('Deleted'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Delete failed'),
  });

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', docType);
    if (docNotes) fd.append('notes', docNotes);
    uploadDocMut.mutate(fd);
    e.target.value = '';
  };

  const handleDownload = (docId, name) => {
    api.get(`/employee-documents/${docId}/download`, { responseType: 'blob' }).then(r => {
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
    });
  };

  const DOC_TYPES = [
    { value: 'resume', label: 'Resume/CV' },
    { value: 'contract', label: 'Contract' },
    { value: 'id', label: 'Government ID' },
    { value: 'certificate', label: 'Certificate' },
    { value: 'performance', label: 'Performance Review' },
    { value: 'other', label: 'Other' },
  ];

  const updateMut = useMutation({
    mutationFn: (data) => api.put(`/employees/${id}`, data).then(r => r.data.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employee-detail', id] }); qc.invalidateQueries({ queryKey: ['employees'] }); toast.success('Employee updated'); setEditModal(false); },
    onError: (err) => { const errors = err.response?.data?.errors; if (errors?.length) toast.error(errors.join('. ')); else toast.error(err.response?.data?.message || 'Update failed'); }
  });

  const terminateMut = useMutation({
    mutationFn: () => api.put(`/employees/${id}/terminate`).then(r => r.data.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employee-detail', id] }); qc.invalidateQueries({ queryKey: ['employees'] }); toast.success('Employee terminated'); navigate('/employees'); },
    onError: (err) => { toast.error(err.response?.data?.message || 'Failed to terminate'); }
  });

  if (isLoading) return <LoadingSkeleton rows={5} />;
  if (!data?.employee) return <div className="empty-state">Employee not found</div>;

  const emp = data.employee;
  const att = data.attendance || [];
  const leaves = data.leaves || [];
  const payslips = data.payslips || [];
  const contracts = data.contracts || [];

  const leaveLabels = { sick: 'Sick', vacation: 'Vacation', personal: 'Personal', maternity: 'Maternity', paternity: 'Paternity', bereavement: 'Bereavement', other: 'Other' };
  const statusColors = { active: 'success', inactive: 'error', 'on-leave': 'warning', pending: 'warning' };
  const leaveStatusColors = { pending: 'warning', 'hr-reviewed': 'info', 'admin-approved': 'success', rejected: 'error' };

  const openEdit = () => {
    setEditForm({
      firstName: emp.firstName || '',
      middleName: emp.middleName || '',
      lastName: emp.lastName || '',
      email: emp.email || '',
      phone: emp.phone || '',
      address: emp.address || '',
      departmentId: emp.departmentId || '',
      positionId: emp.positionId || '',
      scheduleId: emp.scheduleId || '',
      salary: emp.salary || '',
      employmentType: emp.employmentType || 'full-time',
      paymentFrequency: emp.paymentFrequency || 'monthly',
      tinNumber: emp.tinNumber || '',
      sssNumber: emp.sssNumber || '',
      philHealthNumber: emp.philHealthNumber || '',
      pagIbigNumber: emp.pagIbigNumber || '',
      bankName: emp.bankName || '',
      bankAccountNumber: emp.bankAccountNumber || '',
      civilStatus: emp.civilStatus || undefined,
      nationality: emp.nationality || '',
      emergencyContactName: emp.emergencyContactName || '',
      emergencyContactPhone: emp.emergencyContactPhone || '',
      emergencyContactRelation: emp.emergencyContactRelation || '',
    });
    setEditModal(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    const payload = { ...editForm };
    if (payload.departmentId) payload.departmentId = parseInt(payload.departmentId);
    if (payload.positionId) payload.positionId = parseInt(payload.positionId);
    if (payload.scheduleId) payload.scheduleId = parseInt(payload.scheduleId);
    if (payload.salary) payload.salary = parseFloat(payload.salary);
    await updateMut.mutateAsync(payload);
  };

  const handleTerminate = async () => {
    if (!(await confirmTerminate(`Terminate ${emp.firstName} ${emp.lastName}?`))) return;
    terminateMut.mutate();
  };

  return (
    <>
      <header className="pos-header">
        <div className="flex items-center" style={{ gap: 12 }}>
          <button className="btn btn-sm btn-outline" onClick={() => navigate(-1)}>&larr;</button>
          <div>
            <h1>{emp.firstName} {emp.middleName ? emp.middleName + ' ' : ''}{emp.lastName}</h1>
            <div className="sub">{emp.employeeNo} &middot; {emp.department?.name || '—'} &middot; {emp.position?.title || '—'}</div>
          </div>
        </div>
        <div className="flex items-center gap-xs">
          <span className={`badge ${statusColors[emp.status]}`}>{emp.status}</span>
          {emp.user?.role?.slug && ['cashier', 'manager', 'inventory_staff'].includes(emp.user.role.slug) && (
            <span className="badge info">{emp.user.role.name}</span>
          )}
          {emp.status === 'active' && (
            <>
              {canCreateEdit && <button className="btn btn-sm btn-secondary" onClick={openEdit}>{icons.edit}</button>}
              {canCreateEdit && emp.userId && (
                <button className="btn btn-sm btn-outline" onClick={() => { setPosModal(true); setPosRole(emp.user?.role?.slug && ['cashier', 'manager', 'inventory_staff'].includes(emp.user.role.slug) ? emp.user.role.slug : 'cashier'); }}>
                  {emp.user?.role?.slug && ['cashier', 'manager', 'inventory_staff'].includes(emp.user.role.slug) ? 'Revoke POS' : 'Assign POS'}
                </button>
              )}
              {isAdmin && <button className="btn btn-sm btn-danger" onClick={handleTerminate} disabled={terminateMut.isPending}>Terminate</button>}
            </>
          )}
        </div>
      </header>

      <div className="flex gap-xs mb-md">
        {['overview', 'attendance', 'leaves', 'payslips', 'contracts', 'documents'].map(t => (
          <button key={t} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="detail-grid gap-md">
          <div className="card p-md">
            <h3 className="mt-0 mb-sm">Personal Info</h3>
            <div className="text-sm leading-2">
              <div><strong>Email:</strong> {emp.email}</div>
              <div><strong>Phone:</strong> {emp.phone || '—'}</div>
              <div><strong>Address:</strong> {emp.address || '—'}</div>
              <div><strong>Civil Status:</strong> {emp.civilStatus || '—'}</div>
              <div><strong>Hire Date:</strong> {formatDate(emp.hireDate)}</div>
              <div><strong>Salary:</strong> {peso(emp.salary)}</div>
              <div><strong>Type:</strong> {emp.employmentType}</div>
              <div><strong>Schedule:</strong> {emp.schedule ? `${emp.schedule.name} (${emp.schedule.startTime}–${emp.schedule.endTime})` : '—'}</div>
            </div>
          </div>
          <div className="card p-md">
            <h3 className="mt-0 mb-sm">Quick Stats</h3>
            <div className="detail-grid gap-sm">
              <div className="stat-card-inline">
                <div className="font-size-24 font-bold text-accent">{att.length}</div>
                <div className="text-xs text-muted">Attendance Records</div>
              </div>
              <div className="stat-card-inline">
                <div className="font-size-24 font-bold text-accent">{leaves.length}</div>
                <div className="text-xs text-muted">Leave Requests</div>
              </div>
              <div className="stat-card-inline">
                <div className="font-size-24 font-bold text-success">{payslips.length}</div>
                <div className="text-xs text-muted">Payslips</div>
              </div>
              <div className="stat-card-inline">
                <div className="font-size-24 font-bold text-warning">{contracts.length}</div>
                <div className="text-xs text-muted">Contracts</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Clock In</th><th>Clock Out</th><th>Status</th><th>Hours</th><th>OT</th></tr></thead>
            <tbody>
              {att.map(a => (
                <tr key={a.id}>
                  <td>{formatDate(a.date)}</td>
                  <td>{a.clockIn ? new Date(a.clockIn).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td>{a.clockOut ? new Date(a.clockOut).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td><span className={`badge ${a.status === 'present' ? 'success' : a.status === 'late' ? 'warning' : a.status === 'on-leave' ? 'info' : 'error'}`}>{a.status}</span></td>
                  <td>{a.totalHours ? Number(a.totalHours).toFixed(1) : '—'}</td>
                  <td>{a.overtime > 0 ? `+${Number(a.overtime).toFixed(1)}` : '—'}</td>
                </tr>
              ))}
              {att.length === 0 && <tr><td colSpan={6} className="empty-state">No attendance records</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'leaves' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th></tr></thead>
            <tbody>
              {leaves.map(l => (
                <tr key={l.id}>
                  <td>{leaveLabels[l.leaveType] || l.leaveType}</td>
                  <td>{formatDate(l.startDate)}</td>
                  <td>{formatDate(l.endDate)}</td>
                  <td>{l.days}</td>
                  <td className="truncate">{l.reason}</td>
                  <td><span className={`badge ${leaveStatusColors[l.status]}`}>{l.status}</span></td>
                </tr>
              ))}
              {leaves.length === 0 && <tr><td colSpan={6} className="empty-state">No leave requests</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'payslips' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Period</th><th>Basic Pay</th><th>OT</th><th>Bonus</th><th>Deductions</th><th>Net Pay</th><th>Status</th></tr></thead>
            <tbody>
              {payslips.map(ps => (
                <tr key={ps.id}>
                  <td>{ps.payroll?.period || '—'}</td>
                  <td>{peso(ps.basicSalary)}</td>
                  <td>{peso(ps.overtimePay)}</td>
                  <td>{peso(ps.bonusPay)}</td>
                  <td>{peso(ps.totalDeductions)}</td>
                  <td className="total-amount">{peso(ps.netPay)}</td>
                  <td><span className={`badge ${ps.status === 'paid' ? 'success' : 'warning'}`}>{ps.status}</span></td>
                </tr>
              ))}
              {payslips.length === 0 && <tr><td colSpan={7} className="empty-state">No payslips</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'contracts' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Type</th><th>Start</th><th>End</th><th>Salary</th><th>Status</th><th>Approved</th></tr></thead>
            <tbody>
              {contracts.map(c => (
                <tr key={c.id}>
                  <td>{c.contractType}</td>
                  <td>{formatDate(c.startDate)}</td>
                  <td>{c.endDate ? formatDate(c.endDate) : '—'}</td>
                  <td>{c.salary ? peso(c.salary) : '—'}</td>
                  <td><span className={`badge ${c.status === 'active' ? 'success' : c.status === 'terminated' ? 'error' : 'warning'}`}>{c.status}</span></td>
                  <td>{c.approvedAt ? <span className="badge success">Yes</span> : <span className="badge warning">No</span>}</td>
                </tr>
              ))}
              {contracts.length === 0 && <tr><td colSpan={6} className="empty-state">No contracts</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'documents' && (
        <div>
          {canCreateEdit && (
            <div className="flex flex-gap-sm mb-md" style={{ alignItems: 'center' }}>
              <select className="input-block" style={{ width: 180 }} value={docType} onChange={e => setDocType(e.target.value)}>
                {DOC_TYPES.map(dt => <option key={dt.value} value={dt.value}>{dt.label}</option>)}
              </select>
              <input className="input-block" style={{ width: 200 }} placeholder="Notes (optional)" value={docNotes} onChange={e => setDocNotes(e.target.value)} />
              <button className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploadDocMut.isPending}>
                {uploadDocMut.isPending ? 'Uploading...' : 'Upload File'}
              </button>
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png" className="sr-only" style={{ display: 'none' }} onChange={handleUpload} />
            </div>
          )}
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr>
                <th>Type</th><th>File Name</th><th>Size</th><th>Uploaded By</th><th>Date</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {docs.map(doc => (
                  <tr key={doc.id}>
                    <td><span className="badge badge-info">{doc.type}</span></td>
                    <td>{doc.originalName}</td>
                    <td>{(doc.size / 1024).toFixed(1)} KB</td>
                    <td>{doc.uploader ? `${doc.uploader.firstName} ${doc.uploader.lastName}` : '—'}</td>
                    <td>{formatDate(doc.createdAt)}</td>
                    <td>
                      <div className="flex gap-xs">
                        <button className="btn btn-sm btn-outline" onClick={() => handleDownload(doc.id, doc.originalName)}>Download</button>
                        {canCreateEdit && (
                          <button className="btn btn-sm btn-danger" onClick={async () => { if (await confirmDelete(`Delete this document?`)) deleteDocMut.mutate(doc.id); }}>Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {docs.length === 0 && <tr><td colSpan={6} className="empty-state">No documents uploaded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Employee" wide>
        <form onSubmit={handleEdit} className="modal-form">
          <div className="form-row">
            <div className="field"><label>First Name *</label><input className="input-block" value={editForm.firstName} onChange={e => setEditForm({...editForm, firstName: e.target.value.replace(/[^a-zA-Z\s\-'.]/g, '')})} required /></div>
            <div className="field"><label>Middle Name</label><input className="input-block" value={editForm.middleName} onChange={e => setEditForm({...editForm, middleName: e.target.value.replace(/[^a-zA-Z\s\-'.]/g, '')})} /></div>
            <div className="field"><label>Last Name *</label><input className="input-block" value={editForm.lastName} onChange={e => setEditForm({...editForm, lastName: e.target.value.replace(/[^a-zA-Z\s\-'.]/g, '')})} required /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Email *</label><input className="input-block" type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} required /></div>
            <div className="field"><label>Phone</label><input className="input-block" inputMode="tel" minLength={7} maxLength={20} value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value.replace(/[^0-9+\-\s]/g, '')})} /></div>
          </div>
          <div className="field"><label>Address</label><input className="input-block" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} /></div>
          <div className="form-row">
            <div className="field"><label>Department *</label>
              <select className="input-block" value={editForm.departmentId} onChange={e => setEditForm({...editForm, departmentId: e.target.value})} required>
                <option value="">Select</option>{depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Position *</label>
              <select className="input-block" value={editForm.positionId} onChange={e => setEditForm({...editForm, positionId: e.target.value})} required>
                <option value="">Select</option>{positions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field"><label>Schedule</label>
              <select className="input-block" value={editForm.scheduleId} onChange={e => setEditForm({...editForm, scheduleId: e.target.value})}>
                <option value="">None</option>{schedules.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Salary (₱)</label><input className="input-block" type="number" min="0" step="0.01" value={editForm.salary} onChange={e => setEditForm({...editForm, salary: e.target.value})} /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Employment Type</label>
              <select className="input-block" value={editForm.employmentType} onChange={e => setEditForm({...editForm, employmentType: e.target.value})}>
                <option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="contract">Contract</option>
              </select>
            </div>
            <div className="field"><label>Pay Schedule</label>
              <select className="input-block" value={editForm.paymentFrequency} onChange={e => setEditForm({...editForm, paymentFrequency: e.target.value})}>
                <option value="monthly">Monthly</option><option value="semi-monthly">Semi-Monthly</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field"><label>TIN Number</label><input className="input-block" inputMode="numeric" pattern="[0-9\-]*" value={editForm.tinNumber} onChange={e => setEditForm({...editForm, tinNumber: e.target.value.replace(/[^0-9\-]/g, '')})} placeholder="e.g. 123-456-789-000" /></div>
            <div className="field"><label>SSS Number</label><input className="input-block" inputMode="numeric" pattern="[0-9\-]*" value={editForm.sssNumber} onChange={e => setEditForm({...editForm, sssNumber: e.target.value.replace(/[^0-9\-]/g, '')})} placeholder="e.g. 12-3456789-0" /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>PhilHealth Number</label><input className="input-block" inputMode="numeric" pattern="[0-9\-]*" value={editForm.philHealthNumber} onChange={e => setEditForm({...editForm, philHealthNumber: e.target.value.replace(/[^0-9\-]/g, '')})} placeholder="e.g. 12345678901" /></div>
            <div className="field"><label>Pag-IBIG Number</label><input className="input-block" inputMode="numeric" pattern="[0-9\-]*" value={editForm.pagIbigNumber} onChange={e => setEditForm({...editForm, pagIbigNumber: e.target.value.replace(/[^0-9\-]/g, '')})} placeholder="e.g. 123456789012" /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Bank Name</label><input className="input-block" value={editForm.bankName} onChange={e => setEditForm({...editForm, bankName: e.target.value.replace(/[^a-zA-Z\s]/g, '')})} /></div>
            <div className="field"><label>Bank Account Number</label><input className="input-block" inputMode="numeric" pattern="[0-9]*" value={editForm.bankAccountNumber} onChange={e => setEditForm({...editForm, bankAccountNumber: e.target.value.replace(/[^0-9]/g, '')})} /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Civil Status</label><select className="input-block" value={editForm.civilStatus || ''} onChange={e => setEditForm({...editForm, civilStatus: e.target.value || undefined})}><option value="">Select</option><option value="single">Single</option><option value="married">Married</option><option value="widowed">Widowed</option><option value="separated">Separated</option><option value="divorced">Divorced</option></select></div>
            <div className="field"><label>Nationality</label><input className="input-block" value={editForm.nationality} onChange={e => setEditForm({...editForm, nationality: e.target.value.replace(/[^a-zA-Z\s]/g, '')})} /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Emergency Contact Name</label><input className="input-block" value={editForm.emergencyContactName} onChange={e => setEditForm({...editForm, emergencyContactName: e.target.value.replace(/[^a-zA-Z\s\-'.]/g, '')})} /></div>
            <div className="field"><label>Emergency Contact Phone</label><input className="input-block" inputMode="tel" minLength={7} maxLength={20} value={editForm.emergencyContactPhone} onChange={e => setEditForm({...editForm, emergencyContactPhone: e.target.value.replace(/[^0-9+\-\s]/g, '')})} /></div>
            <div className="field"><label>Relationship</label><input className="input-block" value={editForm.emergencyContactRelation} onChange={e => setEditForm({...editForm, emergencyContactRelation: e.target.value.replace(/[^a-zA-Z\s]/g, '')})} placeholder="e.g. Spouse, Parent" /></div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setEditModal(false)}>{icons.close}</button>
            <button type="submit" className="btn btn-primary" disabled={updateMut.isPending}>{updateMut.isPending && <span className="btn-spinner" />}{updateMut.isPending ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={posModal} onClose={() => setPosModal(false)} title="Assign POS Access">
        <div className="mb-md">
          <p className="text-sm text-muted mb-sm">
            Select which POS role to assign. This employee can then log in and work in the POS system.
          </p>
          {emp.user?.role?.slug && ['cashier', 'manager', 'inventory_staff'].includes(emp.user.role.slug) && (
            <div className="p-sm mb-sm text-sm" style={{ background: 'var(--bg)', borderRadius: 8 }}>
              Current role: <strong>{emp.user.role.name}</strong>
            </div>
          )}
          <div className="field">
            <label htmlFor="detail-pos-role">POS Role</label>
            <select id="detail-pos-role" className="input-block" value={posRole} onChange={e => setPosRole(e.target.value)}>
              {POS_ROLES.map(r => <option key={r.slug} value={r.slug}>{r.label}</option>)}
            </select>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={() => setPosModal(false)}>Cancel</button>
          {emp.user?.role?.slug && ['cashier', 'manager', 'inventory_staff'].includes(emp.user.role.slug) && (
            <button type="button" className="btn btn-danger" onClick={async () => {
              try { await revokePosMut.mutateAsync(id); toast.success('POS access revoked'); setPosModal(false); }
              catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
            }} disabled={revokePosMut.isPending}>
              {revokePosMut.isPending && <span className="btn-spinner" />}
              {revokePosMut.isPending ? 'Revoking...' : 'Revoke POS Access'}
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={async () => {
            try { await assignPosMut.mutateAsync({ id: parseInt(id), roleSlug: posRole }); toast.success('POS role assigned'); setPosModal(false); }
            catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
          }} disabled={assignPosMut.isPending}>
            {assignPosMut.isPending && <span className="btn-spinner" />}
            {assignPosMut.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </Modal>
    </>
  );
}
