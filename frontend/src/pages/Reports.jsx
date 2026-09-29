import { useState } from 'react';
import PosLayout from '../layouts/PosLayout';
import { useSalesReport, useSales, useExpenseReport } from '../hooks/useApi';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { peso, formatDate, formatDateTime, statusBadge, useDebounce } from '../utils/helpers';

function downloadCsv(filename, rows, headers) {
  const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState('sales');
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [salesPage, setSalesPage] = useState(1);
  const [search, setSearch] = useState('');

  const debouncedSearch = useDebounce(search, 300);
  const { data: salesReport, isLoading: salesLoading } = useSalesReport({ startDate, endDate });
  const { data: expenseReport, isLoading: expenseLoading } = useExpenseReport({ startDate, endDate });
  const { data: salesData, isLoading: salesListLoading } = useSales({ page: salesPage, limit: 15, startDate, endDate, search: debouncedSearch || undefined });

  const reportData = salesReport || {};
  const expenseData = expenseReport || {};
  const salesList = salesData?.sales || salesData?.data?.sales || [];

  const exportSalesCsv = () => {
    const days = Object.entries(reportData.dailyBreakdown || {});
    if (days.length === 0) return;
    downloadCsv(`sales-report-${startDate}-to-${endDate}.csv`, days.map(([day, d]) => [day, d.sales, d.revenue, d.profit]), ['Date', 'Sales', 'Revenue', 'Profit']);
  };

  const exportExpenseCsv = () => {
    const cats = Object.entries(expenseData.byCategory || {});
    if (cats.length === 0) return;
    downloadCsv(`expense-report-${startDate}-to-${endDate}.csv`, cats.map(([name, cat]) => [name, cat.count, cat.total]), ['Category', 'Count', 'Total']);
  };

  const exportTransactionsCsv = () => {
    if (salesList.length === 0) return;
    downloadCsv(`transactions-${startDate}-to-${endDate}.csv`, salesList.map(s => [
      s.invoiceNo,
      s.customer ? `${s.customer.firstName || ''} ${s.customer.lastName || ''}`.trim() || 'Walk-in' : 'Walk-in',
      s.user ? `${s.user.firstName || ''} ${s.user.lastName || ''}`.trim() : 'N/A',
      s.total,
      s.paymentMethod || 'cash',
      s.status,
      s.createdAt,
    ]), ['Invoice', 'Customer', 'Cashier', 'Total', 'Payment', 'Status', 'Date']);
  };

  return (
    <PosLayout active="reports">
      <header className="pos-header">
        <div><h1>Reports</h1><div className="sub">Sales, expenses, and performance analytics</div></div>
        <div className="flex-gap">
          {activeTab === 'sales' && reportData.dailyBreakdown && Object.keys(reportData.dailyBreakdown).length > 0 && (
            <button className="btn btn-outline btn-sm" onClick={exportSalesCsv}>Export Sales CSV</button>
          )}
          {activeTab === 'expenses' && expenseData.byCategory && Object.keys(expenseData.byCategory).length > 0 && (
            <button className="btn btn-outline btn-sm" onClick={exportExpenseCsv}>Export Expenses CSV</button>
          )}
          {activeTab === 'transactions' && salesList.length > 0 && (
            <button className="btn btn-outline btn-sm" onClick={exportTransactionsCsv}>Export Transactions CSV</button>
          )}
        </div>
      </header>

      <div className="toolbar">
          <div className="field m-0">
            <label className="text-xs font-semibold">From</label>
            <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '8px 14px' }} />
          </div>
          <div className="field m-0">
            <label className="text-xs font-semibold">To</label>
            <input className="input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '8px 14px' }} />
          </div>
        {activeTab === 'transactions' && (
          <div className="search">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="input with-icon" placeholder="Search by invoice or customer..." value={search} onChange={e => { setSearch(e.target.value); setSalesPage(1); }} />
            {search && (
              <button onClick={() => { setSearch(''); setSalesPage(1); }} className="search-clear">
                ×
              </button>
            )}
          </div>
        )}
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'sales' ? 'active' : ''}`} onClick={() => setActiveTab('sales')}>Sales</button>
        <button className={`tab ${activeTab === 'expenses' ? 'active' : ''}`} onClick={() => setActiveTab('expenses')}>Expenses</button>
        <button className={`tab ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => setActiveTab('transactions')}>Transactions</button>
      </div>

      {activeTab === 'sales' && (
        salesLoading ? <LoadingSkeleton type="cards" /> : (
          <>
            <div className="dashboard-grid">
              <div className="stat-card"><div className="label">Total Sales</div><div className="value">{reportData.totalSales || 0}</div></div>
              <div className="stat-card"><div className="label">Total Revenue</div><div className="value">{peso(reportData.totalRevenue)}</div></div>
              <div className="stat-card"><div className="label">Total Profit</div><div className="value text-success">{peso(reportData.totalProfit)}</div></div>
              <div className="stat-card"><div className="label">Avg. Order Value</div><div className="value">{peso(reportData.averageOrderValue)}</div></div>
            </div>
            {reportData.dailyBreakdown && Object.keys(reportData.dailyBreakdown).length > 0 ? (
              <div className="dashboard-section">
                <h2>Daily Breakdown</h2>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Date</th><th>Sales</th><th>Revenue</th><th>Profit</th></tr></thead>
                    <tbody>
                      {Object.entries(reportData.dailyBreakdown).map(([day, d]) => (
                        <tr key={day}><td>{formatDate(day)}</td><td>{d.sales}</td><td>{peso(d.revenue)}</td><td>{peso(d.profit)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="icon">📊</div>
                <h3>No sales data for this period</h3>
                <p className="text-muted mt-sm">Complete some transactions to see analytics here.</p>
              </div>
            )}
          </>
        )
      )}

      {activeTab === 'expenses' && (
        expenseLoading ? <LoadingSkeleton type="cards" /> : (
          <>
            <div className="dashboard-grid">
              <div className="stat-card"><div className="label">Total Expenses</div><div className="value">{peso(expenseData.totalExpenses || 0)}</div></div>
              <div className="stat-card"><div className="label">Total Transactions</div><div className="value">{expenseData.totalCount || 0}</div></div>
              <div className="stat-card"><div className="label">Period</div><div className="value font-size-14">{formatDate(expenseData.period?.startDate)} - {formatDate(expenseData.period?.endDate)}</div></div>
            </div>
            {expenseData.byCategory && Object.keys(expenseData.byCategory).length > 0 ? (
              <div className="dashboard-section">
                <h2>Expenses by Category</h2>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Category</th><th>Count</th><th>Total</th></tr></thead>
                    <tbody>
                      {Object.entries(expenseData.byCategory).map(([name, cat]) => (
                        <tr key={name}><td><strong>{name}</strong></td><td>{cat.count}</td><td>{peso(cat.total)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="icon">💰</div>
                <h3>No expenses for this period</h3>
                <p className="text-muted mt-sm">Record expenses to see them in reports.</p>
              </div>
            )}
          </>
        )
      )}

      {activeTab === 'transactions' && (
        salesListLoading ? <LoadingSkeleton rows={10} cols={6} /> : (
          salesList.length === 0 ? (
            <div className="empty-state">
              <div className="icon">📋</div>
              <h3>No transactions found</h3>
                <p className="text-muted mt-sm">Transactions will appear here once sales are made.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Invoice</th><th>Customer</th><th>Cashier</th><th>Total</th><th>Payment</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {salesList.map(s => (
                    <tr key={s.id}>
                      <td><strong>{s.invoiceNo}</strong></td>
                      <td>{s.customer ? `${s.customer.firstName || ''} ${s.customer.lastName || ''}`.trim() || 'Walk-in' : 'Walk-in'}</td>
                      <td>{s.user ? `${s.user.firstName || ''} ${s.user.lastName || ''}`.trim() : 'N/A'}</td>
                      <td>{peso(s.total)}</td>
                      <td><span className="badge info">{(s.paymentMethod || 'cash').replace(/_/g, ' ')}</span></td>
                      <td>{statusBadge(s.status)}</td>
                      <td>{formatDateTime(s.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )
      )}
    </PosLayout>
  );
}
