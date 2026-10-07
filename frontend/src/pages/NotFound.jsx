import { useNavigate } from 'react-router-dom';
import PosLayout from '../layouts/PosLayout';
import BrandMark from '../components/BrandMark';

/**
 * 404 — identical card, lockup and copy to the HRMS build's NotFound
 * (frontend-hrms/src/pages/NotFound.jsx); only the return target differs.
 */
export default function NotFound() {
  const navigate = useNavigate();
  return (
    <PosLayout active="">
      <div className="page-error-wrap">
        <div className="status-card">
          <BrandMark size="lg" showCopy={false} className="notfound-mark" />
          <div className="notfound-code">404</div>
          <h2 className="notfound-title">Page not found</h2>
          <p className="pay-status-text">
            The page you're looking for doesn't exist, or you don't have access to it.
          </p>
          <div className="pay-status-actions">
            <button className="btn btn-primary" onClick={() => navigate('/')}>Back to register</button>
          </div>
        </div>
      </div>
    </PosLayout>
  );
}
