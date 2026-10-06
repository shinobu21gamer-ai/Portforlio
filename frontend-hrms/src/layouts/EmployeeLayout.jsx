import { useState } from 'react';
import { NavLink, useLocation, Outlet } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import TopBar from '../components/TopBar';

const NAV_ICONS = {
  profile: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  attendance: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  leaves: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75"/></svg>,
  payslips: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  contracts: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  pos: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  account: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
};

const EMP_NAV_GROUP = {
  label: 'My Account', icon: 'account',
  children: [
    { to: '/my-profile', label: 'My Profile', icon: 'profile' },
    { to: '/my-attendance', label: 'My Attendance', icon: 'attendance' },
    { to: '/my-leaves', label: 'My Leaves', icon: 'leaves' },
    { to: '/my-payslips', label: 'My Payslips', icon: 'payslips' },
    { to: '/my-contracts', label: 'My Contracts', icon: 'contracts' },
  ]
};

export default function EmployeeLayout({ children }) {
  const user = useAuthStore(s => s.user);
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({});

  const toggleGroup = (label) => setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  const closeSidebar = () => setSidebarOpen(false);

  const roleLabel = user?.role?.slug === 'employee' ? 'Employee' : user?.role?.slug === 'cashier' ? 'Cashier' : 'Staff';
  const childActive = EMP_NAV_GROUP.children.some(c => location.pathname === c.to);
  const isOpen = openGroups['My Account'] ?? childActive;

  return (
    <div className="hrms-shell">
      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle menu">☰</button>
      {sidebarOpen && <div className="mobile-backdrop" onClick={closeSidebar} />}
      <aside className={`hrms-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </span>
          <span className="brand-copy">
            <span className="brand-text">MiniMart</span>
            <span className="brand-caption">My workspace</span>
          </span>
        </div>
        <nav className="sidebar-nav" onClick={closeSidebar}>
          <div className="sidebar-section-label">Workspace</div>
          <NavLink to="/pos" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">{NAV_ICONS.pos}</span>
            <span className="nav-label">POS System</span>
          </NavLink>

          <div className={`nav-group ${isOpen ? 'open' : ''}`}>
            <div
              className={`nav-item nav-group-toggle ${isOpen || childActive ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); toggleGroup('My Account'); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleGroup('My Account'); }}
            >
              <span className="nav-icon">{NAV_ICONS.account}</span>
              <span className="nav-label">My Account</span>
              <span className="nav-arrow">{isOpen ? '\u25BE' : '\u25B8'}</span>
            </div>
            {isOpen && (
              <div className="nav-group-children">
                {EMP_NAV_GROUP.children.map(child => (
                  <NavLink key={child.to} to={child.to} end className={({ isActive }) => `nav-item nav-child ${isActive ? 'active' : ''}`}>
                    <span className="nav-label">{child.label}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </nav>
        <div className="sidebar-bottom">
          <div className="user-info">
            <div className="user-avatar">{(user?.firstName || 'U')[0]}</div>
            <div className="user-copy">
              <div className="user-name">{user?.firstName} {user?.middleName ? user.middleName + ' ' : ''}{user?.lastName}</div>
              <div className="user-role">{roleLabel}</div>
            </div>
          </div>
        </div>
      </aside>
      <main className="hrms-main"><TopBar /><div className="page-enter">{children || <Outlet />}</div></main>
    </div>
  );
}
