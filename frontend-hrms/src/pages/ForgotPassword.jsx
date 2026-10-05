import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import Swal from 'sweetalert2';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  // Present only outside production when SMTP is not configured — the server
  // hands back the reset link so a dev/demo deployment can still complete a
  // reset. Production never includes this field.
  const [devResetUrl, setDevResetUrl] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email }, { baseURL: '/api/v1' });
      setDevResetUrl(res.data?.data?.devResetUrl || '');
      setSent(true);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.message || 'Something went wrong' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
          <h1>Forgot Password</h1>
          <p>Enter your email to receive a reset link</p>
        </div>
        {sent ? (
          <div className="text-center">
            <div className="p-md mb-md text-sm" style={{ background: 'var(--success-bg, #d4edda)', borderRadius: 8 }}>
              If the email <strong>{email}</strong> exists in our system, a reset link has been sent.
            </div>
            {devResetUrl ? (
              <div className="p-md mb-md text-sm" style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, textAlign: 'left' }}>
                <strong>Dev mode — SMTP is not configured.</strong><br />
                Your reset link (valid 1 hour):<br />
                <a href={devResetUrl} style={{ wordBreak: 'break-all' }}>{devResetUrl}</a>
              </div>
            ) : null}
            <Link to="/login" className="btn btn-primary btn-block">← Back to Login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="fp-email">Email Address</label>
              <input id="fp-email" className="input-block" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="your@email.com" autoComplete="email" />
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>{loading && <span className="btn-spinner" />}{loading ? 'Sending...' : 'Send Reset Link'}</button>
            <div className="text-center mt-sm-12">
              <Link to="/login" className="text-sm text-muted" style={{ textDecoration: 'none' }}>← Back to Login</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
