import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PosLayout from '../layouts/PosLayout';
import FinanceOverview from './finance/FinanceOverview';
import FinancePnL from './finance/FinancePnL';
import FinanceExpenses from './finance/FinanceExpenses';
import FinancePettyCash from './finance/FinancePettyCash';
import FinanceReports from './finance/FinanceReports';

const TABS = [
  { key: 'overview', label: 'Overview', icon: '📊' },
  { key: 'pnl', label: 'Profit & Loss', icon: '📈' },
  { key: 'expenses', label: 'Expenses', icon: '💸' },
  { key: 'petty-cash', label: 'Petty Cash', icon: '💰' },
  { key: 'reports', label: 'Reports', icon: '📄' },
];

export default function Finance() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(TABS.some(t => t.key === tabParam) ? tabParam : 'overview');
  // Deep links (e.g. the ⌘K palette sending an invoice to the Reports tab) must
  // still land on the right tab when the page is already mounted.
  useEffect(() => {
    if (TABS.some(t => t.key === tabParam)) setActiveTab(tabParam);
  }, [tabParam]);

  return (
    <PosLayout active="finance">
      <header className="finance-header">
        <div>
          <h1>Finances</h1>
          <div className="sub">Dashboard, profit &amp; loss, expenses, petty cash, and reports</div>
        </div>
      </header>

      <div className="finance-tabs" role="tablist">
        {TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={activeTab === t.key}
            className={`finance-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            <span className="finance-tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="finance-tab-panel" key={activeTab}>
        {activeTab === 'overview' && <FinanceOverview />}
        {activeTab === 'pnl' && <FinancePnL />}
        {activeTab === 'expenses' && <FinanceExpenses />}
        {activeTab === 'petty-cash' && <FinancePettyCash />}
        {activeTab === 'reports' && <FinanceReports />}
      </div>
    </PosLayout>
  );
}