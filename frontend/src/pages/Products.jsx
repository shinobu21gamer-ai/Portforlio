import { useState } from 'react';
import PosLayout from '../layouts/PosLayout';
import { useProducts, useCategories, useCreateProduct, useUpdateProduct, useDeleteProduct } from '../hooks/useApi';
import useAuthStore from '../store/authStore';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import { peso, formatDate, statusBadge, useDebounce } from '../utils/helpers';

const EMPTY = { name: '', description: '', categoryId: '', buyingPrice: '', sellingPrice: '', stockQuantity: '', minStockLevel: '10', barcode: '', sku: '', unit: 'pcs', taxRate: '0', expiryDate: '' };

const columns = [
  { key: 'image', label: 'Image', sortable: false },
  { key: 'name', label: 'Name', sortable: true, sortKey: 'name' },
  { key: 'sku', label: 'SKU', sortable: false },
  { key: 'categoryId', label: 'Category', sortable: true, sortKey: 'categoryId' },
  { key: 'stockQuantity', label: 'Stock', sortable: true, sortKey: 'stockQuantity' },
  { key: 'expiryDate', label: 'Expiry', sortable: true, sortKey: 'expiryDate' },
  { key: 'sellingPrice', label: 'Price', sortable: true, sortKey: 'sellingPrice' },
  { key: 'isActive', label: 'Status', sortable: false },
  { key: 'actions', label: 'Actions', sortable: false },
];

export default function Products() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('DESC');

  const user = useAuthStore(s => s.user);
  const role = user?.role?.slug;
  const canEdit = role === 'admin' || role === 'manager' || role === 'inventory_staff';
  const canDelete = role === 'admin' || role === 'manager';
  const toast = useToast();
  const debouncedSearch = useDebounce(search, 300);
  const { data, isLoading } = useProducts({ page, limit: 15, search: debouncedSearch || undefined, categoryId: catFilter || undefined, sortBy, sortOrder });
  const { data: catData } = useCategories();
  const createMut = useCreateProduct();
  const updateMut = useUpdateProduct();
  const deleteMut = useDeleteProduct();

  const products = data?.data?.products || [];
  const pagination = data?.data?.pagination;
  const categories = catData?.categories || [];

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(o => o === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('ASC');
    }
    setPage(1);
  };

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const openAdd = () => { setEditItem(null); setForm(EMPTY); setImageFile(null); setImagePreview(null); setShowModal(true); };
  const openEdit = (p) => {
    setEditItem(p);
    setForm({
      name: p.name, description: p.description || '', categoryId: p.categoryId || '',
      buyingPrice: p.buyingPrice || '', sellingPrice: p.sellingPrice || '',
      stockQuantity: p.stockQuantity || '', minStockLevel: p.minStockLevel || '10',
      barcode: p.barcode || '', sku: p.sku || '', unit: p.unit || 'pcs', taxRate: p.taxRate || '0',
      expiryDate: p.expiryDate ? p.expiryDate.split('T')[0] : '',
    });
    setImageFile(null);
    setImagePreview(p.image || null);
    setShowModal(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be less than 5MB'); return; }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Product name is required'); return; }
    if (!editItem && !imageFile) { toast.error('Product image is required'); return; }
    if (form.sellingPrice && form.buyingPrice && parseFloat(form.sellingPrice) < parseFloat(form.buyingPrice)) {
      toast.error('Selling price cannot be less than buying price'); return;
    }
    if (form.stockQuantity !== '' && parseInt(form.stockQuantity, 10) < 0) {
      toast.error('Stock quantity cannot be negative'); return;
    }

    const normalizedName = form.name.trim().toLowerCase();
    const normalizedSku = (form.sku || '').trim().toLowerCase();
    const normalizedBarcode = (form.barcode || '').trim().toLowerCase();
    const duplicateProduct = products.find((product) => {
      if (editItem?.id === product.id) return false;
      const nameMatch = product.name?.trim().toLowerCase() === normalizedName;
      const skuMatch = normalizedSku && product.sku?.trim().toLowerCase() === normalizedSku;
      const barcodeMatch = normalizedBarcode && product.barcode?.trim().toLowerCase() === normalizedBarcode;
      return nameMatch || skuMatch || barcodeMatch;
    });
    if (duplicateProduct) { toast.error('A product with the same name, SKU, or barcode already exists'); return; }

    try {
      const fd = new FormData();
      fd.append('name', form.name);
      if (form.description) fd.append('description', form.description);
      fd.append('categoryId', form.categoryId);
      fd.append('buyingPrice', form.buyingPrice);
      fd.append('sellingPrice', form.sellingPrice);
      fd.append('stockQuantity', form.stockQuantity || '0');
      fd.append('minStockLevel', form.minStockLevel || '10');
      if (form.sku) fd.append('sku', form.sku);
      if (form.barcode) fd.append('barcode', form.barcode);
      fd.append('unit', form.unit || 'pcs');
      fd.append('taxRate', form.taxRate || '0');
      if (form.expiryDate) fd.append('expiryDate', form.expiryDate);
      if (imageFile) fd.append('image', imageFile);

      if (editItem) {
        await updateMut.mutateAsync({ id: editItem.id, data: fd });
        toast.success('Product updated');
      } else {
        await createMut.mutateAsync(fd);
        toast.success('Product created');
      }
      setShowModal(false);
      setImageFile(null);
      setImagePreview(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save product');
    }
  };

  const handleDelete = async (id) => {
    try { await deleteMut.mutateAsync(id); toast.success('Product deleted'); setDeleteConfirm(null); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to delete'); }
  };

  return (
    <PosLayout active="products">
      <header className="pos-header">
        <div><h1>Products</h1><div className="sub">Manage product inventory</div></div>
        <div className="flex-row">
          <select className="input" value={catFilter} onChange={e => { setCatFilter(e.target.value); setPage(1); }} style={{ maxWidth: 160 }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="search pos-rel">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="input with-icon" placeholder="Search products..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            {search && <button onClick={() => { setSearch(''); setPage(1); }} className="search-clear">×</button>}
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Product</button>
        </div>
      </header>

      <DataTable
        columns={columns}
        data={products}
        pagination={pagination}
        onPageChange={setPage}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        isLoading={isLoading}
        emptyMessage="No products found"
        title=""
        renderRow={(p, _idx, visHeaders) => {
          const cellMap = {
            image: <td>
              {p.image ? (
                <img src={p.image} alt={p.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8 }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📦</div>
              )}
            </td>,
            name: <td><strong>{p.name}</strong></td>,
            sku: <td>{p.sku}</td>,
            categoryId: <td>{p.category?.name || '—'}</td>,
            stockQuantity: <td><span className={`badge ${p.stockQuantity <= (p.minStockLevel || 10) ? 'error' : 'success'}`}>{p.stockQuantity}</span></td>,
            expiryDate: <td>
              {p.expiryDate ? (
                (() => {
                  const daysLeft = Math.ceil((new Date(p.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
                  if (daysLeft < 0) return <span className="badge error">Expired</span>;
                  if (daysLeft <= 30) return <span className="badge warning">{daysLeft}d left</span>;
                  return <span style={{ fontSize: 13 }}>{formatDate(p.expiryDate)}</span>;
                })()
              ) : '—'}
            </td>,
            sellingPrice: <td>{peso(p.sellingPrice)}</td>,
            isActive: <td>{statusBadge(p.isActive ? 'active' : 'inactive')}</td>,
            actions: <td className="table-actions">
              {canEdit && <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)}>✎ Edit</button>}
              {canDelete && <button className="btn btn-destructive btn-sm" onClick={() => setDeleteConfirm(p)}>🗑 Delete</button>}
            </td>,
          };
          return <tr key={p.id}>{visHeaders.map(c => cellMap[c.key])}</tr>;
        }}
      />

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Product' : 'Add Product'}>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Product Image {!editItem && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
            <div className="flex-row" style={{ gap: 12 }}>
              {imagePreview && <img src={imagePreview} alt="Preview" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '2px solid var(--border)' }} />}
              <div>
                <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleImageChange} id="product-image" style={{ display: 'none' }} />
                <label htmlFor="product-image" className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>{imagePreview ? 'Change Image' : 'Upload Image'}</label>
                {imagePreview && <button type="button" className="btn btn-sm mr-sm" onClick={() => { setImageFile(null); setImagePreview(null); }}>Remove</button>}
                <div className="text-xs text-muted" style={{ marginTop: 4 }}>JPEG, PNG, GIF, WebP. Max 5MB.</div>
              </div>
            </div>
          </div>
          <div className="field"><label>Name</label><input className="input-block" value={form.name} onChange={e => update('name', e.target.value.replace(/[<>{}`@#$%^&*|\\]/g, ''))} required /></div>
          <div className="field"><label>Description</label><textarea className="input-block" value={form.description} onChange={e => update('description', e.target.value.replace(/[<>{}`@#$%^&*|\\]/g, ''))} rows={2} /></div>
          <div className="two-col">
            <div className="field"><label>Category</label><select className="input-block" value={form.categoryId} onChange={e => update('categoryId', e.target.value)} required><option value="">Select</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="field"><label>Unit</label><input className="input-block" value={form.unit} onChange={e => update('unit', e.target.value)} /></div>
          </div>
          <div className="two-col">
            <div className="field"><label>Buying Price</label><input className="input-block" type="number" step="0.01" min="0" value={form.buyingPrice} onChange={e => update('buyingPrice', e.target.value)} onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} required /></div>
            <div className="field"><label>Selling Price</label><input className="input-block" type="number" step="0.01" min="0" value={form.sellingPrice} onChange={e => update('sellingPrice', e.target.value)} onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} required /></div>
          </div>
          <div className="two-col">
            <div className="field"><label>Stock Quantity</label><input className="input-block" type="number" min="0" value={form.stockQuantity} onChange={e => update('stockQuantity', e.target.value)} onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} /></div>
            <div className="field"><label>Min Stock Level</label><input className="input-block" type="number" min="0" value={form.minStockLevel} onChange={e => update('minStockLevel', e.target.value)} onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} /></div>
          </div>
          <div className="two-col">
            <div className="field"><label>SKU</label><input className="input-block" value={form.sku} onChange={e => update('sku', e.target.value)} placeholder="Auto-generated if empty" /></div>
            <div className="field"><label>Barcode</label><input className="input-block" value={form.barcode} onChange={e => update('barcode', e.target.value)} placeholder="Auto-generated if empty" /></div>
          </div>
          <div className="field"><label>Tax Rate (%)</label><input className="input-block" type="number" step="0.01" min="0" max="100" value={form.taxRate} onChange={e => update('taxRate', e.target.value)} onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} /></div>
          <div className="field"><label>Expiry Date</label><input className="input-block" type="date" value={form.expiryDate} onChange={e => update('expiryDate', e.target.value)} min={new Date().toISOString().split('T')[0]} /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowModal(false)}>✕ Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) && <span className="btn-spinner" />}{editItem ? 'Update' : '+ Create'}
            </button>
          </div>
        </form>
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
