import { useState } from 'react';
import PosLayout from '../layouts/PosLayout';
import { useDashboard } from '../hooks/useApi';
import useAuthStore from '../store/authStore';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { peso, formatDateTime, statusBadge } from '../utils/helpers';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const CHART_COLORS = ['#6366f1', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b', '#06b6d4', '#ec4899'];

const chartContainerStyle = {
  background: 'var(--muted, #f4f4f5)',
  borderRadius: '12px',
  padding: '20px',
  marginBottom: '16px',
};

const pieContainerStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '16px',
  marginBottom: '16px',
};

const emptyChartStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 300,
  color: 'var(--muted-fg, #999)',
  fontSize: 14,
};

function EmptyChart({ text = 'No data available' }) {
  return <div style={emptyChartStyle}>{text}</div>;
}

export default function Dashboard() {
  const { data, isLoading, error } = useDashboard();
  const user = useAuthStore(s => s.user);
  const role = user?.role?.slug;
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isCashier = role === 'cashier';
  const isInventory = role === 'inventory_staff';

  if (isLoading) return <PosLayout active="dashboard"><LoadingSkeleton type="cards" /></PosLayout>;
  if (error) return <PosLayout active="dashboard"><div className="empty-state"><div className="icon">⚠️</div><h3>Failed to load dashboard</h3><p>{error.message}</p></div></PosLayout>;

  const d = data || {};

  const formatShortDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  };

  const dailySalesData = d.dailySales?.length > 0
    ? d.dailySales.map(s => ({ name: formatShortDate(s.date || s.label), revenue: s.revenue || s.totalRevenue || 0, sales: s.sales || 0 }))
    : [];

  const paymentData = d.paymentMethods?.length > 0
    ? d.paymentMethods.map(pm => ({ name: pm.method || pm.paymentMethod, value: pm.count || pm.total || 0 }))
    : [];

  const categoryData = d.categorySales?.length > 0
    ? d.categorySales.map(c => ({ name: c.category || c.categoryName, value: c.totalRevenue || c.revenue || 0 }))
    : [];

  const bestSellersBarData = d.bestSellers?.length > 0
    ? d.bestSellers.slice(0, 8).map(p => ({ name: p.productName, sold: p.totalSold }))
    : [];

  const greeting = isCashier ? 'Ready for transactions!' : isInventory ? 'Stock levels at a glance.' : "Here's what's happening today.";

  return (
    <PosLayout active="dashboard">
      <header className="pos-header">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">Welcome back! {greeting}</div>
        </div>
      </header>

      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="label">Today's Sales</div>
          <div className="value">{peso(d.todaySales?.totalRevenue)}</div>
          <div className="change text-success">{d.todaySales?.totalSales || 0} transactions</div>
        </div>
        {(isAdmin || isManager) && (
          <>
            <div className="stat-card">
              <div className="label">Monthly Sales</div>
              <div className="value">{peso(d.monthlySales?.totalRevenue)}</div>
              <div className="change text-success">{d.monthlySales?.totalSales || 0} transactions</div>
            </div>
            <div className="stat-card">
              <div className="label">Total Customers</div>
              <div className="value">{d.totalCustomers}</div>
            </div>
            <div className="stat-card">
              <div className="label">Today's Expenses</div>
              <div className="value text-error">{peso(d.todayExpenses)}</div>
            </div>
            <div className="stat-card">
              <div className="label">Monthly Expenses</div>
              <div className="value text-error">{peso(d.monthlyExpenses)}</div>
            </div>
            <div className="stat-card">
              <div className="label">Net Profit (After Expenses)</div>
              <div className="value" style={{ color: (d.monthlySales?.netProfit || 0) >= 0 ? 'var(--success)' : 'var(--error)' }}>
                {peso(d.monthlySales?.netProfit)}
              </div>
              <div className="change text-muted">Gross: {peso(d.monthlySales?.totalProfit)} - Expenses: {peso(d.monthlyExpenses)}</div>
            </div>
          </>
        )}
        {isCashier && (
          <>
            <div className="stat-card">
              <div className="label">Total Customers</div>
              <div className="value">{d.totalCustomers}</div>
            </div>
          </>
        )}
        {isInventory && (
          <>
            <div className="stat-card">
              <div className="label">Low Stock Items</div>
              <div className="value" style={{ color: (d.lowStockProducts?.length || 0) > 0 ? 'var(--error)' : 'var(--success)' }}>
                {d.lowStockProducts?.length || 0}
              </div>
            </div>
          </>
        )}
      </div>

      {(isAdmin || isManager) && dailySalesData.length > 0 && (
        <div className="dashboard-section">
          <h2>📈 Sales Trend</h2>
          <div style={chartContainerStyle}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailySalesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--muted, #f4f4f5)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value, name) => [name === 'revenue' ? peso(value) : value, name === 'revenue' ? 'Revenue' : 'Sales']} />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--primary, #6366f1)"
                  strokeWidth={3}
                  dot={{ fill: 'var(--primary, #6366f1)', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="sales"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#3b82f6', r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {(isAdmin || isManager) && (paymentData.length > 0 || categoryData.length > 0) && (
        <div style={pieContainerStyle}>
          {paymentData.length > 0 && (
            <div className="dashboard-section">
              <h2>💳 Payment Methods</h2>
              <div style={chartContainerStyle}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={paymentData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {paymentData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => [value, 'Count']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {categoryData.length > 0 && (
            <div className="dashboard-section">
              <h2>🏷️ Top Categories</h2>
              <div style={chartContainerStyle}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {categoryData.map((_, i) => <Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => [peso(value), 'Revenue']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {(isAdmin || isManager) && bestSellersBarData.length > 0 && (
        <div className="dashboard-section">
          <h2>📊 Best Sellers</h2>
          <div style={chartContainerStyle}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={bestSellersBarData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--muted, #f4f4f5)" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => [value, 'Units Sold']} />
                <Legend />
                <Bar dataKey="sold" fill="var(--primary, #6366f1)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {dailySalesData.length === 0 && paymentData.length === 0 && (
        <div className="dashboard-section">
          <EmptyChart text="No sales data yet. Complete a sale to see charts here." />
        </div>
      )}

      {(isAdmin || isManager || isInventory) && d.lowStockProducts?.length > 0 && (
        <div className="dashboard-section">
          <h2>⚠️ Low Stock Products</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Product</th><th>SKU</th><th>Stock</th><th>Min Level</th></tr></thead>
              <tbody>
                {d.lowStockProducts.map(p => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.sku}</td>
                    <td><span className="badge error">{p.stockQuantity}</span></td>
                    <td>{p.minStockLevel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(isAdmin || isManager) && d.recentTransactions?.length > 0 && (
        <div className="dashboard-section">
          <h2>📋 Recent Transactions</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Invoice</th><th>Customer</th><th>Cashier</th><th>Total</th><th>Payment</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {d.recentTransactions.map(t => (
                  <tr key={t.id}>
                    <td>{t.invoiceNo}</td>
                    <td>{t.customer}</td>
                    <td>{t.cashier}</td>
                    <td>{peso(t.total)}</td>
                    <td>{t.paymentMethod}</td>
                    <td>{statusBadge(t.status)}</td>
                    <td>{formatDateTime(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PosLayout>
  );
}
