import { useState, useRef, useMemo } from 'react';
import PosLayout from '../layouts/PosLayout';
import { useBranches, useCreateBranch, useUpdateBranch, useDeleteBranch } from '../hooks/useApi';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import Map from '../components/Map';
import { useDebounce } from '../utils/helpers';

const EMPTY = { name: '', code: '', address: '', city: '', province: '', phone: '', email: '', latitude: '', longitude: '' };

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'code', label: 'Code', sortable: true },
  { key: 'location', label: 'Location', sortable: false },
  { key: 'phone', label: 'Phone', sortable: true },
  { key: 'manager', label: 'Manager', sortable: false },
  { key: 'status', label: 'Status', sortable: false },
  { key: 'actions', label: 'Actions', sortable: false },
];

export default function Branches() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('ASC');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [activeBranch, setActiveBranch] = useState(null);
  const mapRef = useRef(null);

  const toast = useToast();
  const { data, isLoading } = useBranches({ page, limit: 15, search: debouncedSearch || undefined, sortBy, sortOrder });
  const createMut = useCreateBranch();
  const updateMut = useUpdateBranch();
  const deleteMut = useDeleteBranch();

  const branches = data?.data?.branches || [];
  const pagination = data?.data?.pagination;

  const branchMarkers = useMemo(() => branches.map(b => ({
    id: b.id,
    latitude: b.latitude,
    longitude: b.longitude,
    name: b.name,
    code: b.code,
    location: [b.city, b.province].filter(Boolean).join(', ') || b.address || '',
  })), [branches]);

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const openAdd = () => { setEditItem(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (b) => {
    setEditItem(b);
    setForm({
      name: b.name, code: b.code || '', address: b.address || '', city: b.city || '',
      province: b.province || '', phone: b.phone || '', email: b.email || '',
      latitude: b.latitude || '', longitude: b.longitude || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Branch name is required'); return; }
    try {
      const payload = { ...form };
      if (payload.latitude) payload.latitude = parseFloat(payload.latitude);
      else delete payload.latitude;
      if (payload.longitude) payload.longitude = parseFloat(payload.longitude);
      else delete payload.longitude;

      if (editItem) { await updateMut.mutateAsync({ id: editItem.id, data: payload }); toast.success('Branch updated'); }
      else { await createMut.mutateAsync(payload); toast.success('Branch created'); }
      setShowModal(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Operation failed'); }
  };

  const handleDelete = async (id) => {
    try { await deleteMut.mutateAsync(id); toast.success('Branch deleted'); setDeleteConfirm(null); }
    catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const handleSort = (field) => {
    if (sortBy === field) setSortOrder(o => o === 'ASC' ? 'DESC' : 'ASC');
    else { setSortBy(field); setSortOrder(field === 'name' ? 'ASC' : 'DESC'); }
    setPage(1);
  };

  return (
    <PosLayout active="branches">
      <header className="pos-header">
        <div><h1>Branches</h1><div className="sub">Manage store locations</div></div>
        <div className="toolbar m-0">
          <div className="search pos-rel max-w-sm">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="input with-icon" placeholder="Search branches..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            {search && <button onClick={() => { setSearch(''); setPage(1); }} className="search-clear">×</button>}
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>＋ Add Branch</button>
        </div>
      </header>

      {branches.length > 0 && (
        <div className="table-wrap">
          <div className="flex-between flex-wrap-gap" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <div>
              <div className="font-semibold text-sm">Branch Locations</div>
              <div className="text-xs text-muted">{branches.filter(b => b.latitude && b.longitude).length} of {branches.length} branches with coordinates</div>
            </div>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => { setActiveBranch(null); mapRef.current?.fitAll(); }}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              <svg style={{ width: 14, height: 14, marginRight: 4, verticalAlign: -2 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Show All
            </button>
          </div>

          <div className="flex" style={{ minHeight: 380 }}>
            <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', maxHeight: 420 }}>
              {branches.map(b => {
                const hasCoords = b.latitude && b.longitude;
                const isActive = activeBranch?.id === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => {
                      if (!hasCoords) return;
                      setActiveBranch(b);
                      mapRef.current?.flyTo(parseFloat(b.latitude), parseFloat(b.longitude), 15);
                    }}
                    disabled={!hasCoords}
                    className="branch-list-item"
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                      border: 'none', borderBottom: '1px solid var(--border)',
                      background: isActive ? 'var(--primary-light, #fff7ed)' : 'transparent',
                      cursor: hasCoords ? 'pointer' : 'default',
                      borderLeft: isActive ? '3px solid var(--primary, #6366f1)' : '3px solid transparent',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => { if (!isActive && hasCoords) e.currentTarget.style.background = 'var(--muted, #f9fafb)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isActive ? 'var(--primary-light, #fff7ed)' : 'transparent'; }}
                  >
                    <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: hasCoords ? 'var(--fg)' : 'var(--muted-fg)', lineHeight: 1.3 }}>
                      <svg style={{ width: 12, height: 12, marginRight: 4, verticalAlign: -1, opacity: hasCoords ? 1 : 0.3 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      {b.name}
                    </div>
                    <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                      {[b.city, b.province].filter(Boolean).join(', ') || b.address || 'No location'}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex-1" style={{ minWidth: 0 }}>
              <Map
                ref={mapRef}
                height={380}
                markers={branchMarkers}
                onMarkerClick={(b) => { setActiveBranch(b); }}
              />
            </div>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={branches}
        pagination={pagination}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No branches found"
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        renderRow={(b, _idx, visHeaders) => {
          const cellMap = {
            name: <td><strong>{b.name}</strong></td>,
            code: <td><code style={{ background: 'var(--muted)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{b.code || '—'}</code></td>,
            location: <td>{[b.city, b.province].filter(Boolean).join(', ') || b.address || '—'}</td>,
            phone: <td>{b.phone || '—'}</td>,
            manager: <td>{b.manager ? `${b.manager.firstName} ${b.manager.lastName}` : '—'}</td>,
            status: <td>{b.isActive ? <span className="badge success">Active</span> : <span className="badge error">Inactive</span>}</td>,
            actions: <td className="table-actions">
              <button className="btn btn-outline btn-sm" onClick={() => openEdit(b)}>✎</button>
              <button className="btn btn-destructive btn-sm" onClick={() => setDeleteConfirm(b)}>🗑</button>
            </td>,
          };
          return <tr key={b.id}>{visHeaders.map(c => cellMap[c.key])}</tr>;
        }}
      />

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Branch' : 'Add Branch'}>
        <form onSubmit={handleSubmit}>
          <div className="two-col">
            <div className="field"><label>Name <span className="text-error">*</span></label><input className="input-block" value={form.name} onChange={e => update('name', e.target.value)} required /></div>
            <div className="field"><label>Code</label><input className="input-block" value={form.code} onChange={e => update('code', e.target.value)} placeholder="e.g. BR001" /></div>
          </div>
          <div className="field"><label>Address</label><textarea className="input-block" value={form.address} onChange={e => update('address', e.target.value)} rows={2} /></div>
          <div className="two-col">
            <div className="field"><label>City</label><input className="input-block" value={form.city} onChange={e => update('city', e.target.value)} /></div>
            <div className="field"><label>Province</label><input className="input-block" value={form.province} onChange={e => update('province', e.target.value)} /></div>
          </div>
          <div className="two-col">
            <div className="field"><label>Phone</label><input className="input-block" value={form.phone} onChange={e => update('phone', e.target.value)} /></div>
            <div className="field"><label>Email</label><input className="input-block" type="email" value={form.email} onChange={e => update('email', e.target.value)} /></div>
          </div>
          <div className="two-col">
            <div className="field"><label>Latitude</label><input className="input-block" type="number" step="any" min="-90" max="90" value={form.latitude} onChange={e => update('latitude', e.target.value)} placeholder="e.g. 14.5995" /></div>
            <div className="field"><label>Longitude</label><input className="input-block" type="number" step="any" min="-180" max="180" value={form.longitude} onChange={e => update('longitude', e.target.value)} placeholder="e.g. 120.9842" /></div>
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
        <p>Are you sure you want to delete branch <strong>{deleteConfirm?.name}</strong>?</p>
        <div className="modal-actions">
          <button className="btn btn-outline btn-sm" onClick={() => setDeleteConfirm(null)}>✕ Cancel</button>
          <button className="btn btn-destructive btn-sm" onClick={() => handleDelete(deleteConfirm?.id)} disabled={deleteMut.isPending}>🗑 Delete</button>
        </div>
      </Modal>
    </PosLayout>
  );
}
