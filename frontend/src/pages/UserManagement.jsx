import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import PosLayout from '../layouts/PosLayout';
import useAuthStore from '../store/authStore';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, useRoles } from '../hooks/useApi';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import { formatDate, statusBadge, useDebounce } from '../utils/helpers';

const EMPTY = { firstName: '', lastName: '', email: '', password: '', phone: '', roleId: '', reportsToId: '' };

const columns = [
  { key: 'name', label: 'Name', sortable: true, sortKey: 'firstName' },
  { key: 'email', label: 'Email', sortable: true, sortKey: 'email' },
  { key: 'role', label: 'Role', sortable: false },
  { key: 'reportsTo', label: 'Reports To', sortable: false },
  { key: 'status', label: 'Status', sortable: false },
  { key: 'lastLogin', label: 'Last Login', sortable: true, sortKey: 'lastLogin' },
  { key: 'actions', label: 'Actions', sortable: false },
];

export default function UserManagement() {
  const currentUser = useAuthStore(s => s.user);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  // The ⌘K palette deep-links here with ?search=<term>; seed the box from it and
  // re-seed on every navigation so a second pick while already on the page works.
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const seeded = searchParams.get('search');
    if (seeded) { setSearch(seeded); setPage(1); }
  }, [searchParams]);
  const debouncedSearch = useDebounce(search);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [sortBy, setSortBy] = useState('firstName');
  const [sortOrder, setSortOrder] = useState('DESC');

  const toast = useToast();
  const { data, isLoading } = useUsers({ page, limit: 15, search: debouncedSearch || undefined, sortBy, sortOrder });
  const { data: allUsersData } = useUsers({ limit: 200 });
  const { data: roles } = useRoles();
  const createMut = useCreateUser();
  const updateMut = useUpdateUser();
  const deleteMut = useDeleteUser();

  const users = data?.data?.users || [];
  const pagination = data?.data?.pagination;

  const handleSort = (field) => {
    if (sortBy === field) setSortOrder(o => o === 'ASC' ? 'DESC' : 'ASC');
    else { setSortBy(field); setSortOrder('ASC'); }
    setPage(1);
  };

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const openAdd = () => { setEditItem(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (u) => {
    setEditItem(u);
    setForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, password: '', phone: u.phone || '', roleId: u.role?.id || u.roleId || '', reportsToId: u.reportsTo?.id || u.reportsToId || '', isActive: u.isActive });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName?.trim() || !form.lastName?.trim()) { toast.error('First name and last name are required'); return; }
    if (!form.email?.trim()) { toast.error('Email is required'); return; }
    if (!form.roleId) { toast.error('Role is required'); return; }
    if (!editItem && !form.password) { toast.error('Password is required for new users'); return; }
    if (form.password && form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (form.password && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)) { toast.error('Password must include uppercase, lowercase, and a number'); return; }
    try {
      if (editItem) {
        const { password, ...rest } = form;
        const payload = { ...rest };
        if (password) payload.password = password;
        await updateMut.mutateAsync({ id: editItem.id, data: payload });
        toast.success('User updated');
      } else {
        await createMut.mutateAsync(form);
        toast.success('User created');
      }
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowModal(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Operation failed'); }
  };

  const handleDelete = async (id) => {
    try { await deleteMut.mutateAsync(id); toast.success('User deleted'); setDeleteConfirm(null); }
    catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const userRole = currentUser?.role?.slug || currentUser?.role;
  if (userRole !== 'admin') {
    return (
      <PosLayout active="users">
        <header className="pos-header"><div><h1>Users</h1><div className="sub">Access denied — admin only</div></div></header>
        <div className="dashboard-section text-center p-md" style={{ color: 'var(--muted-fg)' }}>You do not have permission to view this page.</div>
      </PosLayout>
    );
  }

  return (
    <PosLayout active="users">
      <header className="pos-header">
        <div><h1>Users</h1><div className="sub">Manage system users and roles</div></div>
        <div className="toolbar m-0">
          <div className="search max-w-sm">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="input with-icon" placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add User</button>
        </div>
      </header>

      <DataTable
        columns={columns}
        data={users}
        pagination={pagination}
        onPageChange={setPage}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        isLoading={isLoading}
        emptyMessage="No users found"
        renderRow={(u, _idx, visHeaders) => {
          const cellMap = {
            name: <td><strong>{u.firstName} {u.lastName}</strong></td>,
            email: <td>{u.email}</td>,
            role: <td><span className="badge info">{u.role?.slug || u.role}</span></td>,
            reportsTo: <td>{u.reportsTo ? `${u.reportsTo.firstName} ${u.reportsTo.lastName}` : '—'}</td>,
            status: <td>{statusBadge(u.isActive ? 'active' : 'inactive')}</td>,
            lastLogin: <td>{formatDate(u.lastLogin)}</td>,
            actions: <td className="table-actions">
              <button className="btn btn-outline btn-sm" onClick={() => openEdit(u)}>✎ Edit</button>
              <button
                className="btn btn-destructive btn-sm"
                onClick={() => setDeleteConfirm(u)}
                disabled={u.id === currentUser?.id || u.role?.slug === 'admin'}
                title={u.id === currentUser?.id ? 'Cannot delete yourself' : u.role?.slug === 'admin' ? 'Cannot delete admin users' : 'Delete user'}
              >🗑 Delete</button>
            </td>,
          };
          return <tr key={u.id}>{visHeaders.map(c => cellMap[c.key])}</tr>;
        }}
      />

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit User' : 'Add User'}>
        <form onSubmit={handleSubmit}>
          <div className="two-col">
            <div className="field"><label>First Name</label><input className="input-block" value={form.firstName} onChange={e => update('firstName', e.target.value)} required /></div>
            <div className="field"><label>Last Name</label><input className="input-block" value={form.lastName} onChange={e => update('lastName', e.target.value)} required /></div>
          </div>
          <div className="two-col">
            <div className="field"><label>Email</label><input className="input-block" type="email" value={form.email} onChange={e => update('email', e.target.value)} required /></div>
            <div className="field"><label>Phone</label><input className="input-block" value={form.phone} onChange={e => update('phone', e.target.value)} /></div>
          </div>
          <div className="two-col">
            <div className="field"><label>Role</label>
              <select className="input-block" value={form.roleId} onChange={e => update('roleId', e.target.value)} required>
                <option value="">Select Role</option>
                {(roles || []).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>{editItem ? 'New Password (leave blank to keep)' : 'Password'}</label>
              <input className="input-block" type="password" minLength="8" placeholder="Min 8 chars, upper + lower + number" value={form.password} onChange={e => update('password', e.target.value)} {...(!editItem && { required: true })} />
            </div>
          </div>
          {editItem && (
            <div className="field">
              <label>Status</label>
              <select className="input-block" value={form.isActive ? 'true' : 'false'} onChange={e => update('isActive', e.target.value === 'true')}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          )}
          <div className="field">
            <label>Reports To</label>
            <select className="input-block" value={form.reportsToId} onChange={e => update('reportsToId', e.target.value)}>
              <option value="">None (top-level)</option>
              {(allUsersData?.data?.users || []).filter(u => u.id !== editItem?.id && u.isActive !== false).map(u => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role?.slug || 'user'})</option>
              ))}
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowModal(false)}>✕ Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) && <span className="btn-spinner" />}{editItem ? 'Update' : '+ Create'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirm Delete">
        <p>Are you sure you want to delete <strong>{deleteConfirm?.firstName} {deleteConfirm?.lastName}</strong>?</p>
        <div className="modal-actions">
          <button className="btn btn-outline btn-sm" onClick={() => setDeleteConfirm(null)}>✕ Cancel</button>
          <button className="btn btn-destructive btn-sm" onClick={() => handleDelete(deleteConfirm?.id)} disabled={deleteMut.isPending}>🗑 Delete</button>
        </div>
      </Modal>
    </PosLayout>
  );
}
