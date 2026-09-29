import { useEffect } from 'react';

export default function Login() {
  useEffect(() => {
    const hrmsUrl = import.meta.env.VITE_HRMS_URL || `${window.location.origin}/hrms`;
    if (hrmsUrl) {
      window.location.replace(hrmsUrl);
    }
  }, []);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'radial-gradient(1100px 520px at 50% -8%, rgba(99,102,241,0.20) 0%, rgba(99,102,241,0) 62%), linear-gradient(180deg, #eef2ff 0%, #e0e7ff 55%, #eef2ff 100%)',
      }}
    >
      <p style={{ color: '#4338ca', fontSize: 14, fontWeight: 500 }}>Redirecting to HRMS login...</p>
    </div>
  );
}
