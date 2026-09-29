import { useState } from 'react';
import PosLayout from '../layouts/PosLayout';
import { useDiscounts, useCreateDiscount, useUpdateDiscount, useDeleteDiscount } from '../hooks/useApi';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import { peso, formatDate, statusBadge, useDebounce } from '../utils/helpers';

const EMPTY = { code: '', name: '', description: '', type: 'percentage', value: '', minPurchaseAmount: '', maxDiscountAmount: '', usageLimit: '', startDate: '', endDate: '', isActive: true };

const columns = [
  { key: 'code', label: 'Code', sortable: true, sortKey: 'code' },
  { key: 'name', label: 'Name', sortable: true, sortKey: 'name' },
  { key: 'type', label: 'Type', sortable: false },
  { key: 'value', label: 'Value', sortable: true, sortKey: 'value' },
  { key: 'usedCount', label: 'Used', sortable: true, sortKey: 'usedCount' },
  { key: 'endDate', label: 'Valid Until', sortable: true, sortKey: 'endDate' },
  { key: 'status', label: 'Status', sortable: false },
  { key: 'actions', label: 'Actions', sortable: false },
];

export default function Discounts() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [sortBy, setSortBy] = useState('code');
  const [sortOrder, setSortOrder] = useState('DESC');

  const toast = useToast();
  const debouncedSearch = useDebounce(search, 300);
  const { data, isLoading } = useDiscounts({ page, limit: 15, search: debouncedSearch || undefined, sortBy, sortOrder });
  const createMut = useCreateDiscount();
  const updateMut = useUpdateDiscount();
  const deleteMut = useDeleteDiscount();

  const discounts = data?.data?.discounts || [];
  const pagination = data?.data?.pagination;

  const handleSort = (field) => {
    if (sortBy === field) setSortOrder(o => o === 'ASC' ? 'DESC' : 'ASC');
    else { setSortBy(field); setSortOrder('ASC'); }
    setPage(1);
  };

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const openAdd = () => { setEditItem(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (d) => {
    setEditItem(d);
    setForm({
      code: d.code, name: d.name, description: d.description || '', type: d.type,
      value: d.value || '', minPurchaseAmount: d.minPurchaseAmount || '',
      maxDiscountAmount: d.maxDiscountAmount || '', usageLimit: d.usageLimit || '',
      startDate: d.startDate || '', endDate: d.endDate || '', isActive: d.isActive,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code.trim()) { toast.error('Discount code is required'); return; }
    if (!form.name.trim()) { toast.error('Discount name is required'); return; }
    if (!form.value || parseFloat(form.value) <= 0) { toast.error('Discount value must be greater than 0'); return; }
    if (form.type === 'percentage' && parseFloat(form.value) > 100) { toast.error('Percentage cannot exceed 100%'); return; }
    if (form.startDate && form.endDate && form.endDate < form.startDate) { toast.error('End date must be on or after start date'); return; }
    try {
      const payload = { ...form, value: parseFloat(form.value) };
      if (form.minPurchaseAmount) payload.minPurchaseAmount = parseFloat(form.minPurchaseAmount);
      if (form.maxDiscountAmount) payload.maxDiscountAmount = parseFloat(form.maxDiscountAmount);
      if (form.usageLimit) payload.usageLimit = parseInt(form.usageLimit, 10);
      if (editItem) { await updateMut.mutateAsync({ id: editItem.id, data: payload }); toast.success('Discount updated'); }
      else { await createMut.mutateAsync(payload); toast.success('Discount created'); }
      setShowModal(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Operation failed'); }
  };

  const handleDelete = async (id) => {
    try { await deleteMut.mutateAsync(id); toast.success('Discount deleted'); setDeleteConfirm(null); }
    catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const isExpired = (d) => d.endDate && new Date(d.endDate) < new Date();
  const isUsedUp = (d) => d.usageLimit && d.usedCount >= d.usageLimit;

  return (
    <PosLayout active="discounts">
      <header className="pos-header">
        <div><h1>Discounts & Promos</h1><div className="sub">Manage discount codes and promotional offers</div></div>
        <div className="toolbar m-0">
          <div className="search search-wrap">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="input with-icon" placeholder="Search discounts..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            {search && <button onClick={() => { setSearch(''); setPage(1); }} className="search-clear">×</button>}
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>＋ Add Discount</button>
        </div>
      </header>

      <DataTable
        columns={columns}
        data={discounts}
        pagination={pagination}
        onPageChange={setPage}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        isLoading={isLoading}
        emptyMessage="No discounts found"
        renderRow={(d, _idx, visHeaders) => {
          const cellMap = {
            code: <td><code className="badge neutral">{d.code}</code></td>,
            name: <td><strong>{d.name}</strong></td>,
            type: <td>{d.type === 'percentage' ? 'Percentage' : 'Fixed'}</td>,
            value: <td>{d.type === 'percentage' ? `${d.value}%` : peso(d.value)}</td>,
            usedCount: <td>{d.usedCount || 0}{d.usageLimit ? ` / ${d.usageLimit}` : ''}</td>,
            endDate: <td>{d.endDate ? formatDate(d.endDate) : '∞'}</td>,
            status: <td>
              {!d.isActive ? statusBadge('inactive') : isExpired(d) ? <span className="badge error">Expired</span> : isUsedUp(d) ? <span className="badge warning">Used Up</span> : statusBadge('active')}
            </td>,
            actions: <td className="table-actions">
              <button className="btn btn-outline btn-sm" onClick={() => openEdit(d)}>✎</button>
              <button className="btn btn-destructive btn-sm" onClick={() => setDeleteConfirm(d)}>🗑</button>
            </td>,
          };
          return <tr key={d.id} style={{ opacity: (!d.isActive || isExpired(d) || isUsedUp(d)) ? 0.6 : 1 }}>{visHeaders.map(c => cellMap[c.key])}</tr>;
        }}
      />

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Discount' : 'Add Discount'}>
        <form onSubmit={handleSubmit}>
          <div className="two-col">
            <div className="field"><label>Code <span className="text-error">*</span></label><input className="input-block" value={form.code} onChange={e => update('code', e.target.value.toUpperCase())} placeholder="e.g. SUMMER20" required /></div>
            <div className="field"><label>Name <span className="text-error">*</span></label><input className="input-block" value={form.name} onChange={e => update('name', e.target.value)} required /></div>
          </div>
          <div className="field"><label>Description</label><textarea className="input-block" value={form.description} onChange={e => update('description', e.target.value)} rows={2} /></div>
          <div className="two-col">
            <div className="field"><label>Type <span className="text-error">*</span></label>
              <select className="input-block" value={form.type} onChange={e => update('type', e.target.value)} required>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed (₱)</option>
              </select>
            </div>
            <div className="field"><label>Value <span className="text-error">*</span></label>
              <input className="input-block" type="number" step="0.01" min="0" max={form.type === 'percentage' ? 100 : undefined} value={form.value} onChange={e => update('value', e.target.value)} required />
            </div>
          </div>
          <div className="two-col">
            <div className="field"><label>Min Purchase (₱)</label><input className="input-block" type="number" step="0.01" min="0" value={form.minPurchaseAmount} onChange={e => update('minPurchaseAmount', e.target.value)} placeholder="0" /></div>
            <div className="field"><label>Max Discount (₱)</label><input className="input-block" type="number" step="0.01" min="0" value={form.maxDiscountAmount} onChange={e => update('maxDiscountAmount', e.target.value)} placeholder="No limit" /></div>
          </div>
          <div className="two-col">
            <div className="field"><label>Usage Limit</label><input className="input-block" type="number" min="1" value={form.usageLimit} onChange={e => update('usageLimit', e.target.value)} placeholder="Unlimited" /></div>
            <div className="field"><label>Active</label>
              <select className="input-block" value={form.isActive ? 'true' : 'false'} onChange={e => update('isActive', e.target.value === 'true')}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
          <div className="two-col">
            <div className="field"><label>Start Date</label><input className="input-block" type="date" value={form.startDate} onChange={e => { const v = e.target.value; update('startDate', v); if (form.endDate && v && form.endDate < v) update('endDate', ''); }} /></div>
            <div className="field"><label>End Date</label><input className="input-block" type="date" value={form.endDate} min={form.startDate || ''} onChange={e => update('endDate', e.target.value)} /></div>
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
        <p>Are you sure you want to delete discount <strong>{deleteConfirm?.code}</strong>?</p>
        <div className="modal-actions">
          <button className="btn btn-outline btn-sm" onClick={() => setDeleteConfirm(null)}>✕ Cancel</button>
          <button className="btn btn-destructive btn-sm" onClick={() => handleDelete(deleteConfirm?.id)} disabled={deleteMut.isPending}>🗑 Delete</button>
        </div>
      </Modal>
    </PosLayout>
  );
}
