import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import 'leaflet/dist/leaflet.css';
import App from './App';
import './index.css';
import './ui-polish.css';
// Shared shell (identical file in frontend-hrms) — must stay last so it wins.
import './app-shell.css';

// Same theme key as the HRMS app (see frontend-hrms/src/context/ThemeContext.jsx)
// and applied before first paint, so the two workspaces never disagree about
// light/dark and the register never flashes white on load.
try {
  const storedTheme = localStorage.getItem('minimart_theme')
    || localStorage.getItem('hrms_theme');
  document.documentElement.setAttribute('data-theme', storedTheme === 'dark' ? 'dark' : 'light');
} catch { /* private-mode storage can throw */ }

const queryClient = new QueryClient({
  defaultOptions: {
    // Refetch when returning to the tab and when navigating back to a page, so
    // stock, prices and totals reflect the current state without a manual
    // reload. staleTime stays above 0 to collapse duplicate fetches within a
    // short window; queries that need live data opt into refetchInterval.
    queries: {
      retry: (count, err) => count < 1 && (!err?.response || err.response.status >= 500),
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 10000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
