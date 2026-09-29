import { useNavigate } from 'react-router-dom';
import PosLayout from '../layouts/PosLayout';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <PosLayout active="">
      <div className="flex-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <div className="font-size-48 font-bold text-muted" style={{ lineHeight: 1 }}>404</div>
          <h2 className="mt-sm mb-xs">Page Not Found</h2>
          <p className="text-muted font-size-14 mb-lg">The page you're looking for doesn't exist.</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>Back to POS</button>
        </div>
      </div>
    </PosLayout>
  );
}
