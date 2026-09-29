import { useState } from 'react';
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
  const [activeTab, setActiveTab] = useState('overview');

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