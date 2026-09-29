import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import posApi from '../api/posClient';
import DataTable from '../components/DataTable';
import useDebounce from '../hooks/useDebounce';
import { formatDate, peso } from '../utils/helpers';

const columns = [
  { key: 'orderNo', label: 'PO #', sortable: true },
  { key: 'supplier', label: 'Supplier', sortable: false },
  { key: 'createdAt', label: 'Date', sortable: true },
  { key: 'total', label: 'Total', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'paymentMethod', label: 'Payment', sortable: false },
];

const STATUS_COLORS = { pending: 'warning', ordered: 'info', partial: 'warning', received: 'success', cancelled: 'error' };
const PAYMENT_COLORS = { pending: 'warning', partial: 'info', paid: 'success' };

export default function InvPurchases() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const debouncedSearch = useDebounce(search);

  const { data, isLoading } = useQuery({
    queryKey: ['inv-purchases', page, debouncedSearch, statusFilter],
    queryFn: () => posApi.get('/purchases', { params: { page, limit: 15, search: debouncedSearch || undefined, status: statusFilter || undefined } }).then(r => r.data.data),
  });

  const purchases = data?.purchases || [];
  const pagination = data?.pagination;

  return (
    <>
      <header className="pos-header">
        <div><h1>Purchases</h1><div className="sub">{pagination?.totalItems || 0} orders</div></div>
      </header>
      <div className="search-bar">
        <select className="input-block" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={{ width: 160 }}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="ordered">Ordered</option>
          <option value="partial">Partial</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <div className="flex-1 pos-rel">
          <input className="input-block" placeholder="Search purchases..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ width: '100%', paddingRight: search ? 28 : undefined }} />
          {search && <button onClick={() => { setSearch(''); setPage(1); }} className="search-clear" style={{ right: 6 }}>&times;</button>}
        </div>
      </div>
      <DataTable columns={columns} data={purchases} pagination={pagination} onPageChange={setPage} isLoading={isLoading} emptyMessage="No purchases found"
        renderRow={(p, _idx, visHeaders) => {
          const cellMap = {
            orderNo: <td className="mono">{p.orderNo}</td>,
            supplier: <td>{p.supplier?.name || '—'}</td>,
            date: <td>{formatDate(p.orderDate)}</td>,
            total: <td className="total-amount">{peso(p.total)}</td>,
            status: <td><span className={`badge ${STATUS_COLORS[p.status] || 'info'}`}>{p.status}</span></td>,
            payment: <td><span className={`badge ${PAYMENT_COLORS[p.paymentStatus] || 'info'}`}>{p.paymentStatus}</span></td>,
          };
          return <tr key={p.id}>{visHeaders.map(c => cellMap[c.key])}</tr>;
        }}
      />
    </>
  );
}
