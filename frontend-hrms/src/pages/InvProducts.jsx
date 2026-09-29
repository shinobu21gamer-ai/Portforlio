import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import posApi from '../api/posClient';
import DataTable from '../components/DataTable';
import useDebounce from '../hooks/useDebounce';
import { formatDate, peso } from '../utils/helpers';

const columns = [
  { key: 'sku', label: 'SKU', sortable: true },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'category', label: 'Category', sortable: false },
  { key: 'price', label: 'Cost', sortable: true },
  { key: 'sellingPrice', label: 'Price', sortable: true },
  { key: 'stockQuantity', label: 'Stock', sortable: true },
  { key: 'status', label: 'Status', sortable: false },
];

export default function InvProducts() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);

  const { data, isLoading } = useQuery({
    queryKey: ['inv-products', page, debouncedSearch],
    queryFn: () => posApi.get('/products', { params: { page, limit: 15, search: debouncedSearch || undefined } }).then(r => r.data.data),
  });

  const products = data?.products || [];
  const pagination = data?.pagination;

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
      <DataTable columns={columns} data={products} pagination={pagination} onPageChange={setPage} isLoading={isLoading} emptyMessage="No products found"
        renderRow={(p, _idx, visHeaders) => {
          const cellMap = {
            sku: <td className="mono">{p.sku}</td>,
            name: <td><strong>{p.name}</strong>{p.brand && <div className="text-xs text-muted">{p.brand}</div>}</td>,
            category: <td>{p.category?.name || '—'}</td>,
            buyingPrice: <td>{peso(p.buyingPrice)}</td>,
            sellingPrice: <td>{peso(p.sellingPrice)}</td>,
            stock: <td><span className={`font-semibold ${p.stockQuantity <= (p.minStockLevel || 0) ? 'text-error' : ''}`}>{p.stockQuantity}</span></td>,
            status: <td><span className={`badge ${p.isActive ? 'success' : 'error'}`}>{p.isActive ? 'Active' : 'Inactive'}</span></td>,
          };
          return <tr key={p.id}>{visHeaders.map(c => cellMap[c.key])}</tr>;
        }}
      />
    </>
  );
}
