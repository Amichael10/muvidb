import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { Icon } from '@iconify/react';
import { fetchPlayBySlug, getPlayDateLabel } from '../lib/plays';
import { useAuth } from '../context/AuthContext';
import SEO from '../components/SEO';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import CriticReviewsSection from '../components/film/CriticReviewsSection';
import ReviewSection from '../components/film/ReviewSection';

export default function PlayDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [play, setPlay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBoxOfficeModal, setShowBoxOfficeModal] = useState(false);

  useEffect(() => {
    async function load() {
      if (!slug) return;
      setLoading(true);
      const data = await fetchPlayBySlug(slug);
      setPlay(data);
      setLoading(false);
    }
    load();
  }, [slug]);

  const rawCredits = play?.credits || [];
  const playDateLabel = play ? getPlayDateLabel(play, '') : '';

  // Deduplicate performers by person ID or name to prevent repeated cards for multi-hyphenate roles
  const uniquePerformers = React.useMemo(() => {
    const map = new Map();
    for (const cred of rawCredits) {
      const person = cred.person || {};
      const key = person.id || person.name || cred.id;
      if (!key) continue;

      if (!map.has(key)) {
        map.set(key, {
          id: cred.id,
          person,
          roles: new Set([cred.role].filter(Boolean)),
          characters: new Set([cred.character_name].filter(Boolean)),
        });
      } else {
        const existing = map.get(key);
        if (cred.role) existing.roles.add(cred.role);
        if (cred.character_name) existing.characters.add(cred.character_name);
        if (!existing.person.photo_url && person.photo_url) {
          existing.person = person;
        }
      }
    }

    return Array.from(map.values()).map(item => {
      // Normalize roles to prevent "Director" and "Director & Producer" redundantly repeating
      const rawRoles = Array.from(item.roles);
      const cleanedRoles = [];
      for (const r of rawRoles) {
        if (!cleanedRoles.some(cr => cr.toLowerCase().includes(r.toLowerCase()) || r.toLowerCase().includes(cr.toLowerCase()))) {
          cleanedRoles.push(r);
        } else {
          // Keep the more descriptive one
          const idx = cleanedRoles.findIndex(cr => cr.toLowerCase().includes(r.toLowerCase()) || r.toLowerCase().includes(cr.toLowerCase()));
          if (r.length > cleanedRoles[idx].length) {
            cleanedRoles[idx] = r;
          }
        }
      }

      return {
        ...item,
        roleDisplay: cleanedRoles.join(' · ') || 'Performer',
        characterDisplay: Array.from(item.characters).join(', '),
      };
    });
  }, [rawCredits]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!play) {
    return (
      <div className="min-h-screen bg-bg text-text-primary flex flex-col items-center justify-center p-6 text-center">
        <Icon icon="solar:masks-line-duotone" className="w-20 h-20 text-text-muted opacity-40 mb-4" />
        <h1 className="text-2xl font-bold text-text-primary mb-2">Stage Play Not Found</h1>
        <p className="text-text-muted text-sm mb-6 max-w-md">We couldn't find a theatrical play matching this page.</p>
        <Link to="/plays" className="px-6 py-2.5 rounded-xl bg-brand text-on-brand font-bold hover:bg-brand-hover transition-colors text-sm">
          Return to Theatre Index
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary pb-20">
      <SEO 
        title={`${play.title} (${playDateLabel}) - Stage Play | MuviDB`}
        description={play.synopsis || `Explore stage play production details, playwright ${play.playwright}, director ${play.director}, and ensemble cast on MuviDB.`}
      />

      {/* Play Hero Header */}
      <section className="relative border-b border-border bg-surface/40 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
          <Link to="/plays" className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-brand transition-colors mb-6 font-semibold">
            <Icon icon="solar:alt-arrow-left-linear" className="w-4 h-4" />
            Back to All Plays
          </Link>

          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Poster Card */}
            <div className="w-full md:w-64 flex-shrink-0">
              <ImageWithFallback
                src={play.poster_url || play.banner_url}
                alt={play.title}
                fallbackType="film"
                name={play.title}
                className="w-full h-80 object-cover rounded-2xl border border-border shadow-2xl"
                width={512}
                sizes="(max-width: 767px) 100vw, 256px"
                loading="eager"
              />
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="px-3 py-1 rounded-full bg-brand/15 border border-brand/30 text-brand text-xs font-bold uppercase tracking-wider">
                  <Icon icon="solar:masks-bold" className="inline-block mr-1 text-sm" />
                  {play.genre || 'Stage Production'}
                </span>
                {playDateLabel && (
                  <span className="text-sm font-semibold text-text-muted">
                    {playDateLabel}
                  </span>
                )}
                <span className="px-3 py-1 rounded-full bg-surface border border-border text-xs text-text-muted font-bold capitalize">
                  {play.status?.replace('_', ' ')}
                </span>
                {Boolean(play.box_office_domestic > 0) && (
                  <Link
                    to={`/plays/${play.slug || play.id}/box-office`}
                    className="px-3.5 py-1.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 hover:border-amber-500/50 text-amber-400 text-xs font-bold tracking-wider inline-flex items-center gap-2 shadow-sm transition-all cursor-pointer group"
                    title="Click to view admissions, ticket tiers & venue breakdown"
                  >
                    <Icon icon="solar:ticket-sale-bold" className="text-sm group-hover:scale-110 transition-transform" />
                    <span>₦{Number(play.box_office_domestic).toLocaleString()} Box Office</span>
                    <Icon icon="solar:alt-arrow-right-linear" className="text-xs opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </Link>
                )}
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold text-text-primary mb-4">
                {play.title}
              </h1>

              {/* Key Crew Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 text-xs bg-surface border border-border p-4 rounded-xl">
                <div>
                  <span className="text-text-muted uppercase font-semibold block">Playwright</span>
                  <span className="text-text-primary font-bold text-sm">{play.playwright || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-text-muted uppercase font-semibold block">Director</span>
                  <span className="text-text-primary font-bold text-sm">{play.director || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-text-muted uppercase font-semibold block">Run Dates</span>
                  <span className="text-text-primary font-bold text-sm">{playDateLabel || 'Date TBA'}</span>
                </div>
                <div>
                  <span className="text-text-muted uppercase font-semibold block">Venue & City</span>
                  <span className="text-brand font-bold text-sm">{play.venue ? `${play.venue} (${play.city})` : play.city || 'N/A'}</span>
                </div>
              </div>

              {/* Synopsis */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-2">Production Overview</h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  {play.synopsis || 'An acclaimed theatrical stage play celebrating storytelling and live dramatic craft.'}
                </p>
              </div>

              {play.source_url && (
                <a
                  href={play.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-bold text-brand hover:text-brand-hover transition-colors"
                >
                  <Icon icon="solar:link-round-bold" className="w-4 h-4" />
                  Original Source
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 space-y-12">
        {/* Ensemble Stage Cast Section */}
        <section className="pt-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-brand mb-1">Company & Ensemble</p>
              <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                <Icon icon="solar:users-group-two-rounded-bold" className="text-brand w-6 h-6" />
                Stage Ensemble & Performers ({uniquePerformers.length})
              </h2>
            </div>
            {uniquePerformers.length > 0 && (
              <span className="text-xs text-text-muted font-medium hidden sm:inline-block">
                {uniquePerformers.length} credited {uniquePerformers.length === 1 ? 'member' : 'members'}
              </span>
            )}
          </div>

          {uniquePerformers.length === 0 ? (
            <div className="bg-surface border border-border rounded-2xl p-12 text-center">
              <Icon icon="solar:user-rounded-line-duotone" className="w-16 h-16 text-text-muted mx-auto mb-3 opacity-40" />
              <p className="text-lg font-bold text-text-primary mb-1">No stage performers linked yet</p>
              <p className="text-xs text-text-muted">Performers for this production will appear here as cast credits are added.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
              {uniquePerformers.map((item) => {
                const person = item.person || {};
                return (
                  <Link
                    key={item.id}
                    to={`/people/${person.slug || person.id}`}
                    className="group bg-surface/70 hover:bg-surface border border-border/80 hover:border-brand/60 rounded-2xl p-4 flex flex-col justify-between items-center text-center transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-brand/5 min-h-[210px]"
                  >
                    <div className="flex flex-col items-center w-full">
                      <div className="relative mb-3">
                        <ImageWithFallback
                          src={person.photo_url}
                          alt={person.name || 'Performer'}
                          fallbackType="avatar"
                          name={person.name || 'Performer'}
                          className="w-20 h-20 rounded-full object-cover ring-2 ring-border/80 group-hover:ring-brand/60 transition-all shadow-lg shadow-black/20 group-hover:scale-105 duration-300"
                          width={160}
                          sizes="80px"
                          loading="lazy"
                        />
                      </div>
                      <h3 className="text-xs font-bold text-text-primary group-hover:text-brand transition-colors line-clamp-1 w-full px-1">
                        {person.name || 'Unknown Performer'}
                      </h3>
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 mt-2 rounded-full bg-brand/10 text-brand border border-brand/20 line-clamp-1 max-w-full">
                        {item.roleDisplay}
                      </span>
                    </div>

                    <div className="w-full mt-2 pt-2 border-t border-border/40">
                      {item.characterDisplay ? (
                        <p className="text-[11px] text-text-muted italic line-clamp-1 font-medium">
                          as {item.characterDisplay}
                        </p>
                      ) : (
                        <p className="text-[11px] text-text-muted/40 italic">
                          Stage credit
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Critic Reviews Section */}
        <CriticReviewsSection playId={play.id} user={user} />

        {/* Audience Reviews & Reactions */}
        <ReviewSection playId={play.id} currentUser={user} filmTitle={play.title} />
      </div>

      {/* Theatrical Box Office Breakdown Modal */}
      {showBoxOfficeModal && (
        <PlayBoxOfficeModal
          play={play}
          playDateLabel={playDateLabel}
          isAdmin={user?.role === 'admin' || user?.role === 'admin_limited'}
          onClose={() => setShowBoxOfficeModal(false)}
        />
      )}
    </div>
  );
}

function PlayBoxOfficeModal({ play, playDateLabel, onClose, isAdmin = false }) {
  if (!play) return null;
  const tiers = Array.isArray(play.box_office_metrics?.tier_breakdown) ? play.box_office_metrics.tier_breakdown : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className="relative w-full max-w-lg rounded-2xl bg-surface border border-border shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
              <Icon icon="solar:ticket-sale-bold" className="text-sm" />
              <span>Theatrical Stage Box Office & Admissions</span>
            </div>
            <h3 className="text-xl font-black text-text-primary font-heading tracking-tight">
              {play.title}
            </h3>
            {playDateLabel && (
              <p className="text-xs text-text-muted mt-0.5">{playDateLabel}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <Icon icon="solar:close-circle-bold" className="text-2xl" />
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-surface-2 border border-border/60 space-y-1">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Gross Revenue</span>
            <p className="text-2xl font-black text-amber-400 font-heading">
              ₦{Number(play.box_office_domestic || 0).toLocaleString()}
            </p>
            <span className="text-[10px] text-text-muted font-mono block">Stage box office revenue</span>
          </div>

          <div className="p-4 rounded-xl bg-surface-2 border border-border/60 space-y-1">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Total Admissions</span>
            <p className="text-2xl font-black text-purple-300 font-heading flex items-center gap-1.5">
              <Icon icon="solar:users-group-two-rounded-bold" className="text-purple-400 text-xl" />
              <span>{Number(play.box_office_tickets_sold || 0).toLocaleString()}</span>
            </p>
            <span className="text-[10px] text-text-muted font-mono block">Tickets sold across all tiers</span>
          </div>
        </div>

        {/* Ticket Categories & Pricing Tiers */}
        {tiers.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">Ticket Categories & Pricing</h4>
            <div className="divide-y divide-border/40 rounded-xl border border-border overflow-hidden bg-surface-2/40">
              {tiers.map((tier, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-text-primary block">{tier.type}</span>
                    <span className="text-[11px] text-text-muted">₦{Number(tier.priceNgn || 0).toLocaleString()} per ticket</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-amber-400 block">{tier.sold || 0} sold</span>
                    <span className="text-[10px] text-text-muted">
                      ₦{(Number(tier.priceNgn || 0) * Number(tier.sold || 0)).toLocaleString()} total
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Venue & Location */}
        <div className="p-4 rounded-xl bg-surface-2/50 border border-border/60 space-y-2 text-xs">
          <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Performance Venue & Location</h4>
          <div className="flex items-start gap-2.5">
            <Icon icon="solar:map-point-wave-bold" className="text-brand text-lg shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-text-primary">{play.venue || 'Venue TBA'}</p>
              <p className="text-text-muted text-[11px]">{play.city || 'City TBA'}</p>
            </div>
          </div>
        </div>

        {/* Source verification footer — visible ONLY to admins */}
        {isAdmin && (
          <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-text-muted bg-surface-2/30 -mx-6 -mb-6 p-4 rounded-b-2xl">
            <div className="flex items-center gap-1.5">
              <Icon icon="solar:shield-check-bold" className="text-emerald-400 text-sm" />
              <span>Verified Source (Admin): <strong className="text-text-primary">{play.box_office_source || 'Immersia'}</strong></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
