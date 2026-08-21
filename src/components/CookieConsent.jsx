import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import posthog from 'posthog-js';

const STORAGE_KEY = 'muvidb_cookie_consent';

/**
 * Lightweight, in-house cookie consent banner.
 *
 * Analytics (PostHog) is initialised opt-out by default in main.tsx, so no
 * non-essential cookies fire until the user explicitly accepts here. This banner
 * simply records the choice and flips PostHog's capture state accordingly.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let choice = null;
    try {
      choice = localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage unavailable (private mode / blocked) — show the banner.
    }

    if (choice === 'accepted') {
      applyConsent(true);
    } else if (choice === 'rejected') {
      applyConsent(false);
    } else {
      setVisible(true);
    }

    // Allow other parts of the app (e.g. a footer "Cookie settings" link) to
    // reopen the banner so users can change their choice at any time.
    const reopen = () => setVisible(true);
    window.addEventListener('open-cookie-consent', reopen);
    return () => window.removeEventListener('open-cookie-consent', reopen);
  }, []);

  const applyConsent = (accepted) => {
    try {
      if (accepted) {
        posthog?.opt_in_capturing?.();
      } else {
        posthog?.opt_out_capturing?.();
      }
    } catch {
      // PostHog not configured (no key) — nothing to toggle.
    }
  };

  const handleChoice = (accepted) => {
    try {
      localStorage.setItem(STORAGE_KEY, accepted ? 'accepted' : 'rejected');
    } catch {
      // Ignore storage failures; consent still applies for this session.
    }
    applyConsent(accepted);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[60] p-3 pb-20 sm:p-4 sm:pb-24 lg:pb-4 lg:p-6 pointer-events-none consent-rise"
    >
      {/* Scrim: light fade to separate from hero without completely blinding the screen */}
      <div className="absolute inset-x-0 bottom-0 -top-8 bg-gradient-to-t from-bg via-bg/80 to-transparent pointer-events-none" />

      <div className="relative pointer-events-auto max-w-2xl lg:max-w-3xl mx-auto bg-surface/95 backdrop-blur-xl border border-border rounded-xl sm:rounded-2xl shadow-2xl shadow-black/80 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent pointer-events-none"></div>
        <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none"></div>
        <div className="relative z-10 p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center gap-3 sm:gap-6">
          {/* Copy */}
          <div className="flex items-start gap-3 sm:gap-4 flex-1">
            <div className="flex flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-brand/15 border border-brand/30 items-center justify-center text-brand">
              <Icon icon="solar:shield-check-bold" className="text-lg sm:text-xl" />
            </div>
            <div className="space-y-1 sm:space-y-1.5">
              <h3 className="text-xs font-black text-text-primary uppercase tracking-wider flex items-center gap-2">
                <span>Privacy & Cookies</span>
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                MuviDB uses essential cookies to keep you signed in. Optional analytics
                (PostHog) run only if you accept — under Nigeria’s NDPA 2023. Details in our{' '}
                <Link to="/privacy" className="text-brand hover:underline font-bold">
                  Privacy Policy
                </Link>.
              </p>
            </div>
          </div>

          {/* Actions: Side-by-side on mobile to save vertical height */}
          <div className="flex flex-row sm:flex-row gap-2 sm:gap-3 flex-shrink-0 pt-1 sm:pt-0">
            <button
              type="button"
              onClick={() => handleChoice(false)}
              className="flex-1 sm:flex-initial px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border border-border bg-surface-2 text-text-secondary text-xs font-bold tracking-wider hover:border-text-muted hover:text-text-primary active:scale-95 transition-all min-h-[44px] flex items-center justify-center"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => handleChoice(true)}
              className="flex-1 sm:flex-initial px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-brand text-on-brand text-xs font-bold tracking-wider hover:bg-brand-hover active:scale-95 transition-all shadow-lg shadow-brand/20 min-h-[44px] flex items-center justify-center"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
