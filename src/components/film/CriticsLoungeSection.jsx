import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import ImageWithFallback from '../ui/ImageWithFallback';
import { formatFilmTitle } from '../../utils/format';

export default function CriticsLoungeSection() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadFreshReviews() {
      try {
        const { data, error } = await supabase
          .from('critic_reviews')
          .select(`
            id,
            rating,
            quote,
            review_url,
            created_at,
            critic:critics (
              id,
              name,
              slug,
              avatar_url,
              publication
            ),
            film:films (
              id,
              title,
              year,
              poster_url,
              slug,
              genres
            )
          `)
          .not('quote', 'is', null)
          .order('created_at', { ascending: false })
          .limit(10);

        if (!error && data && isMounted) {
          // Filter out rows without films or critics
          const valid = data.filter(r => r.film && r.critic && r.quote && r.quote.trim().length > 15);
          setReviews(valid);
        }
      } catch (err) {
        console.error('Error fetching critics lounge reviews:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadFreshReviews();
    return () => { isMounted = false; };
  }, []);

  if (!loading && reviews.length === 0) return null;

  return (
    <section className="relative z-10 py-12 md:py-16 border-b border-border/80 bg-surface/30 backdrop-blur-sm overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="flex items-end justify-between gap-4 mb-8">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-text-muted text-[10px] font-bold uppercase tracking-[0.25em]">
                Accredited Voices • Metascore Consensus
              </p>
            </div>
            <h2 className="font-heading text-3xl md:text-[2.5rem] font-bold text-text-primary tracking-tight leading-none flex items-center gap-3">
              <span>The Critics&apos; Lounge</span>
              <span className="hidden sm:inline-block text-xs font-black px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                Editorial
              </span>
            </h2>
          </div>

          <Link
            to="/critics"
            className="group/see shrink-0 inline-flex items-center gap-1.5 text-text-secondary hover:text-brand text-xs font-bold tracking-wide transition-colors whitespace-nowrap pb-1"
          >
            <span>Explore All Critics</span>
            <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4 transition-transform duration-300 group-hover/see:translate-x-1" />
          </Link>
        </div>

        {/* Reviews Carousel */}
        <div data-lenis-prevent className="flex overflow-x-auto gap-5 pb-4 pt-1 scrollbar-hide overscroll-x-contain -mx-4 sm:mx-0 px-4 sm:px-0">
          {loading ? (
            [...Array(3)].map((_, idx) => (
              <div
                key={idx}
                className="shrink-0 w-[310px] sm:w-[380px] h-52 rounded-2xl bg-surface border border-border p-5 animate-pulse"
              />
            ))
          ) : (
            reviews.map((rev) => {
              const score = Number(rev.rating) || 75;
              const isAcclaim = score >= 75;
              const isMixed = score >= 50 && score < 75;
              const filmTitle = formatFilmTitle(rev.film.title);
              const filmPath = `/films/${rev.film.slug || rev.film.id}`;
              const criticPath = `/critics/${rev.critic.slug || rev.critic.id}`;

              return (
                <div
                  key={rev.id}
                  className="shrink-0 w-[320px] sm:w-[420px] group relative rounded-2xl border border-border/80 bg-surface/90 hover:border-emerald-500/40 backdrop-blur-md p-4 sm:p-5 flex flex-col justify-between shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  {/* Top Film Info & Metascore Pill */}
                  <div className="flex items-start gap-3.5 mb-3">
                    {/* Mini Poster */}
                    <Link to={filmPath} className="shrink-0 block w-14 h-20 rounded-lg overflow-hidden bg-surface-2 border border-border/60 shadow-md group-hover:border-emerald-500/30 transition-colors">
                      <ImageWithFallback
                        src={rev.film.poster_url}
                        alt={filmTitle}
                        fallbackType="film"
                        name={filmTitle}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    </Link>

                    {/* Film Meta & Score */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <Link to={filmPath} className="font-heading font-bold text-sm text-text-primary group-hover:text-brand transition-colors truncate">
                          {filmTitle}
                        </Link>

                        {/* Metascore Pill */}
                        <span className={`shrink-0 px-2 py-0.5 rounded-md font-black text-xs font-mono shadow-xs ${
                          isAcclaim
                            ? 'bg-emerald-500 text-black'
                            : isMixed
                              ? 'bg-amber-400 text-black'
                              : 'bg-red-500 text-white'
                        }`}>
                          {score}
                        </span>
                      </div>

                      <p className="text-[11px] text-text-muted font-medium mb-1">
                        {rev.film.year || 'Film'} • {rev.film.genres?.[0] || 'Drama'}
                      </p>

                      <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider ${
                        isAcclaim ? 'text-emerald-400' : isMixed ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        <Icon icon={isAcclaim ? 'solar:cup-star-bold' : 'solar:notes-bold'} className="text-[11px]" />
                        {isAcclaim ? 'Critical Acclaim' : isMixed ? 'Mixed Review' : 'Critical Pan'}
                      </span>
                    </div>
                  </div>

                  {/* Review Quote */}
                  <blockquote className="my-2 text-xs text-text-secondary italic leading-relaxed line-clamp-3 pl-2 border-l-2 border-brand/50">
                    &ldquo;{rev.quote.replace(/^["']|["']$/g, '')}&rdquo;
                  </blockquote>

                  {/* Reviewer / Critic Attribution Footer */}
                  <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-3 text-xs">
                    <Link to={criticPath} className="flex items-center gap-2 group/critic min-w-0">
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-surface-2 shrink-0 border border-border">
                        <ImageWithFallback
                          src={rev.critic.avatar_url}
                          alt={rev.critic.name}
                          fallbackType="avatar"
                          name={rev.critic.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="truncate">
                        <span className="font-bold text-text-primary group-hover/critic:text-brand transition-colors truncate block text-[11px]">
                          {rev.critic.name}
                        </span>
                        <span className="text-[9px] text-text-muted uppercase tracking-wider font-semibold block truncate">
                          {rev.critic.publication || 'Film Critic'}
                        </span>
                      </div>
                    </Link>

                    {rev.review_url ? (
                      <a
                        href={rev.review_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-brand hover:underline shrink-0"
                      >
                        <span>Full Review</span>
                        <Icon icon="solar:arrow-right-up-linear" className="text-xs" />
                      </a>
                    ) : (
                      <Link
                        to={`${filmPath}#reviews`}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-text-muted hover:text-brand shrink-0"
                      >
                        <span>Read</span>
                        <Icon icon="solar:alt-arrow-right-linear" className="text-xs" />
                      </Link>
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>

      </div>
    </section>
  );
}
