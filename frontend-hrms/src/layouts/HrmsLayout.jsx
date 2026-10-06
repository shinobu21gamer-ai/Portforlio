import { useState, useEffect, useMemo, useCallback } from 'react';
import { NavLink, useLocation, Outlet } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import api from '../api/client';
import TopBar from '../components/TopBar';

const ICONS = {
  dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>,
  employees: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  jobs: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  contracts: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="M9 15l3 3 3-3"/></svg>,
  leaves: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75"/></svg>,
  pos: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>,
  attendance: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  schedules: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  payroll: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  departments: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
  settings: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 003.68 15a1.65 1.65 0 00-1.51-1H2a2 2 0 010-4h.09A1.65 1.65 0 003.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9v.09a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
};

const HR_NAV_BASE = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  {
    label: 'Employees', icon: 'employees', children: [
      { to: '/employees', label: 'Employees' },
      { to: '/departments', label: 'Departments' },
      { to: '/attendance', label: 'Attendance' },
      { to: '/attendance/calendar', label: 'Calendar View' },
      { to: '/schedules', label: 'Schedules' },
      // Payroll is admin/hr only at the API level (authorize('admin','hr')) —
      // managers get a 403 on every payroll call, so hide the link for them
      // instead of showing a button that can't work.
      { to: '/payroll', label: 'Payroll', roles: ['admin', 'hr'] },
    ]
  },
  {
    label: 'Job Postings & Hiring', icon: 'jobs', children: [
      { to: '/jobs', label: 'Job Postings' },
      { to: '/interviews', label: 'Interviews' },
      { to: '/careers', label: 'Job Portal', external: true },
    ]
  },
  { to: '/contracts', label: 'Contracts', icon: 'contracts' },
  { to: '/leaves', label: 'Leaves', icon: 'leaves' },
  { to: '/pos', label: 'POS System', icon: 'pos' },
  // Email diagnostics + test send. `roles` is honoured for top-level items by
  // the filter in the nav render below (NavGroup already filters its children).
  { to: '/settings', label: 'Settings', icon: 'settings', roles: ['admin'] },
];

function NavGroup({ item, openGroups, toggleGroup, counts, role }) {
  const location = useLocation();
  // Hide children restricted to other roles (e.g. Payroll for managers), and
  // drop the whole group if every child is hidden for the current role.
  const children = item.children.filter(c => !c.roles || c.roles.includes(role));
  if (children.length === 0) return null;
  const isOpen = openGroups[item.label] !== undefined ? openGroups[item.label] : children.some(c => location.pathname === c.to);

  const getBadge = (path) => {
    if (!counts) return null;
    const map = {
      '/employees': counts.pendingEmployees,
      '/jobs': counts.pendingJobs,
      '/contracts': counts.pendingContracts,
      '/leaves': counts.pendingLeaves + counts.hrReviewedLeaves,
      '/payroll': counts.processedPayrolls,
    };
    const count = map[path];
    return count > 0 ? <span className="nav-badge">{count}</span> : null;
  };

  return (
    <div className={`nav-group ${isOpen ? 'open' : ''}`}>
      <div
        className={`nav-item nav-group-toggle ${isOpen ? 'active' : ''}`}
        onClick={(e) => { e.stopPropagation(); toggleGroup(item.label); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleGroup(item.label); }}
      >
        <span className="nav-icon">{ICONS[item.icon] || item.icon}</span>
        <span className="nav-label">{item.label}</span>
        <span className="nav-arrow">{isOpen ? '▾' : '▸'}</span>
      </div>
      {isOpen && (
        <div className="nav-group-children">
          {children.map(child => child.external ? (
            <a
              key={child.to}
              href={`${import.meta.env.BASE_URL}${child.to.replace(/^\//, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="nav-item nav-child"
            >
              <span className="nav-label">{child.label}</span>
              <span style={{ fontSize: 10, marginLeft: 4 }}>↗</span>
            </a>
          ) : (
            <NavLink
              key={child.to}
              to={child.to}
              end
              className={({ isActive }) => `nav-item nav-child ${isActive ? 'active' : ''}`}
            >
              <span className="nav-label">{child.label}</span>
              {getBadge(child.to)}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HrmsLayout({ children }) {
  const user = useAuthStore(s => s.user);
  const role = user?.role?.slug;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [counts, setCounts] = useState(null);
  const [openGroups, setOpenGroups] = useState({});

  useEffect(() => {
    let alive = true;
    const fetchCounts = () => api.get('/pending-counts').then(r => { if (alive) setCounts(r.data.data); }).catch(() => {});
    fetchCounts();
    const interval = setInterval(fetchCounts, 60000);
    return () => { alive = false; clearInterval(interval); };
  }, []);

  const navItems = useMemo(() => HR_NAV_BASE, []);

  const toggleGroup = useCallback((label) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  }, []);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="hrms-shell">
      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle menu">☰</button>
      {sidebarOpen && <div className="mobile-backdrop" onClick={closeSidebar} />}
      <aside className={`hrms-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg></span>
          <span className="brand-copy">
            <span className="brand-text">MiniMart</span>
            <span className="brand-caption">People &amp; operations</span>
          </span>
        </div>
        <nav className="sidebar-nav" onClick={closeSidebar}>
          <div className="sidebar-section-label">Workspace</div>
          {navItems.filter(n => !n.roles || (role && n.roles.includes(role))).map(n => n.children ? (
            <NavGroup key={n.label} item={n} openGroups={openGroups} toggleGroup={toggleGroup} counts={counts} role={role} />
          ) : n.external ? (
            <a key={n.label} href={n.to} target="_blank" rel="noopener noreferrer" className="nav-item">
              <span className="nav-icon">{ICONS[n.icon] || n.icon}</span>
              <span className="nav-label">{n.label}</span>
              <span style={{ fontSize: 10, marginLeft: 4 }}>↗</span>
            </a>
          ) : (
            <NavLink key={n.to} to={n.to} end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-icon">{ICONS[n.icon] || n.icon}</span>
              <span className="nav-label">{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-info">
            <div className="user-avatar">{(user?.firstName || 'U')[0]}</div>
            <div className="user-copy">
              <div className="user-name">{user?.firstName} {user?.middleName ? user.middleName + ' ' : ''}{user?.lastName}</div>
              <div className="user-role">{user?.role?.slug === 'hr' ? 'HR Officer' : user?.role?.slug === 'manager' ? 'Manager' : user?.role?.slug === 'cashier' ? 'Cashier' : user?.role?.slug === 'employee' ? 'Employee' : 'Admin'}</div>
            </div>
          </div>
        </div>
      </aside>
      <main className="hrms-main"><TopBar /><div className="page-enter">{children || <Outlet />}</div></main>
    </div>
  );
}
