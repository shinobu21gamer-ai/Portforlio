import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEmployees, useCreateEmployee, useUpdateEmployee, useApproveEmployee, useRejectEmployee, useAssignPosAccess, useRevokePosAccess, useDepartments, usePositions } from '../hooks/useApi';
import api from '../api/client';

import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { formatDate, peso } from '../utils/helpers';
import { useIsAdmin, useIsAdminOrHR } from '../hooks/useRole';
import useDebounce from '../hooks/useDebounce';
import { confirmApprove, confirmReject, confirmTerminate } from '../utils/swal';
import { icons } from '../components/ActionButton';

const columns = [
  { key: 'employeeNo', label: 'ID', sortable: true, sortKey: 'employeeNo' },
  { key: 'name', label: 'Name', sortable: true, sortKey: 'firstName' },
  { key: 'email', label: 'Email', sortable: true, sortKey: 'email' },
  { key: 'phone', label: 'Phone', sortable: false },
  { key: 'department', label: 'Department', sortable: false },
  { key: 'position', label: 'Position', sortable: false },
  { key: 'posRole', label: 'POS Role', sortable: false },
  { key: 'salary', label: 'Salary', sortable: true, sortKey: 'salary' },
  { key: 'hireDate', label: 'Hire Date', sortable: true, sortKey: 'hireDate' },
  { key: 'status', label: 'Status', sortable: true, sortKey: 'status' },
  { key: 'approved', label: 'Approved', sortable: false },
  { key: 'actions', label: 'Actions', sortable: false },
];

const POS_ROLES = [
  { slug: 'cashier', label: 'Cashier' },
  { slug: 'manager', label: 'Manager' },
  { slug: 'inventory_staff', label: 'Inventory Staff' },
];

export default function Employees() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [posModal, setPosModal] = useState({ open: false, employee: null });
  const [posRole, setPosRole] = useState('cashier');
  const toast = useToast();
  const isAdmin = useIsAdmin();
  const canCreateEdit = useIsAdminOrHR();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useEmployees({ page, limit: 10, search: debouncedSearch || undefined, status: statusFilter || undefined, employmentType: typeFilter || undefined, sortBy, sortOrder });
  const { data: depts } = useDepartments({ limit: 100 });
  const { data: posData } = usePositions({ limit: 100 });
  const createMut = useCreateEmployee();
  const updateMut = useUpdateEmployee();
  const approveMut = useApproveEmployee();
  const rejectMut = useRejectEmployee();
  const assignPosMut = useAssignPosAccess();
  const revokePosMut = useRevokePosAccess();
  const terminateMut = useMutation({
    mutationFn: (id) => api.put(`/employees/${id}/terminate`).then(r => r.data.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); toast.success('Employee terminated and all data removed'); },
    onError: (err) => { toast.error(err.response?.data?.message || 'Failed to terminate employee'); }
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ firstName: '', middleName: '', lastName: '', email: '', phone: '', hireDate: '', departmentId: '', positionId: '', salary: '', employmentType: 'full-time', tinNumber: '', sssNumber: '', philHealthNumber: '', pagIbigNumber: '', bankName: '', bankAccountNumber: '', emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: '', civilStatus: '', nationality: '', educationLevel: '' });
    setModalOpen(true);
  };

  const openEdit = (emp) => {
    setEditing(emp);
    setForm({
      firstName: emp.firstName, middleName: emp.middleName || '', lastName: emp.lastName, email: emp.email,
      phone: emp.phone || '', hireDate: emp.hireDate?.split('T')[0] || '',
      departmentId: emp.departmentId || '', positionId: emp.positionId || '',
      salary: emp.salary || '', employmentType: emp.employmentType || 'full-time', status: emp.status,
      tinNumber: emp.tinNumber || '', sssNumber: emp.sssNumber || '', philHealthNumber: emp.philHealthNumber || '', pagIbigNumber: emp.pagIbigNumber || '',
      bankName: emp.bankName || '', bankAccountNumber: emp.bankAccountNumber || '',
      emergencyContactName: emp.emergencyContactName || '', emergencyContactPhone: emp.emergencyContactPhone || '', emergencyContactRelation: emp.emergencyContactRelation || '',
      civilStatus: emp.civilStatus || '', nationality: emp.nationality || '', educationLevel: emp.educationLevel || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName?.trim() || !form.lastName?.trim()) { toast.error('First name and last name are required'); return; }
    if (!form.email?.trim()) { toast.error('Email is required'); return; }
    if (!form.hireDate) { toast.error('Hire date is required'); return; }
    if (form.hireDate > new Date().toISOString().split('T')[0]) { toast.error('Hire date cannot be in the future'); return; }
    const salary = parseFloat(form.salary) || 0;
    if (salary < 0) { toast.error('Salary cannot be negative'); return; }
    if (salary > 10000000) { toast.error('Salary exceeds maximum limit'); return; }
    if (!form.departmentId || !form.positionId) { toast.error('Department and position are required'); return; }
    try {
      const payload = { ...form, salary };
      // Omit empty optional fields to avoid validator rejection
      if (!payload.civilStatus) delete payload.civilStatus;
      if (!editing && payload.status === undefined) delete payload.status; // let server default to active
      if (editing && !payload.status) delete payload.status;
      if (editing && !payload.civilStatus) delete payload.civilStatus;
      if (editing) { await updateMut.mutateAsync({ id: editing.id, data: payload }); toast.success('Employee updated'); }
      else { await createMut.mutateAsync(payload); toast.success('Employee created'); }
      setModalOpen(false);
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleApprove = async (emp) => {
    if (!(await confirmApprove(`Approve ${emp.firstName}?`))) return;
    try {
      const result = await approveMut.mutateAsync(emp.id);
      // Temp password is one-time: it is also emailed to the employee, and the
      // account is forced to change it at first login.
      if (result?.tempPassword) {
        toast.success(`Approved. One-time login password: ${result.tempPassword} (sent by email — must be changed at first login)`);
      } else {
        toast.success('Employee approved');
      }
    }
    catch (err) { const errors = err.response?.data?.errors; if (errors?.length) toast.error(errors.join('. ')); else toast.error(err.response?.data?.message || 'Approval failed'); }
  };

  const handleReject = async (emp) => {
    if (!(await confirmReject(`Reject ${emp.firstName}?`))) return;
    try { await rejectMut.mutateAsync(emp.id); toast.success('Employee rejected'); }
    catch (err) { const errors = err.response?.data?.errors; if (errors?.length) toast.error(errors.join('. ')); else toast.error(err.response?.data?.message || 'Rejection failed'); }
  };

  const handleTerminate = async (emp) => {
    if (!(await confirmTerminate(`Terminate ${emp.firstName} ${emp.middleName ? emp.middleName + ' ' : ''}${emp.lastName}? This will deactivate their account.`))) return;
    terminateMut.mutate(emp.id);
  };

  const openPosAssign = (emp) => {
    setPosModal({ open: true, employee: emp });
    setPosRole(emp.user?.role?.slug && ['cashier', 'manager', 'inventory_staff'].includes(emp.user.role.slug) ? emp.user.role.slug : 'cashier');
  };

  const handlePosAssign = async () => {
    if (!posModal.employee) return;
    try {
      await assignPosMut.mutateAsync({ id: posModal.employee.id, roleSlug: posRole });
      toast.success(`${posModal.employee.firstName} assigned as ${POS_ROLES.find(r => r.slug === posRole)?.label}`);
      setPosModal({ open: false, employee: null });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign POS role');
    }
  };

  const handlePosRevoke = async () => {
    if (!posModal.employee) return;
    try {
      await revokePosMut.mutateAsync(posModal.employee.id);
      toast.success(`POS access revoked from ${posModal.employee.firstName}`);
      setPosModal({ open: false, employee: null });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to revoke POS access');
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) setSortOrder(o => o === 'ASC' ? 'DESC' : 'ASC');
    else { setSortBy(field); setSortOrder('ASC'); }
    setPage(1);
  };

  return (
    <>
      <header className="pos-header">
        <div><h1>Employees</h1><div className="sub">{data?.pagination?.totalItems || 0} total</div></div>
        <div className="flex-gap items-center">
          {canCreateEdit && <button className="btn btn-primary" onClick={openAdd}>＋</button>}
        </div>
      </header>

      <div className="search-bar">
        <select className="input-block" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={{ width: 160 }}>
          <option value="">All Status</option>
          <option value="active">Active</option><option value="pending">Pending</option><option value="inactive">Inactive</option><option value="on-leave">On Leave</option>
        </select>
        <select className="input-block" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} style={{ width: 160 }}>
          <option value="">All Types</option>
          <option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="contract">Contract</option>
        </select>
        <div className="flex-1 pos-rel">
          <input className="input-block" placeholder="Search employees..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ width: '100%', paddingRight: search ? 28 : undefined }} />
          {search && <button onClick={() => { setSearch(''); setPage(1); }} className="search-clear" style={{ right: 6 }}>&times;</button>}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.employees || []}
        pagination={data?.pagination}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No employees found"
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        renderRow={(emp, _idx, visHeaders) => {
          const cellMap = {
            employeeNo: <td className="mono">{emp.employeeNo}</td>,
            name: <td><strong>{emp.firstName} {emp.middleName ? emp.middleName + ' ' : ''}{emp.lastName}</strong>{emp.tinNumber && <div className="text-xs text-muted">TIN: {emp.tinNumber} | SSS: {emp.sssNumber} | PhilHealth: {emp.philHealthNumber} | Pag-IBIG: {emp.pagIbigNumber}</div>}</td>,
            email: <td>{emp.email}</td>,
            phone: <td>{emp.phone || '—'}</td>,
            department: <td>{emp.department?.name || '—'}</td>,
            position: <td>{emp.position?.title || '—'}</td>,
            posRole: <td>
              {emp.user?.role?.slug && ['cashier', 'manager', 'inventory_staff'].includes(emp.user.role.slug)
                ? <span className={`badge ${emp.user.role.slug === 'manager' ? 'info' : 'success'}`}>{emp.user.role.name}</span>
                : <span className="text-xs text-muted">—</span>
              }
            </td>,
            salary: <td>{peso(emp.salary)}</td>,
            hireDate: <td>{formatDate(emp.hireDate)}</td>,
            status: <td><span className={`badge ${emp.status === 'active' ? 'success' : emp.status === 'on-leave' ? 'warning' : emp.status === 'pending' ? 'info' : 'error'}`}>{emp.status}</span></td>,
            approved: <td>{emp.approvedAt ? <span className="badge success">Approved</span> : <span className="badge warning">Pending</span>}</td>,
            actions: <td>
              <button className="btn btn-sm btn-secondary" onClick={() => navigate(`/employees/${emp.id}`)} style={{ marginRight: 4 }}>{icons.view}</button>
              {isAdmin && !emp.approvedAt && <button className="btn btn-sm btn-success" onClick={() => handleApprove(emp)} disabled={approveMut.isPending} style={{ marginRight: 4 }}>{icons.approve}</button>}
              {isAdmin && !emp.approvedAt && <button className="btn btn-sm btn-danger" onClick={() => handleReject(emp)} disabled={rejectMut.isPending} style={{ marginRight: 4 }}>Reject</button>}
              {canCreateEdit && <button className="btn btn-sm btn-secondary" onClick={() => openEdit(emp)}>{icons.edit}</button>}
              {emp.status === 'active' && emp.approvedAt && emp.userId && (
                <button className="btn btn-sm btn-outline" onClick={() => openPosAssign(emp)} style={{ marginLeft: 4 }}>
                  {emp.user?.role?.slug && ['cashier', 'manager', 'inventory_staff'].includes(emp.user.role.slug) ? 'Revoke POS' : 'Assign POS'}
                </button>
              )}
              {isAdmin && emp.status === 'active' && <button className="btn btn-sm btn-danger" onClick={() => handleTerminate(emp)} disabled={terminateMut.isPending} style={{ marginLeft: 4 }}>Terminate</button>}
            </td>,
          };
          return <tr key={emp.id}>{visHeaders.map(c => cellMap[c.key])}</tr>;
        }}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Employee' : 'New Employee'} preventClose={createMut.isPending || updateMut.isPending}>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="field"><label htmlFor="emp-firstName">First Name *</label><input id="emp-firstName" className="input-block" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value.replace(/[^a-zA-Z\s\-'.]/g, '')})} required /></div>
            <div className="field"><label htmlFor="emp-middleName">Middle Name</label><input id="emp-middleName" className="input-block" value={form.middleName} onChange={e => setForm({...form, middleName: e.target.value.replace(/[^a-zA-Z\s\-'.]/g, '')})} /></div>
            <div className="field"><label htmlFor="emp-lastName">Last Name *</label><input id="emp-lastName" className="input-block" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value.replace(/[^a-zA-Z\s\-'.]/g, '')})} required /></div>
          </div>
          <div className="field"><label htmlFor="emp-email">Email *</label><input id="emp-email" className="input-block" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required /></div>
          <div className="field"><label htmlFor="emp-phone">Phone</label><input id="emp-phone" className="input-block" inputMode="tel" minLength={7} maxLength={20} value={form.phone} onChange={e => setForm({...form, phone: e.target.value.replace(/[^0-9+\-\s]/g, '')})} /></div>
          <div className="form-row">
            <div className="field"><label htmlFor="emp-hireDate">Hire Date *</label><input id="emp-hireDate" className="input-block" type="date" value={form.hireDate} max={new Date().toISOString().split('T')[0]} onChange={e => setForm({...form, hireDate: e.target.value})} required /></div>
            <div className="field"><label htmlFor="emp-salary">Salary *</label><input id="emp-salary" className="input-block" type="number" min="0" step="100" value={form.salary || ''} onChange={e => setForm({...form, salary: e.target.value})} required /></div>
          </div>
          <div className="form-row">
            <div className="field"><label htmlFor="emp-departmentId">Department *</label>
              <select id="emp-departmentId" className="input-block" value={form.departmentId} onChange={e => setForm({...form, departmentId: e.target.value, positionId: ''})} required>
                <option value="">Select Department</option>
                {(depts?.departments || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="emp-positionId">Position *</label>
              <select id="emp-positionId" className="input-block" value={form.positionId} onChange={e => setForm({...form, positionId: e.target.value})} required>
                <option value="">Select Position</option>
                {(posData?.positions || []).filter(p => !form.departmentId || p.departmentId === parseInt(form.departmentId)).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label htmlFor="emp-employmentType">Employment Type</label>
            <select id="emp-employmentType" className="input-block" value={form.employmentType} onChange={e => setForm({...form, employmentType: e.target.value})}>
              <option value="full-time">Full-Time</option><option value="part-time">Part-Time</option><option value="contract">Contract</option>
            </select>
          </div>
          {editing && (
            <div className="field"><label htmlFor="emp-status">Status</label>
              <select id="emp-status" className="input-block" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option value="active">Active</option><option value="inactive">Inactive</option><option value="on-leave">On Leave</option>
              </select>
            </div>
          )}
          <div className="form-row">
            <div className="field"><label>TIN Number</label><input className="input-block" inputMode="numeric" pattern="[0-9\-]*" value={form.tinNumber || ''} onChange={e => setForm({...form, tinNumber: e.target.value.replace(/[^0-9\-]/g, '')})} placeholder="e.g. 123-456-789-000" /></div>
            <div className="field"><label>SSS Number</label><input className="input-block" inputMode="numeric" pattern="[0-9\-]*" value={form.sssNumber || ''} onChange={e => setForm({...form, sssNumber: e.target.value.replace(/[^0-9\-]/g, '')})} placeholder="e.g. 12-3456789-0" /></div>
            <div className="field"><label>PhilHealth Number</label><input className="input-block" inputMode="numeric" pattern="[0-9\-]*" value={form.philHealthNumber || ''} onChange={e => setForm({...form, philHealthNumber: e.target.value.replace(/[^0-9\-]/g, '')})} placeholder="e.g. 12345678901" /></div>
            <div className="field"><label>Pag-IBIG Number</label><input className="input-block" inputMode="numeric" pattern="[0-9\-]*" value={form.pagIbigNumber || ''} onChange={e => setForm({...form, pagIbigNumber: e.target.value.replace(/[^0-9\-]/g, '')})} placeholder="e.g. 123456789012" /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Bank Name</label><input className="input-block" value={form.bankName || ''} onChange={e => setForm({...form, bankName: e.target.value.replace(/[^a-zA-Z\s]/g, '')})} /></div>
            <div className="field"><label>Bank Account Number</label><input className="input-block" inputMode="numeric" pattern="[0-9]*" value={form.bankAccountNumber || ''} onChange={e => setForm({...form, bankAccountNumber: e.target.value.replace(/[^0-9]/g, '')})} /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Civil Status</label><select className="input-block" value={form.civilStatus || ''} onChange={e => setForm({...form, civilStatus: e.target.value})}><option value="">Select</option><option value="single">Single</option><option value="married">Married</option><option value="widowed">Widowed</option><option value="separated">Separated</option></select></div>
            <div className="field"><label>Nationality</label><input className="input-block" value={form.nationality || ''} onChange={e => setForm({...form, nationality: e.target.value.replace(/[^a-zA-Z\s]/g, '')})} /></div>
            <div className="field"><label>Education Level</label><input className="input-block" value={form.educationLevel || ''} onChange={e => setForm({...form, educationLevel: e.target.value})} placeholder="e.g. Bachelor's Degree" /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Emergency Contact Name</label><input className="input-block" value={form.emergencyContactName || ''} onChange={e => setForm({...form, emergencyContactName: e.target.value.replace(/[^a-zA-Z\s\-'.]/g, '')})} /></div>
            <div className="field"><label>Emergency Contact Phone</label><input className="input-block" inputMode="tel" minLength={7} maxLength={20} value={form.emergencyContactPhone || ''} onChange={e => setForm({...form, emergencyContactPhone: e.target.value.replace(/[^0-9+\-\s]/g, '')})} /></div>
            <div className="field"><label>Relationship</label><input className="input-block" value={form.emergencyContactRelation || ''} onChange={e => setForm({...form, emergencyContactRelation: e.target.value.replace(/[^a-zA-Z\s]/g, '')})} placeholder="e.g. Spouse, Parent" /></div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>{icons.close}</button>
            <button type="submit" className="btn btn-primary" disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) && <span className="btn-spinner" />}
              {createMut.isPending || updateMut.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={posModal.open} onClose={() => setPosModal({ open: false, employee: null })} title={`Assign POS Access — ${posModal.employee?.firstName || ''}`}>
        <div className="mb-md">
          <p className="text-sm text-muted mb-sm">
            Select which POS role to assign to this employee. They can then log in and work in the POS system.
          </p>
          {posModal.employee?.user?.role?.slug && ['cashier', 'manager', 'inventory_staff'].includes(posModal.employee.user.role.slug) && (
            <div className="p-sm text-sm mb-sm" style={{ background: 'var(--bg)', borderRadius: 8 }}>
              Current role: <strong>{posModal.employee.user.role.name}</strong>
            </div>
          )}
          <div className="field">
            <label htmlFor="pos-role-select">POS Role</label>
            <select id="pos-role-select" className="input-block" value={posRole} onChange={e => setPosRole(e.target.value)}>
              {POS_ROLES.map(r => <option key={r.slug} value={r.slug}>{r.label}</option>)}
            </select>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={() => setPosModal({ open: false, employee: null })}>Cancel</button>
          {posModal.employee?.user?.role?.slug && ['cashier', 'manager', 'inventory_staff'].includes(posModal.employee.user.role.slug) && (
            <button type="button" className="btn btn-danger" onClick={handlePosRevoke} disabled={revokePosMut.isPending}>
              {revokePosMut.isPending && <span className="btn-spinner" />}
              {revokePosMut.isPending ? 'Revoking...' : 'Revoke POS Access'}
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={handlePosAssign} disabled={assignPosMut.isPending}>
            {assignPosMut.isPending && <span className="btn-spinner" />}
            {assignPosMut.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </Modal>
    </>
  );
}
