import { useState } from 'react';
import ErrorState from '../components/ErrorState';
import { useQuery } from '@tanstack/react-query';
import posApi from '../api/posClient';
import DataTable from '../components/DataTable';
import useDebounce from '../hooks/useDebounce';
import { formatDate } from '../utils/helpers';

const columns = [
  { key: 'date', label: 'Date', sortable: true },
  { key: 'product', label: 'Product', sortable: false },
  { key: 'type', label: 'Type', sortable: true },
  { key: 'quantity', label: 'Qty', sortable: true },
  { key: 'previous', label: 'Prev Stock', sortable: false },
  { key: 'new', label: 'New Stock', sortable: false },
  { key: 'user', label: 'By', sortable: false },
];

const TYPE_COLORS = { in: 'success', out: 'error', adjustment: 'warning' };

export default function InvInventory() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const debouncedSearch = useDebounce(search);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['inv-movements', page, debouncedSearch, typeFilter],
    queryFn: () => posApi.get('/inventory/movements', { params: { page, limit: 15, search: debouncedSearch || undefined, type: typeFilter || undefined } }).then(r => r.data.data),
  });

  const movements = data?.movements || [];
  const pagination = data?.pagination;

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
        <div><h1>Inventory Movements</h1><div className="sub">{pagination?.totalItems || 0} records</div></div>
      </header>
      <div className="search-bar">
        <select className="input-block" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} style={{ width: 160 }}>
          <option value="">All Types</option>
          <option value="in">Stock In</option>
          <option value="out">Stock Out</option>
          <option value="adjustment">Adjustment</option>
        </select>
        <div className="flex-1 pos-rel">
          <input className="input-block" placeholder="Search products..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ width: '100%', paddingRight: search ? 28 : undefined }} />
          {search && <button onClick={() => { setSearch(''); setPage(1); }} className="search-clear" style={{ right: 6 }}>&times;</button>}
        </div>
      </div>
      <DataTable columns={columns} data={movements} pagination={pagination} onPageChange={setPage} isLoading={isLoading} emptyMessage="No movements found"
        renderRow={(m, _idx, visHeaders) => {
          const cellMap = {
            date: <td>{formatDate(m.createdAt)}</td>,
            product: <td><strong>{m.product?.name || '—'}</strong><div className="text-xs text-muted">{m.product?.sku}</div></td>,
            type: <td><span className={`badge ${TYPE_COLORS[m.type] || 'info'}`}>{m.type}</span></td>,
            quantity: <td className="font-semibold">{m.type === 'out' ? '-' : '+'}{m.quantity}</td>,
            previous: <td>{m.previousStock}</td>,
            new: <td>{m.newStock}</td>,
            user: <td>{m.user ? `${m.user.firstName} ${m.user.lastName}` : '—'}</td>,
          };
          return <tr key={m.id}>{visHeaders.map(c => cellMap[c.key])}</tr>;
        }}
      />
    </>
  );
}
