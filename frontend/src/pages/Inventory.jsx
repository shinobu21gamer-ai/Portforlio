import { useState } from 'react';
import ErrorState from '../components/ErrorState';
import PosLayout from '../layouts/PosLayout';
import { useInventoryMovements, useProducts, useStockIn, useStockOut } from '../hooks/useApi';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import { formatDateTime, useDebounce } from '../utils/helpers';

const columns = [
  { key: 'createdAt', label: 'Date', sortable: true, sortKey: 'createdAt' },
  { key: 'product', label: 'Product', sortable: false },
  { key: 'type', label: 'Type', sortable: true, sortKey: 'type' },
  { key: 'quantity', label: 'Quantity', sortable: true, sortKey: 'quantity' },
  { key: 'previousStock', label: 'Previous', sortable: false },
  { key: 'newStock', label: 'New', sortable: false },
  { key: 'user', label: 'User', sortable: false },
  { key: 'notes', label: 'Notes', sortable: false },
];

export default function Inventory() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('movements');
  const [showModal, setShowModal] = useState(null);
  const [form, setForm] = useState({ productId: '', quantity: '', notes: '' });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('DESC');

  const toast = useToast();
  const debouncedSearch = useDebounce(search, 300);
  const { data, isLoading, isError, error, refetch } = useInventoryMovements({ page, limit: 15, type: activeTab === 'in' ? 'in' : activeTab === 'out' ? 'out' : undefined, search: debouncedSearch || undefined, startDate: dateFrom || undefined, endDate: dateTo || undefined, sortBy, sortOrder });
  const { data: prodData } = useProducts({ limit: 100 });
  const stockInMut = useStockIn();
  const stockOutMut = useStockOut();

  const movements = data?.data?.movements || [];
  const pagination = data?.data?.pagination;
  const products = prodData?.data?.products || [];

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSort = (field) => {
    if (sortBy === field) setSortOrder(o => o === 'ASC' ? 'DESC' : 'ASC');
    else { setSortBy(field); setSortOrder('ASC'); }
    setPage(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const qty = Number(form.quantity);
    if (!form.productId) { toast.error('Select a product'); return; }
    if (!qty || qty <= 0) { toast.error('Quantity must be greater than 0'); return; }
    try {
      if (showModal === 'in') {
        await stockInMut.mutateAsync({ productId: Number(form.productId), quantity: qty, notes: form.notes });
        toast.success('Stock added');
      } else if (showModal === 'out') {
        const product = products.find(p => String(p.id) === String(form.productId));
        if (product && qty > product.stockQuantity) {
          toast.error(`Only ${product.stockQuantity} in stock`);
          return;
        }
        await stockOutMut.mutateAsync({ productId: Number(form.productId), quantity: qty, notes: form.notes });
        toast.success('Stock removed');
      }
      setShowModal(null);
      setForm({ productId: '', quantity: '', notes: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    }
  };

  if (isError) {
    return (
      <div className="page-error-wrap">
        <ErrorState message={error?.response?.data?.message || 'Something went wrong while loading this data.'} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <PosLayout active="inventory">
      <header className="pos-header">
        <div><h1>Inventory</h1><div className="sub">Stock movements and adjustments</div></div>
        <div className="flex-wrap-sm">
          <div className="search pos-rel">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="input with-icon" placeholder="Search movements..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            {search && <button onClick={() => { setSearch(''); setPage(1); }} className="search-clear">×</button>}
          </div>
          <input className="input text-sm" type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
          <span className="text-sm text-muted">to</span>
          <input className="input text-sm" type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} />
          {(dateFrom || dateTo) && <button className="btn btn-outline btn-sm" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}>Clear Dates</button>}
          <button className="btn btn-success btn-sm" onClick={() => { setShowModal('in'); setForm({ productId: '', quantity: '', notes: '' }); }}>Stock In</button>
          <button className="btn btn-destructive btn-sm" onClick={() => { setShowModal('out'); setForm({ productId: '', quantity: '', notes: '' }); }}>Stock Out</button>
        </div>
      </header>

      <div className="tabs">
        <button className={`tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>All Movements</button>
        <button className={`tab ${activeTab === 'in' ? 'active' : ''}`} onClick={() => setActiveTab('in')}>Stock In</button>
        <button className={`tab ${activeTab === 'out' ? 'active' : ''}`} onClick={() => setActiveTab('out')}>Stock Out</button>
      </div>

      <DataTable
        columns={columns}
        data={movements}
        pagination={pagination}
        onPageChange={setPage}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        isLoading={isLoading}
        emptyMessage="No movements found"
        renderRow={(m, _idx, visHeaders) => {
          const cellMap = {
            createdAt: <td>{formatDateTime(m.createdAt)}</td>,
            product: <td>{m.product?.name || '—'}</td>,
            type: <td><span className={`badge ${m.type === 'in' ? 'success' : m.type === 'out' ? 'error' : 'info'}`}>{m.type}</span></td>,
            quantity: <td>{m.quantity}</td>,
            previousStock: <td>{m.previousStock}</td>,
            newStock: <td>{m.newStock}</td>,
            user: <td>{m.user ? `${m.user.firstName} ${m.user.lastName}` : '—'}</td>,
            notes: <td className="w-200 truncate">{m.notes || '—'}</td>,
          };
          return <tr key={m.id}>{visHeaders.map(c => cellMap[c.key])}</tr>;
        }}
      />

      <Modal open={!!showModal} onClose={() => setShowModal(null)} title={showModal === 'in' ? 'Stock In' : 'Stock Out'}>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Product</label>
            <select className="input-block" value={form.productId} onChange={e => update('productId', e.target.value)} required>
              <option value="">Select product</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.stockQuantity})</option>)}
            </select>
          </div>
          <div className="field"><label>Quantity</label><input className="input-block" type="number" min="1" value={form.quantity} onChange={e => update('quantity', e.target.value)} required /></div>
          <div className="field"><label>Notes</label><textarea className="input-block" value={form.notes} onChange={e => update('notes', e.target.value)} rows={2} /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowModal(null)}>✕ Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={stockInMut.isPending || stockOutMut.isPending}>{(stockInMut.isPending || stockOutMut.isPending) && <span className="btn-spinner" />}Confirm</button>
          </div>
        </form>
      </Modal>
    </PosLayout>
  );
}
