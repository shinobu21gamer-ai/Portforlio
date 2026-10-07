import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import BrandMark from '../components/BrandMark';
import { useToast } from '../components/Toast';
import api from '../api/client';
import Input from '../components/Input';
import Button from '../components/Button';

const ROLE_REDIRECTS = {
  cashier: '/pos',
  manager: '/pos',
  inventory_staff: '/pos',
};

const ROUTE_ROLE_ACCESS = [
  { paths: ['/my-profile', '/my-attendance', '/my-leaves', '/my-payslips', '/my-contracts'], roles: ['employee', 'cashier', 'inventory_staff'] },
  { paths: ['/employees', '/departments', '/attendance', '/schedules', '/jobs', '/interviews', '/contracts', '/leaves', '/payroll'], roles: ['admin', 'hr', 'manager'] },
  { paths: ['/inventory-dashboard', '/products', '/categories', '/suppliers', '/inventory', '/purchases'], roles: ['inventory_staff'] },
];

function isPathAllowed(pathname, roleSlug) {
  for (const rule of ROUTE_ROLE_ACCESS) {
    if (rule.paths.some(p => pathname === p || pathname.startsWith(p + '/'))) {
      return rule.roles.includes(roleSlug);
    }
  }
  return true;
}

const REMEMBER_KEY = 'hrms_login_email';

export default function Login() {
  const [email, setEmail] = useState(() => localStorage.getItem(REMEMBER_KEY) || '');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(() => Boolean(localStorage.getItem(REMEMBER_KEY)));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Store branding for the login card, sourced from the brand-safe public
  // settings endpoint; falls back to the static defaults below on failure.
  const [storeName, setStoreName] = useState('MiniMart');
  const login = useAuthStore(s => s.login);
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/public/settings', { headers: { Accept: 'application/json' } })
      .then(r => (r.ok ? r.json() : null))
      .then(payload => {
        if (!cancelled && payload?.data?.storeName) setStoreName(payload.data.storeName);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      toast.error('Please fill in all fields');
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password }, { baseURL: '/api/v1' });
      const json = res.data;
      if (!json.success) {
        const errors = json.errors;
        if (errors && errors.length) throw new Error(errors.join('. '));
        throw new Error(json.message || 'Login failed');
      }
      const { user, token, refreshToken } = json.data;
      login(user, token, refreshToken);

      // Forced first-login password change (e.g. production first-run admin):
      // don't land on a page that will immediately 403 — go straight to the
      // change-password screen.
      if (user?.mustChangePassword) {
        window.location.href = `${import.meta.env.BASE_URL}change-password`;
        return;
      }

      // Persist/forget the remembered email (the checkbox reflects intent).
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, email.trim());
        else localStorage.removeItem(REMEMBER_KEY);
      } catch { /* private-mode storage can throw — non-fatal */ }

      const roleSlug = user?.role?.slug;
      const redirectPath = ROLE_REDIRECTS[roleSlug];
      if (redirectPath) {
        navigate(redirectPath, { replace: true });
        return;
      }

      if (isPathAllowed(from, roleSlug)) {
        navigate(from, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Login failed';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <BrandMark size="lg" showCopy={false} />
          <h1>{storeName}</h1>
          <p>Sign in to your staff account</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            floating
            data-testid="login-email"
          />
          <Input
            label="Password"
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            floating
            data-testid="login-password"
            trailingSlot={(
              <button
                type="button"
                className="password-toggle"
                aria-label={showPw ? 'Hide password' : 'Show password'}
                onClick={() => setShowPw(!showPw)}
              >
                {showPw
                  ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            )}
          />
          <div className="auth-options">
            <label className="remember-me" title="Pre-fill your email next time">
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                style={{ accentColor: 'var(--primary)' }}
              />
              Remember email
            </label>
            <Link to="/forgot-password" className="auth-link">Forgot Password?</Link>
          </div>
          {error ? (
            <div
              role="alert"
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                background: 'var(--danger-light, rgba(239, 68, 68, .09))',
                border: '1px solid var(--color-danger-200, rgba(239, 68, 68, .35))',
                color: 'var(--danger, #b91c1c)',
                fontSize: 13.5,
                fontWeight: 500,
              }}
            >
              {error}
            </div>
          ) : null}
          <Button className="auth-submit" type="submit" size="lg" fullWidth loading={loading} disabled={loading} data-testid="login-submit">
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
          <a href="/" className="auth-link" style={{ display: 'block', textAlign: 'center', marginTop: 12 }}>← Back to Home</a>
        </form>
      </div>
    </div>
  );
}