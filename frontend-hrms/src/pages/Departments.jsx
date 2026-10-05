import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDepartments, usePositions, useCreateDepartment, useUpdateDepartment, useDeleteDepartment, useCreatePosition, useUpdatePosition, useDeletePosition } from '../hooks/useApi';
import api from '../api/client';

import LoadingSkeleton from '../components/LoadingSkeleton';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { useIsAdmin } from '../hooks/useRole';
import { peso } from '../utils/helpers';
import useConfirm from '../hooks/useConfirm.jsx';
import useDebounce from '../hooks/useDebounce';
import { icons } from '../components/ActionButton';

function OrgChartNode({ node, level }) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const initials = `${node.firstName?.[0] || ''}${node.lastName?.[0] || ''}`.toUpperCase();

  return (
    <li className="org-node">
      <div className="org-card" style={{ marginLeft: level * 24 }}>
        <div className="org-avatar">{initials}</div>
        <div className="org-info">
          <div className="org-name">{node.firstName} {node.lastName}</div>
          <div className="org-role">{node.position?.title || '—'}{node.department ? ` · ${node.department.name}` : ''}</div>
        </div>
        {hasChildren && (
          <button className="org-toggle" onClick={() => setOpen(!open)}>
            {open ? '▾' : '▸'} {node.children.length}
          </button>
        )}
      </div>
      {hasChildren && open && (
        <ul className="org-children">
          {node.children.map(child => <OrgChartNode key={child.id} node={child} level={level + 1} />)}
        </ul>
      )}
    </li>
  );
}

function OrgChart() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['org-chart'],
    queryFn: () => api.get('/employees/org-chart').then(r => r.data.data),
  });

  if (isLoading) return <LoadingSkeleton rows={5} />;
  if (error) return <div className="empty-state">Failed to load org chart.</div>;

  const { roots = [], total = 0 } = data || {};

  return (
    <div>
      <div className="flex flex-gap-sm mb-md" style={{ alignItems: 'center' }}>
        <span className="text-sm text-muted">{total} employees</span>
      </div>
      {roots.length === 0 ? (
        <div className="empty-state">No org chart data. Assign "Reports To" on employee profiles to build the hierarchy.</div>
      ) : (
        <ul className="org-tree">
          {roots.map(r => <OrgChartNode key={r.id} node={r} level={0} />)}
        </ul>
      )}
    </div>
  );
}

export default function Departments() {
  const { confirmDelete, confirmDialog } = useConfirm();
  const [tab, setTab] = useState('departments');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const toast = useToast();
  const isAdmin = useIsAdmin();

  const { data: deptsData, isLoading: deptLoading, error: deptError } = useDepartments({ limit: 100, search: debouncedSearch || undefined });
  const { data: posData, isLoading: posLoading, error: posError } = usePositions({ limit: 100, search: debouncedSearch || undefined });
  const createDept = useCreateDepartment();
  const updateDept = useUpdateDepartment();
  const deleteDept = useDeleteDepartment();
  const createPos = useCreatePosition();
  const updatePos = useUpdatePosition();
  const deletePos = useDeletePosition();

  const openAdd = () => {
    setEditing(null);
    if (tab === 'departments') setForm({ name: '', description: '' });
    else setForm({ title: '', departmentId: '', roleSlug: 'employee', minSalary: undefined, maxSalary: undefined, description: '' });
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    if (tab === 'departments') setForm({ name: item.name, description: item.description || '' });
    else setForm({ title: item.title, departmentId: item.departmentId || '', roleSlug: item.roleSlug || 'employee', minSalary: item.minSalary != null ? item.minSalary : undefined, maxSalary: item.maxSalary != null ? item.maxSalary : undefined, description: item.description || '' });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (tab === 'departments') {
      const name = form.name?.trim() || '';
      if (name.length < 2) { toast.error('Department name must be at least 2 characters'); return; }
      if (name.length > 100) { toast.error('Department name must be at most 100 characters'); return; }
    }
    try {
      if (tab === 'departments') {
        if (editing) { await updateDept.mutateAsync({ id: editing.id, data: form }); toast.success('Department updated'); }
        else { await createDept.mutateAsync(form); toast.success('Department created'); }
      } else {
        const payload = { ...form };
        if (payload.minSalary === '' || payload.minSalary === undefined) delete payload.minSalary;
        if (payload.maxSalary === '' || payload.maxSalary === undefined) delete payload.maxSalary;
        if (editing) { await updatePos.mutateAsync({ id: editing.id, data: payload }); toast.success('Position updated'); }
        else { await createPos.mutateAsync(payload); toast.success('Position created'); }
      }
      setModalOpen(false);
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleDelete = async (item) => {
    const name = item.name || item.title;
    if (!(await confirmDelete(`Delete ${name}?`))) return;
    try {
      if (tab === 'departments') { await deleteDept.mutateAsync(item.id); toast.success('Deleted'); }
      else { await deletePos.mutateAsync(item.id); toast.success('Deleted'); }
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const loading = tab === 'departments' ? deptLoading : posLoading;
  const queryError = tab === 'departments' ? deptError : posError;
  const items = tab === 'departments' ? (deptsData?.departments || []) : (posData?.positions || []);

  return (
    <>
      <header className="pos-header">
        <div><h1>Departments & Positions</h1></div>
        {tab !== 'org-chart' && <button className="btn btn-primary" onClick={openAdd}>＋</button>}
      </header>

      <div className="tab-bar">
        <button className={`tab ${tab === 'departments' ? 'active' : ''}`} onClick={() => setTab('departments')}>Departments ({deptsData?.departments?.length || 0})</button>
        <button className={`tab ${tab === 'positions' ? 'active' : ''}`} onClick={() => setTab('positions')}>Positions ({posData?.positions?.length || 0})</button>
        <button className={`tab ${tab === 'org-chart' ? 'active' : ''}`} onClick={() => setTab('org-chart')}>Org Chart</button>
        {tab !== 'org-chart' && (
          <div className="ml-auto">
            <input className="input-block" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200 }} />
          </div>
        )}
      </div>

      {tab === 'org-chart' ? (
        <OrgChart />
      ) : loading ? <LoadingSkeleton rows={3} /> : queryError ? (
        <div className="empty-state">Failed to load data. Please try again.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              {tab === 'departments' ? (
                <tr><th>Name</th><th>Description</th><th>Actions</th></tr>
              ) : (
                <tr><th>Title</th><th>Department</th><th>Salary Range</th><th>Actions</th></tr>
              )}
            </thead>
            <tbody>
              {items.map(item => tab === 'departments' ? (
                <tr key={item.id}>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.description || '—'}</td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(item)}>{icons.edit}</button>
                    {isAdmin && <button className="btn btn-sm btn-danger ml-xs" onClick={() => handleDelete(item)}>{icons.delete}</button>}
                  </td>
                </tr>
              ) : (
                <tr key={item.id}>
                  <td><strong>{item.title}</strong></td>
                  <td>{item.department?.name || item.Department?.name || '—'}</td>
                  <td>{item.minSalary ? `${peso(item.minSalary)} - ${peso(item.maxSalary)}` : '—'}</td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(item)}>{icons.edit}</button>
                    {isAdmin && <button className="btn btn-sm btn-danger ml-xs" onClick={() => handleDelete(item)}>{icons.delete}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <div className="empty-state">No {tab} found. Create one to get started.</div>}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit ${tab === 'departments' ? 'Department' : 'Position'}` : `New ${tab === 'departments' ? 'Department' : 'Position'}`} preventClose={createDept.isPending || updateDept.isPending || createPos.isPending || updatePos.isPending}>
        <form onSubmit={handleSubmit} className="modal-form">
          {tab === 'departments' ? (
            <>
              <div className="field"><label htmlFor="dept-name">Name *</label><input id="dept-name" className="input-block" value={form.name} onChange={e => setForm({...form, name: e.target.value.replace(/[^a-zA-Z\s\-'.]/g, '')})} required /></div>
              <div className="field"><label htmlFor="dept-description">Description</label><textarea id="dept-description" className="input-block" rows={3} value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} /></div>
            </>
          ) : (
            <>
              <div className="field"><label htmlFor="pos-title">Title *</label><input id="pos-title" className="input-block" value={form.title} onChange={e => setForm({...form, title: e.target.value.replace(/[^a-zA-Z\s\-'.]/g, '')})} required /></div>
              <div className="field"><label htmlFor="pos-departmentId">Department *</label>
                <select id="pos-departmentId" className="input-block" value={form.departmentId} onChange={e => setForm({...form, departmentId: e.target.value})} required>
                  <option value="">Select Department</option>
                  {(deptsData?.departments || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="field"><label htmlFor="pos-minSalary">Min Salary</label><input id="pos-minSalary" className="input-block" type="number" min="0" step="100" value={form.minSalary || ''} onChange={e => setForm({...form, minSalary: e.target.value})} /></div>
                <div className="field"><label htmlFor="pos-maxSalary">Max Salary</label><input id="pos-maxSalary" className="input-block" type="number" min="0" step="100" value={form.maxSalary || ''} onChange={e => setForm({...form, maxSalary: e.target.value})} /></div>
              </div>
              <div className="field"><label htmlFor="pos-roleSlug">System Role *</label>
                <select id="pos-roleSlug" className="input-block" value={form.roleSlug || 'employee'} onChange={e => setForm({...form, roleSlug: e.target.value})} required>
                  <option value="employee">Employee (HRMS self-service)</option>
                  <option value="cashier">Cashier (HRMS + POS)</option>
                  <option value="manager">Manager (HRMS + POS)</option>
                  <option value="inventory_staff">Inventory Staff (HRMS + POS)</option>
                  <option value="hr">HR Officer (HRMS full access)</option>
                  <option value="admin">Admin (Full access)</option>
                </select>
              </div>
              <div className="field"><label htmlFor="pos-description">Description</label><textarea id="pos-description" className="input-block" rows={2} value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} /></div>
            </>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>{icons.close}</button>
            <button type="submit" className="btn btn-primary" disabled={createDept.isPending || updateDept.isPending || createPos.isPending || updatePos.isPending}>
              {(createDept.isPending || updateDept.isPending || createPos.isPending || updatePos.isPending) && <span className="btn-spinner" />}
              Save
            </button>
          </div>
        </form>
      </Modal>
    {confirmDialog}
    </>
  );
}
