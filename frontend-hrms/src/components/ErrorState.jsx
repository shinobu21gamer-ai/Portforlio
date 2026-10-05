import Button from './Button';

/**
 * Display error state for data screens (kit component — shared with HRMS).
 * Pair with react-query: {isError ? <ErrorState message={...} onRetry={refetch} /> : ...}
 */
export default function ErrorState({ message = 'Something went wrong while loading this data.', onRetry, retrying = false }) {
  return (
    <div className="error-state" role="alert">
      <div className="error-state__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h3>Couldn't load data</h3>
      <p>{message}</p>
      {typeof onRetry === 'function' && (
        <Button variant="secondary" size="sm" onClick={onRetry} disabled={retrying}>
          {retrying ? 'Retrying…' : 'Try again'}
        </Button>
      )}
    </div>
  );
}
