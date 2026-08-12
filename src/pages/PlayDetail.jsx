import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { Icon } from '@iconify/react';
import { fetchPlayBySlug, getPlayDateLabel } from '../lib/plays';
import SEO from '../components/SEO';

export default function PlayDetail() {
  const { slug } = useParams();
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

  const credits = play.credits || [];
  const playDateLabel = getPlayDateLabel(play, '');

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
              <img
                src={play.poster_url || play.banner_url || 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&q=80&w=600'}
                alt={play.title}
                className="w-full h-80 object-cover rounded-2xl border border-border shadow-2xl"
              />
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="px-3 py-1 rounded-full bg-brand/15 border border-brand/30 text-brand text-xs font-bold uppercase tracking-wider">
                  🎭 {play.genre || 'Stage Production'}
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

      {/* Ensemble Stage Cast Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <h2 className="text-2xl font-bold text-text-primary mb-6 flex items-center gap-2">
          <Icon icon="solar:users-group-two-rounded-bold" className="text-brand w-6 h-6" />
          Stage Ensemble & Performers ({credits.length})
        </h2>

        {credits.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-12 text-center">
            <Icon icon="solar:user-rounded-line-duotone" className="w-16 h-16 text-text-muted mx-auto mb-3 opacity-40" />
            <p className="text-lg font-bold text-text-primary mb-1">No stage performers linked yet</p>
            <p className="text-xs text-text-muted">Performers for this production will appear here as cast credits are added.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {credits.map((cred) => {
              const person = cred.person || {};
              return (
                <Link
                  key={cred.id}
                  to={`/people/${person.slug || person.id}`}
                  className="group bg-surface border border-border hover:border-brand/50 rounded-xl p-3.5 flex flex-col items-center text-center transition-all hover:-translate-y-1"
                >
                  <img
                    src={person.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
                    alt={person.name || 'Performer'}
                    className="w-20 h-20 rounded-full object-cover border-2 border-border group-hover:border-brand transition-colors mb-3 shadow-md"
                  />
                  <h3 className="text-xs font-bold text-text-primary group-hover:text-brand transition-colors line-clamp-1">
                    {person.name || 'Unknown Performer'}
                  </h3>
                  <span className="text-[11px] font-semibold text-brand mt-0.5">
                    {cred.role || 'Actor'}
                  </span>
                  {cred.character_name && (
                    <span className="text-[10px] text-text-muted italic line-clamp-1 mt-0.5">
                      as {cred.character_name}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
