import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PosLayout from '../layouts/PosLayout';
import { useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from '../hooks/useApi';
import useAuthStore from '../store/authStore';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import { formatDate, statusBadge, peso, useDebounce } from '../utils/helpers';

const EMPTY = { firstName: '', lastName: '', email: '', phone: '', address: '', loyaltyPoints: 0 };

const columns = [
  { key: 'name', label: 'Name', sortable: true, sortKey: 'name' },
  { key: 'email', label: 'Email', sortable: false },
  { key: 'phone', label: 'Phone', sortable: false },
  { key: 'loyaltyPoints', label: 'Loyalty Points', sortable: true, sortKey: 'loyaltyPoints' },
  { key: 'totalPurchases', label: 'Total Purchases', sortable: true, sortKey: 'totalPurchases' },
  { key: 'isActive', label: 'Status', sortable: false },
  { key: 'actions', label: 'Actions', sortable: false },
];

export default function Customers() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  // The ⌘K palette deep-links here with ?search=<term>; seed the box from it and
  // re-seed on every navigation so a second pick while already on the page works.
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const seeded = searchParams.get('search');
    if (seeded) { setSearch(seeded); setPage(1); }
  }, [searchParams]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('DESC');

  const user = useAuthStore(s => s.user);
  const role = user?.role?.slug;
  const canEdit = role === 'admin' || role === 'manager' || role === 'cashier';
  const canDelete = role === 'admin' || role === 'manager';
  const toast = useToast();
  const debouncedSearch = useDebounce(search, 300);
  const { data, isLoading } = useCustomers({ page, limit: 15, search: debouncedSearch || undefined, sortBy, sortOrder });
  const createMut = useCreateCustomer();
  const updateMut = useUpdateCustomer();
  const deleteMut = useDeleteCustomer();

  const customers = data?.data?.customers || [];
  const pagination = data?.data?.pagination;

  const handleSort = (field) => {
    if (sortBy === field) setSortOrder(o => o === 'ASC' ? 'DESC' : 'ASC');
    else { setSortBy(field); setSortOrder('ASC'); }
    setPage(1);
  };

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const openAdd = () => { setEditItem(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (c) => {
    setEditItem(c);
    setForm({ firstName: c.firstName, lastName: c.lastName, email: c.email || '', phone: c.phone || '', address: c.address || '', loyaltyPoints: c.loyaltyPoints || 0 });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName.trim()) { toast.error('First name is required'); return; }
    if (!form.lastName.trim()) { toast.error('Last name is required'); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error('Invalid email format'); return;
    }
    try {
      if (editItem) { await updateMut.mutateAsync({ id: editItem.id, data: form }); toast.success('Customer updated'); }
      else { await createMut.mutateAsync(form); toast.success('Customer created'); }
      setShowModal(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Operation failed'); }
  };

  const handleDelete = async (id) => {
    try { await deleteMut.mutateAsync(id); toast.success('Customer deleted'); setDeleteConfirm(null); }
    catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  return (
    <PosLayout active="customers">
      <header className="pos-header">
        <div><h1>Customers</h1><div className="sub">Manage customer profiles and loyalty points</div></div>
        <div className="toolbar m-0">
          <div className="search search-wrap">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="input with-icon" placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            {search && <button onClick={() => { setSearch(''); setPage(1); }} className="search-clear">×</button>}
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Customer</button>
        </div>
      </header>

      <DataTable
        columns={columns}
        data={customers}
        pagination={pagination}
        onPageChange={setPage}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        isLoading={isLoading}
        emptyMessage="No customers found"
        renderRow={(c, _idx, visHeaders) => {
          const cellMap = {
            name: <td><strong>{c.firstName} {c.lastName}</strong></td>,
            email: <td>{c.email || '—'}</td>,
            phone: <td>{c.phone || '—'}</td>,
            loyaltyPoints: <td><span className="badge info">{c.loyaltyPoints || 0}</span></td>,
            totalPurchases: <td>{peso(c.totalPurchases)}</td>,
            isActive: <td>{statusBadge(c.isActive ? 'active' : 'inactive')}</td>,
            actions: <td className="table-actions">
              {canEdit && <button className="btn btn-outline btn-sm" onClick={() => openEdit(c)}>✎ Edit</button>}
              {canDelete && <button className="btn btn-destructive btn-sm" onClick={() => setDeleteConfirm(c)}>🗑 Delete</button>}
            </td>,
          };
          return <tr key={c.id}>{visHeaders.map(c => cellMap[c.key])}</tr>;
        }}
      />

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Customer' : 'Add Customer'}>
        <form onSubmit={handleSubmit}>
          <div className="two-col">
            <div className="field"><label>First Name</label><input className="input-block" value={form.firstName} onChange={e => update('firstName', e.target.value)} required /></div>
            <div className="field"><label>Last Name</label><input className="input-block" value={form.lastName} onChange={e => update('lastName', e.target.value)} required /></div>
          </div>
          <div className="two-col">
            <div className="field"><label>Email</label><input className="input-block" type="email" value={form.email} onChange={e => update('email', e.target.value)} /></div>
            <div className="field"><label>Phone</label><input className="input-block" value={form.phone} onChange={e => update('phone', e.target.value)} /></div>
          </div>
          <div className="field"><label>Address</label><textarea className="input-block" value={form.address} onChange={e => update('address', e.target.value)} rows={2} /></div>
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
