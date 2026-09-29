import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import useAuthStore from '../store/authStore';
import useCartStore from '../store/cartStore';
import { useToast } from '../components/Toast';
import { useUnreadCount, useLogout } from '../hooks/useApi';
import { peso, productEmoji } from '../utils/helpers';
import Button from '../components/Button';
import Avatar from '../components/Avatar';

const HRMS_ORIGIN = import.meta.env.VITE_HRMS_URL
  ? (() => { try { return new URL(import.meta.env.VITE_HRMS_URL).origin; } catch { return window.location.origin; } })()
  : window.location.origin;
const HRMS_HOME = import.meta.env.VITE_HRMS_URL || `${window.location.origin}/hrms`;

export default function PosLayout({ children, active, showCart = false, cartFooter }) {
  const { user, logout } = useAuthStore();
  const clearCart = useCartStore(s => s.clearCart);
  const removeItem = useCartStore(s => s.removeItem);
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const logoutMutation = useLogout();
  const { data: unreadData } = useUnreadCount();
  const unreadCount = unreadData?.unreadCount || 0;

  const isAdmin = user?.role?.slug === 'admin' || user?.role === 'admin';
  const isManager = user?.role?.slug === 'manager' || user?.role === 'manager';
  const isAdminOrManager = isAdmin || isManager;
  const isInventoryStaff = user?.role?.slug === 'inventory_staff';

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('minimart_theme') === 'dark');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('minimart_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const handleLogout = useCallback(async () => {
    if (window.top !== window) {
      window.top.postMessage({ type: 'pos-logout' }, HRMS_ORIGIN);
    }
    try { await logoutMutation.mutateAsync(); } catch {}
    logout();
    clearCart();
    toast.success('Logged out successfully');
    navigate('/login');
  }, [logoutMutation, logout, clearCart, toast, navigate]);

  const items = useCartStore(s => s.items);
  const subtotal = useCartStore(s => s.getSubtotal());
  const tax = useCartStore(s => s.getTax());
  const total = useCartStore(s => s.getTotal());

  const navItems = useMemo(() => [
    { to: '/', label: 'POS', icon: 'pos', roles: [] },
    ...(isAdminOrManager ? [{ to: '/finance', label: 'Finances', icon: 'finance', roles: ['admin', 'manager'] }] : []),
    { to: '/products', label: 'Products', icon: 'products', roles: ['admin', 'manager', 'inventory_staff'] },
    { to: '/categories', label: 'Categories', icon: 'categories', roles: ['admin', 'manager', 'inventory_staff'] },
    ...(isAdminOrManager ? [{ to: '/customers', label: 'Customers', icon: 'customers', roles: ['admin', 'manager'] }] : []),
    { to: '/inventory', label: 'Inventory', icon: 'inventory', roles: ['admin', 'manager', 'inventory_staff'] },
    { to: '/suppliers', label: 'Suppliers', icon: 'suppliers', roles: ['admin', 'manager', 'inventory_staff'] },
    { to: '/purchases', label: 'Purchases', icon: 'purchases', roles: ['admin', 'manager', 'inventory_staff'] },
    ...(isAdminOrManager ? [
      { to: '/discounts', label: 'Discounts', icon: 'discounts', roles: ['admin', 'manager'] },
    ] : []),
    ...(isAdmin ? [
      { to: '/branches', label: 'Branches', icon: 'branches', roles: ['admin'] },
      { to: '/users', label: 'Users', icon: 'users', roles: ['admin'] },
      { to: '/settings', label: 'Settings', icon: 'settings', roles: ['admin'] }
    ] : []),
  ], [isAdmin, isManager, isInventoryStaff, isAdminOrManager]);

  const ICONS = {
    pos: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>,
    dashboard: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>,
    products: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
    categories: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
    customers: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    inventory: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
    suppliers: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
    purchases: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>,
    expenses: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    pettyCash: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
    discounts: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
    reports: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    finance: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
    branches: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    users: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>,
    settings: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
    notifications: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
    hrms: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><polyline points="7 8 10 11 7 14"/><line x1="13" y1="14" x2="17" y2="14"/></svg>,
    profile: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    dark: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
    light: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="23"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
    logout: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  };

  return (
    <div className="pos-shell">
      <div className="pos-band" />
      <div className="pos-body">
        <Button
          className="mobile-menu-btn"
          onClick={() => setSidebarOpen(o => !o)}
          aria-label="Toggle menu"
          variant="ghost"
          size="lg"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </Button>
        {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-top" onClick={() => setSidebarOpen(false)}>
            <div className="sidebar-logo">M</div>

            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) => `sidebar-btn ${isActive || active === item.label.toLowerCase().replace(/\s+/g, '-') ? 'active' : ''}`}
                title={item.label}
              >
                {ICONS[item.icon]}
              </NavLink>
            ))}

            <div className="sidebar-divider" />

            {isAdminOrManager && (
              <Button
                className="sidebar-btn"
                title="HRMS"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (window.top !== window) {
                    window.top.postMessage({ type: 'pos-back-to-hrms' }, HRMS_ORIGIN);
                  } else {
                    window.location.href = HRMS_HOME;
                  }
                }}
              >
                {ICONS.hrms}
              </Button>
            )}

            <Button
              className="sidebar-btn"
              title="Notifications"
              variant="ghost"
              size="sm"
              onClick={() => navigate('/notifications')}
            >
              {ICONS.notifications}
              {unreadCount > 0 && <span className="badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </Button>

            <div className="sidebar-divider" />

            <NavLink to="/profile" className={({ isActive }) => `sidebar-btn ${isActive || active === 'profile' ? 'active' : ''}`} title="Profile">
              {ICONS.profile}
            </NavLink>
          </div>
          <div className="sidebar-bottom">
            <Button
              className="sidebar-btn"
              variant="ghost"
              size="sm"
              onClick={() => setDarkMode(d => !d)}
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              {darkMode ? ICONS.light : ICONS.dark}
            </Button>
            <Button
              className="sidebar-signout"
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              title="Sign out"
            >
              {ICONS.logout}
              <span style={{ display: 'none' }}>Sign out</span>
            </Button>
          </div>
        </aside>

        <main className="main"><div className="page-enter" key={location.pathname}>{children}</div></main>

        {showCart && (
          <aside className="cart">
            <div className="cart-head">
              <span className="order-num">Cart ({items.length})</span>
              <Button variant="danger" size="sm" onClick={() => useCartStore.getState().clearCart()}>Clear</Button>
            </div>
            <div className="cart-list">
              {items.length === 0 ? (
                <p className="cart-empty">No items yet</p>
              ) : (
                items.map(item => (
                  <div key={item.id} className="cart-row">
                    <div className="cart-thumb">
                      {item.image ? <img src={item.image} alt={item.name} loading="lazy" /> : productEmoji(item.category?.slug)}
                    </div>
                    <span className="cart-name">{item.name}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)} aria-label="Decrease quantity">−</Button>
                    <span className="cart-qty">{item.quantity}</span>
                    <Button variant="ghost" size="sm" onClick={() => useCartStore.getState().addItem(item)} aria-label="Increase quantity">+</Button>
                    <span className="cart-price">{peso((item.sellingPrice || item.price || 0) * item.quantity)}</span>
                  </div>
                ))
              )}
            </div>
            <div className="cart-totals">
              <div className="row"><span>Sub Total</span><span>{peso(subtotal)}</span></div>
              <div className="row"><span>Tax</span><span>{peso(tax)}</span></div>
              <div className="divider" />
              <div className="row total"><span>Total</span><span>{peso(total)}</span></div>
            </div>
            {cartFooter && <div className="cart-footer">{cartFooter}</div>}
          </aside>
        )}
      </div>
      <div className="pos-band" />
    </div>
  );
}