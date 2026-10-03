import { lazy, Suspense, useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import useAuthStore from './store/authStore';
import api from './api/client';
import axios from 'axios';
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
    const urlSsoToken = params.get('sso_token');
    const returnTo = params.get('returnTo');
    const embedded = window.top !== window;

    let settled = false;
    const finish = () => { if (!settled) { settled = true; setChecking(false); } };

    // Logout must revoke server-side, not just clear localStorage. Clearing
    // locally leaves the JWT valid until it expires on its own, which is what
    // caused "Token has been revoked" on the next sign-in with a new account.
    const revokeCurrentSession = async () => {
      const stale = localStorage.getItem('token');
      if (stale && stale !== 'null' && stale !== '') {
        try {
          await axios.post(`${api.defaults.baseURL}/auth/logout`, {}, {
            headers: { Authorization: `Bearer ${stale}` },
          });
        } catch { /* already invalid or offline — clear locally regardless */ }
      }
      logout();
    };

    const authenticateWithToken = async (ssoToken) => {
      if (!ssoToken) { finish(); return; }
      // Must read localStorage — authStore persists the token there. Reading
      // sessionStorage always returned null, so a stale session from a previous
      // account was never cleared before the new one was applied.
      const currentToken = localStorage.getItem('token');
      if (currentToken && currentToken !== ssoToken) {
        await revokeCurrentSession();
      }
      window.history.replaceState({}, '', window.location.pathname);
      try {
        const res = await api.get('/auth/profile', { headers: { Authorization: `Bearer ${ssoToken}` } });
        const u = res.data.data;
        login(u, ssoToken, null);
        if (returnTo && returnTo.startsWith('/') && !returnTo.includes('://')) {
          navigate(returnTo, { replace: true });
        }
      } catch (err) {
        console.error('SSO failed:', err);
        if (embedded) {
          setSsoError('SSO authentication failed. Please return to HRMS and try again.');
          window.parent.postMessage({ type: 'pos-auth-failed', error: err?.response?.data?.message || 'Authentication failed' }, HRMS_ORIGIN);
        }
      }
      finish();
    };

    const validateStoredSession = () => {
      if (isAuthenticated && token) {
        api.get('/auth/profile').catch(() => revokeCurrentSession()).finally(finish);
      } else {
        finish();
      }
    };

    // Legacy URL handoff (older HRMS builds): authenticate, then strip the token.
    if (urlSsoToken) {
      window.history.replaceState({}, '', window.location.pathname);
      authenticateWithToken(urlSsoToken);
      return;
    }

    if (!embedded) {
      validateStoredSession();
      return;
    }

    // Embedded in HRMS: request a token over postMessage and wait for it.
    const onMessage = (e) => {
      if (e.origin !== HRMS_ORIGIN) return;
      if (e.data?.type === 'pos-auth-token' && e.data.token) {
        authenticateWithToken(e.data.token);
      }
    };
    window.addEventListener('message', onMessage);
    try { window.parent.postMessage({ type: 'pos-ready' }, HRMS_ORIGIN); } catch { /* ignore */ }
    const fallback = setTimeout(validateStoredSession, 4000);

    return () => {
      clearTimeout(fallback);
      window.removeEventListener('message', onMessage);
    };
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
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

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
    if (!isAuthenticated) return;
    const isMeta = e.metaKey || e.ctrlKey;
    if (isMeta && e.key === 'k') {
      e.preventDefault();
      setSearchOpen(true);
    }
    if (e.key === 'Escape' && searchOpen) {
      e.preventDefault();
      setSearchOpen(false);
    }
  }, [searchOpen, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated && searchOpen) setSearchOpen(false);
  }, [isAuthenticated, searchOpen]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      {children}
      <GlobalSearch isOpen={searchOpen && isAuthenticated} onClose={() => setSearchOpen(false)} onSelect={handleSearchSelect} />
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
                  <Route path="/pos" element={<ProtectedRoute><Pos /></ProtectedRoute>} />
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