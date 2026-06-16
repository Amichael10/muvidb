import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Icon } from '@iconify/react';
import { useWatchlist } from '../hooks/useWatchlist';
import ReviewSection from '../components/film/ReviewSection';
import PersonCard from '../components/person/PersonCard';
import FilmCard from '../components/film/FilmCard';
import WatchOptions from '../components/film/WatchOptions';
import { PLATFORMS, isFilmOnPlatform, getWatchUrl } from '../lib/platforms';
import { Skeleton } from '../components/ui/Skeleton';
import ShareAction from '../components/ui/ShareAction';
import { slugOrId } from '../utils/slug';
import ImageWithFallback from '../components/ui/ImageWithFallback';

const FilmDetailSkeleton = () => (
    <div className="w-full bg-bg min-h-screen">
        <div className="relative w-full h-[60vh] min-h-[500px] bg-surface-2/10 border-b border-border overflow-hidden">
            <div className="absolute inset-0 bg-surface-2 animate-shimmer opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/40 to-transparent"></div>
            <div className="absolute bottom-0 left-0 w-full">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-x border-white/5 flex flex-col md:flex-row items-end gap-8 pb-8">
                    <div className="hidden md:block w-64 h-96 bg-surface-2 rounded-xl animate-shimmer shrink-0 shadow-2xl border border-white/10"></div>
                    <div className="flex-1 space-y-6 w-full pb-4">
                        <div className="space-y-4">
                            <div className="h-12 w-2/3 bg-surface-2 rounded-lg animate-shimmer"></div>
                            <div className="h-4 w-1/3 bg-surface-2 rounded-md animate-shimmer opacity-60"></div>
                        </div>
                        <div className="flex gap-2">
                            <div className="h-6 w-20 bg-surface-2 rounded-md animate-shimmer"></div>
                            <div className="h-6 w-20 bg-surface-2 rounded-md animate-shimmer"></div>
                            <div className="h-6 w-20 bg-surface-2 rounded-md animate-shimmer"></div>
                        </div>
                        <div className="h-10 w-48 bg-surface-2 rounded-lg animate-shimmer"></div>
                    </div>
                </div>
            </div>
        </div>

        <div className="max-w-7xl mx-auto border-x border-border min-h-[600px]">
            <div className="grid grid-cols-1 lg:grid-cols-3 divide-x divide-border">
                <div className="lg:col-span-2">
                    <div className="p-8 md:p-12 border-b border-border space-y-6">
                        <div className="h-8 w-48 bg-surface-2 rounded-md animate-shimmer" />
                        <div className="space-y-3">
                            <div className="h-4 w-full bg-surface-2 rounded animate-shimmer" />
                            <div className="h-4 w-full bg-surface-2 rounded animate-shimmer" />
                            <div className="h-4 w-4/5 bg-surface-2 rounded animate-shimmer" />
                        </div>
                    </div>
                    <div className="p-8 md:p-12 border-b border-border space-y-6 bg-surface-2/5">
                        <div className="h-8 w-56 bg-surface-2 rounded-md animate-shimmer" />
                        <div className="aspect-video w-full bg-surface-2 rounded-xl border border-border animate-shimmer" />
                    </div>
                    <div className="p-8 md:p-12 border-b border-border space-y-8">
                        <div className="h-8 w-32 bg-surface-2 rounded-md animate-shimmer" />
                        <div className="flex gap-8 overflow-hidden">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="shrink-0 w-32 space-y-3">
                                    <div className="w-32 h-32 bg-surface-2 rounded-xl border border-border animate-shimmer" />
                                    <div className="h-3 w-full bg-surface-2 rounded animate-shimmer" />
                                    <div className="h-2 w-1/2 bg-surface-2 rounded animate-shimmer opacity-60" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-1 divide-y divide-border">
                    <div className="p-8">
                        <div className="h-24 w-full bg-surface-2 rounded-xl border border-border animate-shimmer" />
                    </div>
                    <div className="p-8 space-y-6 bg-surface-2/5">
                        <div className="h-4 w-24 bg-surface-2 rounded animate-shimmer" />
                        <div className="space-y-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="flex justify-between items-center pb-3 border-b border-border last:border-0 last:pb-0">
                                    <div className="h-3 w-16 bg-surface-2 rounded animate-shimmer" />
                                    <div className="h-3 w-20 bg-surface-2 rounded animate-shimmer" />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="p-8 space-y-4">
                        <div className="h-12 w-full bg-surface-2 rounded-lg animate-shimmer" />
                        <div className="h-12 w-full bg-surface-2 rounded-lg animate-shimmer" />
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default function FilmDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [film, setFilm] = useState(null);
  const [filmId, setFilmId] = useState(null); // actual UUID for sub-queries
  const [relatedFilms, setRelatedFilms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [episodes, setEpisodes] = useState([]);
  const [parentSeries, setParentSeries] = useState(null);

  const fetchEpisodes = async (seriesId) => {
    try {
      const { data, error } = await supabase
        .from('films')
        .select('id, title, poster_url, youtube_watch_url, episode_number, season_number, synopsis, runtime_minutes')
        .eq('series_id', seriesId)
        .order('episode_number', { ascending: true });

      if (error) throw error;
      setEpisodes(data || []);
    } catch (error) {
      console.error('Error fetching episodes:', error);
    }
  };

  const fetchParentSeries = async (parentId) => {
    try {
      const { data, error } = await supabase
        .from('films')
        .select('id, title, slug')
        .eq('id', parentId)
        .single();
      if (!error && data) {
        setParentSeries(data);
      }
    } catch (e) {
      console.error('Error fetching parent series:', e);
    }
  };

  const {
    inWatchlist,
    loading: watchlistLoading,
    toggleWatchlist
  } = useWatchlist(filmId, user);

  const [cast, setCast] = useState([]);
  const [crew, setCrew] = useState([]);
  const [showAllCast, setShowAllCast] = useState(false);

  useEffect(() => {
    fetchFilm();
  }, [slug]);

  const fetchCredits = async (uuid) => {
    try {
      const { data, error } = await supabase
        .from('credits')
        .select(`
          id, role, character_name, billing_order,
          people(id, name, photo_url, popularity_score, slug)
        `)
        .eq('film_id', uuid)
        .order('billing_order', { ascending: true });

      if (error) throw error;
      
      const castMembers = data
        .filter(c => {
          const role = (c.role || '').trim().toLowerCase();
          return role === 'actor' || role === 'cast';
        })
        .map(c => {
          const person = Array.isArray(c.people) ? c.people[0] : c.people;
          return person ? { ...person, role: c.character_name || 'Cast' } : null;
        })
        .filter(Boolean);
        
      const crewMembers = data
        .filter(c => {
          const role = (c.role || '').trim().toLowerCase();
          return role !== 'actor' && role !== 'cast';
        })
        .map(c => {
          const person = Array.isArray(c.people) ? c.people[0] : c.people;
          return person ? { ...person, role: c.role || 'Crew' } : null;
        })
        .filter(Boolean);

      setCast(castMembers);
      setCrew(crewMembers);
      
      // Extract director if available
      const dir = crewMembers.find(m => (m.role || '').toLowerCase().includes('director'));
      if (dir) {
        setFilm(prev => prev ? { ...prev, director: dir.name } : null);
      }
    } catch (error) {
      console.error('Error fetching credits:', error);
    }
  };

  const fetchFilm = async () => {
    setLoading(true);
    try {
      const { col, val } = slugOrId(slug);
      const { data, error } = await supabase
        .from('films')
        .select(`
          *,
          film_genres(genres(name)),
          film_companies(
            companies(id, name, logo_url)
          )
        `)
        .eq(col, val)
        .single();

      if (error) throw error;
      
      const mappedFilm = {
        ...data,
        genres: data.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
      };
      
      setFilm(mappedFilm);
      setFilmId(data.id);
      fetchCredits(data.id);

      if (data.content_type === 'series') {
        fetchEpisodes(data.id);
      } else if (data.series_id) {
        fetchParentSeries(data.series_id);
      }

      if (data) {
        document.title = `MuviDB | ${data.title}`;
        const { data: related } = await supabase
          .from('films')
          .select(`
            id, title, year, poster_url, backdrop_url, slug,
            film_genres(genres(name))
          `)
          .neq('id', data.id)
          .limit(3);
          
        setRelatedFilms((related || []).map(f => ({
          ...f,
          genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
        })));
      }
    } catch (error) {
      console.error('Error fetching film:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWatchlist = async () => {
    if (!user) {
      navigate('/login', {
        state: { from: `/films/${film?.slug || film?.id || slug}`, message: 'Sign in to add films to your watchlist' }
      });
      return;
    }
    await toggleWatchlist();
  };



  if (loading) return <FilmDetailSkeleton />;

  if (!film) {
    return (
      <div className="w-full min-h-screen bg-bg flex items-center justify-center">
        <div className="max-w-7xl mx-auto px-4 border-x border-border py-32 text-center w-full">
          <Icon icon="solar:clapperboard-play-linear" className="text-4xl mx-auto mb-4 opacity-20 text-brand" />
          <p className="text-text-primary font-heading font-bold text-xl tracking-tighter mb-8">Movie not found</p>
          <button onClick={() => navigate('/browse')} className="bg-brand text-white font-bold px-8 py-4 rounded-lg hover:shadow-brand/20 transition-all">
            ← Browse Movies
          </button>
        </div>
      </div>
    );
  }



  return (
    <div className="w-full bg-bg min-h-screen pb-20">
      <Helmet>
        <title>{`MuviDB | ${film.title}`}</title>
        <meta name="description" content={film.synopsis?.slice(0, 150) || `Watch ${film.title} on MuviDB.`} />
        <meta property="og:title" content={`MuviDB | ${film.title}`} />
        <meta property="og:description" content={film.synopsis?.slice(0, 150) || `Watch ${film.title} on MuviDB.`} />
        {(film.poster_url || film.poster) && <meta property="og:image" content={film.poster_url || film.poster} />}
      </Helmet>
      {/* 1. CINEMATIC HEADER */}
      <div className="relative w-full h-[60vh] min-h-[500px] border-b border-border overflow-hidden">
        <ImageWithFallback
          src={film.backdrop_url || film.backdrop} 
          alt={`${film.title} Backdrop`} 
          className="absolute inset-0 w-full h-full object-cover"
          fallbackType="banner"
          name={film.title}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent w-full md:w-1/2"></div>
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg to-transparent"></div>

        <div className="absolute bottom-0 left-0 w-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-x border-white/5 flex flex-col md:flex-row items-end gap-8 pb-8">
            <div className="hidden md:block w-64 shrink-0 translate-y-16 z-10">
              <ImageWithFallback
                src={film.poster_url || film.poster} 
                alt={`${film.title} Poster`} 
                className="w-full rounded-xl shadow-2xl border border-white/10 object-cover aspect-[2/3]"
                fallbackType="banner"
                name={film.title}
              />
            </div>

            <div className="flex-1 z-10 w-full">
              {parentSeries && (
                <Link 
                  to={`/films/${parentSeries.slug || parentSeries.id}`}
                  className="inline-flex items-center gap-1.5 bg-brand/10 border border-brand/20 text-brand px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase mb-3 hover:bg-brand/20 transition-all"
                >
                  <Icon icon="solar:tv-bold" className="text-xs" />
                  <span>Part of Series: {parentSeries.title}</span>
                </Link>
              )}
              <h1 className="font-heading font-bold text-4xl md:text-6xl text-white mb-4 leading-tight tracking-tighter drop-shadow-2xl">
                {film.title}
              </h1>

              <div className="flex flex-wrap items-center gap-3 md:gap-4 text-xs text-white/80 font-bold mb-4">
                <span>{film.year}</span>
                <span className="w-1 h-1 rounded-full bg-white/20"></span>
                <span>
                  {film.content_type === 'series'
                    ? (film.season_count ? `${film.season_count} Season${film.season_count > 1 ? 's' : ''}` : 'TV Series')
                    : `${film.runtime_minutes || film.runtime || 0} min`}
                </span>
                <span className="w-1 h-1 rounded-full bg-white/20"></span>
                <span>{film.language}</span>
                <span className="w-1 h-1 rounded-full bg-white/20"></span>
                <span className="bg-brand text-white px-2 py-0.5 rounded text-[10px] font-bold">
                  {film.nfvcb_rating}
                </span>
                {film.is_in_cinemas && (
                  <span className="bg-gold text-bg px-2 py-0.5 rounded text-[10px] font-bold border border-gold uppercase tracking-wider">
                    In Cinemas
                  </span>
                )}
                {(film.coming_soon || film.status === 'upcoming') && (
                  <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-500/30 uppercase tracking-wider">
                    Coming Soon
                  </span>
                )}
                {film.status && !['released', 'upcoming'].includes(film.status) && (
                  <span className="bg-surface-2 text-text-primary px-2 py-0.5 rounded text-[10px] font-bold border border-border capitalize">
                    {film.status.replace('-', ' ')}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                {(film.genres || []).map(genre => (
                  <span key={genre} className="px-3 py-1 text-[10px] font-bold bg-black/40 backdrop-blur-md text-white rounded-lg border border-white/10">
                    {genre}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap items-end gap-6">
                {Number(film.tmdb_rating || film.rating || 0) > 0 ? (
                  <div className="flex items-center gap-3">
                    <span className="text-brand text-4xl md:text-5xl font-bold font-heading leading-none tracking-tighter drop-shadow-lg">{film.tmdb_rating || film.rating}</span>
                    <div className="flex flex-col justify-end pb-1">
                      <span className="text-white/60 text-[10px] font-bold tracking-wide">Rating</span>
                      <div className="flex items-center gap-1 mt-1">
                        {[1, 2, 3, 4, 5].map(star => (
                          <svg key={star} xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill={star <= Math.round((film.tmdb_rating || film.rating) / 2) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className="text-brand">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => {
                      const el = document.getElementById('reviews-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex items-center gap-2 bg-brand/10 border border-brand/20 text-brand px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-brand/20 transition-all duration-300 cursor-pointer active:scale-95 shadow-md shadow-brand/5 mb-1 shrink-0"
                  >
                    <Icon icon="solar:star-bold" className="text-xs" />
                    <span>Be the first to rate</span>
                  </button>
                )}

                <div className="flex items-center gap-1.5 text-white/60 pb-1">
                  <Icon icon="solar:fire-bold" className="text-orange-500 text-lg" />
                  <span className="text-[10px] font-bold tracking-wide">Trending</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. CONTENT SECTION */}
      <div className="max-w-7xl mx-auto border-x border-border min-h-[600px]">
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-x divide-border">

          {/* MAIN CONTENT (70%) */}
          <div className="lg:col-span-2">
            {/* Synopsis */}
            <section className="p-8 md:p-12 border-b border-border">
              <h2 className="font-heading font-bold text-2xl text-text-primary mb-6 tracking-tighter">Synopsis</h2>
              <p className="text-text-muted text-lg leading-relaxed opacity-80 border-l-2 border-brand pl-6">
                {film.synopsis}
              </p>
            </section>

            {/* Episodes (for series) */}
            {episodes.length > 0 && (
              <section className="p-8 md:p-12 border-b border-border bg-surface-2/5">
                <h2 className="font-heading font-bold text-2xl text-text-primary mb-6 tracking-tighter flex items-center gap-2">
                  <Icon icon="solar:playlist-play-bold" className="text-brand" />
                  Episodes
                </h2>
                <div className="flex flex-col gap-4">
                  {episodes.map((episode) => (
                    <div 
                      key={episode.id} 
                      className="flex flex-col sm:flex-row gap-4 bg-surface p-4 rounded-xl border border-border hover:border-brand/40 hover:shadow-xl transition-all duration-300 group"
                    >
                      {/* Episode Thumbnail */}
                      <div className="relative w-full sm:w-48 aspect-video rounded-lg overflow-hidden bg-surface-2 shrink-0 border border-white/5">
                        <ImageWithFallback
                          src={episode.poster_url || film.poster_url || film.poster}
                          alt={episode.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          fallbackType="banner"
                          name={episode.title}
                        />
                        {episode.youtube_watch_url && (
                          <a 
                            href={episode.youtube_watch_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          >
                            <span className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-300">
                              <Icon icon="solar:play-bold" className="text-sm" />
                            </span>
                          </a>
                        )}
                      </div>
                      
                      {/* Episode Info */}
                      <div className="flex-1 flex flex-col justify-between py-1">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-[10px] font-black uppercase tracking-wider text-brand">
                              Episode {episode.episode_number || 'N/A'}
                            </span>
                            {episode.runtime_minutes && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-white/20" />
                                <span className="text-[10px] font-bold text-text-muted">
                                  {episode.runtime_minutes} min
                                </span>
                              </>
                            )}
                          </div>
                          <h3 className="font-heading font-bold text-base text-text-primary tracking-tight leading-snug group-hover:text-brand transition-colors mb-2">
                            {episode.title}
                          </h3>
                          <p className="text-xs text-text-muted line-clamp-2 leading-relaxed font-medium">
                            {episode.synopsis || film.synopsis}
                          </p>
                        </div>
                        
                        {episode.youtube_watch_url && (
                          <div className="mt-3 sm:mt-0">
                            <a 
                              href={episode.youtube_watch_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-brand hover:text-white transition-colors"
                            >
                              <Icon icon="simple-icons:youtube" className="text-[#FF0000] text-xs" />
                              <span>Watch Episode</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Trailer */}
            {film.trailer_youtube_id && (
              <section id="trailer-section" className="p-8 md:p-12 border-b border-border bg-surface-2/10 relative overflow-hidden">
                <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none"></div>
                <h2 className="font-heading font-bold text-2xl text-text-primary mb-6 tracking-tighter relative z-10">Official Trailer</h2>
                <div className="relative z-10 aspect-video rounded-xl overflow-hidden border border-border bg-surface-2 shadow-sm">
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${film.trailer_youtube_id}?autoplay=0&rel=0&modestbranding=1`}
                    title={`${film.title} Trailer`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
              </section>
            )}

            {/* Cast */}
            {cast.length > 0 && (
              <section className="p-8 md:p-12 border-b border-border">
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-text-muted mb-6">Cast</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {(showAllCast ? cast : cast.slice(0, 5)).map(person => (
                    <Link 
                      key={person.id} 
                      to={`/people/${person.slug || person.id}`}
                      className="group flex flex-col"
                    >
                      <div className="relative w-full aspect-[4/5] rounded-xl overflow-hidden border border-border/50 shadow-md group-hover:shadow-xl group-hover:border-gold/50 transition-all duration-300 transform group-hover:scale-[1.03]">
                        {person.photo_url ? (
                          <img 
                            src={person.photo_url} 
                            alt={person.name} 
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-surface-2 flex items-center justify-center text-text-muted text-4xl font-extrabold uppercase select-none transition-colors group-hover:bg-surface-3">
                            {person.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex flex-col text-left">
                        <span className="font-bold text-text-primary text-sm tracking-tight leading-snug line-clamp-1 group-hover:text-gold transition-colors">
                          {person.name}
                        </span>
                        <span className="text-xs text-text-muted font-medium mt-0.5 line-clamp-1">
                          {person.role}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
                
                {cast.length > 5 && (
                  <div className="mt-8 flex justify-center">
                    <button
                      onClick={() => setShowAllCast(prev => !prev)}
                      className="w-full py-4 bg-surface/50 border border-border text-text-primary text-xs font-black uppercase tracking-widest rounded-xl hover:bg-surface hover:border-border-hover transition-all duration-300 active:scale-[0.98]"
                    >
                      {showAllCast ? 'Show less' : `Show all ${cast.length} cast members`}
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* Crew */}
            {crew.length > 0 && (
              <section className="p-8 md:p-12 border-b border-border">
                <h2 className="font-heading font-bold text-2xl text-text-primary mb-6 tracking-tighter">Crew</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-0 border border-border rounded-lg overflow-hidden">
                  {crew.map((member, idx) => (
                    <Link 
                      key={idx} 
                      to={`/people/${member.slug || member.id}`}
                      className="flex items-center gap-4 bg-surface p-4 border-r border-b border-border last:border-r-0 last:border-b-0 hover:bg-surface-2 transition-colors group"
                    >
                      <img src={member.photo_url || `https://placehold.co/150x150/1A1A1A/FF5C00?text=${member.name.split(' ').map(n => n[0]).join('')}`} alt={member.name} className="w-10 h-10 rounded-lg object-cover border border-border group-hover:border-gold transition-colors" />
                      <div>
                        <div className="font-bold text-text-primary text-xs line-clamp-1 tracking-tight group-hover:text-gold transition-colors">{member.name}</div>
                        <div className="text-text-muted text-[10px] font-bold">{member.role}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Reviews */}
            <section id="reviews-section" className="p-8 md:p-12">
              <ReviewSection
                filmId={film.id}
                currentUser={user}
              />
            </section>
          </div>

          {/* SIDEBAR (30%) */}
          <div className="space-y-0 divide-y divide-border h-full">
            <div className="p-8">
              {film.film_companies?.length > 0 ? (
                <div className="bg-surface rounded-xl p-6 border border-border flex items-center gap-4 group transition-all cursor-default">
                  <div className="w-12 h-12 bg-surface-2 rounded-lg overflow-hidden flex items-center justify-center text-brand font-bold text-xl shrink-0 border border-border/50">
                    {film.film_companies[0].companies?.logo_url ? (
                      <img src={film.film_companies[0].companies.logo_url} className="w-full h-full object-contain p-1" />
                    ) : (
                      film.film_companies[0].companies?.name?.charAt(0) || '?'
                    )}
                  </div>
                  <div>
                    <div className="text-[9px] text-text-muted font-bold tracking-wider mb-0.5">Studio</div>
                    <div className="font-bold text-text-primary text-sm line-clamp-1 tracking-tight">{film.film_companies[0].companies?.name}</div>
                  </div>
                </div>
              ) : (
                <div className="bg-surface rounded-xl p-6 border border-border flex items-center gap-4">
                  <div className="w-12 h-12 bg-surface-2 rounded-lg flex items-center justify-center text-brand font-bold text-xl shrink-0">
                    {film.director?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div className="text-[9px] text-text-muted font-bold tracking-wider mb-0.5">Director</div>
                    <div className="font-bold text-text-primary text-sm tracking-tight">{film.director || 'Not Specified'}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-8 bg-surface-2/5">
              <h3 className="font-heading font-bold text-sm text-text-primary mb-6 tracking-wider">About</h3>
              <div className="space-y-4 text-[11px] font-bold">
                <div className="flex justify-between items-center border-b border-border pb-3">
                  <span className="text-text-muted tracking-wider">Status</span>
                  <span className="text-text-primary">{film.status}</span>
                </div>
                {film.countries && film.countries.length > 0 && (
                  <div className="flex justify-between items-center border-b border-border pb-3">
                    <span className="text-text-muted tracking-wider">Country</span>
                    <span className="text-text-primary text-right">{film.countries.join(', ')}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-b border-border pb-3">
                  <span className="text-text-muted tracking-wider">Language</span>
                  <span className="text-text-primary">{film.language}</span>
                </div>
                <div className="flex justify-between items-center border-b border-border pb-3">
                  <span className="text-text-muted tracking-wider">{film.content_type === 'series' ? 'Seasons' : 'Runtime'}</span>
                  <span className="text-text-primary">
                    {film.content_type === 'series'
                      ? (film.season_count ? `${film.season_count} Season${film.season_count > 1 ? 's' : ''}` : 'TV Series')
                      : `${film.runtime_minutes || film.runtime} min`}
                  </span>
                </div>
                {film.content_type === 'series' && film.episode_count && (
                  <div className="flex justify-between items-center border-b border-border pb-3">
                    <span className="text-text-muted tracking-wider">Episodes</span>
                    <span className="text-text-primary">{film.episode_count} Episodes</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-text-muted tracking-wider">Rating</span>
                  <span className="bg-surface-2 text-text-primary px-2 py-0.5 rounded text-[10px] border border-border font-bold">
                    {film.nfvcb_rating}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-3">
              <WatchOptions film={film} isFullWidth />
              <button
                onClick={handleWatchlist}
                disabled={watchlistLoading}
                className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-lg font-bold text-[10px] tracking-widest transition-all duration-300 active:scale-95 min-h-[44px] disabled:opacity-50 ${inWatchlist
                  ? 'bg-brand text-white'
                  : 'bg-surface-2 border border-border text-text-primary hover:border-brand hover:text-brand'
                  }`}
              >
                {inWatchlist ? 'Added' : 'Add to Watchlist'}
              </button>
              <ShareAction
                title={film.title}
                text={`Check out ${film.title} on MuviDB`}
              />
            </div>

            {/* WHERE TO WATCH — explicit per-platform list (answers the #1 query) */}
            {PLATFORMS.some((p) => isFilmOnPlatform(film, p.id)) && (
              <div className="p-8 border-t border-border">
                <h3 className="font-heading font-bold text-sm text-text-primary mb-6 tracking-wider flex items-center gap-2">
                  <Icon icon="solar:tv-bold" className="text-brand" />
                  Where to Watch
                </h3>
                <div className="flex flex-col gap-2">
                  {PLATFORMS.filter((p) => isFilmOnPlatform(film, p.id)).map((p) => {
                    const url = getWatchUrl(film, p.id);
                    const inner = (
                      <>
                        <span className="flex items-center gap-3">
                          <span
                            className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/10 shrink-0"
                            style={{ background: `${p.color}22`, color: p.color }}
                          >
                            <Icon icon={p.icon} className="text-base" />
                          </span>
                          <span className="text-[11px] font-black uppercase tracking-widest text-text-primary">{p.name}</span>
                        </span>
                        <Icon icon={url ? 'solar:arrow-right-up-linear' : 'solar:alt-arrow-right-linear'} className="text-text-muted group-hover:text-brand transition-colors" />
                      </>
                    );
                    const className = 'group flex items-center justify-between px-4 py-3 rounded-lg bg-surface-2/40 border border-border hover:border-brand/50 transition-all';
                    return url ? (
                      <a key={p.id} href={url} target="_blank" rel="noopener noreferrer" className={className}>{inner}</a>
                    ) : (
                      <Link key={p.id} to={`/watch/${p.id}`} className={className}>{inner}</Link>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="p-8">
              <h3 className="font-heading font-bold text-sm text-text-primary mb-6 tracking-wider">More Like This</h3>
              <div className="flex flex-col gap-0 border border-border rounded-lg overflow-hidden shadow-sm">
                {relatedFilms.map(relatedFilm => (
                  <Link
                    key={relatedFilm.id}
                    to={`/films/${relatedFilm.slug || relatedFilm.id}`}
                    className="flex gap-4 bg-surface hover:bg-surface-2 p-4 border-b border-border last:border-b-0 group transition-all"
                  >
                    <ImageWithFallback
                      src={relatedFilm.poster_url || relatedFilm.poster} 
                      alt={relatedFilm.title}
                      className="w-12 h-16 object-cover rounded-md border border-border"
                      fallbackType="banner"
                      name={relatedFilm.title}
                    />
                    <div className="flex flex-col justify-center">
                      <h4 className="font-bold text-text-primary text-xs group-hover:text-brand transition-colors line-clamp-1 mb-1 tracking-tight">
                        {relatedFilm.title}
                      </h4>
                      <div className="text-[10px] font-bold text-text-muted mb-2">
                        {relatedFilm.year} • {relatedFilm.genres && relatedFilm.genres.length > 0 ? relatedFilm.genres[0] : 'Media'}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}