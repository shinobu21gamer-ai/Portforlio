import { useState, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useDashboard, useMyProfile, useMyAttendance, useMyLeaveBalance, usePendingCounts } from '../hooks/useApi';

import LoadingSkeleton from '../components/LoadingSkeleton';
import { formatDate, getWeekRange, getMonthRange } from '../utils/helpers';
import { useIsAdmin, useIsHR } from '../hooks/useRole';
import useAuthStore from '../store/authStore';
import OnboardingChecklist from '../components/OnboardingChecklist';
import api from '../api/client';
import { icons } from '../components/ActionButton';

export default function Dashboard() {
  const user = useAuthStore(s => s.user);
  const isSelfService = user?.role?.slug === 'employee' || user?.role?.slug === 'cashier';
  const isInventoryStaff = user?.role?.slug === 'inventory_staff';

  if (isInventoryStaff) return <Navigate to="/inventory-dashboard" replace />;
  if (isSelfService) return <EmployeeDashboard />;

  return <AdminDashboard />;
}

function EmployeeDashboard() {
  const navigate = useNavigate();
  const { data: emp, isLoading: empLoading, error: empError } = useMyProfile();
  const { data: att, isLoading: attLoading } = useMyAttendance({});
  const { data: balance, isLoading: balLoading } = useMyLeaveBalance();

  if (empLoading) return <LoadingSkeleton rows={4} />;
  if (empError) return <div className="empty-state"><p>No employee profile found for this account. Please contact your administrator.</p></div>;

  return (
    <div className="hrms-page">
        <div className="page-header"><h1>Welcome back{emp ? `, ${emp.firstName}` : ''}</h1></div>
        <div className="flex-wrap-gap mb-md">
          <button className="btn btn-sm btn-primary" onClick={() => navigate('/my-attendance')}>● Clock In/Out</button>
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/my-leaves')}>Request Leave</button>
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/my-payslips')}>₱ Payslips</button>
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/my-profile')}>{icons.edit} My Profile</button>
        </div>
        <div className="dashboard-grid mb-lg">
          <div className="emp-info-card">
            <div className="label">Employee No</div>
            <div className="value">{emp?.employeeNo || '—'}</div>
          </div>
          <div className="emp-info-card">
            <div className="label">Department</div>
            <div className="value">{emp?.department?.name || '—'}</div>
          </div>
          <div className="emp-info-card">
            <div className="label">Position</div>
            <div className="value">{emp?.position?.title || '—'}</div>
          </div>
          <div className="emp-info-card">
            <div className="label">Leave Balance</div>
            <div className="value">{balance?.vacation?.remaining ?? '—'} VL / {balance?.sick?.remaining ?? '—'} SL</div>
          </div>
        </div>
        <div className="emp-info-card">
          <h3>Today's Attendance</h3>
          {att?.attendance?.[0] ? (
            <div className="flex-gap mt-sm">
              <div><strong>Status:</strong> <span className={`badge ${att.attendance[0].status === 'present' ? 'success' : 'warning'}`}>{att.attendance[0].status}</span></div>
              {att.attendance[0].clockIn && <div><strong>Clock In:</strong> {att.attendance[0].clockIn}</div>}
              {att.attendance[0].clockOut && <div><strong>Clock Out:</strong> {att.attendance[0].clockOut}</div>}
            </div>
          ) : <p className="text-muted mt-sm">No attendance record for today. Go to My Attendance to clock in.</p>}
        </div>
      </div>
  );
}

function AdminDashboard() {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [view, setView] = useState('day');
  const isAdmin = useIsAdmin();
  const isHR = useIsHR();
  const navigate = useNavigate();

  const weekRange = useMemo(() => getWeekRange(date), [date]);
  const monthRange = useMemo(() => getMonthRange(date), [date]);

  const dashParams = useMemo(() => {
    if (view === 'week') return { startDate: weekRange.start, endDate: weekRange.end };
    if (view === 'month') return { startDate: monthRange.start, endDate: monthRange.end };
    return {};
  }, [view, weekRange, monthRange]);

  const { data, isLoading, error } = useDashboard(dashParams);

  const { data: pendingCounts } = usePendingCounts(isAdmin || isHR);

  const navigateDate = (dir) => {
    const d = new Date(date);
    if (view === 'day') d.setDate(d.getDate() + dir);
    else if (view === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setDate(d.toISOString().split('T')[0]);
  };

  const viewLabel = view === 'day' ? formatDate(date) : view === 'week' ? weekRange.label : monthRange.label;

  if (isLoading) return <LoadingSkeleton rows={5} />;
  if (error) return <div className="empty-state"><h3>Error loading dashboard</h3><p>{error.message}</p></div>;

  const emp = data?.employees || {};
  const activeCount = data?.activeCount || 0;
  const att = data?.attendance || {};
  const depts = data?.departments || {};

  return (<>
      <header className="pos-header">
        <div>
          <h1>HRMS Dashboard</h1>
          <div className="sub">Human Resource Management Overview</div>
        </div>
      </header>
      <OnboardingChecklist />

      <div className="flex-wrap-sm mb-md">
        {isAdmin && <button className="btn btn-sm btn-primary" onClick={() => navigate('/employees')}>＋ Add Employee</button>}
        {isAdmin && <button className="btn btn-sm btn-outline" onClick={() => navigate('/payroll')}>₱ Process Payroll</button>}
        <button className="btn btn-sm btn-outline" onClick={() => navigate('/leaves')}>{isAdmin ? 'Approve Leaves' : 'Review Leaves'}</button>
        <button className="btn btn-sm btn-outline" onClick={() => navigate('/contracts')}>📋 Contracts</button>
        {isHR && <button className="btn btn-sm btn-outline" onClick={() => navigate('/schedules')}>📅 Schedules</button>}
        {pendingCounts && (
          <div className="flex-gap ml-auto text-sm">
            {pendingCounts.pendingEmployees > 0 && <span className="badge warning">🔔 {pendingCounts.pendingEmployees} pending employees</span>}
            {pendingCounts.pendingLeaves > 0 && <span className="badge warning">🔔 {pendingCounts.pendingLeaves} pending leaves</span>}
            {pendingCounts.pendingContracts > 0 && <span className="badge warning">🔔 {pendingCounts.pendingContracts} pending contracts</span>}
          </div>
        )}
      </div>

      <div className="flex-gap-sm mb-md items-center">
        <button className="btn btn-sm" onClick={() => navigateDate(-1)}>◀</button>
        <button className={`btn btn-sm ${view === 'day' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('day')}>Day</button>
        <button className={`btn btn-sm ${view === 'week' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('week')}>Week</button>
        <button className={`btn btn-sm ${view === 'month' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('month')}>Month</button>
        <button className="btn btn-sm" onClick={() => navigateDate(1)}>▶</button>
        <span className="ml-sm font-semibold text-sm">{viewLabel}</span>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card stat-card-accent" style={{ borderLeftColor: 'var(--primary)' }}>
          <div className="stat-card-icon" style={{ background: 'rgba(99,102,241,.1)', color: 'var(--primary)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div className="stat-card-content">
            <div className="label">Total Employees</div>
            <div className="value">{emp.pagination?.totalItems || 0}</div>
          </div>
        </div>
        <div className="stat-card stat-card-accent" style={{ borderLeftColor: 'var(--success)' }}>
          <div className="stat-card-icon" style={{ background: 'rgba(34,197,94,.1)', color: 'var(--success)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div className="stat-card-content">
            <div className="label">Active Employees</div>
            <div className="value text-success">{activeCount}</div>
          </div>
        </div>
        <div className="stat-card stat-card-accent" style={{ borderLeftColor: 'var(--info)' }}>
          <div className="stat-card-icon" style={{ background: 'rgba(59,130,246,.1)', color: 'var(--info)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div className="stat-card-content">
            <div className="label">Present {view !== 'day' ? 'Total' : 'Today'}</div>
            <div className="value text-info">{att.present || 0}</div>
          </div>
        </div>
        <div className="stat-card stat-card-accent" style={{ borderLeftColor: 'var(--warning)' }}>
          <div className="stat-card-icon" style={{ background: 'rgba(234,179,8,.1)', color: 'var(--warning)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div className="stat-card-content">
            <div className="label">Late {view !== 'day' ? 'Total' : 'Today'}</div>
            <div className="value text-warning">{att.late || 0}</div>
          </div>
        </div>
        <div className="stat-card stat-card-accent" style={{ borderLeftColor: 'var(--error)' }}>
          <div className="stat-card-icon" style={{ background: 'rgba(239,68,68,.1)', color: 'var(--error)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div className="stat-card-content">
            <div className="label">Absent {view !== 'day' ? 'Total' : 'Today'}</div>
            <div className="value text-error">{att.absent || 0}</div>
          </div>
        </div>
        <div className="stat-card stat-card-accent" style={{ borderLeftColor: 'var(--accent)' }}>
          <div className="stat-card-icon" style={{ background: 'rgba(99,102,241,.1)', color: 'var(--accent)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          </div>
          <div className="stat-card-content">
            <div className="label">Departments</div>
            <div className="value">{depts.departments?.length || 0}</div>
          </div>
        </div>
        {att.totalHours > 0 && (
          <div className="stat-card stat-card-accent" style={{ borderLeftColor: 'var(--primary)' }}>
            <div className="stat-card-icon" style={{ background: 'rgba(99,102,241,.1)', color: 'var(--primary)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div className="stat-card-content">
              <div className="label">Total Hours</div>
              <div className="value">{Number(att.totalHours).toFixed(1)}</div>
            </div>
          </div>
        )}
        {att.totalOT > 0 && (
          <div className="stat-card stat-card-accent" style={{ borderLeftColor: 'var(--success)' }}>
            <div className="stat-card-icon" style={{ background: 'rgba(34,197,94,.1)', color: 'var(--success)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            </div>
            <div className="stat-card-content">
              <div className="label">Total Overtime</div>
              <div className="value text-success">{Number(att.totalOT).toFixed(1)}h</div>
            </div>
          </div>
        )}
      </div>

      {(isAdmin || isHR) && pendingCounts && (
        <div className="dashboard-section mb-lg">
          <h2>Pending Approvals</h2>
          <div className="dashboard-grid">
            {pendingCounts.pendingEmployees > 0 && (
              <div className="stat-card" style={{ cursor: 'pointer', borderLeft: '3px solid var(--warning)' }} onClick={() => navigate('/employees')}>
                <div className="label">Employees to Approve</div>
                <div className="value" style={{ color: 'var(--warning)' }}>{pendingCounts.pendingEmployees}</div>
              </div>
            )}
            {pendingCounts.pendingJobs > 0 && (
              <div className="stat-card" style={{ cursor: 'pointer', borderLeft: '3px solid var(--warning)' }} onClick={() => navigate('/jobs')}>
                <div className="label">Job Postings to Approve</div>
                <div className="value" style={{ color: 'var(--warning)' }}>{pendingCounts.pendingJobs}</div>
              </div>
            )}
            {pendingCounts.pendingContracts > 0 && (
              <div className="stat-card" style={{ cursor: 'pointer', borderLeft: '3px solid var(--warning)' }} onClick={() => navigate('/contracts')}>
                <div className="label">Contracts to Approve</div>
                <div className="value" style={{ color: 'var(--warning)' }}>{pendingCounts.pendingContracts}</div>
              </div>
            )}
            {pendingCounts.pendingLeaves > 0 && (
              <div className="stat-card" style={{ cursor: 'pointer', borderLeft: '3px solid var(--info)' }} onClick={() => navigate('/leaves')}>
                <div className="label">Leaves to Review</div>
                <div className="value" style={{ color: 'var(--info)' }}>{pendingCounts.pendingLeaves}</div>
              </div>
            )}
            {pendingCounts.hrReviewedLeaves > 0 && (
              <div className="stat-card" style={{ cursor: 'pointer', borderLeft: '3px solid var(--success)' }} onClick={() => navigate('/leaves')}>
                <div className="label">Leaves to Approve</div>
                <div className="value" style={{ color: 'var(--success)' }}>{pendingCounts.hrReviewedLeaves}</div>
              </div>
            )}
            {pendingCounts.processedPayrolls > 0 && (
              <div className="stat-card" style={{ cursor: 'pointer', borderLeft: '3px solid var(--success)' }} onClick={() => navigate('/payroll')}>
                <div className="label">Payroll to Pay</div>
                <div className="value" style={{ color: 'var(--success)' }}>{pendingCounts.processedPayrolls}</div>
              </div>
            )}
            {pendingCounts.pendingEmployees === 0 && pendingCounts.pendingJobs === 0 && pendingCounts.pendingContracts === 0 && pendingCounts.pendingLeaves === 0 && pendingCounts.hrReviewedLeaves === 0 && pendingCounts.processedPayrolls === 0 && (
              <div className="text-sm text-muted p-md" style={{ gridColumn: '1 / -1' }}>No pending approvals. All caught up!</div>
            )}
          </div>
        </div>
      )}

      <div className="dashboard-section">
        <h2>Attendance Summary — {viewLabel}</h2>
        {att.total > 0 ? (
          <div className="attendance-bar">
            <div className="att-segment present" style={{ flex: att.present || 0 }}>
              <span>Present: {att.present || 0}</span>
            </div>
            <div className="att-segment late" style={{ flex: att.late || 0 }}>
              <span>Late: {att.late || 0}</span>
            </div>
            <div className="att-segment absent" style={{ flex: att.absent || 0 }}>
              <span>Absent: {att.absent || 0}</span>
            </div>
          </div>
        ) : (
          <p className="text-muted">No attendance data available.</p>
        )}
      </div>

      <div className="dashboard-section">
        <h2>Departments</h2>
        <div className="dashboard-grid">
          {(depts.departments || []).map(d => (
            <div key={d.id} className="dept-card">
              <strong>{d.name}</strong>
              <div className="text-sm text-muted mt-xs">{d.description || 'No description'}</div>
            </div>
          ))}
        </div>
      </div>
    </>);
}
