import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import ImageWithFallback from '../components/ui/ImageWithFallback';

export default function ClaimCompany() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);

  // Verification method: 'work_email' vs 'instagram_dm'
  const [verificationMethod, setVerificationMethod] = useState('work_email');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [workEmail, setWorkEmail] = useState(user?.email || '');
  const [officialRole, setOfficialRole] = useState('Studio Executive');
  const [phone, setPhone] = useState('');
  const [verificationDocUrl, setVerificationDocUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submittedClaim, setSubmittedClaim] = useState(null);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    document.title = 'Claim Company & Studio Profile | MuviDB';
    const target = searchParams.get('company');
    if (!target) return;

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target);
    supabase
      .from('companies')
      .select('*')
      .eq(isUUID ? 'id' : 'slug', target)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSelectedCompany(data);
          setSearchQuery(data.name);
        }
      });
  }, [searchParams]);

  // Autocomplete search
  useEffect(() => {
    if (!searchQuery.trim() || selectedCompany) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('id, name, slug, logo_url, company_type, headquarters, founded_year, claimed')
          .ilike('name', `%${searchQuery.trim()}%`)
          .order('name', { ascending: true })
          .limit(8);

        if (!error && data) {
          setSearchResults(data);
        }
      } catch (err) {
        console.error('Error searching companies:', err);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCompany]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please sign in to claim a company profile');
      navigate('/login?redirect=/claim/company');
      return;
    }

    if (!selectedCompany) {
      toast.error('Please select a company to claim');
      return;
    }

    if (verificationMethod === 'instagram_dm' && !instagramHandle.trim()) {
      toast.error('Please enter your official company Instagram handle');
      return;
    }

    if (verificationMethod === 'work_email' && !workEmail.trim()) {
      toast.error('Please enter your corporate work email');
      return;
    }

    if (!confirmed) {
      toast.error('Please check the confirmation box before submitting');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch('/api/company-claims?action=submit-claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyId: selectedCompany.id,
          officialRole: officialRole.trim(),
          verificationMethod,
          workEmail: workEmail.trim(),
          instagramHandle: instagramHandle.trim(),
          phone: phone.trim(),
          verificationDocUrl: verificationDocUrl.trim(),
          notes: notes.trim(),
        }),
      });

      const result = await res.json().catch(() => null);

      if (res.ok && result?.success) {
        localStorage.setItem(`muvidb_claimed_company_${user.id}`, selectedCompany.id);
        setSubmittedClaim(result.claim || {
          claim_code: result.claimCode || 'MUV-CO-REQ',
          verification_method: verificationMethod,
        });
        toast.success(`Verification initiated for ${selectedCompany.name}!`);
      } else {
        toast.error(result?.error || 'Failed to submit claim. Please try again.');
      }
    } catch (err) {
      console.error('Claim error:', err);
      toast.error('Failed to submit claim. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = () => {
    if (!submittedClaim?.claim_code) return;
    navigator.clipboard.writeText(submittedClaim.claim_code);
    setCodeCopied(true);
    toast.success('Claim code copied to clipboard!');
    setTimeout(() => setCodeCopied(false), 2500);
  };

  // ── SUBMITTED CONFIRMATION STATE (Editorial Left-Aligned Layout) ──
  if (submittedClaim) {
    const isIg = submittedClaim.verification_method === 'instagram_dm';

    return (
      <main className="min-h-screen bg-bg px-4 pt-28 pb-20">
        <section className="mx-auto max-w-4xl text-left">
          
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-xs text-text-muted mb-3">
              <Link to="/companies" className="hover:text-text-primary transition">Studios &amp; Companies</Link>
              <Icon icon="solar:alt-arrow-right-linear" width="12" />
              <span className="text-text-primary font-medium">Claim Status</span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-brand">
              VERIFICATION IN PROGRESS
            </p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-heading font-black tracking-tight text-text-primary">
              {isIg ? 'Send Instagram verification code' : 'Verification request received'}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-text-muted max-w-2xl">
              {isIg
                ? `Your claim for ${selectedCompany?.name || 'this studio'} has been logged. Send the code below from your verified Instagram account to complete ownership confirmation.`
                : `We have received your verification request for ${selectedCompany?.name || 'this studio'}. Our Trust & Safety team is reviewing domain credentials.`}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Main Status Panel */}
            <div className="lg:col-span-8 space-y-5">
              
              {/* Studio Overview Header */}
              <div className="rounded-2xl border border-border bg-surface p-6">
                <div className="flex items-center justify-between pb-5 border-b border-border/70 flex-wrap gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-14 h-14 rounded-xl bg-black/40 border border-border overflow-hidden shrink-0 flex items-center justify-center">
                      <ImageWithFallback
                        src={selectedCompany?.logo_url}
                        alt={selectedCompany?.name || 'Studio'}
                        fallbackType="company"
                        name={selectedCompany?.name || 'Studio'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-heading font-black text-text-primary truncate">
                        {selectedCompany?.name}
                      </h2>
                      <p className="text-xs text-text-muted mt-0.5">
                        {selectedCompany?.company_type || 'Production Company'} • {selectedCompany?.headquarters || 'Lagos, Nigeria'}
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span>Pending Verification</span>
                  </span>
                </div>

                {/* Ticket Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block mb-1">
                      Claimant Contact
                    </span>
                    <span className="font-semibold text-text-primary block truncate">
                      {isIg ? `@${instagramHandle} (Instagram)` : workEmail}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block mb-1">
                      Official Role
                    </span>
                    <span className="font-semibold text-text-primary block truncate">
                      {officialRole || 'Studio Executive'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action / Next Step Card */}
              {isIg ? (
                <div className="rounded-2xl border border-border bg-surface p-6 space-y-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand block mb-1">
                      Action Required
                    </span>
                    <h3 className="text-base font-heading font-black text-text-primary">
                      Direct message MuviDB on Instagram
                    </h3>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">
                      To verify ownership, send your unique verification code from your studio’s official Instagram account (<strong className="text-text-primary">@{instagramHandle}</strong>) to our official page (<strong className="text-text-primary">@muvidb</strong>).
                    </p>
                  </div>

                  {/* Clean Horizontal Code Strip */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-surface-2 border border-border">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block">
                        Verification Code
                      </span>
                      <span className="font-mono text-xl font-black text-brand tracking-wider">
                        {submittedClaim.claim_code}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={copyCode}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface border border-border text-xs font-bold text-text-primary hover:border-brand transition"
                    >
                      <Icon icon={codeCopied ? 'solar:check-circle-bold' : 'solar:copy-bold'} width="14" className={codeCopied ? 'text-emerald-500' : ''} />
                      <span>{codeCopied ? 'Copied' : 'Copy Code'}</span>
                    </button>
                  </div>

                  <a
                    href="https://ig.me/m/muvidb"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-95 text-white font-bold text-xs transition shadow-sm"
                  >
                    <Icon icon="solar:chat-round-dots-bold" width="16" />
                    <span>Open Instagram DM (@muvidb)</span>
                    <Icon icon="solar:arrow-right-up-linear" width="14" />
                  </a>
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-surface p-6 space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand block mb-1">
                        Domain Credential Review
                      </span>
                      <h3 className="text-base font-heading font-black text-text-primary">
                        Confirmation email sent to {workEmail}
                      </h3>
                      <p className="text-xs text-text-muted mt-1 leading-relaxed">
                        We have logged your ticket and sent a confirmation receipt. Our Trust &amp; Safety team verifies that your email domain matches the official company register.
                      </p>
                    </div>

                    <div className="shrink-0 px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-right">
                      <span className="text-[9px] uppercase font-bold text-text-muted block">Ticket Ref</span>
                      <span className="font-mono font-bold text-xs text-text-primary">{submittedClaim.claim_code}</span>
                    </div>
                  </div>

                  {/* Progress Timeline */}
                  <div className="space-y-3 pt-2 border-t border-border/70 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                        <Icon icon="solar:check-circle-bold" width="14" />
                      </div>
                      <span className="text-text-primary font-medium">Claim request logged in system</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                        <Icon icon="solar:restart-linear" width="14" className="animate-spin" />
                      </div>
                      <span className="text-text-primary font-medium">Domain verification in progress (typically under 24 hours)</span>
                    </div>

                    <div className="flex items-center gap-3 opacity-60">
                      <div className="w-6 h-6 rounded-full bg-surface-2 border border-border text-text-muted flex items-center justify-center shrink-0">
                        <Icon icon="solar:lock-bold" width="12" />
                      </div>
                      <span className="text-text-muted">Studio management privileges activated</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar / Quick Actions */}
            <div className="lg:col-span-4 space-y-4">
              <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
                <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                  Next Steps
                </h4>

                <Link
                  to="/company/dashboard"
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-brand text-white font-bold text-xs hover:bg-brand/90 transition shadow-sm"
                >
                  <Icon icon="solar:widget-2-bold" width="16" />
                  <span>Go to Studio Dashboard</span>
                </Link>

                <Link
                  to={`/companies/${selectedCompany?.slug || selectedCompany?.id}`}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl border border-border bg-surface-2 text-text-primary hover:border-brand/40 font-bold text-xs transition"
                >
                  <span>View Public Slate</span>
                  <Icon icon="solar:arrow-right-linear" width="14" />
                </Link>
              </div>

              <div className="rounded-2xl border border-border/80 bg-surface-2/50 p-5 space-y-2 text-xs text-text-muted">
                <div className="flex items-center gap-2 text-text-primary font-bold">
                  <Icon icon="solar:shield-check-bold" width="16" className="text-brand" />
                  <span>Trust &amp; Security Policy</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  MuviDB will never ask for your passwords, login credentials, or banking details. Official communications come only from <strong className="text-text-primary">@muvidb</strong> or <strong className="text-text-primary">support@muvidb.com</strong>.
                </p>
              </div>
            </div>

          </div>
        </section>
      </main>
    );
  }

  // ── MAIN FORM STATE (Clean 2-Column Editorial Layout) ──
  return (
    <main className="min-h-screen bg-bg px-4 pt-28 pb-20">
      <section className="mx-auto max-w-6xl text-left">
        
        {/* Editorial Page Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 text-xs text-text-muted mb-3">
            <Link to="/companies" className="hover:text-text-primary transition">Studios &amp; Companies</Link>
            <Icon icon="solar:alt-arrow-right-linear" width="12" />
            <span className="text-text-primary font-medium">Claim Official Profile</span>
          </div>

          <p className="text-[10px] font-black uppercase tracking-[.25em] text-brand">
            STUDIO VERIFICATION
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-heading font-black tracking-tight text-text-primary">
            Claim your studio profile
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-text-muted max-w-2xl">
            Gain verified administrative ownership of your production company or agency. Directly manage your official film slate, box office numbers, and talent roster on MuviDB.
          </p>
        </div>

        {/* 2-Column Split: Form (Left) & Verification Guide (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Form */}
          <div className="lg:col-span-8">
            <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-border bg-surface p-6 sm:p-8">
              
              {/* 1. Target Studio Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-primary mb-2">
                  1. Select Production Studio or Agency <span className="text-brand">*</span>
                </label>

                {selectedCompany ? (
                  <div className="flex items-center justify-between p-4 bg-surface-2 border border-brand/40 rounded-xl">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-black/40 border border-border overflow-hidden shrink-0 flex items-center justify-center">
                        <ImageWithFallback
                          src={selectedCompany.logo_url}
                          alt={selectedCompany.name}
                          fallbackType="company"
                          name={selectedCompany.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-heading font-black text-text-primary truncate">
                          {selectedCompany.name}
                        </h3>
                        <p className="text-xs text-text-muted">
                          {selectedCompany.company_type || 'Production Company'} • {selectedCompany.headquarters || 'Lagos, Nigeria'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCompany(null);
                        setSearchQuery('');
                      }}
                      className="text-xs font-bold text-brand hover:underline px-3 py-1.5 rounded-lg hover:bg-brand/10 transition shrink-0"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Icon
                      icon="solar:magnifer-linear"
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
                      width="18"
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search company (e.g. Inkblot, FilmOne, Baggyland)..."
                      className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-brand transition"
                    />
                    {searching && (
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                        <Icon icon="solar:restart-linear" className="animate-spin text-brand" width="16" />
                      </div>
                    )}

                    {searchResults.length > 0 && (
                      <div className="absolute top-full mt-2 left-0 right-0 bg-surface border border-border rounded-xl shadow-2xl z-30 max-h-64 overflow-y-auto divide-y divide-border">
                        {searchResults.map((comp) => (
                          <button
                            key={comp.id}
                            type="button"
                            onClick={() => {
                              setSelectedCompany(comp);
                              setSearchResults([]);
                            }}
                            className="w-full text-left p-3.5 hover:bg-surface-2 flex items-center gap-3 transition"
                          >
                            <div className="w-10 h-10 rounded-lg bg-black/40 border border-border overflow-hidden shrink-0 flex items-center justify-center">
                              <ImageWithFallback
                                src={comp.logo_url}
                                alt={comp.name}
                                fallbackType="company"
                                name={comp.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-text-primary truncate">{comp.name}</div>
                              <div className="text-xs text-text-muted">
                                {comp.company_type || 'Studio'} {comp.headquarters ? `• ${comp.headquarters}` : ''}
                              </div>
                            </div>
                            <span className="text-xs font-bold text-brand px-2.5 py-1 rounded-lg bg-brand/10">Select</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Verification Channel Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-primary mb-2">
                  2. Choose Verification Channel <span className="text-brand">*</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVerificationMethod('work_email')}
                    className={`p-4 rounded-xl border text-left transition flex items-start gap-3 cursor-pointer ${
                      verificationMethod === 'work_email'
                        ? 'border-brand bg-brand/5 shadow-sm'
                        : 'border-border bg-surface-2 hover:border-border/80'
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${verificationMethod === 'work_email' ? 'bg-brand text-white' : 'bg-surface text-text-muted'}`}>
                      <Icon icon="solar:letter-bold" width="18" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-text-primary">
                        Corporate Work Email
                      </div>
                      <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                        Automatic domain verification (e.g. @studio.com).
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVerificationMethod('instagram_dm')}
                    className={`p-4 rounded-xl border text-left transition flex items-start gap-3 cursor-pointer ${
                      verificationMethod === 'instagram_dm'
                        ? 'border-brand bg-brand/5 shadow-sm'
                        : 'border-border bg-surface-2 hover:border-border/80'
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${verificationMethod === 'instagram_dm' ? 'bg-brand text-white' : 'bg-surface text-text-muted'}`}>
                      <Icon icon="logos:instagram-icon" width="18" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                        <span>Instagram DM</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-extrabold bg-emerald-500/15 text-emerald-400">Direct</span>
                      </div>
                      <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                        Message code from @company to @muvidb.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* 3. Channel Input */}
              {verificationMethod === 'work_email' ? (
                <div className="p-4 bg-surface-2/60 border border-border rounded-xl space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-muted">
                    Official Corporate Email <span className="text-brand">*</span>
                  </label>
                  <div className="relative">
                    <Icon icon="solar:letter-linear" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" width="16" />
                    <input
                      type="email"
                      required
                      value={workEmail}
                      onChange={(e) => setWorkEmail(e.target.value)}
                      placeholder="executive@companydomain.com"
                      className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-brand transition"
                    />
                  </div>
                  <p className="text-[10px] text-text-muted">
                    Confirmation tickets are sent to this address to verify your domain credentials.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-surface-2/60 border border-border rounded-xl space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-muted">
                    Official Instagram Handle <span className="text-brand">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted font-bold text-xs">@</span>
                    <input
                      type="text"
                      required
                      value={instagramHandle}
                      onChange={(e) => setInstagramHandle(e.target.value)}
                      placeholder="inkblotproductions"
                      className="w-full bg-surface border border-border rounded-xl pl-8 pr-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-brand transition"
                    />
                  </div>
                  <p className="text-[10px] text-text-muted">
                    You will send your generated verification code from this Instagram handle to @muvidb.
                  </p>
                </div>
              )}

              {/* 4. Credentials & Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-primary mb-1.5">
                    Your Official Role / Title <span className="text-brand">*</span>
                  </label>
                  <div className="relative">
                    <Icon icon="solar:user-id-linear" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" width="16" />
                    <input
                      type="text"
                      required
                      value={officialRole}
                      onChange={(e) => setOfficialRole(e.target.value)}
                      placeholder="Managing Director, Production Lead"
                      className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-brand transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-primary mb-1.5">
                    Contact Phone / WhatsApp
                  </label>
                  <div className="relative">
                    <Icon icon="solar:phone-linear" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" width="16" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+234 800 000 0000"
                      className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-brand transition"
                    />
                  </div>
                </div>
              </div>

              {/* 5. Additional Link (Optional) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-primary mb-1.5">
                  Staff Verification Link / Proof URL <span className="text-text-muted font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Icon icon="solar:link-linear" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" width="16" />
                  <input
                    type="url"
                    value={verificationDocUrl}
                    onChange={(e) => setVerificationDocUrl(e.target.value)}
                    placeholder="Link to LinkedIn, studio website team page, or press announcement"
                    className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-brand transition"
                  />
                </div>
              </div>

              {/* 6. Slate Notes (Optional) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-primary mb-1.5">
                  Slate Notes / Titles to Update <span className="text-text-muted font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="List any upcoming theatrical releases or initial titles you intend to update..."
                  className="w-full bg-surface-2 border border-border rounded-xl p-3 text-xs text-text-primary focus:outline-none focus:border-brand transition resize-none"
                />
              </div>

              {/* 7. Confirmation Checkbox */}
              <label className="flex items-start gap-3 rounded-xl border border-border bg-surface-2/60 p-4 text-xs leading-5 text-text-muted cursor-pointer hover:border-brand/40 transition">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  required
                  className="mt-0.5 accent-brand rounded cursor-pointer"
                />
                <span>
                  I confirm that I am an authorized executive or representative of <strong className="text-text-primary">{selectedCompany?.name || 'this production company'}</strong> and that all information provided is accurate.
                </span>
              </label>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || !selectedCompany || !confirmed}
                className="w-full bg-brand text-white font-black py-4 px-6 rounded-xl text-xs uppercase tracking-wider transition hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-brand/20 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Icon icon="solar:restart-linear" className="animate-spin" width="16" />
                    <span>Submitting Claim...</span>
                  </>
                ) : (
                  <>
                    <Icon icon="solar:shield-check-bold" width="16" />
                    <span>Submit Studio Verification Claim</span>
                  </>
                )}
              </button>

            </form>
          </div>

          {/* Right Column: Editorial Sidebar */}
          <div className="lg:col-span-4 space-y-5">
            
            {/* Studio Privileges */}
            <div className="rounded-2xl border border-border bg-surface p-6 space-y-4">
              <div className="flex items-center gap-2 text-brand">
                <Icon icon="solar:shield-star-bold" width="20" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  Verified Studio Privileges
                </h3>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="flex items-start gap-2.5">
                  <Icon icon="solar:verified-check-bold" width="16" className="text-brand shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-text-primary block">Official Studio Badge</strong>
                    <span className="text-text-muted text-[11px] leading-relaxed">
                      Displays verified company credentials across all production credits.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Icon icon="solar:clapperboard-play-bold" width="16" className="text-brand shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-text-primary block">Catalogue Administration</strong>
                    <span className="text-text-muted text-[11px] leading-relaxed">
                      Add and update theatrical releases, trailers, box office, and streaming links.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Icon icon="solar:users-group-two-rounded-bold" width="16" className="text-brand shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-text-primary block">Zero-Duplicate Cast Roster</strong>
                    <span className="text-text-muted text-[11px] leading-relaxed">
                      Tag actors and crew with clean, canonical character credits.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Icon icon="solar:star-bold" width="16" className="text-brand shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-text-primary block">Talent Management Desk</strong>
                    <span className="text-text-muted text-[11px] leading-relaxed">
                      Represent talent and manage agency contacts for production inquiries.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* How It Works */}
            <div className="rounded-2xl border border-border bg-surface-2/60 p-6 space-y-3 text-xs">
              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                Verification Guidelines
              </h4>
              <p className="text-[11px] text-text-muted leading-relaxed">
                MuviDB editorial staff confirms company authenticity. Work email domains matching the studio's website or official press profiles are prioritized.
              </p>
              <div className="pt-2 border-t border-border/70 flex items-center justify-between text-[11px]">
                <span className="text-text-muted">Turnaround:</span>
                <span className="text-text-primary font-bold">Within 24 Hours</span>
              </div>
            </div>

            {/* Support Link */}
            <div className="p-4 rounded-xl border border-border bg-surface flex items-center justify-between text-xs">
              <span className="text-text-muted">Questions about claiming?</span>
              <a
                href="https://ig.me/m/muvidb"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand font-bold hover:underline inline-flex items-center gap-1"
              >
                <span>Ask Support</span>
                <Icon icon="solar:arrow-right-up-linear" width="12" />
              </a>
            </div>

          </div>

        </div>

      </section>
    </main>
  );
}
