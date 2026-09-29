import { useState } from 'react';
import PosLayout from '../layouts/PosLayout';
import { usePurchases, useProducts, useSuppliers, useCategories, useCreateProduct, useCreatePurchase, useReceivePurchase, useCancelPurchase, usePurchase, usePayPurchase, useShipPurchase, useDeliveryByPurchase, useBranches } from '../hooks/useApi';
import { usePettyCashFunds } from '../hooks/useApi';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import LiveTracking from './LiveTracking';
import { peso, formatDate, statusBadge, useDebounce } from '../utils/helpers';

const createItemRow = () => ({
  rowId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  productId: '',
  quantity: '',
  unitCost: '',
  expiryDate: '',
});

const columns = [
  { key: 'orderNo', label: 'Order #', sortable: true, sortKey: 'orderNo' },
  { key: 'supplier', label: 'Supplier', sortable: false },
  { key: 'total', label: 'Total', sortable: true, sortKey: 'total' },
  { key: 'paid', label: 'Paid', sortable: false },
  { key: 'status', label: 'Status', sortable: true, sortKey: 'status' },
  { key: 'paymentStatus', label: 'Payment', sortable: false },
  { key: 'orderDate', label: 'Date', sortable: true, sortKey: 'orderDate' },
  { key: 'actions', label: 'Actions', sortable: false },
];

export default function Purchases() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalKey, setModalKey] = useState(0);
  const [receiveModal, setReceiveModal] = useState(null);
  const [form, setForm] = useState({ supplierId: '', items: [createItemRow()], notes: '' });
  const [receiveQty, setReceiveQty] = useState({});
  const [payModal, setPayModal] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [paySource, setPaySource] = useState('');
  const [payFundId, setPayFundId] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [trackModal, setTrackModal] = useState(null);
  const [shipModal, setShipModal] = useState(null);
  const [destLat, setDestLat] = useState('14.5995');
  const [destLng, setDestLng] = useState('120.9842');
  const [destBranchId, setDestBranchId] = useState('');
  const { data: branchData } = useBranches({ limit: 100 });

  const toast = useToast();
  const debouncedSearch = useDebounce(search, 300);
  const { data, isLoading } = usePurchases({ page, limit: 15, search: debouncedSearch || undefined, sortBy, sortOrder });
  const { data: supData } = useSuppliers();
  const { data: prodData } = useProducts({ limit: 100 });
  const { data: fundsData } = usePettyCashFunds();
  const { data: catData } = useCategories();
  const createMut = useCreatePurchase();
  const createProductMut = useCreateProduct();
  const receiveMut = useReceivePurchase();
  const cancelMut = useCancelPurchase();
  const payMut = usePayPurchase();
  const shipMut = useShipPurchase();
  const { data: trackData } = useDeliveryByPurchase(trackModal?.id);

  const { data: fullPurchaseData } = usePurchase(receiveModal?.id);
  const fullPurchase = fullPurchaseData?.data || fullPurchaseData;

  const purchases = data?.data?.purchases || [];
  const pagination = data?.data?.pagination;
  const suppliers = supData?.data?.suppliers || [];
  const products = prodData?.data?.products || [];
  const activeFunds = (fundsData?.data?.funds || []).filter(f => f.status === 'active');
  const branches = branchData?.data?.branches || [];
  const categories = catData?.data?.categories || [];
  const filteredProducts = form.supplierId ? products.filter(p => String(p.supplierId) === String(form.supplierId)) : products;
  const [showProductModal, setShowProductModal] = useState(false);
  const [productForm, setProductForm] = useState({ name: '', description: '', categoryId: '', unit: 'pcs', buyingPrice: '', sellingPrice: '', stockQuantity: 0, minStockLevel: 5, sku: '', barcode: '', taxRate: 0, expiryDate: '' });

  const handleSort = (field) => {
    if (sortBy === field) setSortOrder(o => o === 'ASC' ? 'DESC' : 'ASC');
    else { setSortBy(field); setSortOrder('ASC'); }
    setPage(1);
  };

  const addItem = () => setForm(p => ({ ...p, items: [...p.items, createItemRow()] }));
  const removeItem = (rowId) => setForm(p => ({ ...p, items: p.items.filter(item => item.rowId !== rowId) }));
  const updateItem = (rowId, k, v) => setForm(p => ({ ...p, items: p.items.map(item => item.rowId === rowId ? { ...item, [k]: v } : item) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplierId) { toast.error('Supplier is required'); return; }
    if (!form.items.length || form.items.every(i => !i.productId)) { toast.error('At least one item is required'); return; }
    for (const item of form.items) {
      if (!item.productId) { toast.error('Each item must have a product selected'); return; }
      if (!item.quantity || Number(item.quantity) < 1) { toast.error('Quantity must be at least 1'); return; }
      if (item.unitCost === '' || item.unitCost === undefined || Number(item.unitCost) < 0) { toast.error('Unit cost must be 0 or more'); return; }
    }
    try {
      await createMut.mutateAsync({
        supplierId: Number(form.supplierId),
        items: form.items.map(i => ({ productId: Number(i.productId), quantity: Number(i.quantity), unitCost: Number(i.unitCost), expiryDate: i.expiryDate || null })),
        notes: form.notes,
      });
      toast.success('Purchase order created');
      setShowModal(false);
      setForm({ supplierId: '', items: [createItemRow()], notes: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create purchase');
    }
  };

  const handleReceive = async () => {
    const items = fullPurchase?.items || receiveModal?.items || [];
    try {
      await receiveMut.mutateAsync({
        id: receiveModal.id,
        data: { items: items.map(i => ({ purchaseItemId: i.id, quantity: Number(receiveQty[i.id] || i.quantity) })) },
      });
      toast.success('Purchase received');
      setReceiveModal(null);
      setReceiveQty({});
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to receive'); }
  };

  const handleCancel = async (id) => {
    try { await cancelMut.mutateAsync(id); toast.success('Purchase cancelled'); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to cancel'); }
  };

  const handlePay = async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (paySource === 'petty_cash' && !payFundId) { toast.error('Select a petty cash fund'); return; }
    try {
      const payload = { amount };
      if (paySource === 'petty_cash') payload.fundId = Number(payFundId);
      await payMut.mutateAsync({ id: payModal.id, data: payload });
      toast.success('Payment recorded');
      setPayModal(null);
      setPayAmount('');
      setPaySource('');
      setPayFundId('');
    } catch (err) { toast.error(err.response?.data?.message || 'Payment failed'); }
  };

  const handleShip = async () => {
    if (!destLat || !destLng) { toast.error('Enter destination coordinates'); return; }
    try {
      await shipMut.mutateAsync({ purchaseId: shipModal.id, destinationLat: parseFloat(destLat), destinationLng: parseFloat(destLng) });
      toast.success('Delivery started');
      setShipModal(null);
      setTrackModal(shipModal);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to start delivery'); }
  };

  return (
    <PosLayout active="purchases">
      <header className="pos-header">
        <div><h1>Purchases</h1><div className="sub">Purchase orders and inventory receiving</div></div>
        <div className="flex-row">
          <div className="search pos-rel">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="input with-icon" placeholder="Search purchases..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            {search && <button onClick={() => { setSearch(''); setPage(1); }} className="search-clear">×</button>}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setForm({ supplierId: '', items: [createItemRow()], notes: '' }); setModalKey(k => k + 1); setShowModal(true); }}>+ New Purchase Order</button>
        </div>
      </header>

      <DataTable
        columns={columns}
        data={purchases}
        pagination={pagination}
        onPageChange={setPage}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        isLoading={isLoading}
        emptyMessage="No purchases found"
        renderRow={(p, _idx, visHeaders) => {
          const cellMap = {
            orderNo: <td><strong>{p.orderNo}</strong></td>,
            supplier: <td>{p.supplier?.name || '—'}</td>,
            totalAmount: <td>{peso(p.total)}</td>,
            paid: <td className={p.paymentStatus === 'paid' ? 'text-success' : 'text-warning'}>{peso(p.paidAmount || 0)}</td>,
            status: <td>{statusBadge(p.status)}</td>,
            paymentStatus: <td>{statusBadge(p.paymentStatus)}</td>,
            orderDate: <td>{formatDate(p.orderDate)}</td>,
            actions: <td className="table-actions">
              {(p.status === 'ordered' || p.status === 'partial') && <button className="btn btn-success btn-sm" onClick={() => setReceiveModal(p)}>Receive</button>}
              {p.paymentStatus !== 'paid' && <button className="btn btn-primary btn-sm" onClick={() => { setPayModal(p); setPayAmount(String(parseFloat(p.total) - parseFloat(p.paidAmount || 0)).toFixed(2)); }}>₱ Pay</button>}
              {p.status === 'pending' && <button className="btn btn-destructive btn-sm" onClick={() => handleCancel(p.id)}>Cancel</button>}
              {p.status !== 'received' && p.status !== 'cancelled' && (
                <button className="btn btn-sm" style={{ background: '#6366f1', color: '#fff' }} onClick={() => setTrackModal(p)}>🗺️ Track</button>
              )}
            </td>,
          };
          return <tr key={p.id}>{visHeaders.map(c => cellMap[c.key])}</tr>;
        }}
      />

      <Modal key={modalKey} open={showModal} onClose={() => setShowModal(false)} title="New Purchase Order">
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Supplier</label>
            <select className="input-block" value={form.supplierId} onChange={e => setForm(p => ({ ...p, supplierId: e.target.value, items: p.items.map(i => ({ ...i, productId: '' })) }))} required>
              <option value="">Select supplier</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {form.items.map((item) => (
            <div key={item.rowId} className="p-sm mb-md" style={{ background: 'var(--muted)', borderRadius: 12 }}>
              <div className="two-col">
                <div className="field"><label>Product</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select className="input-block" style={{ flex: 1 }} value={item.productId} onChange={e => updateItem(item.rowId, 'productId', e.target.value)} required>
                      <option value="">Select product</option>
                      {filteredProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => { setProductForm({ name: '', description: '', categoryId: '', unit: 'pcs', buyingPrice: '', sellingPrice: '', stockQuantity: 0, minStockLevel: 5, sku: '', barcode: '', taxRate: 0, expiryDate: '' }); setShowProductModal(true); }}>+ Create</button>
                  </div>
                </div>
                <div className="field"><label>Qty</label><input className="input-block" type="number" min="1" value={item.quantity} onChange={e => updateItem(item.rowId, 'quantity', e.target.value)} required /></div>
              </div>
              <div className="two-col">
                <div className="field"><label>Unit Cost</label><input className="input-block" type="number" step="0.01" min="0" value={item.unitCost} onChange={e => updateItem(item.rowId, 'unitCost', e.target.value)} required /></div>
                <div className="field"><label>Expiry Date</label><input className="input-block" type="date" value={item.expiryDate} min={new Date().toISOString().split('T')[0]} onChange={e => updateItem(item.rowId, 'expiryDate', e.target.value)} /></div>
              </div>
              {form.items.length > 1 && <button type="button" className="btn btn-destructive btn-sm mt-xs" onClick={() => removeItem(item.rowId)}>− Remove</button>}
            </div>
          ))}
          <button type="button" className="btn btn-outline btn-sm" onClick={addItem}>+ Add Item</button>
          <div className="field mt-md"><label>Notes</label><textarea className="input-block" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowModal(false)}>✕ Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={createMut.isPending}>{createMut.isPending && <span className="btn-spinner" />}+ Create</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!receiveModal} onClose={() => { setReceiveModal(null); setReceiveQty({}); }} title={`Receive ${receiveModal?.orderNo || ''}`}>
        <p className="text-sm text-muted mb-sm">Confirm received quantities for each item.</p>
        {(fullPurchase?.items || receiveModal?.items || []).map((item, i) => (
          <div key={i} className="field">
            <label>{item.product?.name || item.productName || `Product #${item.productId}`} (Ordered: {item.quantity})</label>
            <input className="input-block" type="number" min="0" defaultValue={item.quantity} onChange={e => setReceiveQty(p => ({ ...p, [item.id]: e.target.value }))} />
          </div>
        ))}
        <div className="modal-actions">
          <button className="btn btn-outline btn-sm" onClick={() => { setReceiveModal(null); setReceiveQty({}); }}>✕ Cancel</button>
          <button className="btn btn-success btn-sm" onClick={handleReceive} disabled={receiveMut.isPending}>{receiveMut.isPending && <span className="btn-spinner" />}Confirm Receive</button>
        </div>
      </Modal>

      <Modal open={!!payModal} onClose={() => { setPayModal(null); setPayAmount(''); setPaySource(''); setPayFundId(''); }} title={`Pay ${payModal?.orderNo || ''}`}>
        {(() => {
          const total = parseFloat(payModal?.total || 0);
          const paid = parseFloat(payModal?.paidAmount || 0);
          const remaining = total - paid;
          const amount = parseFloat(payAmount) || 0;
          const overpay = amount > remaining ? amount - remaining : 0;
          return (
            <>
              <div className="flex-col-gap mb-sm">
                <div className="text-sm text-muted">Total: <strong>{peso(total)}</strong></div>
                <div className="text-sm text-muted">Already paid: <strong>{peso(paid)}</strong></div>
                <div className="text-sm font-bold text-error">Remaining: {peso(remaining)}</div>
              </div>
              <div className="field"><label>Payment Amount</label><input className="input-block" type="number" min="0" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} /></div>
              {amount > 0 && (
                <div className="text-sm" style={{ padding: '8px 12px', borderRadius: 8, background: overpay > 0 ? '#dcfce7' : 'var(--muted)', marginBottom: 12 }}>
                  {overpay > 0 ? (
                  <span className="text-success font-semibold">Change: {peso(overpay)}</span>
                  ) : amount < remaining ? (
                    <span>Will pay: {peso(amount)} &middot; Still owed: {peso(remaining - amount)}</span>
                  ) : (
                    <span>Will pay: {peso(remaining)} (full balance)</span>
                  )}
                </div>
              )}
              <div className="field"><label>Payment Source</label>
                <select className="input-block" value={paySource} onChange={e => { setPaySource(e.target.value); setPayFundId(''); }}>
                  <option value="">Cash / Other</option>
                  {activeFunds.length > 0 && <option value="petty_cash">Petty Cash Fund</option>}
                </select>
              </div>
              {paySource === 'petty_cash' && (
                <div className="field"><label>Select Fund</label>
                  <select className="input-block" value={payFundId} onChange={e => setPayFundId(e.target.value)} required>
                    <option value="">Select fund</option>
                    {activeFunds.map(f => <option key={f.id} value={f.id}>{f.name} — {peso(f.currentBalance)}</option>)}
                  </select>
                </div>
              )}
              <div className="modal-actions">
                <button className="btn btn-outline btn-sm" onClick={() => { setPayModal(null); setPayAmount(''); setPaySource(''); setPayFundId(''); }}>✕ Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={handlePay} disabled={payMut.isPending || !amount || amount <= 0}>{payMut.isPending && <span className="btn-spinner" />}₱ Pay{overpay > 0 ? ` + ${peso(overpay)} change` : ''}</button>
              </div>
            </>
          );
        })()}
      </Modal>

      <Modal open={showProductModal} onClose={() => setShowProductModal(false)} title="Create Product">
        <form onSubmit={e => { e.preventDefault(); const fd = new FormData(); Object.entries(productForm).forEach(([k,v]) => fd.append(k, v)); createProductMut.mutate(fd, { onSuccess: () => { toast.success('Product created'); setShowProductModal(false); setProductForm({ name: '', description: '', categoryId: '', unit: 'pcs', buyingPrice: '', sellingPrice: '', stockQuantity: 0, minStockLevel: 5, sku: '', barcode: '', taxRate: 0, expiryDate: '' }); } }); }}>
          <div className="field"><label>Name</label><input className="input-block" value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} required /></div>
          <div className="field"><label>Description</label><textarea className="input-block" value={productForm.description} onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
          <div className="two-col">
            <div className="field"><label>Category</label><select className="input-block" value={productForm.categoryId} onChange={e => setProductForm(f => ({ ...f, categoryId: e.target.value }))} required><option value="">Select</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="field"><label>Unit</label><input className="input-block" value={productForm.unit} onChange={e => setProductForm(f => ({ ...f, unit: e.target.value }))} /></div>
          </div>
          <div className="two-col">
            <div className="field"><label>Buying Price</label><input className="input-block" type="number" step="0.01" min="0" value={productForm.buyingPrice} onChange={e => setProductForm(f => ({ ...f, buyingPrice: e.target.value }))} required /></div>
            <div className="field"><label>Selling Price</label><input className="input-block" type="number" step="0.01" min="0" value={productForm.sellingPrice} onChange={e => setProductForm(f => ({ ...f, sellingPrice: e.target.value }))} required /></div>
          </div>
          <div className="two-col">
            <div className="field"><label>Stock Quantity</label><input className="input-block" type="number" min="0" value={productForm.stockQuantity} onChange={e => setProductForm(f => ({ ...f, stockQuantity: parseInt(e.target.value) || 0 }))} /></div>
            <div className="field"><label>Min Stock Level</label><input className="input-block" type="number" min="0" value={productForm.minStockLevel} onChange={e => setProductForm(f => ({ ...f, minStockLevel: parseInt(e.target.value) || 0 }))} /></div>
          </div>
          <div className="two-col">
            <div className="field"><label>SKU</label><input className="input-block" value={productForm.sku} onChange={e => setProductForm(f => ({ ...f, sku: e.target.value }))} placeholder="Auto-generated if empty" /></div>
            <div className="field"><label>Barcode</label><input className="input-block" value={productForm.barcode} onChange={e => setProductForm(f => ({ ...f, barcode: e.target.value }))} placeholder="Auto-generated if empty" /></div>
          </div>
          <div className="field"><label>Tax Rate (%)</label><input className="input-block" type="number" step="0.01" min="0" max="100" value={productForm.taxRate} onChange={e => setProductForm(f => ({ ...f, taxRate: parseFloat(e.target.value) || 0 }))} /></div>
          <div className="field"><label>Expiry Date</label><input className="input-block" type="date" value={productForm.expiryDate} onChange={e => setProductForm(f => ({ ...f, expiryDate: e.target.value }))} min={new Date().toISOString().split('T')[0]} /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowProductModal(false)}>✕ Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={createProductMut.isPending}>{createProductMut.isPending && <span className="btn-spinner" />}+ Create</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!trackModal} onClose={() => setTrackModal(null)} title={`Track Delivery — ${trackModal?.orderNo || ''}`}>
        {trackModal && trackData?.delivery ? (
          <LiveTracking deliveryId={trackData.delivery.id} />
        ) : trackModal ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
            <p style={{ color: '#64748b', marginBottom: 16 }}>No delivery tracking for this order yet.</p>
            <button className="btn btn-primary btn-sm" onClick={() => { setTrackModal(null); setShipModal(trackModal); }}>
              🚚 Start Delivery
            </button>
          </div>
        ) : null}
      </Modal>

      <Modal open={!!shipModal} onClose={() => setShipModal(null)} title={`Ship Order — ${shipModal?.orderNo || ''}`}>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>Select the destination branch for the rider.</p>
        <div className="field">
          <label>Destination Branch</label>
          <select className="input-block" value={destBranchId} onChange={e => {
            const id = e.target.value;
            setDestBranchId(id);
            const branch = branches.find(b => String(b.id) === String(id));
            if (branch) {
              setDestLat(String(branch.latitude || branch.lat || ''));
              setDestLng(String(branch.longitude || branch.lng || ''));
            }
          }} required>
            <option value="">Select branch</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name} — {b.address || b.city || ''}</option>
            ))}
          </select>
        </div>
        <div className="flex-gap">
          <div className="field" style={{ flex: 1 }}><label>Latitude</label><input className="input-block" type="number" step="any" value={destLat} onChange={e => setDestLat(e.target.value)} required /></div>
          <div className="field" style={{ flex: 1 }}><label>Longitude</label><input className="input-block" type="number" step="any" value={destLng} onChange={e => setDestLng(e.target.value)} required /></div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-outline btn-sm" onClick={() => setShipModal(null)}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleShip} disabled={shipMut.isPending || !destBranchId}>
            {shipMut.isPending && <span className="btn-spinner" />}🚚 Ship Order
          </button>
        </div>
      </Modal>
    </PosLayout>
  );
}

