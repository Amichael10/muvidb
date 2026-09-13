import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import { formatFilmTitle } from '../utils/format';
import { useAuth } from '../context/AuthContext';

const formatRuntime = (minutes) => {
  if (!minutes) return null;
  const mins = Number(minutes);
  if (isNaN(mins)) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}` : `${m}m`;
};

const formatRelativeTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Render 5 yellow stars (Rotten Tomatoes style)
function StarDisplay({ score10, maxStars = 5 }) {
  if (score10 == null || isNaN(score10)) return null;
  const score = Math.max(0, Math.min(10, Number(score10)));
  // Map 0-10 scale to 0-5 stars
  const starsCount = score / 2; // e.g. 8/10 -> 4 stars, 7/10 -> 3.5 stars
  const fullStars = Math.floor(starsCount);
  const hasHalf = starsCount - fullStars >= 0.3 && starsCount - fullStars <= 0.7;
  const roundedStars = starsCount - fullStars > 0.7 ? fullStars + 1 : fullStars;

  return (
    <div className="flex items-center gap-1 text-[#FFB800]">
      {[...Array(maxStars)].map((_, i) => {
        if (i < roundedStars) {
          return <Icon key={i} icon="solar:star-bold" className="text-base sm:text-lg" />;
        }
        if (i === roundedStars && hasHalf) {
          return <Icon key={i} icon="solar:star-half-bold" className="text-base sm:text-lg" />;
        }
        return <Icon key={i} icon="solar:star-linear" className="text-base sm:text-lg text-white/20" />;
      })}
      <span className="text-xs font-bold text-white/50 ml-1.5 font-mono">
        {score.toFixed(1)}/10
      </span>
    </div>
  );
}

export default function FilmReviews() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'all_audience';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  const [film, setFilm] = useState(null);
  const [criticsList, setCriticsList] = useState([]);
  const [audienceList, setAudienceList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { user } = useAuth();

  // Sync tab with URL if changed externally
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && ['all_critics', 'top_critics', 'all_audience', 'verified_audience'].includes(t)) {
      setActiveTab(t);
    }
  }, [searchParams]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchParams({ tab: newTab });
  };

  // Fetch Film and all Reviews (Critics + Audience)
  useEffect(() => {
    if (!slug) return;
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch film by slug or id
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
        const col = isUuid ? 'id' : 'slug';

        const { data: filmData, error: filmErr } = await supabase
          .from('films')
          .select(`
            id,
            title,
            slug,
            poster_url,
            backdrop_url,
            year,
            release_date,
            runtime_minutes,
            director,
            nfvcb_rating,
            liked_percent,
            audience_rating,
            audience_rating_count,
            imdb_rating,
            imdb_vote_count,
            tmdb_rating,
            synopsis,
            release_type,
            film_genres(genres(name)),
            credits(
              role,
              character_name,
              people(name, photo_url)
            )
          `)
          .eq(col, slug)
          .single();

        if (filmErr || !filmData) {
          throw new Error('Film not found');
        }

        const genres = (filmData.film_genres || [])
          .map((fg) => fg.genres?.name)
          .filter(Boolean);

        // Find director from credits if missing in film column
        let directorName = filmData.director;
        if (!directorName && filmData.credits) {
          const dirCredit = filmData.credits.find((c) =>
            (c.role || '').toLowerCase().includes('director')
          );
          if (dirCredit?.people?.name) {
            directorName = dirCredit.people.name;
          }
        }

        const fullFilm = {
          ...filmData,
          genres,
          director: directorName,
        };

        if (isMounted) setFilm(fullFilm);

        // 2. Fetch Critic Reviews
        const { data: criticData, error: criticErr } = await supabase
          .from('critic_reviews')
          .select('*, critic:critics(id, name, slug, avatar_url, publication, is_verified)')
          .eq('film_id', filmData.id)
          .order('is_featured', { ascending: false })
          .order('created_at', { ascending: false });

        if (!criticErr && criticData && isMounted) {
          setCriticsList(criticData);
        }

        // 3. Fetch Audience Reviews (Community users + YouTube comments)
        const { data: revData, error: revErr } = await supabase
          .from('reviews')
          .select('*, users:user_id(id, name, avatar_url)')
          .eq('film_id', filmData.id)
          .order('created_at', { ascending: false });

        if (!revErr && revData && isMounted) {
          setAudienceList(revData);
        }
      } catch (err) {
        console.error('Error loading reviews page:', err);
        if (isMounted) setError(err.message || 'Failed to load reviews');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  // Derived Critic & Audience metrics
  const criticMetrics = useMemo(() => {
    const validRatings = criticsList
      .map((c) => (c.rating != null && c.rating !== '' ? Number(c.rating) : null))
      .filter((n) => n !== null && !isNaN(n) && n > 0 && n <= 10);
    const count = validRatings.length;
    const avgScore = count > 0 ? (validRatings.reduce((a, b) => a + b, 0) / count).toFixed(1) : null;
    const freshCount = validRatings.filter((n) => n >= 6).length;
    const freshPct = count > 0 ? Math.round((freshCount / count) * 100) : null;
    const topCritics = criticsList.filter((c) => c.is_featured || c.critic?.is_verified);
    return { count, avgScore, freshPct, topCriticsCount: topCritics.length };
  }, [criticsList]);

  const audienceMetrics = useMemo(() => {
    const verifiedUsers = audienceList.filter((r) => !r.source || r.source === 'user');
    const youtubeComments = audienceList.filter((r) => r.source === 'youtube');
    const totalCount = audienceList.length;
    const likedPct = film?.liked_percent != null ? Math.round(Number(film.liked_percent)) : null;
    return {
      totalCount,
      verifiedCount: verifiedUsers.length,
      youtubeCount: youtubeComments.length,
      likedPct,
    };
  }, [audienceList, film]);

  // Filtered items based on activeTab & search
  const displayedReviews = useMemo(() => {
    let list = [];
    const isCriticTab = activeTab === 'all_critics' || activeTab === 'top_critics';

    if (activeTab === 'all_critics') {
      list = criticsList.map((c) => ({
        id: `critic_${c.id}`,
        type: 'critic',
        author: c.critic?.name || c.critic_name || 'Critic',
        handle: c.critic?.publication || c.publication || 'Film Journalist',
        avatar: c.critic?.avatar_url || null,
        isVerified: Boolean(c.critic?.is_verified || c.is_featured),
        isTop: Boolean(c.is_featured),
        rating10: c.rating != null && c.rating !== '' ? Number(c.rating) : null,
        body: c.body || c.quote || '',
        createdAt: c.created_at,
        url: c.review_url || null,
        source: 'critic',
      }));
    } else if (activeTab === 'top_critics') {
      list = criticsList
        .filter((c) => c.is_featured || c.critic?.is_verified)
        .map((c) => ({
          id: `critic_${c.id}`,
          type: 'critic',
          author: c.critic?.name || c.critic_name || 'Top Critic',
          handle: c.critic?.publication || c.publication || 'Film Journalist',
          avatar: c.critic?.avatar_url || null,
          isVerified: true,
          isTop: true,
          rating10: c.rating != null && c.rating !== '' ? Number(c.rating) : null,
          body: c.body || c.quote || '',
          createdAt: c.created_at,
          url: c.review_url || null,
          source: 'critic',
        }));
    } else if (activeTab === 'verified_audience') {
      list = audienceList
        .filter((r) => !r.source || r.source === 'user')
        .map((r) => ({
          id: `user_${r.id}`,
          type: 'audience',
          author: r.users?.name || 'Verified Audience',
          handle: r.users?.name ? `@${r.users.name.toLowerCase().replace(/\s+/g, '')}` : '@audience',
          avatar: r.users?.avatar_url || null,
          isVerified: true,
          rating10: r.rating != null ? Number(r.rating) : null,
          body: r.body || '',
          createdAt: r.created_at,
          source: 'user',
        }));
    } else {
      // all_audience
      list = audienceList.map((r) => {
        const isExternal = r.source === 'youtube';
        return {
          id: `aud_${r.id}`,
          type: 'audience',
          author: isExternal ? (r.author_name || 'YouTube Viewer') : (r.users?.name || 'Audience Member'),
          handle: isExternal
            ? (r.author_handle ? `@${r.author_handle}` : 'via YouTube')
            : (r.users?.name ? `@${r.users.name.toLowerCase().replace(/\s+/g, '')}` : '@audience'),
          avatar: isExternal ? (r.author_avatar_url || null) : (r.users?.avatar_url || null),
          isVerified: !isExternal,
          isExternal,
          rating10: r.rating != null ? Number(r.rating) : (r.sentiment_score ? Number(r.sentiment_score) : null),
          body: r.body || '',
          createdAt: r.created_at,
          likes: r.likes || 0,
          url: r.comment_url || null,
          source: r.source || 'user',
        };
      });
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (item) =>
        item.author.toLowerCase().includes(q) ||
        item.handle.toLowerCase().includes(q) ||
        item.body.toLowerCase().includes(q)
    );
  }, [activeTab, criticsList, audienceList, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080A0D] text-white flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-brand border-t-transparent animate-spin" />
          <p className="text-xs font-bold text-white/50 tracking-wider uppercase">Loading Reviews...</p>
        </div>
      </div>
    );
  }

  if (error || !film) {
    return (
      <div className="min-h-screen bg-[#080A0D] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#0E1217] border border-white/10 rounded-2xl p-8 text-center">
          <Icon icon="solar:danger-circle-bold" className="text-4xl text-amber-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold font-heading mb-2">Film Reviews Unavailable</h2>
          <p className="text-xs text-white/60 mb-6">{error || 'Unable to locate this film or its review data.'}</p>
          <Link
            to={`/films/${slug || ''}`}
            className="inline-flex items-center gap-2 bg-brand hover:bg-brand-hover text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md"
          >
            <Icon icon="solar:arrow-left-linear" />
            <span>Return to Film</span>
          </Link>
        </div>
      </div>
    );
  }

  const title = formatFilmTitle(film.title);
  const runtime = formatRuntime(film.runtime_minutes);
  const year = film.year || film.release_date?.slice(0, 4) || null;
  const ratingAge = film.nfvcb_rating || '18';
  const genresString = film.genres && film.genres.length > 0 ? film.genres.join(', ') : 'Drama';
  const muvidbScore = film.audience_rating || film.imdb_rating || film.tmdb_rating;

  return (
    <div className="min-h-screen bg-[#080A0D] text-white selection:bg-brand selection:text-white">
      {/* Top Header Navigation Strip */}
      <div className="border-b border-white/10 bg-[#0E1217]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <Link
            to={`/films/${film.slug || film.id}`}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-white/70 hover:text-brand transition-colors group cursor-pointer"
          >
            <Icon icon="solar:arrow-left-linear" className="text-base group-hover:-translate-x-1 transition-transform" />
            <span>Back to {title}</span>
          </Link>

          <div className="flex items-center gap-2 text-xs text-white/40 font-mono">
            <span>{criticsList.length + audienceList.length} Total Reviews</span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Rotten Tomatoes Layout Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="flex flex-col lg:flex-row items-start gap-8 xl:gap-12">
          
          {/* ========================================================================= */}
          {/* LEFT COLUMN: FILM POSTER & METADATA (STICKY)                             */}
          {/* ========================================================================= */}
          <aside className="w-full lg:w-64 xl:w-72 shrink-0 lg:sticky lg:top-20 self-start">
            <div className="bg-[#0E1217] border border-white/10 rounded-2xl p-5 shadow-2xl space-y-5">
              {/* Poster */}
              <Link to={`/films/${film.slug || film.id}`} className="block group">
                <div className="aspect-[2/3] w-full rounded-xl overflow-hidden border border-white/10 bg-[#141A22] shadow-xl relative group-hover:border-brand/40 transition-colors">
                  <ImageWithFallback
                    src={film.poster_url}
                    alt={title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    fallbackType="film"
                    name={title}
                    width={320}
                    loading="eager"
                  />
                </div>
              </Link>

              {/* Title & Return */}
              <div>
                <Link
                  to={`/films/${film.slug || film.id}`}
                  className="font-heading font-black text-xl sm:text-2xl text-white hover:text-brand transition-colors leading-tight block"
                >
                  {title}
                </Link>
                {year && <p className="text-xs text-white/50 font-medium mt-0.5">{year}</p>}
              </div>

              {/* Film Attributes (Stacked Key-Value exactly like Rotten Tomatoes) */}
              <div className="border-t border-white/10 pt-4 space-y-2.5 text-xs text-white/80">
                <div>
                  <span className="font-bold text-white/50 block text-[11px] uppercase tracking-wider mb-0.5">Rating:</span>
                  <span className="font-semibold text-white">{ratingAge}</span>
                </div>

                {runtime && (
                  <div>
                    <span className="font-bold text-white/50 block text-[11px] uppercase tracking-wider mb-0.5">Runtime:</span>
                    <span className="font-semibold text-white">{runtime}</span>
                  </div>
                )}

                {genresString && (
                  <div>
                    <span className="font-bold text-white/50 block text-[11px] uppercase tracking-wider mb-0.5">Genres:</span>
                    <span className="font-semibold text-white leading-relaxed">{genresString}</span>
                  </div>
                )}

                {film.director && (
                  <div>
                    <span className="font-bold text-white/50 block text-[11px] uppercase tracking-wider mb-0.5">Directed By:</span>
                    <span className="font-semibold text-white">{film.director}</span>
                  </div>
                )}

                <div>
                  <span className="font-bold text-white/50 block text-[11px] uppercase tracking-wider mb-0.5">Release Status:</span>
                  <span className="font-semibold text-white">
                    {film.release_type === 'cinema' ? 'In Theaters' : 'Streaming / Online'}
                  </span>
                </div>
              </div>

              {/* Compact Dual Score Summary Badge */}
              <div className="border-t border-white/10 pt-4 grid grid-cols-2 gap-2 text-center">
                {/* Critics Score */}
                <div className="p-2.5 bg-white/[0.03] border border-white/10 rounded-xl">
                  <div className="flex items-center justify-center gap-1 text-emerald-400 font-black text-base font-heading">
                    <Icon icon="solar:medal-ribbon-star-bold" className="text-sm" />
                    <span>{criticMetrics.freshPct != null ? `${criticMetrics.freshPct}%` : (criticMetrics.avgScore ? `${criticMetrics.avgScore}/10` : '—')}</span>
                  </div>
                  <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider block mt-0.5">
                    Critics Score
                  </span>
                </div>

                {/* Audience Score */}
                <div className="p-2.5 bg-white/[0.03] border border-white/10 rounded-xl">
                  <div className="flex items-center justify-center gap-1 text-[#FA320A] font-black text-base font-heading">
                    <Icon icon="mdi:popcorn" className="text-base" />
                    <span>{audienceMetrics.likedPct != null ? `${audienceMetrics.likedPct}%` : '—'}</span>
                  </div>
                  <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider block mt-0.5">
                    Audience Score
                  </span>
                </div>
              </div>

              {/* MuviDB Overall 0-10 Rating */}
              {muvidbScore && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:star-bold" className="text-amber-400 text-lg" />
                    <span className="text-xs font-black uppercase tracking-wider text-amber-400">MuviDB Score</span>
                  </div>
                  <span className="font-heading font-black text-sm text-white">
                    {Number(muvidbScore).toFixed(1)} <span className="text-white/40 text-[10px]">/ 10</span>
                  </span>
                </div>
              )}

              {/* Footer link matching RT: "Do you think we mischaracterized a critic's review?" */}
              <div className="pt-2">
                <Link
                  to={`/films/${film.slug || film.id}`}
                  className="text-[11px] text-white/40 hover:text-brand transition-colors block text-center underline underline-offset-2"
                >
                  Do you think we mischaracterized a review? Let us know
                </Link>
              </div>

            </div>
          </aside>

          {/* ========================================================================= */}
          {/* RIGHT COLUMN: ROTTEN TOMATOES REVIEW STREAM & TABS                        */}
          {/* ========================================================================= */}
          <main className="flex-1 min-w-0 w-full">
            {/* Page Heading */}
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black font-heading tracking-tight text-white">
                {title} Reviews
              </h1>
              <p className="text-xs sm:text-sm text-white/50 mt-1">
                Verified reviews, press commentary, and authentic audience reactions
              </p>
            </div>

            {/* Rotten Tomatoes Filter Pills Tab Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {/* ALL CRITICS */}
                <button
                  type="button"
                  onClick={() => handleTabChange('all_critics')}
                  className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'all_critics'
                      ? 'bg-white text-black shadow-lg shadow-white/10 scale-105'
                      : 'bg-[#0E1217] text-white/60 hover:text-white hover:bg-[#141A22] border border-white/10'
                  }`}
                >
                  All Critics {criticMetrics.count > 0 && `(${criticMetrics.count})`}
                </button>

                {/* TOP CRITICS */}
                <button
                  type="button"
                  onClick={() => handleTabChange('top_critics')}
                  className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'top_critics'
                      ? 'bg-white text-black shadow-lg shadow-white/10 scale-105'
                      : 'bg-[#0E1217] text-white/60 hover:text-white hover:bg-[#141A22] border border-white/10'
                  }`}
                >
                  Top Critics {criticMetrics.topCriticsCount > 0 && `(${criticMetrics.topCriticsCount})`}
                </button>

                {/* ALL AUDIENCE */}
                <button
                  type="button"
                  onClick={() => handleTabChange('all_audience')}
                  className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'all_audience'
                      ? 'bg-white text-black shadow-lg shadow-white/10 scale-105'
                      : 'bg-[#0E1217] text-white/60 hover:text-white hover:bg-[#141A22] border border-white/10'
                  }`}
                >
                  All Audience {audienceMetrics.totalCount > 0 && `(${audienceMetrics.totalCount})`}
                </button>

                {/* VERIFIED AUDIENCE */}
                <button
                  type="button"
                  onClick={() => handleTabChange('verified_audience')}
                  className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'verified_audience'
                      ? 'bg-white text-black shadow-lg shadow-white/10 scale-105'
                      : 'bg-[#0E1217] text-white/60 hover:text-white hover:bg-[#141A22] border border-white/10'
                  }`}
                >
                  Verified Audience {audienceMetrics.verifiedCount > 0 && `(${audienceMetrics.verifiedCount})`}
                </button>
              </div>

              {/* Instant Search Box */}
              <div className="relative w-full sm:w-64">
                <Icon icon="solar:magnifer-linear" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 text-sm" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search reviews..."
                  className="w-full bg-[#0E1217] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-brand/60 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Reviews Stream (Rotten Tomatoes Cards) */}
            {displayedReviews.length === 0 ? (
              <div className="bg-[#0E1217] border border-dashed border-white/15 rounded-2xl p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/30 mx-auto">
                  <Icon icon="solar:chat-square-bold" className="text-2xl" />
                </div>
                <h3 className="font-heading font-black text-lg text-white">No reviews found in this category</h3>
                <p className="text-xs text-white/50 max-w-sm mx-auto">
                  {searchQuery ? `No results matching "${searchQuery}". Try another search term.` : 'Be the first to share your thoughts on this film.'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-xs text-brand font-bold hover:underline"
                  >
                    Clear search filter
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {displayedReviews.map((rev) => {
                  const initial = rev.author.charAt(0).toUpperCase();

                  return (
                    <article
                      key={rev.id}
                      className="bg-[#0E1217] border border-white/10 hover:border-white/20 rounded-2xl p-5 sm:p-6 transition-all duration-200 shadow-md flex flex-col justify-between gap-3.5 group"
                    >
                      {/* Top Row: Avatar + Author Info + Actions */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Avatar */}
                          <div className="relative shrink-0">
                            {rev.avatar ? (
                              <img
                                src={rev.avatar}
                                alt=""
                                className="w-11 h-11 rounded-full object-cover border border-white/15 shadow-sm"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-full bg-[#1C2430] border border-white/15 flex items-center justify-center text-brand font-black text-sm">
                                {initial}
                              </div>
                            )}
                            {rev.source === 'youtube' && (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center text-white text-[9px] shadow-sm">
                                <Icon icon="mdi:youtube" />
                              </div>
                            )}
                          </div>

                          {/* Author Names & Credentials */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-heading font-black text-sm sm:text-base text-white tracking-tight truncate">
                                {rev.author}
                              </h4>
                              {rev.type === 'critic' && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                                  <Icon icon="solar:verified-check-bold" className="text-[10px]" />
                                  {rev.isTop ? 'Top Critic' : 'Certified Critic'}
                                </span>
                              )}
                              {rev.isVerified && rev.type === 'audience' && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
                                  <Icon icon="solar:shield-check-bold" className="text-[10px]" />
                                  Verified
                                </span>
                              )}
                              {rev.source === 'youtube' && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">
                                  via YouTube
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5">
                              <span className="font-medium truncate">{rev.handle}</span>
                              {rev.createdAt && (
                                <>
                                  <span>•</span>
                                  <span>{formatRelativeTime(rev.createdAt)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Top Right Action (External link or three dots) */}
                        {rev.url && (
                          <a
                            href={rev.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white/40 hover:text-white text-sm p-1 rounded-lg hover:bg-white/5 transition-all shrink-0 cursor-pointer"
                            title="View source review"
                          >
                            <Icon icon="solar:arrow-right-up-linear" />
                          </a>
                        )}
                      </div>

                      {/* Middle: 5 Yellow Stars (Rotten Tomatoes visual signature) */}
                      {rev.rating10 != null && (
                        <div className="pt-0.5">
                          <StarDisplay score10={rev.rating10} />
                        </div>
                      )}

                      {/* Review Text Body */}
                      <p className="text-white/90 text-sm sm:text-[15px] leading-relaxed font-sans whitespace-pre-line">
                        {rev.body}
                      </p>

                      {/* Footer / Meta info */}
                      {(rev.likes > 0 || rev.url) && (
                        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-white/40">
                          {rev.likes > 0 ? (
                            <span className="flex items-center gap-1 text-[11px] font-mono">
                              <Icon icon="solar:like-bold" className="text-red-400 text-xs" />
                              <span>{rev.likes.toLocaleString()} likes</span>
                            </span>
                          ) : <span />}

                          {rev.url && (
                            <a
                              href={rev.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-bold text-brand hover:underline inline-flex items-center gap-1"
                            >
                              <span>{rev.type === 'critic' ? 'Read full publication article' : 'View comment on YouTube'}</span>
                              <Icon icon="solar:arrow-right-up-linear" className="text-xs" />
                            </a>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </main>

        </div>
      </div>
    </div>
  );
}
