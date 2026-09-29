import { lazy, Suspense, useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import useAuthStore from './store/authStore';
import api from './api/client';
import GlobalSearch from './components/GlobalSearch';

const HRMS_ORIGIN = import.meta.env.VITE_HRMS_URL
  ? (() => { try { return new URL(import.meta.env.VITE_HRMS_URL).origin; } catch { return window.location.origin; } })()
  : window.location.origin;

import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Pos from './pages/Pos';
import Payment from './pages/Payment';
import NotFound from './pages/NotFound';

const Products       = lazy(() => import('./pages/Products'));
const Categories     = lazy(() => import('./pages/Categories'));
const Customers      = lazy(() => import('./pages/Customers'));
const Suppliers      = lazy(() => import('./pages/Suppliers'));
const Purchases      = lazy(() => import('./pages/Purchases'));
const Inventory      = lazy(() => import('./pages/Inventory'));
const Notifications  = lazy(() => import('./pages/Notifications'));
const Settings       = lazy(() => import('./pages/Settings'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const Profile        = lazy(() => import('./pages/Profile'));
const Discounts      = lazy(() => import('./pages/Discounts'));
const Finance        = lazy(() => import('./pages/Finance'));
const Branches       = lazy(() => import('./pages/Branches'));

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" />
        <p style={{ color: 'var(--muted-fg)', fontSize: 13, marginTop: 12 }}>Loading...</p>
      </div>
    </div>
  );
}

function AuthCheck({ children }) {
  const { isAuthenticated, token, logout, login } = useAuthStore();
  const [checking, setChecking] = useState(true);
  const [ssoError, setSsoError] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get('sso_token');
    const returnTo = params.get('returnTo');

    const doSso = async () => {
      if (ssoToken) {
        const currentToken = sessionStorage.getItem('token');
        if (currentToken && currentToken !== ssoToken) {
          logout();
        }
        try {
          const res = await api.get('/auth/profile', { headers: { Authorization: `Bearer ${ssoToken}` } });
          const u = res.data.data;
          login(u, ssoToken, null);
          window.history.replaceState({}, '', window.location.pathname);
          if (returnTo && returnTo.startsWith('/') && !returnTo.includes('://')) {
            navigate(returnTo, { replace: true });
          }
        } catch (err) {
          console.error('SSO failed:', err);
          window.history.replaceState({}, '', window.location.pathname);
          if (window.top !== window) {
            setSsoError('SSO authentication failed. Please return to HRMS and try again.');
            window.parent.postMessage({ type: 'pos-auth-failed', error: err?.response?.data?.message || 'Authentication failed' }, HRMS_ORIGIN);
          }
        }
        setChecking(false);
        return;
      }

      if (!isAuthenticated || !token) {
        setChecking(false);
        return;
      }
      try {
        await api.get('/auth/profile');
      } catch {
        logout();
      }
      setChecking(false);
    };

    doSso();
  }, []);

  if (checking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" />
          <p style={{ color: 'var(--muted-fg)', fontSize: 14, marginTop: 16 }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (ssoError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center', padding: 32, maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#x26A0;</div>
          <h2 style={{ color: 'var(--fg)', fontSize: 18, marginBottom: 8 }}>Authentication Failed</h2>
          <p style={{ color: 'var(--muted-fg)', fontSize: 14, marginBottom: 24 }}>{ssoError}</p>
          {window.top !== window ? null : (
            <a href="/" style={{ color: 'var(--primary)', fontSize: 14, textDecoration: 'none' }}>Go to POS Login</a>
          )}
        </div>
      </div>
    );
  }

  return children;
}

function GlobalSearchProvider({ children }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();

  const handleSearchSelect = useCallback((action) => {
    if (!action) return;
    const { type, id } = action;
    switch (type) {
      case 'product':
        navigate(`/products/${id}`);
        break;
      case 'customer':
        navigate(`/customers/${id}`);
        break;
      case 'employee':
        navigate(`/users/${id}`);
        break;
      case 'sale':
        navigate(`/sales/${id}`);
        break;
    }
  }, [navigate]);

  const handleKeyDown = useCallback((e) => {
    const isMeta = e.metaKey || e.ctrlKey;
    if (isMeta && e.key === 'k') {
      e.preventDefault();
      setSearchOpen(true);
    }
    if (e.key === 'Escape' && searchOpen) {
      e.preventDefault();
      setSearchOpen(false);
    }
  }, [searchOpen]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      {children}
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} onSelect={handleSearchSelect} />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ErrorBoundary>
          <AuthCheck>
            <GlobalSearchProvider>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />

                  <Route path="/" element={<ProtectedRoute><Pos /></ProtectedRoute>} />
                  <Route path="/payment" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
                  <Route path="/payment/success" element={<ProtectedRoute><Payment success /></ProtectedRoute>} />
                  <Route path="/payment/cancel" element={<ProtectedRoute><Payment cancel /></ProtectedRoute>} />
                  <Route path="/dashboard" element={<ProtectedRoute roles={['admin', 'manager']}><Navigate to="/finance" replace /></ProtectedRoute>} />
                  <Route path="/products" element={<ProtectedRoute roles={['admin', 'manager', 'inventory_staff']}><Products /></ProtectedRoute>} />
                  <Route path="/categories" element={<ProtectedRoute roles={['admin', 'manager', 'inventory_staff']}><Categories /></ProtectedRoute>} />
                  <Route path="/customers" element={<ProtectedRoute roles={['admin', 'manager']}><Customers /></ProtectedRoute>} />
                  <Route path="/suppliers" element={<ProtectedRoute roles={['admin', 'manager', 'inventory_staff']}><Suppliers /></ProtectedRoute>} />
                  <Route path="/purchases" element={<ProtectedRoute roles={['admin', 'manager', 'inventory_staff']}><Purchases /></ProtectedRoute>} />
                  <Route path="/expenses" element={<ProtectedRoute roles={['admin', 'manager']}><Navigate to="/finance" replace /></ProtectedRoute>} />
                  <Route path="/petty-cash" element={<ProtectedRoute roles={['admin', 'manager']}><Navigate to="/finance" replace /></ProtectedRoute>} />
                  <Route path="/inventory" element={<ProtectedRoute roles={['admin', 'manager', 'inventory_staff']}><Inventory /></ProtectedRoute>} />
                  <Route path="/discounts" element={<ProtectedRoute roles={['admin', 'manager']}><Discounts /></ProtectedRoute>} />
                  <Route path="/finance" element={<ProtectedRoute roles={['admin', 'manager']}><Finance /></ProtectedRoute>} />
                  <Route path="/branches" element={<ProtectedRoute roles={['admin']}><Branches /></ProtectedRoute>} />
                  <Route path="/reports" element={<ProtectedRoute roles={['admin', 'manager']}><Navigate to="/finance" replace /></ProtectedRoute>} />
                  <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute roles={['admin']}><Settings /></ProtectedRoute>} />
                  <Route path="/users" element={<ProtectedRoute roles={['admin']}><UserManagement /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </GlobalSearchProvider>
          </AuthCheck>
        </ErrorBoundary>
      </ToastProvider>
    </BrowserRouter>
  );
}