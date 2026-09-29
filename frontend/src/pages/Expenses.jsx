import { useState } from 'react';
import PosLayout from '../layouts/PosLayout';
import { useExpenses, useExpenseCategories, useCreateExpense, useUpdateExpense, useDeleteExpense } from '../hooks/useApi';
import useAuthStore from '../store/authStore';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import { peso, formatDate, statusBadge, useDebounce } from '../utils/helpers';

const EMPTY = { expenseCategoryId: '', amount: '', description: '', paymentMethod: 'cash', expenseDate: new Date().toISOString().split('T')[0] };

const columns = [
  { key: 'expenseDate', label: 'Date', sortable: true, sortKey: 'expenseDate' },
  { key: 'category', label: 'Category', sortable: false },
  { key: 'description', label: 'Description', sortable: true, sortKey: 'description' },
  { key: 'amount', label: 'Amount', sortable: true, sortKey: 'amount' },
  { key: 'paymentMethod', label: 'Payment', sortable: false },
  { key: 'actions', label: 'Actions', sortable: false },
];

export default function Expenses() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('expenseDate');
  const [sortOrder, setSortOrder] = useState('DESC');

  const user = useAuthStore(s => s.user);
  const role = user?.role?.slug;
  const canEdit = role === 'admin' || role === 'manager';
  const canDelete = role === 'admin';
  const toast = useToast();
  const debouncedSearch = useDebounce(search, 300);
  const { data, isLoading } = useExpenses({ page, limit: 15, search: debouncedSearch || undefined, startDate: dateFrom || undefined, endDate: dateTo || undefined, sortBy, sortOrder });
  const { data: catData } = useExpenseCategories();
  const createMut = useCreateExpense();
  const updateMut = useUpdateExpense();
  const deleteMut = useDeleteExpense();

  const expenses = data?.data?.expenses || [];
  const pagination = data?.data?.pagination;
  const categories = catData?.data || [];

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSort = (field) => {
    if (sortBy === field) setSortOrder(o => o === 'ASC' ? 'DESC' : 'ASC');
    else { setSortBy(field); setSortOrder('ASC'); }
    setPage(1);
  };

  const openAdd = () => { setEditItem(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (e) => {
    setEditItem(e);
    setForm({ expenseCategoryId: e.expenseCategoryId || '', amount: e.amount || '', description: e.description || '', paymentMethod: e.paymentMethod || 'cash', expenseDate: e.expenseDate || new Date().toISOString().split('T')[0] });
    setShowModal(true);
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!form.expenseCategoryId) { toast.error('Category is required'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Amount must be greater than 0'); return; }
    if (!form.expenseDate) { toast.error('Date is required'); return; }
    try {
      const payload = { ...form, expenseCategoryId: Number(form.expenseCategoryId), amount: Number(form.amount) };
      if (editItem) { await updateMut.mutateAsync({ id: editItem.id, data: payload }); toast.success('Expense updated'); }
      else { await createMut.mutateAsync(payload); toast.success('Expense created'); }
      setShowModal(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Operation failed'); }
  };

  const handleDelete = async (id) => {
    try { await deleteMut.mutateAsync(id); toast.success('Expense deleted'); setDeleteConfirm(null); }
    catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  return (
    <PosLayout active="expenses">
      <header className="pos-header">
        <div><h1>Expenses</h1><div className="sub">Track and manage business expenses</div></div>
        <div className="flex-wrap-sm">
          <div className="search pos-rel">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="input with-icon" placeholder="Search expenses..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            {search && <button onClick={() => { setSearch(''); setPage(1); }} className="search-clear">×</button>}
          </div>
          <input className="input text-sm" type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
          <span className="text-sm text-muted">to</span>
          <input className="input text-sm" type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} />
          {(dateFrom || dateTo) && (
            <button className="btn btn-outline btn-sm" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}>Clear Dates</button>
          )}
          <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Expense</button>
        </div>
      </header>

      <DataTable
        columns={columns}
        data={expenses}
        pagination={pagination}
        onPageChange={setPage}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        isLoading={isLoading}
        emptyMessage="No expenses found"
        renderRow={(e, _idx, visHeaders) => {
          const cellMap = {
            expenseDate: <td>{formatDate(e.expenseDate)}</td>,
            category: <td>{e.category?.name || '—'}</td>,
            description: <td>{e.description || '—'}</td>,
            amount: <td><strong>{peso(e.amount)}</strong></td>,
            paymentMethod: <td>{e.paymentMethod}</td>,
            actions: <td className="table-actions">
              {canEdit && <button className="btn btn-outline btn-sm" onClick={() => openEdit(e)}>✎ Edit</button>}
              {canDelete && <button className="btn btn-destructive btn-sm" onClick={() => setDeleteConfirm(e)}>🗑 Delete</button>}
            </td>,
          };
          return <tr key={e.id}>{visHeaders.map(c => cellMap[c.key])}</tr>;
        }}
      />

      {expenses.length > 0 && (
        <div className="summary-bar">
          <span>Total ({pagination?.total || expenses.length} expenses)</span>
          <span>{peso(data?.data?.totalAmount || expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0))}</span>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Expense' : 'Add Expense'}>
        <form onSubmit={handleSubmit}>
          <div className="two-col">
            <div className="field"><label>Category</label>
              <select className="input-block" value={form.expenseCategoryId} onChange={e => update('expenseCategoryId', e.target.value)} required>
                <option value="">Select</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Amount</label><input className="input-block" type="number" step="0.01" min="0" value={form.amount} onChange={e => update('amount', e.target.value)} required /></div>
          </div>
          <div className="field"><label>Description</label><textarea className="input-block" value={form.description} onChange={e => update('description', e.target.value)} rows={2} /></div>
          <div className="two-col">
            <div className="field"><label>Payment Method</label>
              <select className="input-block" value={form.paymentMethod} onChange={e => update('paymentMethod', e.target.value)}>
                <option value="cash">Cash</option><option value="gcash">GCash</option><option value="maya">Maya</option><option value="credit_card">Credit Card</option><option value="debit_card">Debit Card</option><option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
            <div className="field"><label>Date</label><input className="input-block" type="date" value={form.expenseDate} onChange={e => update('expenseDate', e.target.value)} required /></div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowModal(false)}>✕ Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={createMut.isPending || updateMut.isPending}>{(createMut.isPending || updateMut.isPending) && <span className="btn-spinner" />}{editItem ? 'Update' : '+ Create'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirm Delete">
        <p>Are you sure you want to delete this expense of <strong>{peso(deleteConfirm?.amount)}</strong>?</p>
        <div className="modal-actions">
          <button className="btn btn-outline btn-sm" onClick={() => setDeleteConfirm(null)}>✕ Cancel</button>
          <button className="btn btn-destructive btn-sm" onClick={() => handleDelete(deleteConfirm?.id)} disabled={deleteMut.isPending}>🗑 Delete</button>
        </div>
      </Modal>
    </PosLayout>
  );
}
