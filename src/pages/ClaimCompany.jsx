import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { submitCompanyClaim } from '../lib/companyClient';
import ImageWithFallback from '../components/ui/ImageWithFallback';

export default function ClaimCompany() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);

  // Form states
  const [workEmail, setWorkEmail] = useState(user?.email || '');
  const [officialRole, setOfficialRole] = useState('Studio Executive');
  const [phone, setPhone] = useState('');
  const [verificationDocUrl, setVerificationDocUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Auto-select company from query param if provided (e.g. /claim/company?company=slug-or-id)
  useEffect(() => {
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
          .select('id, name, slug, logo_url, company_type, headquarters, founded_year')
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

    if (!workEmail.trim()) {
      toast.error('Please provide your corporate or official work email');
      return;
    }

    setSubmitting(true);
    try {
      await submitCompanyClaim({
        company_id: selectedCompany.id,
        user_id: user.id,
        work_email: workEmail.trim(),
        official_role: officialRole.trim(),
        verification_doc_url: verificationDocUrl.trim(),
        notes: notes.trim(),
      });

      // Also track in local session so user can immediately manage
      localStorage.setItem(`muvidb_claimed_company_${user.id}`, selectedCompany.id);

      setSubmitted(true);
      toast.success(`Claim submitted for ${selectedCompany.name}!`);
    } catch (err) {
      console.error('Claim error:', err);
      toast.error('Failed to submit claim. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-bg text-text-primary flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-surface border border-border rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-emerald-500/20">
            <Icon icon="solar:check-circle-bold" width="36" />
          </div>

          <h2 className="text-2xl font-bold tracking-tight mb-2">Claim Successfully Submitted</h2>
          <p className="text-sm text-text-muted mb-6 leading-relaxed">
            Your verification request for <strong className="text-text-primary">{selectedCompany?.name}</strong> has been received. You now have access to manage your titles, credits, and talent roster directly.
          </p>

          <div className="bg-surface-2/60 border border-border rounded-xl p-4 text-left mb-6 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-text-muted">Company</span>
              <span className="font-semibold text-text-primary">{selectedCompany?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Corporate Email</span>
              <span className="font-semibold text-text-primary">{workEmail}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Your Role</span>
              <span className="font-semibold text-text-primary">{officialRole}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/company/dashboard"
              className="flex-1 bg-brand text-white font-bold py-3 px-4 rounded-xl text-sm transition hover:bg-brand/90 flex items-center justify-center gap-2 shadow-lg shadow-brand/20"
            >
              <Icon icon="solar:widget-2-bold" width="18" />
              Open Studio Dashboard
            </Link>
            <Link
              to={`/companies/${selectedCompany?.slug || selectedCompany?.id}`}
              className="py-3 px-4 rounded-xl text-sm font-semibold border border-border bg-surface hover:bg-surface-2 transition text-text-muted hover:text-text-primary"
            >
              View Public Page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-xs text-text-muted">
          <Link to="/companies" className="hover:text-text-primary transition">Studios & Companies</Link>
          <Icon icon="solar:alt-arrow-right-linear" width="12" />
          <span className="text-text-primary font-medium">Claim Official Company Profile</span>
        </div>

        {/* Hero Card */}
        <div className="bg-gradient-to-br from-surface to-surface-2 border border-border rounded-2xl p-6 sm:p-8 mb-8 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-brand text-xs font-bold mb-4 uppercase tracking-wider">
              <Icon icon="solar:shield-check-bold" width="14" />
              Studio & Agency Portal
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
              Claim Your Company on MuviDB
            </h1>
            <p className="text-text-muted text-sm sm:text-base leading-relaxed max-w-2xl">
              Gain verified administrative control of your production studio, distributor, or talent agency. Directly edit your film slate, theatrical status, box office numbers, talent roster, and credits with zero duplicate clutter.
            </p>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="w-9 h-9 rounded-lg bg-brand/10 text-brand flex items-center justify-center mb-3">
              <Icon icon="solar:clapperboard-play-bold" width="20" />
            </div>
            <h4 className="text-xs font-bold text-text-primary mb-1">Direct Film Management</h4>
            <p className="text-[11px] text-text-muted leading-relaxed">
              Add new films, update theatrical release dates, synopsis, posters, trailers, and box office earnings in real-time.
            </p>
          </div>

          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
              <Icon icon="solar:users-group-two-rounded-bold" width="20" />
            </div>
            <h4 className="text-xs font-bold text-text-primary mb-1">Cast & Credits Control</h4>
            <p className="text-[11px] text-text-muted leading-relaxed">
              Curate cast & crew with zero duplicate actors. Add unlisted filmmakers and actors to MuviDB on the fly.
            </p>
          </div>

          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3">
              <Icon icon="solar:key-square-bold" width="20" />
            </div>
            <h4 className="text-xs font-bold text-text-primary mb-1">Team & API Access</h4>
            <p className="text-[11px] text-text-muted leading-relaxed">
              Invite team members (owners, admins, editors) and generate live developer API keys for automation.
            </p>
          </div>
        </div>

        {/* Main Claim Form */}
        <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* 1. Select Company */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                1. Select Studio / Production Company / Agency <span className="text-brand">*</span>
              </label>

              {selectedCompany ? (
                <div className="flex items-center justify-between p-3.5 bg-surface-2 border border-brand/40 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-black/40 border border-border overflow-hidden flex items-center justify-center shrink-0">
                      <ImageWithFallback
                        src={selectedCompany.logo_url}
                        alt={selectedCompany.name}
                        fallbackType="company"
                        name={selectedCompany.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-text-primary">{selectedCompany.name}</h4>
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
                    className="text-xs font-bold text-brand hover:underline px-2 py-1"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative">
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
                      placeholder="Search company by name (e.g. EbonyLife, Inkblot, FilmOne)..."
                      className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-brand transition"
                    />
                    {searching && (
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                        <Icon icon="solar:restart-linear" className="animate-spin text-text-muted" width="16" />
                      </div>
                    )}
                  </div>

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
                          className="w-full text-left p-3 hover:bg-surface-2 flex items-center gap-3 transition"
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
                          <span className="text-xs font-bold text-brand px-2 py-1 rounded bg-brand/10">Select</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Official Credentials */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                  Corporate Work Email <span className="text-brand">*</span>
                </label>
                <div className="relative">
                  <Icon icon="solar:letter-linear" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" width="16" />
                  <input
                    type="email"
                    required
                    value={workEmail}
                    onChange={(e) => setWorkEmail(e.target.value)}
                    placeholder="name@companydomain.com"
                    className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand transition"
                  />
                </div>
                <p className="text-[10px] text-text-muted mt-1">Official corporate email matching your studio domain speeds up verification.</p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                  Your Official Role / Title <span className="text-brand">*</span>
                </label>
                <div className="relative">
                  <Icon icon="solar:user-id-linear" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" width="16" />
                  <input
                    type="text"
                    required
                    value={officialRole}
                    onChange={(e) => setOfficialRole(e.target.value)}
                    placeholder="e.g. Head of Production, Executive Producer"
                    className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand transition"
                  />
                </div>
              </div>
            </div>

            {/* 3. Phone & Verification link */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                  Official Phone / WhatsApp
                </label>
                <div className="relative">
                  <Icon icon="solar:phone-linear" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" width="16" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+234 800 000 0000"
                    className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                  Staff Verification Link / Proof URL
                </label>
                <div className="relative">
                  <Icon icon="solar:link-linear" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" width="16" />
                  <input
                    type="url"
                    value={verificationDocUrl}
                    onChange={(e) => setVerificationDocUrl(e.target.value)}
                    placeholder="LinkedIn staff URL, IMDbPro, or company team link"
                    className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand transition"
                  />
                </div>
              </div>
            </div>

            {/* 4. Notes */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                Additional Notes or Details
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="List any upcoming theatrical releases or initial titles you intend to update..."
                className="w-full bg-surface-2 border border-border rounded-xl p-3 text-sm text-text-primary focus:outline-none focus:border-brand transition resize-none"
              />
            </div>

            {/* Submit CTA */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting || !selectedCompany}
                className="w-full bg-brand text-white font-bold py-3.5 px-6 rounded-xl text-sm transition hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-brand/20"
              >
                {submitting ? (
                  <>
                    <Icon icon="solar:restart-linear" className="animate-spin" width="18" />
                    Submitting Claim...
                  </>
                ) : (
                  <>
                    <Icon icon="solar:shield-check-bold" width="18" />
                    Submit Official Company Claim
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
