import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import AuthLayout from '../layouts/AuthLayout';
import api from '../api/client';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error('No reset token provided');
      navigate('/login');
    }
  }, [token, navigate, toast]);

  const pwValid = (pw) => ({
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /\d/.test(pw),
  });
  const pw = pwValid(password);
  const allValid = pw.length && pw.upper && pw.lower && pw.number && password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
      toast.success('Password reset successful!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-card">
        {success ? (
          <>
            <h1 className="auth-title">Password Reset</h1>
            <p className="text-center text-muted mb-md">
              Your password has been reset successfully.
            </p>
            <Link to="/login" className="btn btn-primary btn-block text-center" style={{ textDecoration: 'none' }}>
              Sign in with new password
            </Link>
          </>
        ) : (
          <>
            <h1 className="auth-title leading-tight">Reset your<br />password</h1>
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>New Password</label>
                <div className="input-wrap">
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  <input className="input with-icon" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="Min 8 characters" />
                  <button type="button" className="pw-toggle" onClick={() => setShowPassword(v => !v)} tabIndex={-1} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword
                      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
                {password.length > 0 && (
                  <div style={{ fontSize: 12, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ color: pw.length ? 'var(--success, #22c55e)' : 'var(--muted-fg)' }}>{pw.length ? '\u2713' : '\u2717'} At least 8 characters</span>
                    <span style={{ color: pw.upper ? 'var(--success, #22c55e)' : 'var(--muted-fg)' }}>{pw.upper ? '\u2713' : '\u2717'} One uppercase letter</span>
                    <span style={{ color: pw.lower ? 'var(--success, #22c55e)' : 'var(--muted-fg)' }}>{pw.lower ? '\u2713' : '\u2717'} One lowercase letter</span>
                    <span style={{ color: pw.number ? 'var(--success, #22c55e)' : 'var(--muted-fg)' }}>{pw.number ? '\u2713' : '\u2717'} One number</span>
                  </div>
                )}
              </div>
              <div className="field">
                <label>Confirm Password</label>
                <div className="input-wrap">
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  <input className="input with-icon" type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={8} placeholder="Re-enter password" />
                  <button type="button" className="pw-toggle" onClick={() => setShowConfirm(v => !v)} tabIndex={-1} aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                    {showConfirm
                      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
                {confirmPassword.length > 0 && (
                  <span style={{ fontSize: 12, marginTop: 4, display: 'block', color: password === confirmPassword ? 'var(--success, #22c55e)' : '#ef4444' }}>
                    {password === confirmPassword ? '\u2713 Passwords match' : '\u2717 Passwords do not match'}
                  </span>
                )}
              </div>
              <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} type="submit" disabled={loading || !allValid}>
                {loading && <span className="btn-spinner" />}{loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          </>
        )}
        <Link to="/login" className="link-strong text-center block mt-sm font-size-14">
          &lt; Back to login
        </Link>
      </div>
    </AuthLayout>
  );
}
