import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
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

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore(s => s.login);
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Please fill in all fields');
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
      toast.error(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo-wrap">
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <rect width="44" height="44" rx="14" fill="var(--primary)"/>
              <circle cx="16" cy="16" r="4" stroke="#fff" strokeWidth="2"/>
              <circle cx="28" cy="16" r="4" stroke="#fff" strokeWidth="2"/>
              <circle cx="22" cy="28" r="4" stroke="#fff" strokeWidth="2"/>
              <path d="M16 16l6 12M28 16l-6 12" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h1>HRMS</h1>
          <p>Human Resource Management System</p>
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
          />
          <Input
            label="Password"
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            floating
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
            <Link to="/forgot-password" className="auth-link">Forgot Password?</Link>
          </div>
          <Button className="auth-submit" type="submit" size="lg" fullWidth loading={loading} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  );
}