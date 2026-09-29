import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';

const HRMS_URL = import.meta.env.VITE_HRMS_URL || (typeof window !== 'undefined' ? window.location.origin + '/hrms' : '');

export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();
  const isPaymentPage = location.pathname.startsWith('/payment/');

  if (!isAuthenticated) {
    if (isPaymentPage) {
      return children;
    }
    if (window.top !== window) {
      const hrmsOrigin = HRMS_URL ? new URL(HRMS_URL).origin : window.parent.origin;
      window.parent.postMessage({ type: 'pos-auth-failed', error: 'Not authenticated' }, hrmsOrigin);
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc' }}>
          <div style={{ textAlign: 'center', padding: 32 }}>
            <p style={{ color: '#64748b', fontSize: 14 }}>Authentication required. Please return to HRMS.</p>
          </div>
        </div>
      );
    }
    if (HRMS_URL) {
      window.location.replace(HRMS_URL);
    }
    return null;
  }

  if (roles) {
    const userRole = user?.role?.slug || (typeof user?.role === 'string' ? user.role : null);
    if (!userRole || !roles.includes(userRole)) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}
