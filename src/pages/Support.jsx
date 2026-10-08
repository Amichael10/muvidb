import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../context/AuthContext';

const PRESET_AMOUNTS = [
  {
    amount: 1000,
    label: '₦1,000',
    tierName: 'Seed Supporter',
    tagline: 'Powers daily search & database lookups',
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
    tagline: 'Funds image optimization & talent archiving',
    icon: 'solar:star-bold',
  },
  {
    amount: 10000,
    label: '₦10,000',
    tierName: 'Heritage Guardian',
    tagline: 'Maintains historical Nollywood catalog & cloud backups',
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

      // Seamless redirect to Bachs hosted checkout
      window.location.href = targetUrl;
    } catch (err) {
      console.error('[Support] Checkout error:', err);
      setError(err.message || 'Payment service is temporarily unavailable. Please try again in a moment.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text-primary selection:bg-brand selection:text-white pb-24">
      {/* Decorative ambient gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-rose-500/10 via-amber-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16">
        {/* SUCCESS CELEBRATION BANNER */}
        {isSuccess && (
          <div className="mb-12 p-8 rounded-3xl bg-gradient-to-b from-surface via-surface-2 to-surface border border-emerald-500/30 shadow-[0_20px_50px_rgba(16,185,129,0.15)] text-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Icon icon="solar:heart-bold" className="w-9 h-9 animate-bounce" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-white tracking-tight">
              Thank You for Fueling African Cinema!
            </h2>
            <p className="mt-2 text-sm sm:text-base text-text-secondary max-w-xl mx-auto leading-relaxed">
              Your contribution directly funds server uptime, credit archiving, and ensures MuviDB remains 100% free for everyone.
            </p>
            {paymentRef && (
              <div className="mt-4 inline-block px-4 py-1.5 rounded-full bg-black/40 border border-border text-xs font-mono text-text-muted">
                Reference: <span className="text-white font-bold">{paymentRef}</span>
                {paidAmount && <span> • ₦{Number(paidAmount).toLocaleString()}</span>}
              </div>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/"
                className="px-6 py-2.5 rounded-xl bg-brand text-white font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-opacity"
              >
                Back to Archive
              </Link>
              <Link
                to="/browse"
                className="px-6 py-2.5 rounded-xl bg-surface-2 border border-border text-white font-bold text-xs uppercase tracking-wider hover:bg-surface transition-colors"
              >
                Discover Films
              </Link>
            </div>
          </div>
        )}

        {/* HERO HEADER */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-bold tracking-widest uppercase mb-4">
            <Icon icon="solar:heart-bold" className="w-3.5 h-3.5" />
            <span>Community-Powered Heritage</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-heading font-black tracking-tight text-white leading-tight">
            Keep Nollywood &amp; African Cinema Free For Everyone.
          </h1>

          <p className="mt-4 sm:mt-5 text-sm sm:text-base text-text-secondary leading-relaxed">
            We don’t believe in charging actors for profile representation, putting film credits behind paywalls, or restricting public discovery. MuviDB is open to all.
            Your voluntary contribution keeps our cloud servers online and our archival scanners running.
          </p>
        </div>

        {/* MAIN BENTO SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* CONTRIBUTION FORM (7 Cols) */}
          <div className="lg:col-span-7 bg-surface/90 border border-border rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-2xl relative">
            <div className="flex items-center justify-between pb-6 border-b border-border/80 mb-6">
              <div>
                <h2 className="text-lg font-heading font-bold text-white">Choose Your Contribution</h2>
                <p className="text-xs text-text-muted mt-0.5">Pay securely via Bachs (Cards, Bank Transfer, USSD, Crypto)</p>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400 font-bold">
                <Icon icon="solar:shield-check-bold" className="w-3.5 h-3.5" />
                <span>Bachs Verified</span>
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
                      className={`relative p-4 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between ${
                        isSelected
                          ? 'bg-rose-500/10 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.15)] ring-1 ring-rose-500'
                          : 'bg-surface-2/60 border-border hover:border-text-muted/40 hover:bg-surface-2'
                      }`}
                    >
                      {tier.popular && (
                        <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black uppercase tracking-wider shadow-sm">
                          Popular
                        </span>
                      )}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Icon
                            icon={tier.icon}
                            className={`w-5 h-5 ${isSelected ? 'text-rose-400' : 'text-text-muted'}`}
                          />
                          {isSelected && (
                            <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-rose-500" />
                          )}
                        </div>
                        <div className="text-lg sm:text-xl font-heading font-black text-white">
                          {tier.label}
                        </div>
                        <div className="text-xs font-semibold text-text-primary mt-0.5">
                          {tier.tierName}
                        </div>
                      </div>
                      <div className="text-[10px] text-text-muted mt-2 leading-tight">
                        {tier.tagline}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Amount Field */}
              <div className="pt-2">
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
                    className={`w-full pl-9 pr-4 py-3 rounded-xl bg-surface-2 border text-sm font-bold text-white placeholder-text-muted focus:outline-none transition-all ${
                      isCustom && customAmount
                        ? 'border-rose-500 ring-1 ring-rose-500'
                        : 'border-border focus:border-text-muted'
                    }`}
                  />
                </div>
              </div>

              {/* Supporter Details */}
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                    Your Email <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={supporterEmail}
                    onChange={(e) => setSupporterEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-border text-sm text-white placeholder-text-muted focus:outline-none focus:border-rose-500"
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
                    className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-border text-sm text-white placeholder-text-muted focus:outline-none focus:border-rose-500"
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
                    placeholder="Leave a word of encouragement for the team..."
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-2 border border-border text-sm text-white placeholder-text-muted focus:outline-none focus:border-rose-500 resize-none"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <Icon icon="solar:danger-triangle-bold" className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-rose-500 via-rose-600 to-amber-600 hover:opacity-95 text-white font-heading font-black text-sm uppercase tracking-wider shadow-[0_10px_30px_rgba(244,63,94,0.3)] transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>Connecting to Bachs Checkout...</span>
                  </>
                ) : (
                  <>
                    <Icon icon="solar:heart-bold" className="w-5 h-5 text-white" />
                    <span>Contribute ₦{activeAmount.toLocaleString()} with Bachs</span>
                  </>
                )}
              </button>

              <p className="text-center text-[11px] text-text-muted">
                Transactions processed securely via Bachs Global Payments.
              </p>
            </form>
          </div>

          {/* IMPACT & TRANSPARENCY (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Why Support Card */}
            <div className="p-6 rounded-3xl bg-surface-2/60 border border-border">
              <h3 className="text-sm font-bold uppercase tracking-widest text-brand mb-4 flex items-center gap-2">
                <Icon icon="solar:eye-bold" className="w-4 h-4" />
                Where Your Support Goes
              </h3>
              <ul className="space-y-3.5 text-xs text-text-secondary">
                <li className="flex items-start gap-2.5">
                  <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Zero Paywalls:</strong> Keeps cast discovery, crew contacts, and film history open to aspiring actors, students, and indie filmmakers.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>OCR Credit Scanners:</strong> Processing video credits directly into accurate, searchable, verified film records.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Reliable Infrastructure:</strong> Fast high-availability servers, image CDNs, and daily database redundancy.</span>
                </li>
              </ul>
            </div>

            {/* Other Ways to Help */}
            <div className="p-6 rounded-3xl bg-surface-2/60 border border-border">
              <h3 className="text-sm font-bold uppercase tracking-widest text-text-primary mb-3">
                Other Ways to Help
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed mb-4">
                Can’t donate right now? You can still make a huge difference in documenting African cinema history:
              </p>
              <div className="space-y-2">
                <Link
                  to="/submit/film"
                  className="flex items-center justify-between p-3 rounded-xl bg-surface hover:bg-surface/80 border border-border text-xs font-semibold text-white transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Icon icon="solar:clapperboard-add-bold" className="w-4 h-4 text-brand" />
                    Submit Missing Nollywood Films
                  </span>
                  <Icon icon="solar:arrow-right-linear" className="w-4 h-4 text-text-muted" />
                </Link>
                <Link
                  to="/claim"
                  className="flex items-center justify-between p-3 rounded-xl bg-surface hover:bg-surface/80 border border-border text-xs font-semibold text-white transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Icon icon="solar:user-check-bold" className="w-4 h-4 text-emerald-400" />
                    Claim &amp; Verify Your Profile
                  </span>
                  <Icon icon="solar:arrow-right-linear" className="w-4 h-4 text-text-muted" />
                </Link>
              </div>
            </div>

            {/* Commercial API Callout */}
            <div className="p-6 rounded-3xl bg-surface border border-border/80">
              <div className="flex items-center gap-2 text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                <Icon icon="solar:code-square-bold" className="w-4 h-4 text-sky-400" />
                Building Commercial Apps?
              </div>
              <p className="text-xs text-text-secondary leading-relaxed mb-3">
                Need automated programmatic API access, high-throughput endpoints, and bulk exports?
              </p>
              <Link
                to="/developers"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-400 hover:text-sky-300 transition-colors"
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
