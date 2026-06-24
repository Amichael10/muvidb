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
      className="fixed inset-x-0 bottom-0 z-[60] p-4 pb-24 lg:pb-4 lg:p-6 page-fade-in"
    >
      <div className="relative max-w-3xl mx-auto bg-surface border border-border rounded-2xl shadow-2xl shadow-black/40 backdrop-blur-md overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none"></div>
        <div className="relative z-10 p-6 lg:p-7 flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Copy */}
          <div className="flex items-start gap-4 flex-1">
            <div className="hidden sm:flex flex-shrink-0 w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 items-center justify-center">
              <Icon icon="solar:cookie-bold" className="text-brand text-xl" />
            </div>
            <div className="space-y-2">
              <h3 className="text-[11px] font-black text-text-primary uppercase tracking-[0.2em]">
                We value your privacy
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                MuviDB uses essential cookies to keep you signed in, plus optional
                analytics cookies to understand how the site is used so we can improve it.
                You can accept or decline analytics — your choice is remembered. Read more in our{' '}
                <Link to="/privacy" className="text-brand hover:underline font-bold">
                  Privacy Policy
                </Link>.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={() => handleChoice(false)}
              className="px-6 py-3 rounded-xl border border-border text-text-secondary text-[10px] font-black uppercase tracking-widest hover:border-text-muted hover:text-text-primary active:scale-95 transition-all"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => handleChoice(true)}
              className="px-6 py-3 rounded-xl bg-brand text-on-brand text-[10px] font-black uppercase tracking-widest hover:bg-brand-hover active:scale-95 transition-all shadow-lg shadow-brand/20"
            >
              Accept Analytics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
