import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function AuthLayout({ children }) {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return (
    <div className="auth-page">
      <div className="auth-bg">
        <img src="/minimart.svg" alt="" className="auth-bg-img" />
      </div>
      {children}
    </div>
  );
}
