import { useState } from 'react';
import { useFinanceReport, useCashflow } from '../../hooks/useApi';
import DataTable from '../../components/DataTable';
import { peso } from '../../utils/helpers';

const pnlColumns = [
  { key: 'date', label: 'Date', sortable: false },
  { key: 'sales', label: 'Sales', sortable: false },
  { key: 'revenue', label: 'Revenue', sortable: false },
  { key: 'tax', label: 'Tax', sortable: false },
  { key: 'discounts', label: 'Discounts', sortable: false },
  { key: 'grossProfit', label: 'Gross Profit', sortable: false },
  { key: 'expenses', label: 'Expenses', sortable: false },
  { key: 'netProfit', label: 'Net Profit', sortable: false },
];

const taxColumns = [
  { key: 'method', label: 'Payment Method', sortable: false },
  { key: 'count', label: 'Transactions', sortable: false },
  { key: 'total', label: 'Total Sales', sortable: false },
  { key: 'tax', label: 'Tax Collected', sortable: false },
];

const PRESETS = [
  { label: 'Today', getRange: () => { const d = new Date(); return { from: d.toISOString().split('T')[0], to: d.toISOString().split('T')[0] }; } },
  { label: 'This Week', getRange: () => { const d = new Date(), day = d.getDay(), start = new Date(d); start.setDate(d.getDate() - day); return { from: start.toISOString().split('T')[0], to: d.toISOString().split('T')[0] }; } },
  { label: 'This Month', getRange: () => { const d = new Date(); return { from: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0], to: d.toISOString().split('T')[0] }; } },
  { label: 'Last Month', getRange: () => { const d = new Date(); return { from: new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0], to: new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0] }; } },
  { label: 'This Quarter', getRange: () => { const d = new Date(), q = Math.floor(d.getMonth() / 3); return { from: new Date(d.getFullYear(), q * 3, 1).toISOString().split('T')[0], to: d.toISOString().split('T')[0] }; } },
  { label: 'This Year', getRange: () => { const d = new Date(); return { from: `${d.getFullYear()}-01-01`, to: d.toISOString().split('T')[0] }; } },
];

export default function FinancePnL() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeTab, setActiveTab] = useState('pnl');
  const [activePreset, setActivePreset] = useState('');

  const params = {};
  if (dateFrom) params.startDate = dateFrom;
  if (dateTo) params.endDate = dateTo;

  const { data: pnlData, isLoading: pnlLoading } = useFinanceReport(params);
  const { data: cfData, isLoading: cfLoading } = useCashflow(params);

  const report = pnlData?.data;
  const cashflow = cfData?.data;
  const s = report?.summary || {};

  const applyPreset = (preset, idx) => {
    const range = preset.getRange();
    setDateFrom(range.from);
    setDateTo(range.to);
    setActivePreset(idx);
  };

  const clearDates = () => { setDateFrom(''); setDateTo(''); setActivePreset(''); };

  const marginClass = (s.profitMargin || 0) >= 0 ? 'positive' : 'negative';

  return (
    <>
      <header className="pos-header">
        <div>
          <h1>Profit &amp; Loss</h1>
          <div className="sub">P&amp;L, tax summary, and cash flow for the selected period</div>
        </div>
        <div className="finance-filters">
          <input className="input" type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setActivePreset(''); }} />
          <span className="text-muted font-size-14">to</span>
          <input className="input" type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setActivePreset(''); }} />
          {(dateFrom || dateTo) && <button className="btn btn-outline btn-sm" onClick={clearDates}>Clear</button>}
        </div>
      </header>

      <div className="finance-presets mb-md">
        {PRESETS.map((p, i) => (
          <button key={i} className={`btn btn-sm ${activePreset === i ? 'btn-primary' : 'btn-outline'}`} onClick={() => applyPreset(p, i)}>{p.label}</button>
        ))}
      </div>

      <div className="finance-summary">
        <div className="finance-stat revenue">
          <div className="stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div className="stat-label">Total Revenue</div>
          <div className="stat-value text-primary">{peso(s.totalRevenue)}</div>
          <div className="stat-sub">{s.totalSales || 0} sales</div>
        </div>
        <div className="finance-stat cogs">
          <div className="stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          </div>
          <div className="stat-label">Cost of Goods</div>
          <div className="stat-value text-error">{peso(s.totalCOGS)}</div>
        </div>
        <div className="finance-stat gross">
          <div className="stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          </div>
          <div className="stat-label">Gross Profit</div>
          <div className="stat-value text-success">{peso(s.grossProfit)}</div>
        </div>
        <div className="finance-stat expenses">
          <div className="stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          </div>
          <div className="stat-label">Expenses</div>
          <div className="stat-value text-error">{peso(s.totalExpenses)}</div>
          <div className="stat-sub">{s.expenseCount || 0} items</div>
        </div>
        <div className="finance-stat net">
          <div className="stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>
          </div>
          <div className="stat-label">Net Profit</div>
          <div className="stat-value" style={{ color: (s.netProfit || 0) >= 0 ? 'var(--success)' : 'var(--error)' }}>{peso(s.netProfit)}</div>
          <div className={`finance-margin ${marginClass}`}>{s.profitMargin || 0}% margin</div>
        </div>
        <div className="finance-stat tax">
          <div className="stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
          <div className="stat-label">Tax Collected</div>
          <div className="stat-value" style={{ color: '#8b5cf6' }}>{peso(s.totalTax)}</div>
          <div className="stat-sub">{peso(s.totalDiscounts)} discounts</div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'pnl' ? 'active' : ''}`} onClick={() => setActiveTab('pnl')}>P&L Breakdown</button>
        <button className={`tab ${activeTab === 'tax' ? 'active' : ''}`} onClick={() => setActiveTab('tax')}>Tax Summary</button>
        <button className={`tab ${activeTab === 'cashflow' ? 'active' : ''}`} onClick={() => setActiveTab('cashflow')}>Cash Flow</button>
      </div>

      {activeTab === 'pnl' && (
        <DataTable
          columns={pnlColumns}
          data={(report?.dailyPnl || []).map(d => ({
            ...d,
            revenue: peso(d.revenue),
            tax: peso(d.tax),
            discounts: peso(d.discounts),
            grossProfit: <span className={d.grossProfit >= 0 ? 'text-success' : 'text-error'}>{peso(d.grossProfit)}</span>,
            expenses: <span className="text-error">{peso(d.expenses)}</span>,
            netProfit: <strong className={d.netProfit >= 0 ? 'text-success' : 'text-error'}>{peso(d.netProfit)}</strong>,
          }))}
          isLoading={pnlLoading}
          emptyMessage="No data for selected period"
        />
      )}

      {activeTab === 'tax' && (
        <DataTable
          columns={taxColumns}
          data={(report?.taxBreakdown || []).map(t => ({
            ...t,
            method: t.method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            total: peso(t.total),
            tax: <strong className="text-accent">{peso(t.tax)}</strong>,
          }))}
          isLoading={pnlLoading}
          emptyMessage="No tax data for selected period"
        />
      )}

      {activeTab === 'cashflow' && (
        <div>
          {cfLoading ? (
            <div className="text-center p-lg text-muted">Loading cash flow data...</div>
          ) : cashflow ? (
            <>
              <div className="finance-cashflow">
                <div className="finance-cashflow-card in">
                  <div className="cf-label">Cash In (Sales)</div>
                  <div className="cf-value">{peso(cashflow.cashIn?.total)}</div>
                </div>
                <div className="finance-cashflow-card out">
                  <div className="cf-label">Cash Out (Purchases + Expenses)</div>
                  <div className="cf-value">{peso(cashflow.cashOut?.total)}</div>
                </div>
                <div className={`finance-cashflow-card net ${(cashflow.netCashflow || 0) >= 0 ? 'positive' : 'negative'}`}>
                  <div className="cf-label">Net Cash Flow</div>
                  <div className="cf-value" style={{ color: (cashflow.netCashflow || 0) >= 0 ? '#166534' : '#991b1b' }}>{peso(cashflow.netCashflow)}</div>
                </div>
              </div>

              <div className="finance-breakdown">
                <div className="dashboard-section">
                  <h3>Cash In by Payment Method</h3>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Method</th><th>Transactions</th><th>Amount</th></tr></thead>
                      <tbody>
                        {(cashflow.cashIn?.byMethod || []).map(m => (
                          <tr key={m.method}>
                            <td>{m.method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
                            <td>{m.count}</td>
                            <td><strong>{peso(m.amount)}</strong></td>
                          </tr>
                        ))}
                        {(!cashflow.cashIn?.byMethod || cashflow.cashIn.byMethod.length === 0) && (
                          <tr><td colSpan={3} className="text-center p-md text-muted">No data</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="dashboard-section">
                  <h3>Cash Out Breakdown</h3>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Category</th><th>Amount</th></tr></thead>
                      <tbody>
                        <tr><td>Purchases</td><td><strong className="text-error">{peso(cashflow.cashOut?.purchases?.total)}</strong></td></tr>
                        {(cashflow.cashOut?.expenses?.byMethod || []).map(m => (
                          <tr key={m.method}>
                            <td>Expense ({m.method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())})</td>
                            <td><strong className="text-error">{peso(m.amount)}</strong></td>
                          </tr>
                        ))}
                        {(!cashflow.cashOut?.expenses?.byMethod || cashflow.cashOut.expenses.byMethod.length === 0) && !cashflow.cashOut?.purchases?.total && (
                          <tr><td colSpan={2} className="text-center p-md text-muted">No data</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center p-lg text-muted">No cash flow data for selected period</div>
          )}
        </div>
      )}
    </>
  );
}