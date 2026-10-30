import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate, useLoaderData } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import SEO from '../components/SEO';
import { useAuth } from '../context/AuthContext';

function formatNaira(amount) {
  if (!amount || isNaN(amount)) return '—';
  const num = Number(amount);
  if (num >= 1_000_000_000) {
    return `₦${(num / 1_000_000_000).toFixed(2)} Billion`;
  }
  if (num >= 1_000_000) {
    return `₦${(num / 1_000_000).toFixed(1)} Million`;
  }
  return `₦${num.toLocaleString('en-NG')}`;
}

export default function PlayBoxOffice() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const loaderData = useLoaderData();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'admin_limited';

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/box-office?section=plays');
    }
  };

  const [play, setPlay] = useState(loaderData?.play ?? null);
  const [loading, setLoading] = useState(!loaderData?.play);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (loaderData?.play) {
      setPlay(loaderData.play);
      setLoading(false);
      return;
    }

    async function loadPlay() {
      if (!slug) return;
      setLoading(true);
      setError(null);

      try {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
        let query = supabase.from('plays').select('*');

        if (isUUID) {
          query = query.eq('id', slug);
        } else {
          query = query.eq('slug', slug);
        }

        const { data, error: fetchErr } = await query.single();

        if (fetchErr || !data) {
          const { data: fallbackData } = await supabase
            .from('plays')
            .select('*')
            .eq('id', slug)
            .maybeSingle();

          if (fallbackData) {
            setPlay(fallbackData);
          } else {
            setError('Stage play not found');
          }
        } else {
          setPlay(data);
        }
      } catch (err) {
        console.error('Error fetching stage play box office:', err);
        setError('Failed to load stage play box office records');
      } finally {
        setLoading(false);
      }
    }

    loadPlay();
  }, [slug, loaderData]);

  // Pricing tiers extraction
  const tiers = useMemo(() => {
    if (!play) return [];
    
    // Check box_office_metrics.tier_breakdown first (e.g. Immersia/ticketing platforms)
    const metricsTiers = play.box_office_metrics?.tier_breakdown;
    if (Array.isArray(metricsTiers) && metricsTiers.length > 0) {
      return metricsTiers.map(t => ({
        name: t.type || t.name,
        price: Number(t.priceNgn || t.price || 0),
        sold: t.sold != null ? Number(t.sold) : null,
        gross: t.grossNgn != null ? Number(t.grossNgn) : (t.gross != null ? Number(t.gross) : (t.sold && t.priceNgn ? Number(t.sold) * Number(t.priceNgn) : null))
      }));
    } else if (metricsTiers && typeof metricsTiers === 'object') {
      return Object.entries(metricsTiers).map(([name, val]) => ({
        name: val.name || name,
        price: Number(val.priceNgn || val.price || 0),
        sold: val.sold != null ? Number(val.sold) : null,
        gross: val.grossNgn != null ? Number(val.grossNgn) : (val.gross != null ? Number(val.gross) : (val.sold && val.price ? Number(val.sold) * Number(val.price) : null))
      }));
    }

    if (Array.isArray(play.ticket_pricing) && play.ticket_pricing.length > 0) {
      return play.ticket_pricing;
    }
    if (play.ticket_pricing && typeof play.ticket_pricing === 'object') {
      return Object.entries(play.ticket_pricing).map(([name, price]) => ({
        name,
        price: typeof price === 'number' ? price : Number(String(price).replace(/[^0-9]/g, '')),
        sold: play.admissions_breakdown?.[name] || null
      }));
    }
    return [];
  }, [play]);

  const sessions = useMemo(() => {
    if (!play?.box_office_metrics?.session_breakdown) return [];
    return play.box_office_metrics.session_breakdown;
  }, [play]);

  const totalSold = useMemo(() => {
    if (!play) return 0;
    if (play.box_office_tickets_sold != null) return Number(play.box_office_tickets_sold);
    if (play.box_office_metrics?.tickets_sold != null) return Number(play.box_office_metrics.tickets_sold);
    if (play.admissions_total) return Number(play.admissions_total);
    if (play.admissions) return Number(play.admissions);
    return tiers.reduce((acc, t) => acc + (Number(t.sold) || 0), 0);
  }, [play, tiers]);

  const domesticGross = Number(play?.box_office_domestic || play?.box_office_metrics?.gross_domestic_ngn || 0);

  if (loading) {
    return (
      <div className="w-full min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
        <p className="text-text-muted text-sm font-medium">Loading Stage Box Office Records...</p>
      </div>
    );
  }

  if (error || !play) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <Icon icon="solar:ticket-sale-linear" className="text-5xl text-text-muted mx-auto opacity-40" />
        <h2 className="text-2xl font-bold text-text-primary">Record Not Found</h2>
        <p className="text-text-muted text-sm">We could not find box office tracking records for this stage play.</p>
        <Link
          to="/plays"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-white font-bold text-sm shadow-md hover:opacity-90 transition-opacity"
        >
          <Icon icon="solar:arrow-left-linear" />
          <span>Back to Stage Plays</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full bg-bg min-h-screen pb-24 text-text-primary">
      <SEO 
        title={`${play.title} Theatrical Box Office & Admissions | MuviDB`}
        description={`Live theatrical box office gross, ticket categories, and admissions breakdown for ${play.title}.`}
      />

      {/* Breadcrumb / Back Bar */}
      <section className="border-b border-border bg-surface-2/40 py-3.5">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-xs font-bold text-text-muted hover:text-brand transition-colors group cursor-pointer"
          >
            <Icon icon="solar:arrow-left-linear" className="text-sm group-hover:-translate-x-0.5 transition-transform" />
            <span>Back</span>
          </button>

          <Link
            to="/box-office?section=plays"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-400 hover:underline"
          >
            <Icon icon="solar:masks-bold" className="text-sm" />
            <span>Stage Play Tracker</span>
          </Link>
        </div>
      </section>

      {/* Play Header Summary */}
      <section className="relative border-b border-border bg-surface/60 py-8 sm:py-10">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <Link
              to={`/plays/${play.slug || play.id}`}
              className="shrink-0 w-24 sm:w-28 md:w-32 aspect-[2/3] rounded-xl overflow-hidden border border-border shadow-xl hover:opacity-90 transition-opacity"
            >
              <ImageWithFallback
                src={play.poster_url}
                alt={play.title}
                fallbackType="film"
                className="w-full h-full object-cover"
              />
            </Link>

            <div className="space-y-3 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-400 text-[10px] font-black uppercase tracking-wider">
                  Live Stage Box Office
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-brand/15 border border-brand/30 text-brand text-[10px] font-black uppercase tracking-wider">
                  {play.genre || 'Stage Play'}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black font-heading tracking-tight text-text-primary">
                {play.title}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                {play.playwright && (
                  <div>
                    <span className="text-text-muted">Playwright: </span>
                    <span className="text-text-primary font-bold">{play.playwright}</span>
                  </div>
                )}
                {play.director && (
                  <div>
                    <span className="text-text-muted">Director: </span>
                    <span className="text-text-primary font-bold">{play.director}</span>
                  </div>
                )}
                {play.venue && (
                  <div>
                    <span className="text-text-muted">Venue: </span>
                    <span className="text-brand font-bold">{play.venue} {play.city ? `(${play.city})` : ''}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 pt-2 sm:pt-0">
              <Link
                to={`/plays/${play.slug || play.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-xs font-bold text-text-primary transition-all hover:border-brand/40 shadow-xs"
              >
                <span>View Stage Play Details</span>
                <Icon icon="solar:arrow-right-up-linear" className="text-sm text-text-muted" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 py-8 sm:py-10 space-y-10">
        
        {/* KEY STAGE PLAY METRICS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Gross Box Office */}
          <div className="p-5 rounded-2xl bg-brand/[0.07] border border-brand/25 shadow-sm space-y-2 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-brand">
                Gross Box Office
              </span>
              <Icon icon="solar:ticket-sale-bold" className="text-brand text-base" />
            </div>
            <div className="text-2xl sm:text-3xl font-black font-heading text-brand tracking-tight">
              ₦{domesticGross.toLocaleString('en-NG')}
            </div>
            <div className="text-[11px] text-text-muted font-mono">
              Verified live theatrical revenue
            </div>
          </div>

          {/* Total Admissions */}
          <div className="p-5 rounded-2xl bg-surface border border-border shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                Total Admissions
              </span>
              <Icon icon="solar:users-group-two-rounded-bold" className="text-purple-400 text-base" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-heading text-text-primary tracking-tight">
              {totalSold > 0 ? `${totalSold.toLocaleString()} tickets` : '—'}
            </div>
            <div className="text-[11px] text-text-muted">
              Live theatrical audience count
            </div>
          </div>

          {/* Staging Venue */}
          <div className="p-5 rounded-2xl bg-surface border border-border shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                Auditorium / Venue
              </span>
              <Icon icon="solar:map-point-wave-bold" className="text-brand text-base" />
            </div>
            <div className="text-base sm:text-lg font-black font-heading text-text-primary tracking-tight truncate">
              {play.venue || play.city || 'TBA'}
            </div>
            <div className="text-[11px] text-text-muted truncate">
              {play.city ? `${play.city}, Nigeria` : 'Live stage performance'}
            </div>
          </div>

          {/* Dates / Run */}
          <div className="p-5 rounded-2xl bg-surface border border-border shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                Run Status
              </span>
              <Icon icon="solar:calendar-bold" className="text-emerald-400 text-base" />
            </div>
            <div className="text-base sm:text-lg font-black font-heading text-text-primary tracking-tight capitalize">
              {play.status?.replace('_', ' ') || 'Production Run'}
            </div>
            <div className="text-[11px] text-text-muted truncate">
              {play.run_start_date ? new Date(play.run_start_date).toLocaleDateString() : (play.year ? String(play.year) : 'Active season')}
            </div>
          </div>
        </div>

        {/* TICKET CATEGORIES & TIERS BREAKDOWN TABLE */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-0.5 bg-brand rounded-full inline-block" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                  Admission Categories
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold font-heading text-text-primary tracking-tight mt-1">
                Ticket Categories &amp; Pricing Tiers
              </h2>
            </div>
            <p className="text-xs text-text-muted">
              Live ticketing tiers, prices per seat category, and recorded attendee numbers.
            </p>
          </div>

          <div className="rounded-2xl border border-border overflow-hidden bg-surface shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-text-muted font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 pl-4 sm:pl-6 pr-3">Category / Tier</th>
                    <th className="py-3.5 px-3 text-right">Price per Ticket</th>
                    <th className="py-3.5 px-3 text-right">Tickets Sold</th>
                    <th className="py-3.5 pr-4 sm:pr-6 pl-3 text-right">Category Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {tiers.length > 0 ? (
                    tiers.map((tier, idx) => {
                      const tierPrice = Number(tier.price || 0);
                      const tierSold = tier.sold != null ? Number(tier.sold) : null;
                      const tierRevenue = tier.gross != null ? Number(tier.gross) : (tierSold != null ? tierPrice * tierSold : null);

                      return (
                        <tr key={idx} className="hover:bg-surface-2/40 transition-colors">
                          <td className="py-3.5 pl-4 sm:pl-6 pr-3 font-bold text-text-primary flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-brand" />
                            <span className="capitalize">{tier.name || `Tier ${idx + 1}`}</span>
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-bold text-brand">
                            {tierPrice > 0 ? `₦${tierPrice.toLocaleString('en-NG')}` : 'Free / Complimentary'}
                          </td>
                          <td className="py-3.5 px-3 text-right text-text-secondary font-mono">
                            {tierSold != null ? `${tierSold.toLocaleString()} tickets` : '—'}
                          </td>
                          <td className="py-3.5 pr-4 sm:pr-6 pl-3 text-right font-mono font-bold text-text-primary">
                            {tierRevenue != null && tierRevenue > 0 ? `₦${tierRevenue.toLocaleString('en-NG')}` : '—'}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-text-muted">
                        <Icon icon="solar:ticket-linear" className="text-2xl mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-semibold text-text-primary">Standard Admission</p>
                        <p className="text-xs text-text-muted mt-0.5">Total box office revenue is registered as single general admission.</p>
                      </td>
                    </tr>
                  )}

                  {/* TOTAL SUMMARY ROW */}
                  <tr className="bg-surface-2/80 font-black text-text-primary border-t border-border">
                    <td className="py-4 pl-4 sm:pl-6 pr-3 uppercase tracking-wider text-xs">
                      Total Production Box Office
                    </td>
                    <td className="py-4 px-3 text-right text-text-muted">
                      Full Run
                    </td>
                    <td className="py-4 px-3 text-right font-mono text-purple-400">
                      {totalSold > 0 ? `${totalSold.toLocaleString()} tickets` : '—'}
                    </td>
                    <td className="py-4 pr-4 sm:pr-6 pl-3 text-right font-mono text-base text-brand">
                      ₦{domesticGross.toLocaleString('en-NG')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* SHOWTIMES & SESSION BREAKDOWN */}
        {sessions.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-text-primary flex items-center gap-2">
                  <Icon icon="solar:calendar-date-bold" className="text-brand" />
                  <span>Showtimes &amp; Session Performance</span>
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Verified admissions and box office gross per scheduled theatrical performance ({sessions.length} shows tracked).
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-surface-2/60 text-text-muted font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3.5 pl-4 sm:pl-6 pr-3">Showtime / Date</th>
                      <th className="py-3.5 px-3 text-right">Venue Capacity</th>
                      <th className="py-3.5 px-3 text-right">Admissions Sold</th>
                      <th className="py-3.5 px-3 text-right">Occupancy</th>
                      <th className="py-3.5 pr-4 sm:pr-6 pl-3 text-right">Session Gross</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {sessions.map((s, idx) => {
                      const occ = s.capacity > 0 ? ((s.tickets_sold / s.capacity) * 100).toFixed(0) : '—';
                      return (
                        <tr key={s.session_id || idx} className="hover:bg-surface-2/40 transition-colors">
                          <td className="py-3.5 pl-4 sm:pl-6 pr-3 font-bold text-text-primary">
                            <span>{s.display_name}</span>
                          </td>
                          <td className="py-3.5 px-3 text-right text-text-muted font-mono">
                            {s.capacity ? `${s.capacity.toLocaleString()} seats` : '—'}
                          </td>
                          <td className="py-3.5 px-3 text-right text-purple-400 font-mono font-bold">
                            {s.tickets_sold != null ? `${s.tickets_sold.toLocaleString()} tickets` : '0'}
                          </td>
                          <td className="py-3.5 px-3 text-right text-text-secondary font-mono">
                            {occ !== '—' ? `${occ}%` : '—'}
                          </td>
                          <td className="py-3.5 pr-4 sm:pr-6 pl-3 text-right font-mono font-bold text-brand">
                            ₦{Number(s.gross || 0).toLocaleString('en-NG')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VENUE & PRODUCTION DETAILS */}
        <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary flex items-center gap-2">
            <Icon icon="solar:buildings-bold" className="text-brand text-base" />
            <span>Venue &amp; Staging Details</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-text-muted block mb-1">Staging Venue</span>
              <span className="text-text-primary font-bold text-sm">{play.venue || 'TBA'}</span>
            </div>
            <div>
              <span className="text-text-muted block mb-1">Host City</span>
              <span className="text-text-primary font-bold text-sm">{play.city || 'Nigeria'}</span>
            </div>
            <div>
              <span className="text-text-muted block mb-1">Ticketing Verification</span>
              <span className="text-emerald-400 font-bold text-sm inline-flex items-center gap-1">
                <Icon icon="solar:check-circle-bold" />
                Verified Live Production
              </span>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
