import { useNavigate } from 'react-router-dom';


export default function NotFound() {
  const navigate = useNavigate();
  return (
      <div className="flex-col flex-center text-center" style={{ height: '100%' }}>
        <h1 className="font-size-48 font-bold text-muted" style={{ marginBottom: 8 }}>404</h1>
        <p className="font-size-18 text-muted mb-lg">Page not found</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Go to Dashboard</button>
      </div>
  );
}
