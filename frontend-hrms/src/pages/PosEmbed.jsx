import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function PosEmbed({ page, onClose }) {
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [posActive, setPosActive] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef(null);

  const posBase = import.meta.env.VITE_POS_URL || window.location.origin;
  const posUrl = `${posBase}${page || '/pos'}`;
  const posOrigin = (() => { try { return new URL(posBase, window.location.origin).origin; } catch { return window.location.origin; } })();

  const sendToken = useCallback(() => {
    if (!token) return;
    try {
      iframeRef.current?.contentWindow?.postMessage({ type: 'pos-auth-token', token }, posOrigin);
    } catch { /* ignore */ }
  }, [token, posOrigin]);

  useEffect(() => {
    setLoaded(false);
    setIframeKey(k => k + 1);
  }, [token]);
  const handleClose = useCallback(() => {
    setPosActive(false);
    if (onClose) onClose();
    else {
      const slug = user?.role?.slug;
      if (slug === 'cashier') navigate('/my-attendance');
      else if (slug === 'inventory_staff') navigate('/inventory-dashboard');
      else navigate('/');
    }
  }, [onClose, navigate, user]);

  useEffect(() => {
    let authFailedOnce = false;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    const handleMessage = (e) => {
      if (e.origin !== posOrigin) return;

      if (e.data?.type === 'pos-ready') {
        sendToken();
        return;
      }
      if (e.data?.type === 'pos-logout' || e.data?.type === 'pos-back-to-hrms') {
        handleClose();
      }
      if (e.data?.type === 'pos-auth-failed') {
        if (!authFailedOnce && retryCount < 2) {
          authFailedOnce = true;
          setRetryCount(c => c + 1);
          setLoaded(false);
          setIframeKey(k => k + 1);
        } else {
          setAuthError(e.data.error || 'POS authentication failed');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('message', handleMessage);
    };
  }, [handleClose, retryCount, posOrigin, sendToken]);

  useEffect(() => {
    if (loaded || authError) return;
    const timer = setTimeout(() => setAuthError('Timed out loading POS. Please try again.'), 20000);
    return () => clearTimeout(timer);
  }, [loaded, authError, iframeKey]);

  if (!posActive) return null;

  if (!token) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#64748b', fontSize: 14 }}>Authenticating...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: 32, maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#x26A0;</div>
          <h2 style={{ color: '#0f172a', fontSize: 18, fontWeight: 600, marginBottom: 8 }}>POS Authentication Failed</h2>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>{authError}</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              onClick={() => { setAuthError(null); setRetryCount(0); setLoaded(false); setIframeKey(k => k + 1); }}
              style={{
                padding: '10px 20px', borderRadius: 8, background: '#6366f1', color: '#fff',
                border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              }}
            >
              Retry
            </button>
            <button
              onClick={handleClose}
              style={{
                padding: '10px 20px', borderRadius: 8, background: '#e2e8f0', color: '#0f172a',
                border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              }}
            >
              Back to HRMS
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#fff' }}>
      <button
        onClick={handleClose}
        style={{
          position: 'fixed', top: 12, left: 12, zIndex: 1001,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 8,
          background: 'rgba(0,0,0,0.7)', color: '#fff',
          border: 'none', fontSize: 13, fontWeight: 500,
          cursor: 'pointer', backdropFilter: 'blur(8px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.85)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to HRMS
      </button>

      {!loaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ color: '#64748b', fontSize: 14 }}>Loading POS...</p>
          </div>
        </div>
      )}

      <iframe
        key={iframeKey}
        ref={iframeRef}
        src={posUrl}
        onLoad={() => { setLoaded(true); sendToken(); }}
        style={{
          width: '100%', height: '100%', border: 'none',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
        title="Point of Sale"
      />
    </div>
  );
}
