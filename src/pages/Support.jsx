import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../context/AuthContext';

const PRESET_AMOUNTS = [
  {
    amount: 1000,
    label: '₦1,000',
    tierName: 'Seed Supporter',
    tagline: 'Powers daily search and fast database lookups',
    icon: 'solar:cup-bold',
  },
  {
    amount: 2500,
    label: '₦2,500',
    tierName: 'Reel Patron',
    tagline: 'Covers OCR credit roll extraction for 1 feature film',
    icon: 'solar:clapperboard-play-bold',
    popular: true,
  },
  {
    amount: 5000,
    label: '₦5,000',
    tierName: 'Cinema Champion',
    tagline: 'Funds image optimization and talent cataloging',
    icon: 'solar:star-bold',
  },
  {
    amount: 10000,
    label: '₦10,000',
    tierName: 'Heritage Guardian',
    tagline: 'Maintains historical Nollywood catalog & redundancy',
    icon: 'solar:shield-check-bold',
  },
];

export default function Support() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const isSuccess = searchParams.get('status') === 'success' || searchParams.get('payment') === 'success';
  const paymentRef = searchParams.get('ref') || searchParams.get('orderNo');
  const paidAmount = searchParams.get('amount');

  const [selectedAmount, setSelectedAmount] = useState(2500);
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [supporterName, setSupporterName] = useState('');
  const [supporterEmail, setSupporterEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Auto-fill logged in user info if available
  useEffect(() => {
    if (user?.email && !supporterEmail) {
      setSupporterEmail(user.email);
    }
    if (user?.name && !supporterName) {
      setSupporterName(user.name);
    }
  }, [user]);

  const activeAmount = isCustom ? Number(customAmount || 0) : selectedAmount;

  const handlePresetSelect = (amt) => {
    setIsCustom(false);
    setSelectedAmount(amt);
    setCustomAmount('');
    setError(null);
  };

  const handleCustomChange = (e) => {
    const val = e.target.value.replace(/\D/g, '');
    setIsCustom(true);
    setCustomAmount(val);
    setError(null);
  };

  const handleSupportCheckout = async (e) => {
    e.preventDefault();
    setError(null);

    if (!activeAmount || activeAmount < 200) {
      setError('Please choose or enter a contribution amount of at least ₦200.');
      return;
    }

    if (!supporterEmail || !supporterEmail.includes('@')) {
      setError('Please provide a valid email address so we can send your contribution receipt.');
      return;
    }

    setLoading(true);

    try {
      const returnUrl = `${window.location.origin}/support?status=success`;
      const cancelUrl = `${window.location.origin}/support`;

      const res = await fetch('/api/data?key=bachs&op=initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: activeAmount,
          currency: 'NGN',
          planType: 'support',
          userName: supporterName || 'Anonymous Cinephile',
          userEmail: supporterEmail,
          returnUrl,
          cancelUrl,
        }),
      });

      const data = await res.json();

      const targetUrl = data.checkoutUrl || data.cashierUrl;
      if (!res.ok || !data.success || !targetUrl) {
        throw new Error(data.error || 'Failed to initialize payment checkout. Please try again.');
      }

      // Seamless redirect to hosted checkout
      window.location.href = targetUrl;
    } catch (err) {
      console.error('[Support] Checkout error:', err);
      setError(err.message || 'Payment service is temporarily unavailable. Please try again in a moment.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text-primary selection:bg-brand selection:text-white pb-24">
      {/* Subtle brand ambiance */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-80 bg-gradient-to-b from-brand/10 via-brand/2 to-transparent blur-3xl pointer-events-none -z-10" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-14">
        {/* SUCCESS CELEBRATION BANNER */}
        {isSuccess && (
          <div className="mb-12 p-8 rounded-2xl bg-surface border border-brand/30 shadow-[0_12px_40px_rgba(255,90,31,0.12)] text-center animate-in zoom-in-95 duration-300">
            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-brand/15 border border-brand/30 flex items-center justify-center text-brand">
              <Icon icon="solar:heart-bold" className="w-8 h-8 animate-pulse" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-text-primary tracking-tight">
              Thank You for Fueling African Cinema!
            </h2>
            <p className="mt-2 text-sm sm:text-base text-text-secondary max-w-xl mx-auto leading-relaxed">
              Your contribution directly funds server uptime, credit archiving, and ensures MuviDB remains 100% free for everyone.
            </p>
            {paymentRef && (
              <div className="mt-4 inline-block px-4 py-1.5 rounded-lg bg-surface-2 border border-border text-xs font-mono text-text-muted">
                Reference: <span className="text-text-primary font-bold">{paymentRef}</span>
                {paidAmount && <span> • ₦{Number(paidAmount).toLocaleString()}</span>}
              </div>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/"
                className="px-6 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-md"
              >
                Back to Archive
              </Link>
              <Link
                to="/browse"
                className="px-6 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary font-bold text-xs uppercase tracking-wider hover:bg-surface-3 transition-colors"
              >
                Discover Films
              </Link>
            </div>
          </div>
        )}

        {/* HERO HEADER */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/10 border border-brand/25 text-brand text-[11px] font-bold tracking-widest uppercase mb-4">
            <Icon icon="solar:heart-bold" className="w-3.5 h-3.5" />
            <span>Community-Powered Heritage</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-heading font-black tracking-tight text-text-primary leading-tight">
            Keep Nollywood &amp; African Cinema Free For Everyone.
          </h1>

          <p className="mt-4 sm:mt-5 text-sm sm:text-base text-text-secondary leading-relaxed max-w-2xl mx-auto">
            We don’t believe in charging actors for profile representation, putting film credits behind paywalls, or restricting public discovery. MuviDB is open to all.
            Your voluntary contribution keeps our cloud servers online and our archival scanners running.
          </p>
        </div>

        {/* MAIN BENTO SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* CONTRIBUTION FORM (7 Cols) */}
          <div className="lg:col-span-7 bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-xl relative">
            <div className="flex items-center justify-between pb-6 border-b border-border mb-6">
              <div>
                <h2 className="text-lg font-heading font-bold text-text-primary">Choose Your Contribution</h2>
                <p className="text-xs text-text-muted mt-0.5">Pay securely via Cards, Bank Transfer, USSD, or QR</p>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-2 border border-border text-[10px] font-mono text-text-secondary">
                <Icon icon="solar:shield-check-bold" className="w-3.5 h-3.5 text-brand" />
                <span>Secure Checkout</span>
              </div>
            </div>

            <form onSubmit={handleSupportCheckout} className="space-y-6">
              {/* Preset Cards Grid */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {PRESET_AMOUNTS.map((tier) => {
                  const isSelected = !isCustom && selectedAmount === tier.amount;
                  return (
                    <button
                      key={tier.amount}
                      type="button"
                      onClick={() => handlePresetSelect(tier.amount)}
                      className={`relative p-4 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
                        isSelected
                          ? 'bg-brand/10 border-brand shadow-[0_0_20px_rgba(255,90,31,0.15)] ring-1 ring-brand'
                          : 'bg-surface-2 border-border hover:border-brand/40 hover:bg-surface-3'
                      }`}
                    >
                      {tier.popular && (
                        <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-md bg-brand text-white text-[9px] font-black uppercase tracking-wider shadow-sm">
                          Popular
                        </span>
                      )}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Icon
                            icon={tier.icon}
                            className={`w-5 h-5 ${isSelected ? 'text-brand' : 'text-text-muted'}`}
                          />
                          {isSelected && (
                            <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-brand" />
                          )}
                        </div>
                        <div className="text-lg sm:text-xl font-heading font-black text-text-primary">
                          {tier.label}
                        </div>
                        <div className="text-xs font-semibold text-text-primary mt-0.5">
                          {tier.tierName}
                        </div>
                      </div>
                      <div className="text-[11px] text-text-muted mt-2 leading-tight">
                        {tier.tagline}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Amount Field */}
              <div className="pt-1">
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                  Or Enter a Custom Amount (₦)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-text-muted">
                    ₦
                  </span>
                  <input
                    type="text"
                    value={customAmount}
                    onChange={handleCustomChange}
                    placeholder="e.g. 15,000"
                    className={`w-full pl-9 pr-4 py-3 rounded-xl bg-surface-2 border text-sm font-bold text-text-primary placeholder-text-muted focus:outline-none transition-all ${
                      isCustom && customAmount
                        ? 'border-brand ring-1 ring-brand'
                        : 'border-border focus:border-brand'
                    }`}
                  />
                </div>
              </div>

              {/* Supporter Details */}
              <div className="space-y-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                    Your Email <span className="text-brand">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={supporterEmail}
                    onChange={(e) => setSupporterEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                    Your Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={supporterName}
                    onChange={(e) => setSupporterName(e.target.value)}
                    placeholder="e.g. Adewale K. or Leave blank for Anonymous"
                    className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                    Message / Note (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Leave a word of encouragement for the archive..."
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-brand resize-none"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                  <Icon icon="solar:danger-triangle-bold" className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 rounded-xl bg-brand hover:bg-brand-hover text-white font-heading font-bold text-sm uppercase tracking-wider shadow-[0_4px_20px_rgba(255,90,31,0.25)] hover:shadow-[0_6px_25px_rgba(255,90,31,0.35)] transition-all duration-200 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>Connecting to Secure Checkout...</span>
                  </>
                ) : (
                  <>
                    <Icon icon="solar:heart-bold" className="w-5 h-5 text-white" />
                    <span>Contribute ₦{activeAmount.toLocaleString()}</span>
                  </>
                )}
              </button>

              <p className="text-center text-[11px] text-text-muted flex items-center justify-center gap-1.5">
                <Icon icon="solar:lock-bold" className="w-3.5 h-3.5 text-text-muted" />
                <span>256-bit encrypted checkout. No recurring charges.</span>
              </p>
            </form>
          </div>

          {/* IMPACT & TRANSPARENCY (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Why Support Card */}
            <div className="p-6 rounded-2xl bg-surface border border-border">
              <h3 className="text-xs font-bold uppercase tracking-widest text-brand mb-4 flex items-center gap-2">
                <Icon icon="solar:eye-bold" className="w-4 h-4 text-brand" />
                Where Your Support Goes
              </h3>
              <ul className="space-y-3.5 text-xs text-text-secondary">
                <li className="flex items-start gap-2.5">
                  <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                  <span><strong>Zero Paywalls:</strong> Keeps cast discovery, crew contacts, and film history open to aspiring actors, students, and indie filmmakers.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                  <span><strong>OCR Credit Scanners:</strong> Processing video credits directly into accurate, searchable, verified film records.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                  <span><strong>Reliable Infrastructure:</strong> Fast high-availability servers, image CDNs, and daily database redundancy.</span>
                </li>
              </ul>
            </div>

            {/* Other Ways to Help */}
            <div className="p-6 rounded-2xl bg-surface border border-border">
              <h3 className="text-xs font-bold uppercase tracking-widest text-text-primary mb-3">
                Other Ways to Help
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed mb-4">
                Can’t donate right now? You can still make a huge difference in documenting African cinema history:
              </p>
              <div className="space-y-2">
                <Link
                  to="/submit/film"
                  className="flex items-center justify-between p-3 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-xs font-semibold text-text-primary transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Icon icon="solar:clapperboard-add-bold" className="w-4 h-4 text-brand" />
                    Submit Missing Nollywood Films
                  </span>
                  <Icon icon="solar:arrow-right-linear" className="w-4 h-4 text-text-muted" />
                </Link>
                <Link
                  to="/claim"
                  className="flex items-center justify-between p-3 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-xs font-semibold text-text-primary transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Icon icon="solar:user-check-bold" className="w-4 h-4 text-brand" />
                    Claim &amp; Verify Your Profile
                  </span>
                  <Icon icon="solar:arrow-right-linear" className="w-4 h-4 text-text-muted" />
                </Link>
              </div>
            </div>

            {/* Commercial API Callout */}
            <div className="p-6 rounded-2xl bg-surface border border-border">
              <div className="flex items-center gap-2 text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                <Icon icon="solar:code-square-bold" className="w-4 h-4 text-brand" />
                Building Commercial Apps?
              </div>
              <p className="text-xs text-text-secondary leading-relaxed mb-3">
                Need automated programmatic API access, high-throughput endpoints, and bulk exports?
              </p>
              <Link
                to="/developers"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:text-brand-hover transition-colors"
              >
                <span>Check Developer API documentation</span>
                <Icon icon="solar:arrow-right-linear" className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
