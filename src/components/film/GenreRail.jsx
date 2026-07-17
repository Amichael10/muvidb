import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import FilmCard from './FilmCard';

const GENRES = [
  { name: 'Drama', icon: 'solar:mask-happly-bold', color: 'from-blue-500/20 to-blue-600/5' },
  { name: 'Romance', icon: 'solar:heart-bold', color: 'from-pink-500/20 to-pink-600/5' },
  { name: 'Comedy', icon: 'solar:smile-circle-bold', color: 'from-yellow-400/20 to-yellow-500/5' },
  { name: 'Horror', icon: 'solar:skull-bold', color: 'from-gray-700/20 to-black/5' },
  { name: 'Crime', icon: 'solar:danger-triangle-bold', color: 'from-slate-600/20 to-slate-800/5' },
  { name: 'Action', icon: 'solar:bolt-bold', color: 'from-red-500/20 to-red-600/5' },
  { name: 'Thriller', icon: 'solar:ghost-bold', color: 'from-purple-500/20 to-purple-600/5' },
  { name: 'Epic', icon: 'solar:crown-bold', color: 'from-amber-600/20 to-amber-700/5' },
  { name: 'Faith', icon: 'solar:star-bold', color: 'from-sky-400/20 to-sky-500/5' },
  { name: 'Social Issue', icon: 'solar:users-group-rounded-bold', color: 'from-teal-500/20 to-teal-600/5' },
  { name: 'Melodrama', icon: 'solar:sad-circle-bold', color: 'from-indigo-500/20 to-indigo-600/5' },
  { name: 'Urban', icon: 'solar:city-bold', color: 'from-zinc-500/20 to-zinc-600/5' },
  { name: 'RomCom', icon: 'solar:heart-angle-bold', color: 'from-rose-400/20 to-rose-500/5' },
  { name: 'Mystery', icon: 'solar:eye-bold', color: 'from-violet-600/20 to-violet-700/5' },
  { name: 'Musical', icon: 'solar:music-note-bold', color: 'from-fuchsia-500/20 to-fuchsia-600/5' },
  { name: 'Family', icon: 'solar:home-smile-bold', color: 'from-orange-400/20 to-orange-500/5' },
  { name: 'Biography', icon: 'solar:user-id-bold', color: 'from-emerald-500/20 to-emerald-600/5' },
  { name: 'Documentary', icon: 'solar:videocamera-record-bold', color: 'from-cyan-500/20 to-cyan-600/5' },
  { name: 'Animation', icon: 'solar:ghost-bold', color: 'from-lime-500/20 to-lime-600/5' },
];

export default function GenreRail({ variant = 'grid' }) {
  const isChips = variant === 'chips';
  const isPosterGrid = variant === 'poster-grid';
  const [selectedGenre, setSelectedGenre] = useState('');
  // genreCounts: null = still loading; {} or map = loaded. Replaces the old
  // dependency on a 1,000-film array passed down from the homepage.
  const [genreCounts, setGenreCounts] = useState(null);
  const [genreCovers, setGenreCovers] = useState({});
  const [filteredFilms, setFilteredFilms] = useState([]);

  // Ref and state for scrollable lineup row
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Fetch whole-catalogue genre counts once via a single light aggregate query
  // (instead of counting a capped film list on the client).
  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('genres')
        .select('name, film_genres(count)');
      if (!active) return;
      if (error || !data) {
        setGenreCounts({});
        return;
      }
      const counts = {};
      data.forEach(g => { counts[g.name] = g.film_genres?.[0]?.count || 0; });
      setGenreCounts(counts);
    })();
    return () => { active = false; };
  }, []);

  // Fetch cover images for poster-grid variant once genre counts are available.
  useEffect(() => {
    if (!isPosterGrid || !genreCounts) return;
    let active = true;
    (async () => {
      // Get the top genre names that have films
      const topGenreNames = GENRES
        .filter(g => (genreCounts[g.name] || 0) > 0)
        .sort((a, b) => (genreCounts[b.name] || 0) - (genreCounts[a.name] || 0))
        .slice(0, 10)
        .map(g => g.name);
      if (topGenreNames.length === 0) return;

      // Fetch one top film per genre in parallel for cover images
      const coverPromises = topGenreNames.map(async (genreName) => {
        const { data } = await supabase
          .from('films')
          .select('poster_url, film_genres!inner(genres!inner(name))')
          .eq('film_genres.genres.name', genreName)
          .not('poster_url', 'is', null)
          .order('view_count', { ascending: false })
          .limit(1);
        return { genre: genreName, poster: data?.[0]?.poster_url || '' };
      });
      const results = await Promise.all(coverPromises);
      if (!active) return;
      const covers = {};
      results.forEach(r => { if (r.poster) covers[r.genre] = r.poster; });
      setGenreCovers(covers);
    })();
    return () => { active = false; };
  }, [genreCounts, isPosterGrid]);

  // Compute active genres from the curated list + fetched counts.
  const activeGenres = GENRES
    .map(genre => ({ ...genre, count: genreCounts?.[genre.name] || 0, coverImage: genreCovers[genre.name] || '' }))
    .filter(g => g.count > 0);

  // Auto-select top genre with most films once counts arrive.
  useEffect(() => {
    if (!selectedGenre && activeGenres.length > 0) {
      const topGenre = [...activeGenres].sort((a, b) => b.count - a.count)[0].name;
      setSelectedGenre(topGenre);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genreCounts]);

  // Lazy-load the films for the selected genre only when it changes (top 20 by views).
  useEffect(() => {
    if (!selectedGenre) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('films')
        .select(`
          id, slug, title, poster_url, backdrop_url, year, language,
          runtime_minutes, view_count, average_rating, nfvcb_rating,
          is_featured, is_trending, release_type, streaming_links, source,
          youtube_watch_url, content_type, season_count, created_at, release_date,
          film_genres!inner(genres!inner(name))
        `)
        .eq('film_genres.genres.name', selectedGenre)
        .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
        .order('view_count', { ascending: false })
        .limit(50);
      if (!active) return;
      if (!error && data) {
        // Shuffle the array and take the first 20
        const shuffled = [...data].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 20);

        setFilteredFilms(selected.map(f => ({
          ...f,
          genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
        })));
      } else {
        setFilteredFilms([]);
      }
    })();
    return () => { active = false; };
  }, [selectedGenre]);

  // Scroll checking logic for lineup
  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [filteredFilms]);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      const scrollAmount = direction === 'left' ? -clientWidth * 0.8 : clientWidth * 0.8;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // While counts load, reserve the section height so it doesn't shift the
  // page in (CLS) once it appears.
  if (genreCounts === null) {
    if (isPosterGrid) {
      return (
        <section className="py-16 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-10">
              <div className="h-7 w-48 bg-surface-2 rounded animate-pulse" />
              <div className="h-4 w-24 bg-surface-2 rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="rounded-lg overflow-hidden bg-surface-2 animate-pulse aspect-[4/3]" />
              ))}
            </div>
          </div>
        </section>
      );
    }
    if (!isChips) return null;
    return (
      <section className="py-16 overflow-hidden bg-surface-2/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10 border-x border-white/5">
          <div className="h-7 w-48 bg-white/10 rounded animate-pulse" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-x border-white/5">
          <div className="flex gap-2.5 overflow-hidden pb-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shrink-0 h-10 w-28 rounded-full bg-white/10 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (activeGenres.length === 0) return null;

  // ──── Poster Grid variant (homepage) ────
  if (isPosterGrid) {
    const topGenres = [...activeGenres]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return (
      <section className="py-16 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-text-muted text-[10px] font-bold uppercase tracking-[0.25em] mb-1">Explore by category</p>
              <h2 className="font-heading font-bold text-2xl md:text-3xl text-text-primary tracking-tighter">
                Browse by Genre
              </h2>
            </div>
            <Link
              to="/browse"
              className="group/see shrink-0 inline-flex items-center gap-1.5 text-text-secondary hover:text-brand text-xs font-bold tracking-wide transition-colors whitespace-nowrap"
            >
              All genres
              <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4 transition-transform duration-300 group-hover/see:translate-x-1" />
            </Link>
          </div>

          {/* Genre poster grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {topGenres.map((genre) => (
              <Link
                key={genre.name}
                to={`/browse?genre=${encodeURIComponent(genre.name)}`}
                className="group relative rounded-lg overflow-hidden bg-surface-2 aspect-[4/3] block border border-border shadow-sm"
              >
                {/* Cover poster */}
                {genre.coverImage ? (
                  <img
                    src={genre.coverImage}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-surface-3 to-surface-2" />
                )}
                {/* Dark overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                {/* Text */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="font-heading font-bold text-white text-sm md:text-base tracking-tight group-hover:text-brand transition-colors">
                    {genre.name}
                  </h3>
                  <p className="text-white/60 text-[11px] font-semibold mt-0.5">
                    {genre.count.toLocaleString()} {genre.count === 1 ? 'movie' : 'movies'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 overflow-hidden bg-surface-2/5">
      {/* Title */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10 border-x border-white/5 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-heading font-bold text-2xl text-text-primary tracking-tighter">
            Browse by Mood
          </h2>
          <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mt-1 opacity-60">
            Find your next obsession — dynamically updated
          </p>
        </div>
        <Link to="/browse" className="text-brand text-[10px] font-bold uppercase tracking-widest hover:underline whitespace-nowrap shrink-0">
          All genres →
        </Link>
      </div>

      {/* Compact chip strip (homepage) */}
      {isChips ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-x border-white/5 mb-2">
          <div className="flex gap-2.5 overflow-x-auto pb-4 scrollbar-hide touch-pan-x">
            {activeGenres.map((genre) => {
              const isSelected = selectedGenre === genre.name;
              return (
                <button
                  key={genre.name}
                  onClick={() => setSelectedGenre(genre.name)}
                  className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-bold whitespace-nowrap border transition-all duration-200 ${
                    isSelected
                      ? 'bg-brand border-brand text-white shadow-lg shadow-brand/20'
                      : 'bg-surface border-border text-text-secondary hover:border-brand/50 hover:text-text-primary'
                  }`}
                >
                  <Icon icon={genre.icon} className="text-base" />
                  {genre.name}
                  <span className={`text-[10px] font-black ${isSelected ? 'text-white/70' : 'text-text-muted'}`}>
                    {genre.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
      /* Grid of Genre Cards */
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-x border-white/5 mb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {activeGenres.map((genre, i) => {
            const isSelected = selectedGenre === genre.name;
            return (
              <motion.div
                key={genre.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.4), duration: 0.5 }}
                viewport={{ once: true }}
              >
                <button
                  onClick={() => setSelectedGenre(genre.name)}
                  className={`text-left group relative flex flex-col justify-end w-full h-44 rounded-2xl border overflow-hidden bg-surface transition-all duration-500 ${
                    isSelected 
                      ? 'border-brand shadow-xl shadow-brand/10 ring-2 ring-brand/30' 
                      : 'border-border hover:border-brand/40 hover:shadow-2xl hover:shadow-brand/5'
                  }`}
                >
                  {/* Background Cover Image */}
                  {genre.coverImage ? (
                    <img 
                      src={genre.coverImage} 
                      alt="" 
                      className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-50 group-hover:scale-110 transition-all duration-700" 
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-brand/10 to-transparent opacity-20" />
                  )}
                  
                  {/* Overlay Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                  
                  {/* Content Overlay */}
                  <div className="relative z-10 p-5 flex items-center justify-between w-full">
                    <div className="space-y-1">
                      <span className={`text-lg font-heading font-black tracking-tight transition-colors block ${isSelected ? 'text-brand' : 'text-white group-hover:text-brand'}`}>
                        {genre.name}
                      </span>
                      <p className="text-[10px] font-bold text-text-muted group-hover:text-white/80 transition-colors uppercase tracking-widest">
                        {genre.count} {genre.count === 1 ? 'Film' : 'Films'}
                      </p>
                    </div>
                    
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all shrink-0 ${
                      isSelected 
                        ? 'bg-brand/20 border-brand text-brand' 
                        : 'bg-white/5 group-hover:bg-brand/20 border-white/10 group-hover:border-brand/30 text-white group-hover:text-brand'
                    }`}>
                      <Icon icon={genre.icon} className="text-xl" />
                    </div>
                  </div>
                  
                  {/* Bottom Line Accent */}
                  <div className={`absolute bottom-0 left-0 right-0 h-1 bg-brand transition-transform duration-500 origin-left ${isSelected ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`} />
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
      )}

      {/* Selected Genre Lineup Row */}
      {selectedGenre && filteredFilms.length > 0 && (
        <div className={`${isChips ? 'pt-2' : 'border-t border-border pt-12 mt-12'} relative group/row`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Row Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div className="space-y-1">
                <h3 className="text-xl font-heading font-black text-text-primary tracking-tight">
                  Selected Mood: {selectedGenre}
                </h3>
                <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mt-1 opacity-70">
                  Highly rated titles matching this genre
                </p>
              </div>
              <Link 
                to={`/browse?genre=${encodeURIComponent(selectedGenre)}`} 
                className="text-text-primary font-bold text-xs px-5 py-2.5 border border-border rounded-lg hover:border-brand hover:text-brand transition-all duration-300 flex items-center gap-2 w-fit bg-surface/50 backdrop-blur-sm"
              >
                See all {selectedGenre} Films
                <Icon icon="solar:alt-arrow-right-linear" className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Scrollable Row Container */}
            <div className="relative -mx-4 sm:mx-0">
              {/* Edge Gradients for Desktop */}
              <div className={`absolute top-0 left-0 bottom-0 w-20 z-10 bg-gradient-to-r from-bg to-transparent pointer-events-none transition-opacity duration-300 hidden md:block ${canScrollLeft ? 'opacity-100' : 'opacity-0'}`} />
              <div className={`absolute top-0 right-0 bottom-0 w-20 z-10 bg-gradient-to-l from-bg to-transparent pointer-events-none transition-opacity duration-300 hidden md:block ${canScrollRight ? 'opacity-100' : 'opacity-0'}`} />

              {/* Navigation Arrows */}
              {filteredFilms.length > 1 && (
                <>
                  <button 
                    onClick={() => scroll('left')}
                    className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 w-10 h-10 bg-surface border border-border rounded-full flex items-center justify-center text-text-primary shadow-lg opacity-0 group-hover/row:opacity-100 transition-all duration-300 hover:scale-110 active:scale-95 hover:border-brand hidden md:flex ${!canScrollLeft && 'pointer-events-none !opacity-0'}`}
                    aria-label="Previous"
                  >
                    <Icon icon="solar:alt-arrow-left-linear" width="20" height="20" />
                  </button>
                  
                  <button 
                    onClick={() => scroll('right')}
                    className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20 w-10 h-10 bg-surface border border-border rounded-full flex items-center justify-center text-text-primary shadow-lg opacity-0 group-hover/row:opacity-100 transition-all duration-300 hover:scale-110 active:scale-95 hover:border-brand hidden md:flex ${!canScrollRight && 'pointer-events-none !opacity-0'}`}
                    aria-label="Next"
                  >
                    <Icon icon="solar:alt-arrow-right-linear" width="20" height="20" />
                  </button>
                </>
              )}

              <div 
                ref={scrollRef}
                onScroll={checkScroll}
                className="flex overflow-x-auto gap-4 md:gap-6 py-16 -my-16 px-4 sm:px-0 scrollbar-hide touch-pan-x"
              >
                {filteredFilms.map((film) => (
                  <div key={film.id} className="shrink-0">
                    <FilmCard 
                      film={film} 
                      size="md" 
                      variant="portrait" 
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
