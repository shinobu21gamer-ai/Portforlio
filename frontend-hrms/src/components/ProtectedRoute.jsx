import { useEffect } from 'react';
import useAuthStore from '../store/authStore';
import { useNavigate, useLocation } from 'react-router-dom';

export default function ProtectedRoute({ children, allowedRoles }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location } });
    }
  }, [isAuthenticated, navigate, location]);

  if (!isAuthenticated) return null;

  if (allowedRoles && (!user?.role?.slug || !allowedRoles.includes(user.role.slug))) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Access Denied</h1>
        <p style={{ color: '#666', marginBottom: 16 }}>You don't have permission to view this page.</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Go to Dashboard</button>
      </div>
    );
  }

  return children;
}
