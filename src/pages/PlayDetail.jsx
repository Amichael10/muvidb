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

  const rawCredits = play.credits || [];
  const playDateLabel = getPlayDateLabel(play, '');

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

  return (
    <div className="min-h-screen bg-bg text-text-primary pb-20">
      <SEO 
        title={`${play.title} (${playDateLabel}) - Stage Play | MuviDB`}
        description={play.synopsis || `Explore stage play production details, playwright ${play.playwright}, director ${play.director}, and ensemble cast on MuviDB.`}
      />

      {/* Play Hero Header */}
      <section className="relative border-b border-border bg-surface/40 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
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
    </div>
  );
}
