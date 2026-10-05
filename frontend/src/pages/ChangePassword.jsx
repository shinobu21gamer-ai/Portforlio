import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';
import AuthLayout from '../layouts/AuthLayout';
import api from '../api/client';

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
  let email = '';
  try {
    const stored = JSON.parse(localStorage.getItem('user') || 'null');
    email = stored?.email || '';
  } catch { /* no stored user */ }

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      return toast.error('New password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return toast.error('Password needs an uppercase letter, a lowercase letter and a number');
    }
    if (newPassword !== confirm) {
      return toast.error('New passwords do not match');
    }
    setLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      // The server invalidates all existing tokens on password change.
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not change password');
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-card">
        <h1 className="auth-title leading-tight">Set your<br />password</h1>
        <p className="text-center text-muted" style={{ marginBottom: 16 }}>
          For security, you must set your own password before using the system.
          {email ? <> Account: <strong>{email}</strong>.</> : null}
        </p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Current password"
            />
          </div>
          <div className="field">
            <label>New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="8+ chars, upper, lower, number"
            />
          </div>
          <div className="field">
            <label>Confirm new password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Repeat new password"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Saving…' : 'Set new password'}
          </button>
        </form>
        <div className="text-center" style={{ marginTop: 16 }}>
          <Link to="/login" className="link-strong">← Back to login</Link>
        </div>
      </div>
    </AuthLayout>
  );
}
