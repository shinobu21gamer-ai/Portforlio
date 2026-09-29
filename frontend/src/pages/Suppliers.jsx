import { useState, useRef } from 'react';
import PosLayout from '../layouts/PosLayout';
import {
  useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier,
  useSupplierSummary, useSupplierPurchases, useImportSuppliers,
} from '../hooks/useApi';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import Map from '../components/Map';
import { peso, formatDate, useDebounce } from '../utils/helpers';
import api from '../api/client';

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
  { key: 'contactPerson', label: 'Contact Person', sortable: false },
  { key: 'category', label: 'Category', sortable: true, sortKey: 'category' },
  { key: 'rating', label: 'Rating', sortable: true, sortKey: 'rating' },
  { key: 'phone', label: 'Phone', sortable: false },
  { key: 'purchaseCount', label: 'Purchases', sortable: true, sortKey: 'purchaseCount' },
  { key: 'location', label: 'Location', sortable: false },
  { key: 'status', label: 'Status', sortable: false },
  { key: 'actions', label: 'Actions', sortable: false },
];

// Parse a single CSV line into fields, honoring double-quoted cells (incl. embedded commas/quotes)
const parseCsvRow = (line) => {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
};

// Neutralize spreadsheet formula injection cells (=, +, -, @, tab, CR)
const csvCell = (v) => {
  const s = String(v ?? '').replace(/^[=+\-@\t\r]/, "'$&");
  return `"${s.replace(/"/g, '""')}"`;
};

export default function Suppliers() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('ASC');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [viewTab, setViewTab] = useState('details');
  const [viewPurchasesPage, setViewPurchasesPage] = useState(1);
  const importRef = useRef(null);

  const toast = useToast();
  const { data, isLoading } = useSuppliers({
    page, limit: 15, search: debouncedSearch || undefined,
    sortBy, sortOrder, category: categoryFilter || undefined,
  });
  const createMut = useCreateSupplier();
  const updateMut = useUpdateSupplier();
  const deleteMut = useDeleteSupplier();
  const importMut = useImportSuppliers();

  const { data: summaryData } = useSupplierSummary(viewItem?.id);
  const { data: purchaseData } = useSupplierPurchases(viewItem?.id, { page: viewPurchasesPage, limit: 10 });

  const suppliers = data?.data?.suppliers || [];
  const pagination = data?.data?.pagination;

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
    if (form.phone && form.phone.length > 20) { toast.error('Phone must be 20 characters or less'); return; }
    if (form.latitude && (parseFloat(form.latitude) < -90 || parseFloat(form.latitude) > 90)) { toast.error('Latitude must be between -90 and 90'); return; }
    if (form.longitude && (parseFloat(form.longitude) < -180 || parseFloat(form.longitude) > 180)) { toast.error('Longitude must be between -180 and 180'); return; }
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
      if (editItem) { await updateMut.mutateAsync({ id: editItem.id, data: payload }); toast.success('Supplier updated'); }
      else { await createMut.mutateAsync(payload); toast.success('Supplier created'); }
      setShowModal(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Operation failed'); }
  };

  const handleDelete = async (id) => {
    try { await deleteMut.mutateAsync(id); toast.success('Supplier deleted'); setDeleteConfirm(null); }
    catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const handleExport = async () => {
    try {
      const res = await api.get('/suppliers/export');
      const list = res.data.data.suppliers || [];
      if (list.length === 0) { toast.error('No suppliers to export'); return; }
      const headers = Object.keys(list[0]);
      const csv = [
        headers.join(','),
        ...list.map(row => headers.map(h => csvCell(row[h])).join(','))
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'suppliers.csv'; a.click();
      URL.revokeObjectURL(url);
      toast.success('Suppliers exported');
    } catch (err) { toast.error('Export failed'); }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { toast.error('CSV must have a header row and at least one data row'); return; }
      const headers = parseCsvRow(lines[0]).map(h => h.trim().replace(/^"|"$/g, ''));
      const rows = lines.slice(1).map(line => {
        const values = parseCsvRow(line).map(v => v.trim().replace(/^"|"$/g, ''));
        const obj = {};
        headers.forEach((h, i) => { obj[h] = values[i] || ''; });
        return obj;
      });
      const result = await importMut.mutateAsync(rows);
      toast.success(`Imported ${result.created} suppliers${result.errors.length ? `, ${result.errors.length} errors` : ''}`);
    } catch (err) { toast.error(err.response?.data?.message || 'Import failed'); }
    e.target.value = '';
  };

  const summary = summaryData || {};
  const purchaseList = purchaseData?.purchases || [];
  const purchasePagination = purchaseData?.pagination;

  return (
    <PosLayout active="suppliers">
      <header className="pos-header">
        <div><h1>Suppliers</h1><div className="sub">Manage supplier contacts and purchase history</div></div>
        <div className="flex-gap-sm items-center flex-wrap">
          <select className="input-block" value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }} style={{ width: 160 }}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <div className="search search-wrap">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="input with-icon" placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            {search && <button onClick={() => { setSearch(''); setPage(1); }} className="search-clear">×</button>}
          </div>
          <button className="btn btn-outline btn-sm" onClick={handleExport} title="Export CSV">↓ Export</button>
          <button className="btn btn-outline btn-sm" onClick={() => importRef.current?.click()} title="Import CSV">↑ Import</button>
          <input ref={importRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
          <button className="btn btn-primary btn-sm" onClick={openAdd}>＋ Add Supplier</button>
        </div>
      </header>

      <DataTable
        columns={columns}
        data={suppliers}
        pagination={pagination}
        onPageChange={setPage}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        isLoading={isLoading}
        emptyMessage="No suppliers found"
        renderRow={(s, _idx, visHeaders) => {
          const cellMap = {
            name: <td>
              <div>
                <strong style={{ cursor: 'pointer', color: 'var(--primary)' }} onClick={() => { setViewItem(s); setViewTab('details'); }}>{s.name}</strong>
                {s.email && <div className="text-xs text-muted">{s.email}</div>}
              </div>
            </td>,
            contactPerson: <td>{s.contactPerson || '—'}</td>,
            category: <td><span className="badge info">{CATEGORY_LABELS[s.category] || s.category || '—'}</span></td>,
            rating: <td>{s.rating ? <span className="text-warning font-semibold">★ {Number(s.rating).toFixed(1)}</span> : '—'}</td>,
            phone: <td>{s.phone || s.mobile || '—'}</td>,
            purchaseCount: <td><span className="badge info">{s.purchaseCount || 0}</span></td>,
            location: <td>{[s.city, s.province].filter(Boolean).join(', ') || '—'}</td>,
            status: <td>{s.isActive ? <span className="badge success">Active</span> : <span className="badge error">Inactive</span>}</td>,
            actions: <td className="table-actions">
              <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)}>✎</button>
              <button className="btn btn-destructive btn-sm" onClick={() => setDeleteConfirm(s)}>🗑</button>
            </td>,
          };
          return <tr key={s.id}>{visHeaders.map(c => cellMap[c.key])}</tr>;
        }}
      />

      {/* ─── Create/Edit Modal ─── */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Supplier' : 'Add Supplier'} wide>
        <form onSubmit={handleSubmit}>
          <h4 className="text-xs font-semibold text-muted mb-sm" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>Basic Information</h4>
          <div className="field"><label>Name <span className="text-error">*</span></label><input className="input-block" value={form.name} onChange={e => update('name', e.target.value)} required /></div>
          <div className="two-col">
            <div className="field"><label>Contact Person</label><input className="input-block" value={form.contactPerson} onChange={e => update('contactPerson', e.target.value)} /></div>
            <div className="field"><label>Email</label><input className="input-block" type="email" value={form.email} onChange={e => update('email', e.target.value)} /></div>
          </div>
          <div className="two-col">
            <div className="field"><label>Phone</label><input className="input-block" value={form.phone} onChange={e => update('phone', e.target.value)} /></div>
            <div className="field"><label>Mobile</label><input className="input-block" value={form.mobile} onChange={e => update('mobile', e.target.value)} /></div>
          </div>
          <div className="field"><label>Address</label><textarea className="input-block" value={form.address} onChange={e => update('address', e.target.value)} rows={2} /></div>
          <div className="three-col">
            <div className="field"><label>City</label><input className="input-block" value={form.city} onChange={e => update('city', e.target.value)} /></div>
            <div className="field"><label>Province</label><input className="input-block" value={form.province} onChange={e => update('province', e.target.value)} /></div>
            <div className="field"><label>Postal Code</label><input className="input-block" value={form.postalCode} onChange={e => update('postalCode', e.target.value)} /></div>
          </div>

          <h4 className="text-xs font-semibold text-muted mb-sm mt-md" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>Business Details</h4>
          <div className="two-col">
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
          <div className="two-col">
            <div className="field"><label>Tax ID</label><input className="input-block" value={form.taxId} onChange={e => update('taxId', e.target.value)} /></div>
            <div className="field"><label>Registration Number</label><input className="input-block" value={form.registrationNumber} onChange={e => update('registrationNumber', e.target.value)} /></div>
          </div>
          <div className="two-col">
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
          <div className="two-col">
            <div className="field"><label>Lead Time (days)</label><input className="input-block" type="number" min="0" value={form.leadTimeDays} onChange={e => update('leadTimeDays', e.target.value)} placeholder="e.g. 7" /></div>
            <div className="field"><label>Minimum Order Amount (₱)</label><input className="input-block" type="number" min="0" step="0.01" value={form.minimumOrderAmount} onChange={e => update('minimumOrderAmount', e.target.value)} placeholder="e.g. 5000" /></div>
          </div>

          <h4 className="text-xs font-semibold text-muted mb-sm mt-md" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bank Information</h4>
          <div className="two-col">
            <div className="field"><label>Bank Name</label><input className="input-block" value={form.bankName} onChange={e => update('bankName', e.target.value)} /></div>
            <div className="field"><label>Bank Account</label><input className="input-block" value={form.bankAccount} onChange={e => update('bankAccount', e.target.value)} /></div>
          </div>

          <h4 className="text-xs font-semibold text-muted mb-sm mt-md" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>Location</h4>
          <div className="two-col">
            <div className="field"><label>Latitude</label><input className="input-block" type="number" step="any" min="-90" max="90" value={form.latitude} onChange={e => update('latitude', e.target.value)} placeholder="e.g. 14.5995" /></div>
            <div className="field"><label>Longitude</label><input className="input-block" type="number" step="any" min="-180" max="180" value={form.longitude} onChange={e => update('longitude', e.target.value)} placeholder="e.g. 120.9842" /></div>
          </div>

          <div className="field"><label>Notes</label><textarea className="input-block" value={form.notes} onChange={e => update('notes', e.target.value)} rows={2} /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowModal(false)}>✕ Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) && <span className="btn-spinner" />}{editItem ? 'Update' : '+ Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Detail Modal with Tabs ─── */}
      <Modal open={!!viewItem} onClose={() => setViewItem(null)} title="Supplier Details" wide>
        {viewItem && (
          <div className="text-sm">
            <div className="flex-gap-sm mb-md">
              {['details', 'summary', 'purchases'].map(t => (
                <button key={t} className={`btn btn-sm ${viewTab === t ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setViewTab(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {viewTab === 'details' && (
              <>
                <div className="detail-grid">
                  <div><span className="detail-label">Name</span><div className="detail-value">{viewItem.name}</div></div>
                  <div><span className="detail-label">Contact Person</span><div>{viewItem.contactPerson || '—'}</div></div>
                  <div><span className="detail-label">Email</span><div>{viewItem.email || '—'}</div></div>
                  <div><span className="detail-label">Phone</span><div>{viewItem.phone || '—'}</div></div>
                  <div><span className="detail-label">Mobile</span><div>{viewItem.mobile || '—'}</div></div>
                  <div><span className="detail-label">Category</span><div><span className="badge info">{CATEGORY_LABELS[viewItem.category] || viewItem.category || '—'}</span></div></div>
                  <div><span className="detail-label">Rating</span><div>{viewItem.rating ? <span className="text-warning font-semibold">★ {Number(viewItem.rating).toFixed(1)}</span> : '—'}</div></div>
                  <div><span className="detail-label">Website</span><div>{viewItem.website ? <a href={viewItem.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>{viewItem.website}</a> : '—'}</div></div>
                  <div><span className="detail-label">Purchases</span><div><span className="badge info">{viewItem.purchaseCount || 0}</span></div></div>
                  <div><span className="detail-label">Status</span><div>{viewItem.isActive ? <span className="badge success">Active</span> : <span className="badge error">Inactive</span>}</div></div>
                  <div className="detail-span-2"><span className="detail-label">Address</span><div>{viewItem.address || '—'}</div></div>
                  <div><span className="detail-label">City</span><div>{viewItem.city || '—'}</div></div>
                  <div><span className="detail-label">Province</span><div>{viewItem.province || '—'}</div></div>
                  <div><span className="detail-label">Postal Code</span><div>{viewItem.postalCode || '—'}</div></div>
                  <div><span className="detail-label">Tax ID</span><div>{viewItem.taxId || '—'}</div></div>
                  <div><span className="detail-label">Registration #</span><div>{viewItem.registrationNumber || '—'}</div></div>
                  <div><span className="detail-label">Payment Terms</span><div>{viewItem.paymentTerms || '—'}</div></div>
                  <div><span className="detail-label">Lead Time</span><div>{viewItem.leadTimeDays ? `${viewItem.leadTimeDays} days` : '—'}</div></div>
                  <div><span className="detail-label">Min Order Amount</span><div>{viewItem.minimumOrderAmount ? peso(viewItem.minimumOrderAmount) : '—'}</div></div>
                  <div><span className="detail-label">Bank Name</span><div>{viewItem.bankName || '—'}</div></div>
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
              </>
            )}

            {viewTab === 'summary' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                  <div className="text-center p-sm" style={{ background: 'var(--muted)', borderRadius: 8 }}>
                    <div className="font-bold" style={{ fontSize: 20, color: 'var(--primary)' }}>{peso(summary.totalSpend)}</div>
                    <div className="text-xs text-muted">Total Spend</div>
                  </div>
                  <div className="text-center p-sm" style={{ background: 'var(--muted)', borderRadius: 8 }}>
                    <div className="font-bold" style={{ fontSize: 20, color: 'var(--accent)' }}>{peso(summary.avgOrderValue)}</div>
                    <div className="text-xs text-muted">Avg Order</div>
                  </div>
                  <div className="text-center p-sm" style={{ background: 'var(--muted)', borderRadius: 8 }}>
                    <div className="font-bold" style={{ fontSize: 20, color: 'var(--success)' }}>{summary.purchaseCount || 0}</div>
                    <div className="text-xs text-muted">Total Orders</div>
                  </div>
                  <div className="text-center p-sm" style={{ background: 'var(--muted)', borderRadius: 8 }}>
                    <div className="font-bold" style={{ fontSize: 20, color: summary.outstandingBalance > 0 ? 'var(--error)' : 'var(--success)' }}>{peso(summary.outstandingBalance)}</div>
                    <div className="text-xs text-muted">Outstanding</div>
                  </div>
                </div>
                <div>
                  <strong>Last Purchase:</strong> {summary.lastPurchaseDate ? formatDate(summary.lastPurchaseDate) : 'No purchases yet'}
                </div>
              </div>
            )}

            {viewTab === 'purchases' && (
              <div>
                {purchaseList.length === 0 ? (
                  <div className="empty-state" style={{ padding: '20px 0' }}>No purchase history</div>
                ) : (
                  <>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr><th>PO #</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                          {purchaseList.map(p => (
                            <tr key={p.id}>
                              <td className="mono">{p.orderNo}</td>
                              <td>{formatDate(p.orderDate)}</td>
                              <td className="total-amount">{peso(p.total)}</td>
                              <td><span className={`badge ${p.paymentStatus === 'paid' ? 'success' : p.paymentStatus === 'partial' ? 'warning' : 'info'}`}>{p.paymentStatus}</span></td>
                              <td><span className={`badge ${p.status === 'received' ? 'success' : p.status === 'cancelled' ? 'error' : 'info'}`}>{p.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {purchasePagination?.totalPages > 1 && (
                      <div className="pagination">
                        <button className="btn btn-sm" disabled={viewPurchasesPage <= 1} onClick={() => setViewPurchasesPage(p => p - 1)}>◀</button>
                        <span className="text-sm text-muted">Page {viewPurchasesPage} / {purchasePagination.totalPages}</span>
                        <button className="btn btn-sm" disabled={viewPurchasesPage >= purchasePagination.totalPages} onClick={() => setViewPurchasesPage(p => p + 1)}>▶</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="flex-end mt-md">
              <button className="btn btn-outline btn-sm" onClick={() => { setViewItem(null); openEdit(viewItem); }}>✎ Edit</button>
              <button className="btn btn-sm" onClick={() => setViewItem(null)}>✕ Close</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirm Delete">
        <p>Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?</p>
        <div className="modal-actions">
          <button className="btn btn-outline btn-sm" onClick={() => setDeleteConfirm(null)}>✕ Cancel</button>
          <button className="btn btn-destructive btn-sm" onClick={() => handleDelete(deleteConfirm?.id)} disabled={deleteMut.isPending}>🗑 Delete</button>
        </div>
      </Modal>
    </PosLayout>
  );
}
