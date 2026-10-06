import { useMemo, useState } from 'react';
import PosLayout from '../layouts/PosLayout';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { useActivityLogs, useUsers } from '../hooks/useApi';
import { formatDateTime, useDebounce } from '../utils/helpers';
import '../activity-history.css';

const MODULES = [
  'Access', 'Auth', 'Customers', 'Finance', 'HRMS', 'Inventory',
  'Notifications', 'POS', 'Products', 'Purchases', 'Sales', 'Settings', 'System',
];

const ACTION_LABELS = {
  'sale-created': 'Sale completed',
  'sale-refunded': 'Sale refunded',
  'sale-cancelled': 'Sale cancelled',
  'sale-completed-as-cash': 'Pending sale completed as cash',
  'sale-payment-confirmed': 'Sale payment confirmed',
  'purchase-created': 'Purchase order created',
  'purchase-received': 'Purchase received',
  'purchase-payment-recorded': 'Purchase payment recorded',
  'purchase-cancelled': 'Purchase cancelled',
  'employee-approved': 'Employee approved',
  'employee-rejected': 'Employee rejected',
  'leave-admin-approved': 'Leave request approved',
  'contract-approved': 'Contract approved',
  'payroll-paid': 'Payroll paid',
  'login': 'Signed in',
};

function actionLabel(action) {
  return ACTION_LABELS[action] || String(action || 'Activity').replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function actorLabel(user) {
  if (!user) return 'System / unavailable user';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || `User #${user.id}`;
}

function DetailBlock({ title, value }) {
  if (value == null) return null;
  return (
    <section className="activity-detail-block">
      <h3>{title}</h3>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </section>
  );
}

export default function ActivityHistory() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [module, setModule] = useState('');
  const [userId, setUserId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  const debouncedSearch = useDebounce(search, 350);

  const params = useMemo(() => ({
    page,
    limit: 25,
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(module ? { module } : {}),
    ...(userId ? { userId } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  }), [page, debouncedSearch, module, userId, startDate, endDate]);

  const { data, isLoading, isError, error, refetch, isFetching } = useActivityLogs(params);
  const { data: usersData } = useUsers({ limit: 200, sortBy: 'firstName', sortOrder: 'ASC' });
  const logs = data?.data?.logs || [];
  const pagination = data?.data?.pagination;
  const users = usersData?.data?.users || [];
  const totalLogs = pagination?.total ?? pagination?.totalItems ?? logs.length;
  const invalidDateRange = Boolean(startDate && endDate && startDate > endDate);

  const resetFilters = () => {
    setSearch('');
    setModule('');
    setUserId('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  return (
    <PosLayout active="activity">
      <header className="pos-header activity-header">
        <div>
          <h1>Activity History</h1>
          <div className="sub">A traceable timeline of successful changes across sales, inventory, finance, and HRMS.</div>
        </div>
        <button className="btn btn-outline btn-sm" type="button" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </header>

      <section className="activity-toolbar" aria-label="Activity filters">
        <label className="activity-search">
          <span>Search activity</span>
          <input
            className="input"
            placeholder="Name, invoice, purchase order, or action…"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          />
        </label>
        <label>
          <span>Area</span>
          <select className="input" value={module} onChange={(event) => { setModule(event.target.value); setPage(1); }}>
            <option value="">All areas</option>
            {MODULES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Who</span>
          <select className="input" value={userId} onChange={(event) => { setUserId(event.target.value); setPage(1); }}>
            <option value="">Everyone</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{actorLabel(user)}</option>
            ))}
          </select>
        </label>
        <label>
          <span>From</span>
          <input className="input" type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} />
        </label>
        <label>
          <span>To</span>
          <input className="input" type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setPage(1); }} />
        </label>
        <button className="btn btn-ghost btn-sm activity-clear" type="button" onClick={resetFilters}>Clear filters</button>
      </section>

      <div className="activity-summary-row">
        <div><strong>{totalLogs.toLocaleString()}</strong><span>{module || 'all'} activity records</span></div>
        <p>Successful changes are recorded with the signed-in staff member, time, and affected record. Older actions may not have a full audit entry.</p>
      </div>

      {invalidDateRange && <div className="activity-error">Choose a start date before the end date.</div>}
      {isError && <div className="activity-error">Could not load activity history: {error?.response?.data?.message || error?.message || 'Please try again.'}</div>}

      <div className="table-wrap activity-table-wrap">
        <table className="data-table activity-table">
          <thead>
            <tr>
              <th>Who</th>
              <th>What happened</th>
              <th>Area</th>
              <th>When</th>
              <th>Record</th>
              <th aria-label="Details" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="activity-state">Loading activity…</td></tr>
            ) : invalidDateRange ? (
              <tr><td colSpan={6} className="activity-state">Adjust the date range to view records.</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="activity-state">No activity matches these filters.</td></tr>
            ) : logs.map((log) => (
              <tr key={log.id}>
                <td>
                  <div className="activity-actor">{actorLabel(log.user)}</div>
                  {log.user?.email && <div className="activity-muted">{log.user.email}</div>}
                </td>
                <td>
                  <div className="activity-action">{actionLabel(log.action)}</div>
                  <div className="activity-description">{log.description || 'No additional description'}</div>
                </td>
                <td><span className="activity-module">{log.module}</span></td>
                <td className="activity-time">{formatDateTime(log.createdAt)}</td>
                <td className="activity-reference">
                  {log.referenceType ? `${log.referenceType}${log.referenceId ? ` #${log.referenceId}` : ''}` : '—'}
                </td>
                <td>
                  <button className="btn btn-outline btn-sm" type="button" onClick={() => setSelectedLog(log)}>Details</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>

      <Modal open={!!selectedLog} onClose={() => setSelectedLog(null)} title="Activity details" size="lg">
        {selectedLog && (
          <div className="activity-detail">
            <div className="activity-detail-summary">
              <span className="activity-module">{selectedLog.module}</span>
              <h3>{actionLabel(selectedLog.action)}</h3>
              <p>{selectedLog.description || 'No additional description'}</p>
            </div>
            <dl className="activity-detail-meta">
              <div><dt>Performed by</dt><dd>{actorLabel(selectedLog.user)}{selectedLog.user?.email ? ` · ${selectedLog.user.email}` : ''}</dd></div>
              <div><dt>Time</dt><dd>{formatDateTime(selectedLog.createdAt)}</dd></div>
              <div><dt>Record</dt><dd>{selectedLog.referenceType ? `${selectedLog.referenceType}${selectedLog.referenceId ? ` #${selectedLog.referenceId}` : ''}` : '—'}</dd></div>
              <div><dt>Request</dt><dd>{selectedLog.requestMethod || '—'} {selectedLog.requestUrl || ''}</dd></div>
              <div><dt>IP address</dt><dd>{selectedLog.ipAddress || '—'}</dd></div>
              {selectedLog.userAgent && <div><dt>Device</dt><dd>{selectedLog.userAgent}</dd></div>}
            </dl>
            <DetailBlock title="Changed from" value={selectedLog.oldData} />
            <DetailBlock title="Changed to / transaction summary" value={selectedLog.newData} />
          </div>
        )}
      </Modal>
    </PosLayout>
  );
}
