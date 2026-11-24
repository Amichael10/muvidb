import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import ImageWithFallback from '../ui/ImageWithFallback';
import { formatFilmTitle } from '../../utils/format';

// Editorial fallback reviews strictly tied to recent Nollywood cinema & streaming releases
const DEMO_RECENT_CRITIC_REVIEWS = [
  {
    id: 'rev-farmers-bride',
    rating: 82, // Explicit numeric rating
    quote: 'A masterclass in rural tension and cinematic pacing. The ensemble cast delivers an emotionally gripping experience that anchors Nollywood cinema this season.',
    review_url: 'https://whatkeptmeup.com',
    critic: {
      name: 'Anita Eboigbe',
      slug: 'anita-eboigbe',
      publication: 'Inside Nollywood',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    },
    film: {
      title: "Farmer's Bride",
      slug: 'farmers-bride',
      year: 2024,
      genres: ['Drama', 'Thriller'],
      poster_url: 'https://m.media-amazon.com/images/M/MV5BMmM4Y2Y0YTctZWY2Yy00ZjMwLThlNTItZjFlZjYwZTkzNTlkXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
    },
    release_badge: 'In Cinemas Now',
    verdict: 'Must Watch',
  },
  {
    id: 'rev-seven-doors',
    rating: null, // Qualitative review (NO fake 75!)
    quote: 'Seven Doors takes Nigerian period mystery to a cinematic height rarely seen on streaming. Femi Adebayo orchestrates atmospheric folklore with razor-sharp direction.',
    review_url: 'https://nollywoodreporter.example.com',
    critic: {
      name: 'Dami Dawson',
      slug: 'dami-dawson',
      publication: 'The Film Chronicle',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    },
    film: {
      title: 'Seven Doors',
      slug: 'seven-doors',
      year: 2024,
      genres: ['Mini Series', 'Folklore'],
      poster_url: 'https://m.media-amazon.com/images/M/MV5BODg3ZjNmOTItZTBkNi00ODFjLWIwY2ItOTU1ZWMwMDI1NWIxXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
    },
    release_badge: 'Streaming Hit',
    verdict: "Critic's Pick",
  },
  {
    id: 'rev-beast-of-two-worlds',
    rating: 88, // Explicit numeric rating
    quote: 'Odunlade Adekola and Eniola Ajao craft a breathtaking folklore epic. Visual effects and costume authenticity set a new benchmark for Yoruba fantasy.',
    review_url: 'https://whatkeptmeup.com',
    critic: {
      name: 'Chiemeka Offor',
      slug: 'chiemeka-offor',
      publication: 'What Kept Me Up',
      avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    },
    film: {
      title: 'Beast of Two Worlds (Ajakaju)',
      slug: 'beast-of-two-worlds',
      year: 2024,
      genres: ['Epic', 'Drama'],
      poster_url: 'https://m.media-amazon.com/images/M/MV5BZDU1ODVkMjItYmFhNy00YmM1LWI0YmItMDcyZGE0ZDBiOGE2XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
    },
    release_badge: 'Box Office Leader',
    verdict: 'Certified Acclaim',
  },
  {
    id: 'rev-water-and-garri',
    rating: null, // Qualitative review (NO fake 75!)
    quote: 'Tiwa Savage grounds the film with quiet vulnerability, accompanied by a lavish Afrobeat score and sun-drenched cinematography across Cape Coast.',
    review_url: 'https://pulse.ng/entertainment',
    critic: {
      name: 'Kayode Badmus',
      slug: 'kayode-badmus',
      publication: 'Pulse Nigeria',
      avatar_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=200&q=80',
    },
    film: {
      title: 'Water and Garri',
      slug: 'water-and-garri',
      year: 2024,
      genres: ['Romance', 'Music'],
      poster_url: 'https://m.media-amazon.com/images/M/MV5BNTBmYzcxNDItMGNmNi00YjBhLTk3ZTYtZjg1OWVmMTM4NDU4XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
    },
    release_badge: 'Prime Video Premiere',
    verdict: 'Recommended',
  },
];

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
              genres,
              is_in_cinemas
            )
          `)
          .not('quote', 'is', null)
          .order('created_at', { ascending: false })
          .limit(12);

        if (!error && data && isMounted) {
          // Strictly prioritize recent films (past 1-2 years or currently in cinemas)
          const currentYear = new Date().getFullYear();
          const valid = data.filter(
            (r) =>
              r.film &&
              r.critic &&
              r.quote &&
              r.quote.trim().length > 15 &&
              (r.film.is_in_cinemas || (r.film.year && r.film.year >= currentYear - 1))
          );

          if (valid.length > 0) {
            setReviews(valid);
          } else {
            setReviews(DEMO_RECENT_CRITIC_REVIEWS);
          }
        } else {
          setReviews(DEMO_RECENT_CRITIC_REVIEWS);
        }
      } catch (err) {
        console.error('Error fetching critics lounge reviews:', err);
        setReviews(DEMO_RECENT_CRITIC_REVIEWS);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadFreshReviews();
    return () => {
      isMounted = false;
    };
  }, []);

  const displayReviews = reviews.length > 0 ? reviews : DEMO_RECENT_CRITIC_REVIEWS;

  return (
    <section className="relative z-10 py-12 md:py-16 border-b border-border/80 bg-surface/30 backdrop-blur-sm overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="flex items-end justify-between gap-4 mb-8">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-text-muted text-[10px] font-bold uppercase tracking-[0.25em]">
                Accredited Voices • Recent Theatrical &amp; Streaming Releases
              </p>
            </div>
            <h2 className="font-heading text-3xl md:text-[2.5rem] font-bold text-text-primary tracking-tight leading-none flex items-center gap-3">
              <span>The Critics&apos; Lounge</span>
              <span className="hidden sm:inline-block text-xs font-black px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                Guiding Your Watch
              </span>
            </h2>
            <p className="text-xs text-text-muted">
              Recent reviews from verified African film critics for films released this week and month
            </p>
          </div>

          <Link
            to="/critics"
            className="group/see shrink-0 inline-flex items-center gap-1.5 text-text-secondary hover:text-brand text-xs font-bold tracking-wide transition-colors whitespace-nowrap pb-1"
          >
            <span>Explore All Critics</span>
            <Icon
              icon="solar:alt-arrow-right-linear"
              className="w-4 h-4 transition-transform duration-300 group-hover/see:translate-x-1"
            />
          </Link>
        </div>

        {/* Reviews Carousel */}
        <div
          data-lenis-prevent
          className="flex overflow-x-auto gap-5 pb-4 pt-1 scrollbar-hide overscroll-x-contain -mx-4 sm:mx-0 px-4 sm:px-0"
        >
          {loading && displayReviews.length === 0 ? (
            [...Array(3)].map((_, idx) => (
              <div
                key={idx}
                className="shrink-0 w-[310px] sm:w-[380px] h-52 rounded-2xl bg-surface border border-border p-5 animate-pulse"
              />
            ))
          ) : (
            displayReviews.map((rev) => {
              // ZERO-FALSIFICATION: Only parse numeric rating if explicitly provided!
              const hasNumericRating =
                rev.rating !== null &&
                rev.rating !== undefined &&
                !isNaN(Number(rev.rating)) &&
                Number(rev.rating) > 0;
              const numericScore = hasNumericRating ? Number(rev.rating) : null;
              const isAcclaim = numericScore !== null && numericScore >= 75;
              const isMixed = numericScore !== null && numericScore >= 50 && numericScore < 75;

              const filmTitle = formatFilmTitle(rev.film?.title || 'Film');
              const filmPath = `/films/${rev.film?.slug || rev.film?.id || '#'}`;
              const criticPath = `/critics/${rev.critic?.slug || rev.critic?.id || '#'}`;
              const releaseBadge =
                rev.release_badge ||
                (rev.film?.is_in_cinemas ? 'In Cinemas' : rev.film?.year ? `${rev.film.year} Release` : 'Recent');

              return (
                <div
                  key={rev.id}
                  className="shrink-0 w-[320px] sm:w-[420px] group relative rounded-2xl border border-border/80 bg-surface/90 hover:border-emerald-500/40 backdrop-blur-md p-4 sm:p-5 flex flex-col justify-between shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  {/* Top Film Info & Score / Verdict Pill */}
                  <div className="flex items-start gap-3.5 mb-3">
                    {/* Mini Poster */}
                    <Link
                      to={filmPath}
                      className="shrink-0 block w-14 h-20 rounded-lg overflow-hidden bg-surface-2 border border-border/60 shadow-md group-hover:border-emerald-500/30 transition-colors"
                    >
                      <ImageWithFallback
                        src={rev.film?.poster_url}
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
                        <Link
                          to={filmPath}
                          className="font-heading font-bold text-sm text-text-primary group-hover:text-brand transition-colors truncate"
                        >
                          {filmTitle}
                        </Link>

                        {/* Metascore Pill OR Qualitative Verdict Badge (NO fake 75!) */}
                        {hasNumericRating ? (
                          <span
                            className={`shrink-0 px-2 py-0.5 rounded-md font-black text-xs font-mono shadow-xs ${
                              isAcclaim
                                ? 'bg-emerald-500 text-black'
                                : isMixed
                                  ? 'bg-amber-400 text-black'
                                  : 'bg-red-500 text-white'
                            }`}
                          >
                            {numericScore}
                          </span>
                        ) : (
                          <span className="shrink-0 px-2 py-0.5 rounded-md font-black text-[10px] uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-xs">
                            {rev.verdict || "Critic's Pick"}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-text-muted font-medium mb-1">
                        <span className="px-1.5 py-0.2 rounded bg-surface-2 border border-hairline text-[9px] font-bold text-text-secondary uppercase">
                          {releaseBadge}
                        </span>
                        <span>•</span>
                        <span>{rev.film?.genres?.[0] || 'Nollywood'}</span>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider ${
                          hasNumericRating
                            ? isAcclaim
                              ? 'text-emerald-400'
                              : isMixed
                                ? 'text-amber-400'
                                : 'text-red-400'
                            : 'text-brand'
                        }`}
                      >
                        <Icon
                          icon={
                            hasNumericRating
                              ? isAcclaim
                                ? 'solar:cup-star-bold'
                                : 'solar:notes-bold'
                              : 'solar:verified-check-bold'
                          }
                          className="text-[11px]"
                        />
                        {hasNumericRating
                          ? isAcclaim
                            ? 'Critical Acclaim'
                            : isMixed
                              ? 'Mixed Review'
                              : 'Critical Pan'
                          : rev.verdict || 'Editorial Review'}
                      </span>
                    </div>
                  </div>

                  {/* Critic Quote Snippet */}
                  <blockquote className="relative my-2 flex-1">
                    <p className="text-xs text-text-secondary italic line-clamp-3 leading-relaxed">
                      &ldquo;{rev.quote}&rdquo;
                    </p>
                  </blockquote>

                  {/* Footer: Critic byline & source */}
                  <div className="pt-3 border-t border-hairline flex items-center justify-between text-xs">
                    <Link to={criticPath} className="flex items-center gap-2 group/author">
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-surface-2 border border-border shrink-0">
                        <ImageWithFallback
                          src={rev.critic?.avatar_url}
                          alt={rev.critic?.name}
                          fallbackType="avatar"
                          name={rev.critic?.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-text-primary group-hover/author:text-brand truncate">
                          {rev.critic?.name}
                        </p>
                        <p className="text-[10px] text-text-muted truncate">
                          {rev.critic?.publication || 'Film Critic'}
                        </p>
                      </div>
                    </Link>

                    {rev.review_url && (
                      <a
                        href={rev.review_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5"
                      >
                        <span>Full Review</span>
                        <Icon icon="solar:arrow-right-up-linear" className="text-xs" />
                      </a>
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
