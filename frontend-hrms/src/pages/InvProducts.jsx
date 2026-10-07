import { useState } from 'react';
import ErrorState from '../components/ErrorState';
import { useQuery } from '@tanstack/react-query';
import posApi from '../api/posClient';
import DataTable from '../components/DataTable';
import useDebounce from '../hooks/useDebounce';
import { formatDate, peso } from '../utils/helpers';

const columns = [
  { key: 'sku', label: 'SKU', sortable: true },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'category', label: 'Category', sortable: false },
  { key: 'buyingPrice', label: 'Cost', sortable: true },
  { key: 'sellingPrice', label: 'Price', sortable: true },
  { key: 'stockQuantity', label: 'Stock', sortable: true },
  { key: 'status', label: 'Status', sortable: false },
];

export default function InvProducts() {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('DESC');
  // Clicking a header toggles the direction on the same column and jumps back to
  // the first page. The sort runs on the API (each service whitelists the columns
  // it accepts), so the whole list stays ordered rather than just the loaded page.
  const handleSort = (field) => {
    if (sortBy === field) setSortOrder((o) => (o === 'ASC' ? 'DESC' : 'ASC'));
    else { setSortBy(field); setSortOrder('ASC'); }
    setPage(1);
  };

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['inv-products', page, debouncedSearch, sortBy, sortOrder],
    queryFn: () => posApi.get('/products', { params: { page, limit: 15, search: debouncedSearch || undefined, sortBy, sortOrder } }).then(r => r.data.data),
  });

  const products = data?.products || [];
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
        <div><h1>Products</h1><div className="sub">{pagination?.totalItems || 0} products</div></div>
      </header>
      <div className="search-bar">
        <div className="flex-1 pos-rel">
          <input className="input-block" placeholder="Search products..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ width: '100%', paddingRight: search ? 28 : undefined }} />
          {search && <button onClick={() => { setSearch(''); setPage(1); }} className="search-clear" style={{ right: 6 }}>&times;</button>}
        </div>
      </div>
      <DataTable columns={columns} data={products} pagination={pagination} onPageChange={setPage} sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} isLoading={isLoading} emptyMessage="No products found"
        renderRow={(p, _idx, visHeaders) => {
          const cellMap = {
            sku: <td className="mono">{p.sku}</td>,
            name: <td><strong>{p.name}</strong>{p.brand && <div className="text-xs text-muted">{p.brand}</div>}</td>,
            category: <td>{p.category?.name || '—'}</td>,
            buyingPrice: <td>{peso(p.buyingPrice)}</td>,
            sellingPrice: <td>{peso(p.sellingPrice)}</td>,
            stockQuantity: <td><span className={`font-semibold ${p.stockQuantity <= (p.minStockLevel || 0) ? 'text-error' : ''}`}>{p.stockQuantity}</span></td>,
            status: <td><span className={`badge ${p.isActive ? 'success' : 'error'}`}>{p.isActive ? 'Active' : 'Inactive'}</span></td>,
          };
          return <tr key={p.id}>{visHeaders.map(c => cellMap[c.key])}</tr>;
        }}
      />
    </>
  );
}
