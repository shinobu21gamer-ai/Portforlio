import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';
import AuthLayout from '../layouts/AuthLayout';
import api from '../api/client';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetLink, setResetLink] = useState('');
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setSent(true);
      if (res.data?.data?.resetLink) {
        setResetLink(res.data.data.resetLink);
      }
      toast.success('If the email exists, a reset link has been sent.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-card">
        <h1 className="auth-title leading-tight">Forgot your<br />password?</h1>
        {sent ? (
          <>
            <p className="text-center text-muted">
              If the email <strong>{email}</strong> exists in our system, a password reset link has been sent. Check your inbox and spam folder.
            </p>
            {resetLink && import.meta.env.DEV && (
              <div style={{ marginTop: 16, padding: 12, background: 'var(--muted)', borderRadius: 8, fontSize: 13 }}>
                <strong>Dev Mode:</strong>{' '}
                <Link to={resetLink} className="link-strong">Click here to reset password</Link>
              </div>
            )}
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email</label>
              <div className="input-wrap">
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v16H4z"/><polyline points="22,6 12,13 2,6"/></svg>
                <input className="input with-icon" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="Enter your email" />
              </div>
            </div>
            <button className="btn btn-primary btn-block" type="submit" style={{ marginTop: 14 }} disabled={loading}>
              {loading && <span className="btn-spinner" />}{loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}
        <Link to="/login" className="link-strong text-center block mt-sm font-size-14">
          &lt; Back to login
        </Link>
      </div>
    </AuthLayout>
  );
}
