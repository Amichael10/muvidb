import {createRoot} from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import './index.css';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';

// Initialize PostHog for Analytics and Error Tracking.
// Capture is opt-out by default: no non-essential analytics fire until the user
// accepts via the cookie consent banner (see components/CookieConsent.jsx).
// Session replay is disabled — we only collect aggregate analytics.
if (import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only', // Captures users when they log in
    opt_out_capturing_by_default: true, // Wait for explicit consent before capturing
    disable_session_recording: true,    // Never record screen-activity replays
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
