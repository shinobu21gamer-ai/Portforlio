import { useState } from 'react';
import { NavLink, useLocation, Outlet } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import TopBar from '../components/TopBar';
import BrandMark from '../components/BrandMark';

const NAV_ICONS = {
  dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  products: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  categories: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  suppliers: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  inventory: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  purchases: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  profile: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  attendance: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  leaves: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75"/></svg>,
  contracts: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="M9 15l3 3 3-3"/></svg>,
  payslips: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  pos: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  group: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  account: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
};

const NAV_GROUPS = [
  {
    label: 'Operations', icon: 'group',
    children: [
      { to: '/products', label: 'Products', icon: 'products' },
      { to: '/categories', label: 'Categories', icon: 'categories' },
      { to: '/suppliers', label: 'Suppliers', icon: 'suppliers' },
      { to: '/inventory', label: 'Inventory', icon: 'inventory' },
      { to: '/purchases', label: 'Purchases', icon: 'purchases' },
    ]
  },
  {
    label: 'My Account', icon: 'account',
    children: [
      { to: '/my-profile', label: 'My Profile', icon: 'profile' },
      { to: '/my-attendance', label: 'My Attendance', icon: 'attendance' },
      { to: '/my-leaves', label: 'My Leaves', icon: 'leaves' },
      { to: '/my-payslips', label: 'My Payslips', icon: 'payslips' },
      { to: '/my-contracts', label: 'My Contracts', icon: 'contracts' },
    ]
  },
];

export default function InventoryStaffLayout({ children }) {
  const user = useAuthStore(s => s.user);
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({});

  const toggleGroup = (label) => setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  const closeSidebar = () => setSidebarOpen(false);

  const isGroupChildActive = (children) => children.some(c => location.pathname === c.to);

  return (
    <div className="hrms-shell">
      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle menu">☰</button>
      {sidebarOpen && <div className="mobile-backdrop" onClick={closeSidebar} />}
      <aside className={`hrms-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <BrandMark caption="Inventory workspace" />
        </div>
        <nav className="sidebar-nav" onClick={closeSidebar}>
          <div className="sidebar-section-label">Workspace</div>
          <NavLink to="/inventory-dashboard" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">{NAV_ICONS.dashboard}</span>
            <span className="nav-label">Dashboard</span>
          </NavLink>

          <NavLink to="/pos" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">{NAV_ICONS.pos}</span>
            <span className="nav-label">POS System</span>
          </NavLink>

          {NAV_GROUPS.map(group => {
            const childActive = isGroupChildActive(group.children);
            const isOpen = openGroups[group.label] ?? childActive;
            return (
              <div key={group.label} className={`nav-group ${isOpen ? 'open' : ''}`}>
                <div
                  className={`nav-item nav-group-toggle ${isOpen || childActive ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); toggleGroup(group.label); }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleGroup(group.label); }}
                >
                  <span className="nav-icon">{NAV_ICONS[group.icon]}</span>
                  <span className="nav-label">{group.label}</span>
                  <span className="nav-arrow">{isOpen ? '\u25BE' : '\u25B8'}</span>
                </div>
                {isOpen && (
                  <div className="nav-group-children">
                    {group.children.map(child => (
                      <NavLink key={child.to} to={child.to} end className={({ isActive }) => `nav-item nav-child ${isActive ? 'active' : ''}`}>
                        <span className="nav-label">{child.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-info">
            <div className="user-avatar">{(user?.firstName || 'U')[0]}</div>
            <div className="user-copy">
              <div className="user-name">{user?.firstName} {user?.middleName ? user.middleName + ' ' : ''}{user?.lastName}</div>
              <div className="user-role">Inventory Staff</div>
            </div>
          </div>
        </div>
      </aside>
      <main className="hrms-main"><TopBar /><div className="page-enter">{children || <Outlet />}</div></main>
    </div>
  );
}
