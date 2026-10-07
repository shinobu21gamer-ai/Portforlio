import { useNavigate } from 'react-router-dom';
import BrandMark from '../components/BrandMark';

/**
 * 404 — identical card, lockup and copy to the POS build's NotFound
 * (frontend/src/pages/NotFound.jsx); only the return target differs. Rendered
 * outside the app layouts (an unknown URL has no sidebar to belong to), so it
 * sits on the sign-in canvas.
 */
export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="auth-page">
      <div className="status-card">
        <BrandMark size="lg" showCopy={false} className="notfound-mark" />
        <div className="notfound-code">404</div>
        <h2 className="notfound-title">Page not found</h2>
        <p className="pay-status-text">
          The page you're looking for doesn't exist, or you don't have access to it.
        </p>
        <div className="pay-status-actions">
          <button className="btn btn-primary" onClick={() => navigate('/')}>Back to dashboard</button>
        </div>
      </div>
    </div>
  );
}
