import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useToast } from '../components/Toast';
import { safeParse } from '../utils/helpers';

/**
 * Forced first-login password change.
 * The server flags certain accounts (e.g. the production first-run admin)
 * with mustChangePassword: every protected route returns
 * 403 { errors: { code: 'MUST_CHANGE_PASSWORD' } } until the user sets
 * their own password here. The API client intercepts that code and sends
 * the user to this screen.
 */
export default function ChangePassword() {
  const toast = useToast();
  const stored = safeParse(localStorage.getItem('hrms_auth'));
  const email = stored?.user?.email || stored?.email || '';
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters.', { title: 'Too short' });
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      toast.error('Password must contain at least one uppercase letter, one lowercase letter, and one number.', { title: 'Weak password' });
      return;
    }
    if (newPassword !== confirm) {
      toast.error('New passwords do not match.', { title: 'Mismatch' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword }, { baseURL: '/api/v1' });
      // The server invalidates all existing tokens on password change, so
      // clear local state and go to a clean login.
      localStorage.removeItem('hrms_auth');
      window.location.href = `${import.meta.env.BASE_URL}login`;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not change password', { title: 'Error' });
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
          <h1>Change Password</h1>
          <p>
            For security, you must set your own password before using the system.
            {email ? <> Account: <strong>{email}</strong>.</> : '.'}
          </p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="cp-current">Current Password</label>
            <input id="cp-current" className="input-block" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <div className="field">
            <label htmlFor="cp-new">New Password</label>
            <input id="cp-new" className="input-block" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} autoComplete="new-password" placeholder="8+ chars, upper, lower, number" />
          </div>
          <div className="field">
            <label htmlFor="cp-confirm">Confirm New Password</label>
            <input id="cp-confirm" className="input-block" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>{loading && <span className="btn-spinner" />}{loading ? 'Saving…' : 'Set New Password'}</button>
        </form>
      </div>
    </div>
  );
}
