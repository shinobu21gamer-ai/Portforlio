import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useToast } from '../components/Toast';

export default function ResetPassword() {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match', { title: 'Mismatch' });
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters', { title: 'Too short' });
      return;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      toast.error('Password must include uppercase, lowercase, and a number', { title: 'Weak password' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password }, { baseURL: '/api/v1' });
      setSuccess(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid or expired token', { title: 'Error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
          <h1>Reset Password</h1>
          <p>Enter your new password below</p>
        </div>
        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ padding: 16, background: 'var(--success-light)', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
              <strong>Password reset successful!</strong><br />
              You can now log in with your new password.
            </div>
            <Link to="/login" className="btn btn-primary btn-block">→ Go to Login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="rp-token">Reset Token</label>
              <input id="rp-token" className="input-block" type="text" value={token} onChange={e => setToken(e.target.value)} required placeholder="Paste your reset token" />
            </div>
            <div className="field">
              <label htmlFor="rp-password">New Password</label>
              <div className="pw-wrap">
                <input id="rp-password" className="input-block" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" placeholder="Min 8 chars, upper + lower + number" />
                <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)}>{showPw ? '🙈' : '👁'}</button>
              </div>
            </div>
            <div className="field">
              <label htmlFor="rp-confirm">Confirm Password</label>
              <input id="rp-confirm" className="input-block" type={showPw ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>{loading && <span className="btn-spinner" />}{loading ? 'Resetting...' : 'Reset Password'}</button>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <Link to="/login" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>← Back to Login</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
