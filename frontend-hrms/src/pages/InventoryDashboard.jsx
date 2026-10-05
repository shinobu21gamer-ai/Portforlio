import { useQuery } from '@tanstack/react-query';
import ErrorState from '../components/ErrorState';
import useAuthStore from '../store/authStore';
import { peso } from '../utils/helpers';
import posApi from '../api/posClient';

export default function InventoryDashboard() {
  const user = useAuthStore(s => s.user);

  const { data: productsRes, isLoading: productsLoading, isError: productsError, refetch: refetchProducts } = useQuery({
    queryKey: ['inv-products'],
    queryFn: () => posApi.get('/products?limit=100').then(r => r.data),
  });

  const { data: purchasesRes, isLoading: purchasesLoading, isError: purchasesError } = useQuery({
    queryKey: ['inv-purchases'],
    queryFn: () => posApi.get('/purchases?limit=50').then(r => r.data),
  });

  const { data: suppliersRes } = useQuery({
    queryKey: ['inv-suppliers'],
    queryFn: () => posApi.get('/suppliers?limit=100').then(r => r.data),
  });

  const products = productsRes?.data?.products || [];
  const purchases = purchasesRes?.data?.purchases || [];
  const suppliers = suppliersRes?.data?.suppliers || [];

  const totalProducts = productsRes?.data?.pagination?.total || products.length;
  const lowStockProducts = products.filter(p => p.stockQuantity <= (p.minStockLevel || 5));
  const outOfStock = products.filter(p => p.stockQuantity === 0);
  const totalStockValue = products.reduce((sum, p) => sum + (p.stockQuantity * (p.buyingPrice || 0)), 0);
  const pendingPurchases = purchases.filter(p => p.status === 'pending' || p.status === 'ordered');
  const totalPurchaseValue = pendingPurchases.reduce((sum, p) => sum + (p.total - (p.paidAmount || 0)), 0);

  const stats = [
    { label: 'Total Products', value: totalProducts, color: 'var(--primary)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> },
    { label: 'Low Stock Items', value: lowStockProducts.length, color: lowStockProducts.length > 0 ? 'var(--warning)' : 'var(--success)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
    { label: 'Out of Stock', value: outOfStock.length, color: outOfStock.length > 0 ? 'var(--error)' : 'var(--success)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> },
    { label: 'Stock Value', value: peso(totalStockValue), color: 'var(--info)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
    { label: 'Suppliers', value: suppliers.length, color: '#8b5cf6', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { label: 'Pending Purchases', value: pendingPurchases.length, color: 'var(--warning)', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> },
  ];

  if (productsError || purchasesError) {
    return (
      <div className="page-error-wrap">
        <ErrorState message={null || 'Something went wrong while loading this data.'} onRetry={() => refetchProducts()} />
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Inventory Dashboard</h1>
          <div className="sub">Welcome back, {user?.firstName}</div>
        </div>
      </div>

      <div className="dashboard-grid mb-lg" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {stats.map((s, i) => (
          <div key={i} className="stat-card">
            <div className="flex items-center gap-sm mb-xs">
              <div className="flex-center" style={{ width: 36, height: 36, borderRadius: 10, background: `${s.color}15`, color: s.color }}>{s.icon}</div>
              <div className="text-xs text-muted font-semibold">{s.label}</div>
            </div>
            <div className="value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div className="dashboard-section">
          <h2 className="font-size-18 font-bold mb-md flex items-center gap-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Low Stock Alerts
          </h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Current Stock</th>
                  <th>Threshold</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.slice(0, 10).map(p => (
                  <tr key={p.id}>
                    <td className="font-semibold">{p.name}</td>
                    <td className="text-muted">{p.sku || '—'}</td>
                    <td><strong className={p.stockQuantity === 0 ? 'text-error' : 'text-warning'}>{p.stockQuantity}</strong></td>
                    <td>{p.minStockLevel || 5}</td>
                    <td>
                      <span className={`badge ${p.stockQuantity === 0 ? 'error' : 'warning'}`}>
                        {p.stockQuantity === 0 ? 'Out of Stock' : 'Low Stock'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Purchases */}
      <div className="dashboard-section">
        <h2 className="font-size-18 font-bold mb-md">Recent Purchases</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PO #</th>
                <th>Supplier</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {purchasesLoading ? (
                <tr><td colSpan={5} className="text-center p-md text-muted">Loading...</td></tr>
              ) : purchases.length === 0 ? (
                <tr><td colSpan={5} className="text-center p-md text-muted">No purchases yet</td></tr>
              ) : (
                purchases.slice(0, 10).map(p => (
                  <tr key={p.id}>
                    <td className="font-semibold">PO-{String(p.id).padStart(4, '0')}</td>
                    <td>{p.supplier?.name || '—'}</td>
                    <td>{peso(p.total)}</td>
                    <td>
                      <span className={`badge ${p.status === 'completed' ? 'success' : p.status === 'cancelled' ? 'error' : p.status === 'received' ? 'info' : 'warning'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="text-muted font-size-14">{new Date(p.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
