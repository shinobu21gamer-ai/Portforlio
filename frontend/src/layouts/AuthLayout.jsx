import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import BrandMark from '../components/BrandMark';

/**
 * Sign-in shell. Renders the same lockup, card and canvas as the HRMS login
 * (see frontend-hrms/src/pages/Login.jsx) so both apps open identically.
 */
export default function AuthLayout({ children, caption = 'Retail operations' }) {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-lockup">
          <BrandMark size="lg" showCopy={false} />
          <div>
            <h1>MiniMart</h1>
            <p>{caption}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
