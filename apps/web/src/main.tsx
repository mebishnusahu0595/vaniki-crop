import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import './index.css';
import './i18n';

const PRELOAD_RELOAD_KEY = 'vaniki-preload-reload-count';

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();

    const reloadCount = Number(window.sessionStorage.getItem(PRELOAD_RELOAD_KEY) || '0');
    if (reloadCount >= 1) {
      return;
    }

    window.sessionStorage.setItem(PRELOAD_RELOAD_KEY, String(reloadCount + 1));
    window.location.reload();
  });

  // If app stays stable for a few seconds, allow auto-recovery for a future deploy.
  window.setTimeout(() => {
    window.sessionStorage.removeItem(PRELOAD_RELOAD_KEY);
  }, 10000);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </HelmetProvider>
  </StrictMode>,
);
