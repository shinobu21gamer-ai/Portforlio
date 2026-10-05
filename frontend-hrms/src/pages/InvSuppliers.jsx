import { useState } from 'react';
import ErrorState from '../components/ErrorState';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import posApi from '../api/posClient';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import Map from '../components/Map';
import useDebounce from '../hooks/useDebounce';
import { useToast } from '../components/Toast';
import { icons } from '../components/ActionButton';
import { formatDate } from '../utils/helpers';

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'raw_material', label: 'Raw Material' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'service', label: 'Service' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_LABELS = {
  raw_material: 'Raw Material', equipment: 'Equipment', service: 'Service',
  packaging: 'Packaging', other: 'Other',
};

const EMPTY = {
  name: '', contactPerson: '', email: '', phone: '', mobile: '',
  address: '', city: '', province: '', postalCode: '', taxId: '',
  paymentTerms: '', notes: '', latitude: '', longitude: '',
  website: '', category: 'other', leadTimeDays: '', minimumOrderAmount: '',
  rating: '', bankName: '', bankAccount: '', registrationNumber: '',
};

const columns = [
  { key: 'name', label: 'Name', sortable: true, sortKey: 'name' },
  { key: 'contactPerson', label: 'Contact', sortable: false },
  { key: 'category', label: 'Category', sortable: true, sortKey: 'category' },
  { key: 'email', label: 'Email', sortable: false },
  { key: 'phone', label: 'Phone', sortable: false },
  { key: 'city', label: 'City', sortable: false },
  { key: 'paymentTerms', label: 'Terms', sortable: false },
  { key: 'purchaseCount', label: 'Purchases', sortable: true, sortKey: 'purchaseCount' },
  { key: 'status', label: 'Status', sortable: false },
  { key: 'actions', label: 'Actions', sortable: false },
];

export default function InvSuppliers() {
  const toast = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('ASC');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [viewItem, setViewItem] = useState(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['inv-suppliers', page, debouncedSearch, sortBy, sortOrder, categoryFilter, statusFilter],
    queryFn: () => posApi.get('/suppliers', {
      params: {
        page, limit: 15, search: debouncedSearch || undefined,
        sortBy, sortOrder, category: categoryFilter || undefined,
        isActive: statusFilter || undefined,
      },
    }).then(r => r.data.data),
  });

  const suppliers = data?.suppliers || [];
  const pagination = data?.pagination;

  const createMut = useMutation({
    mutationFn: (d) => posApi.post('/suppliers', d).then(r => r.data.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inv-suppliers'] }); toast.success('Supplier created'); setShowModal(false); },
    onError: (err) => toast.error(err.response?.data?.message || 'Create failed'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }) => posApi.put(`/suppliers/${id}`, d).then(r => r.data.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inv-suppliers'] }); toast.success('Supplier updated'); setShowModal(false); },
    onError: (err) => toast.error(err.response?.data?.message || 'Update failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => posApi.delete(`/suppliers/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inv-suppliers'] }); toast.success('Supplier deleted'); setDeleteConfirm(null); },
    onError: (err) => toast.error(err.response?.data?.message || 'Delete failed'),
  });

  const handleSort = (field) => {
    if (sortBy === field) setSortOrder(o => o === 'ASC' ? 'DESC' : 'ASC');
    else { setSortBy(field); setSortOrder('ASC'); }
    setPage(1);
  };

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const openAdd = () => { setEditItem(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (s) => {
    setEditItem(s);
    setForm({
      name: s.name, contactPerson: s.contactPerson || '', email: s.email || '',
      phone: s.phone || '', mobile: s.mobile || '', address: s.address || '',
      city: s.city || '', province: s.province || '', postalCode: s.postalCode || '',
      taxId: s.taxId || '', paymentTerms: s.paymentTerms || '', notes: s.notes || '',
      latitude: s.latitude || '', longitude: s.longitude || '',
      website: s.website || '', category: s.category || 'other',
      leadTimeDays: s.leadTimeDays || '', minimumOrderAmount: s.minimumOrderAmount || '',
      rating: s.rating || '', bankName: s.bankName || '', bankAccount: s.bankAccount || '',
      registrationNumber: s.registrationNumber || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name?.trim()) { toast.error('Supplier name is required'); return; }
    if (form.name.trim().length < 2) { toast.error('Name must be at least 2 characters'); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error('Invalid email format'); return; }
    if (form.rating && (parseFloat(form.rating) < 1 || parseFloat(form.rating) > 5)) { toast.error('Rating must be between 1 and 5'); return; }
    try {
      const payload = { ...form };
      if (payload.latitude) payload.latitude = parseFloat(payload.latitude);
      else delete payload.latitude;
      if (payload.longitude) payload.longitude = parseFloat(payload.longitude);
      else delete payload.longitude;
      if (payload.leadTimeDays) payload.leadTimeDays = parseInt(payload.leadTimeDays);
      else delete payload.leadTimeDays;
      if (payload.minimumOrderAmount) payload.minimumOrderAmount = parseFloat(payload.minimumOrderAmount);
      else delete payload.minimumOrderAmount;
      if (payload.rating) payload.rating = parseFloat(payload.rating);
      else delete payload.rating;
      if (editItem) await updateMut.mutateAsync({ id: editItem.id, ...payload });
      else await createMut.mutateAsync(payload);
    } catch (err) { /* handled by mutation */ }
  };

  const handleDelete = async (id) => {
    await deleteMut.mutateAsync(id);
  };

  if (isError) {
    return (
      <div className="page-error-wrap">
        <ErrorState message={error?.response?.data?.message || 'Something went wrong while loading this data.'} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <>
      <header className="pos-header">
        <div><h1>Suppliers</h1><div className="sub">{pagination?.totalItems || 0} suppliers</div></div>
        <div className="flex-gap-sm items-center flex-wrap">
          <select className="input-block" value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }} style={{ width: 160 }}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select className="input-block" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={{ width: 130 }}>
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <div className="search-wrap-wide">
            <input className="input-block" placeholder="Search suppliers..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            {search && <button className="search-clear" onClick={() => { setSearch(''); setPage(1); }}>&times;</button>}
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>＋ Add</button>
        </div>
      </header>

      <DataTable columns={columns} data={suppliers} pagination={pagination} onPageChange={setPage}
        sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort}
        isLoading={isLoading} emptyMessage="No suppliers found"
        renderRow={(s, _idx, visHeaders) => {
          const cellMap = {
            name: <td>
              <div>
                <strong style={{ cursor: 'pointer', color: 'var(--primary)' }} onClick={() => setViewItem(s)}>{s.name}</strong>
                {s.contactPerson && <div className="text-xs text-muted">{s.contactPerson}</div>}
              </div>
            </td>,
            contactPerson: <td>{s.contactPerson || '—'}</td>,
            category: <td><span className="badge info">{CATEGORY_LABELS[s.category] || s.category || '—'}</span></td>,
            email: <td>{s.email || '—'}</td>,
            phone: <td>{s.phone || s.mobile || '—'}</td>,
            city: <td>{s.city || '—'}</td>,
            paymentTerms: <td>{s.paymentTerms || '—'}</td>,
            purchaseCount: <td><span className="badge info">{s.purchaseCount || 0}</span></td>,
            status: <td>{s.isActive !== false ? <span className="badge success">Active</span> : <span className="badge error">Inactive</span>}</td>,
            actions: <td className="flex-gap-xs">
              <button className="btn btn-sm btn-secondary" onClick={() => setViewItem(s)}>{icons.view}</button>
              <button className="btn btn-sm btn-outline" onClick={() => openEdit(s)}>{icons.edit}</button>
              <button className="btn btn-sm btn-danger" onClick={() => setDeleteConfirm(s)}>{icons.delete}</button>
            </td>,
          };
          return <tr key={s.id}>{visHeaders.map(c => cellMap[c.key])}</tr>;
        }}
      />

      {/* ─── Create/Edit Modal ─── */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Supplier' : 'Add Supplier'} wide>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="field"><label>Name <span className="text-error">*</span></label><input className="input-block" value={form.name} onChange={e => update('name', e.target.value)} required /></div>
          <div className="form-row">
            <div className="field"><label>Contact Person</label><input className="input-block" value={form.contactPerson} onChange={e => update('contactPerson', e.target.value.replace(/[^a-zA-Z\s\-'.]/g, ''))} /></div>
            <div className="field"><label>Email</label><input className="input-block" type="email" value={form.email} onChange={e => update('email', e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Phone</label><input className="input-block" inputMode="tel" minLength={7} maxLength={20} value={form.phone} onChange={e => update('phone', e.target.value.replace(/[^0-9+\-\s]/g, ''))} /></div>
            <div className="field"><label>Mobile</label><input className="input-block" inputMode="tel" minLength={7} maxLength={20} value={form.mobile} onChange={e => update('mobile', e.target.value.replace(/[^0-9+\-\s]/g, ''))} /></div>
          </div>
          <div className="field"><label>Address</label><textarea className="input-block" value={form.address} onChange={e => update('address', e.target.value)} rows={2} /></div>
          <div className="form-grid-3">
            <div className="field"><label>City</label><input className="input-block" value={form.city} onChange={e => update('city', e.target.value.replace(/[^a-zA-Z\s]/g, ''))} /></div>
            <div className="field"><label>Province</label><input className="input-block" value={form.province} onChange={e => update('province', e.target.value.replace(/[^a-zA-Z\s]/g, ''))} /></div>
            <div className="field"><label>Postal Code</label><input className="input-block" inputMode="numeric" value={form.postalCode} onChange={e => update('postalCode', e.target.value.replace(/[^0-9]/g, ''))} /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Website</label><input className="input-block" value={form.website} onChange={e => update('website', e.target.value)} placeholder="https://example.com" /></div>
            <div className="field"><label>Category</label>
              <select className="input-block" value={form.category} onChange={e => update('category', e.target.value)}>
                <option value="raw_material">Raw Material</option>
                <option value="equipment">Equipment</option>
                <option value="service">Service</option>
                <option value="packaging">Packaging</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field"><label>Tax ID</label><input className="input-block" value={form.taxId} onChange={e => update('taxId', e.target.value)} /></div>
            <div className="field"><label>Registration Number</label><input className="input-block" value={form.registrationNumber} onChange={e => update('registrationNumber', e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Payment Terms</label>
              <select className="input-block" value={form.paymentTerms} onChange={e => update('paymentTerms', e.target.value)}>
                <option value="">Select</option>
                <option value="cod">Cash on Delivery</option>
                <option value="net15">Net 15</option>
                <option value="net30">Net 30</option>
                <option value="net60">Net 60</option>
                <option value="prepaid">Prepaid</option>
              </select>
            </div>
            <div className="field"><label>Rating (1-5)</label><input className="input-block" type="number" step="0.1" min="1" max="5" value={form.rating} onChange={e => update('rating', e.target.value)} placeholder="e.g. 4.5" /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Lead Time (days)</label><input className="input-block" type="number" min="0" value={form.leadTimeDays} onChange={e => update('leadTimeDays', e.target.value)} placeholder="e.g. 7" /></div>
            <div className="field"><label>Minimum Order Amount (₱)</label><input className="input-block" type="number" min="0" step="0.01" value={form.minimumOrderAmount} onChange={e => update('minimumOrderAmount', e.target.value)} placeholder="e.g. 5000" /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Bank Name</label><input className="input-block" value={form.bankName} onChange={e => update('bankName', e.target.value.replace(/[^a-zA-Z\s]/g, ''))} /></div>
            <div className="field"><label>Bank Account</label><input className="input-block" inputMode="numeric" value={form.bankAccount} onChange={e => update('bankAccount', e.target.value.replace(/[^0-9]/g, ''))} /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Latitude</label><input className="input-block" type="number" step="any" min="-90" max="90" value={form.latitude} onChange={e => update('latitude', e.target.value)} placeholder="e.g. 14.5995" /></div>
            <div className="field"><label>Longitude</label><input className="input-block" type="number" step="any" min="-180" max="180" value={form.longitude} onChange={e => update('longitude', e.target.value)} placeholder="e.g. 120.9842" /></div>
          </div>
          <div className="field"><label>Notes</label><textarea className="input-block" value={form.notes} onChange={e => update('notes', e.target.value)} rows={2} /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>{icons.close}</button>
            <button type="submit" className="btn btn-primary" disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) && <span className="btn-spinner" />}{editItem ? 'Update' : '+ Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Detail Modal ─── */}
      <Modal open={!!viewItem} onClose={() => setViewItem(null)} title="Supplier Details" wide>
        {viewItem && (
          <div className="text-sm">
            <div className="detail-grid">
              <div><span className="detail-label">Name</span><div className="detail-value">{viewItem.name}</div></div>
              <div><span className="detail-label">Contact Person</span><div>{viewItem.contactPerson || '—'}</div></div>
              <div><span className="detail-label">Email</span><div>{viewItem.email || '—'}</div></div>
              <div><span className="detail-label">Phone</span><div>{viewItem.phone || '—'}</div></div>
              <div><span className="detail-label">Mobile</span><div>{viewItem.mobile || '—'}</div></div>
              <div><span className="detail-label">Category</span><div><span className="badge info">{CATEGORY_LABELS[viewItem.category] || viewItem.category || '—'}</span></div></div>
              <div><span className="detail-label">Rating</span><div>{viewItem.rating ? <span className="text-warning font-semibold">★ {Number(viewItem.rating).toFixed(1)}</span> : '—'}</div></div>
              <div><span className="detail-label">Website</span><div>{viewItem.website || '—'}</div></div>
              <div><span className="detail-label">Purchases</span><div><span className="badge info">{viewItem.purchaseCount || 0}</span></div></div>
              <div><span className="detail-label">Status</span><div>{viewItem.isActive !== false ? <span className="badge success">Active</span> : <span className="badge error">Inactive</span>}</div></div>
              <div className="detail-span-2"><span className="detail-label">Address</span><div>{viewItem.address || '—'}</div></div>
              <div><span className="detail-label">City</span><div>{viewItem.city || '—'}</div></div>
              <div><span className="detail-label">Province</span><div>{viewItem.province || '—'}</div></div>
              <div><span className="detail-label">Tax ID</span><div>{viewItem.taxId || '—'}</div></div>
              <div><span className="detail-label">Registration #</span><div>{viewItem.registrationNumber || '—'}</div></div>
              <div><span className="detail-label">Payment Terms</span><div>{viewItem.paymentTerms || '—'}</div></div>
              <div><span className="detail-label">Lead Time</span><div>{viewItem.leadTimeDays ? `${viewItem.leadTimeDays} days` : '—'}</div></div>
              <div><span className="detail-label">Min Order</span><div>{viewItem.minimumOrderAmount ? `₱${Number(viewItem.minimumOrderAmount).toLocaleString()}` : '—'}</div></div>
              <div><span className="detail-label">Bank</span><div>{viewItem.bankName || '—'}</div></div>
              <div><span className="detail-label">Bank Account</span><div>{viewItem.bankAccount || '—'}</div></div>
              {viewItem.notes && <div className="detail-span-2"><span className="detail-label">Notes</span><div>{viewItem.notes}</div></div>}
            </div>
            {(viewItem.latitude && viewItem.longitude) && (
              <div className="mt-md">
                <span className="text-xs text-muted">Location</span>
                <div className="mt-xs">
                  <Map latitude={viewItem.latitude} longitude={viewItem.longitude} markerTitle={viewItem.name} height={200} />
                </div>
              </div>
            )}
            <div className="flex-end mt-md">
              <button className="btn btn-outline btn-sm" onClick={() => { setViewItem(null); openEdit(viewItem); }}>{icons.edit} Edit</button>
              <button className="btn btn-sm" onClick={() => setViewItem(null)}>✕ Close</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Delete Confirmation ─── */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirm Delete">
        <p>Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?</p>
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={() => setDeleteConfirm(null)}>{icons.close} Cancel</button>
          <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm?.id)} disabled={deleteMut.isPending}>
            {deleteMut.isPending && <span className="btn-spinner" />} {icons.delete} Delete
          </button>
        </div>
      </Modal>
    </>
  );
}
