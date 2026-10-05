import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import 'leaflet/dist/leaflet.css';

const queryClient = new QueryClient({
  defaultOptions: {
    // refetchOnMount was false and staleTime 60s, so revisiting a page served a
    // cached response and the only way to see fresh data was a full reload.
    // Now refetch on mount and on window focus; staleTime stays above 0 to
    // collapse duplicate fetches, and queries needing live data opt into
    // refetchInterval.
    queries: { retry: 1, refetchOnWindowFocus: true, refetchOnMount: true, staleTime: 10000, gcTime: 300000 },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename="/hrms">
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
