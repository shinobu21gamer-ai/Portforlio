import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import 'leaflet/dist/leaflet.css';
import App from './App';
import './index.css';
import './ui-polish.css';

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
