import {createRoot} from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import './index.css';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';

// Initialize PostHog for Analytics, Session Replay, and Error Tracking
if (import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only', // Captures users when they log in
  });
}

console.log("main.tsx: Starting render...");

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <HelmetProvider>
      <PostHogProvider client={posthog}>
        <App />
      </PostHogProvider>
    </HelmetProvider>
  );
} else {
  console.error("Root not found");
}
