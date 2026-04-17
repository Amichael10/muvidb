import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useWatchlist } from '../hooks/useWatchlist';
import ReviewSection from '../components/film/ReviewSection';
import PersonCard from '../components/person/PersonCard';
import FilmCard from '../components/film/FilmCard';

export default function FilmDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [film, setFilm] = useState(null);
  const [relatedFilms, setRelatedFilms] = useState([]);
  const [loading, setLoading] = useState(true);

  const {
    inWatchlist,
    loading: watchlistLoading,
    toggleWatchlist
  } = useWatchlist(id, user);

  const [cast, setCast] = useState([]);
  const [crew, setCrew] = useState([]);

  useEffect(() => {
    fetchFilm();
    fetchCredits();
  }, [id]);

  const fetchCredits = async () => {
    try {
      const { data, error } = await supabase
        .from('credits')
        .select(`
          id, role, character_name, billing_order,
          people(id, name, photo_url, popularity_score)
        `)
        .eq('film_id', id)
        .order('billing_order', { ascending: true });

      if (error) throw error;
      
      const castMembers = data
        .filter(c => c.role.toLowerCase() === 'actor' || c.role.toLowerCase() === 'cast')
        .map(c => ({
          ...c.people,
          role: c.character_name || 'Cast'
        }));
        
      const crewMembers = data
        .filter(c => c.role.toLowerCase() !== 'actor' && c.role.toLowerCase() !== 'cast')
        .map(c => ({
          ...c.people,
          role: c.role
        }));

      setCast(castMembers);
      setCrew(crewMembers);
    } catch (error) {
      console.error('Error fetching credits:', error);
    }
  };

  const fetchFilm = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('films')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setFilm(data);

      if (data) {
        document.title = `FilmDba | ${data.title}`;
        const { data: related } = await supabase
          .from('films')
          .select('*')
          .neq('id', id)
          .limit(3);
        setRelatedFilms(related || []);
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
        state: { from: `/films/${id}`, message: 'Sign in to add films to your watchlist' }
      });
      return;
    }
    await toggleWatchlist();
  };

  const handleShare = async () => {
    const shareData = {
      title: film.title,
      text: `Check out ${film.title} on Lumi`,
      url: window.location.href
    };
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard');
    }
  };

  if (loading) {
    return <div className="w-full min-h-screen flex items-center justify-center bg-bg text-text-primary">Loading...</div>;
  }

  if (!film) {
    return <div className="w-full min-h-screen flex items-center justify-center bg-bg text-text-primary">Film not found</div>;
  }

  // Format views
  const formatViews = (views) => {
    if (!views) return '0';
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
    if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
    return views;
  };

  // Mock cast data based on the string array in film.cast
  const castMocks = (film.cast || []).map((name, i) => ({
    id: `cast-${i}`,
    name,
    role: i === 0 ? "Lead Character" : "Supporting Character",
    photo: `https://placehold.co/300x300/13192B/D4A017?text=${name.split(' ').map(n => n[0]).join('')}`,
    film_count: Math.floor(Math.random() * 15) + 2
  }));

  // Mock crew data
  const crewMocks = film.director ? [
    { name: film.director, role: "Director", photo: `https://placehold.co/150x150/13192B/C1440E?text=${film.director.split(' ').map(n => n[0]).join('')}` }
  ] : [];

  return (
    <div className="w-full bg-bg min-h-screen pb-20">
      {/* 1. CINEMATIC HEADER */}
      <div className="relative w-full h-[60vh] min-h-[500px]">
        <img
          src={film.backdrop_url || film.backdrop} 
          alt={`${film.title} Backdrop`} 
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Heavy dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0F1E] via-[#0A0F1E]/80 to-transparent"></div>

        <div className="absolute bottom-0 left-0 w-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-end gap-8 pb-8">

            {/* Film Poster (Overlapping) */}
            <div className="hidden md:block w-64 shrink-0 translate-y-24 z-10">
              <img
                src={film.poster_url || film.poster} 
                alt={`${film.title} Poster`} 
                className="w-full rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] border-4 border-bg object-cover aspect-[2/3]"
              />
            </div>

            {/* Metadata */}
            <div className="flex-1 z-10 w-full">
              <h1 className="font-heading font-bold text-4xl md:text-6xl text-text-primary mb-4 leading-tight">
                {film.title}
              </h1>

              <div className="flex flex-wrap items-center gap-3 md:gap-4 text-sm text-text-muted font-medium mb-4">
                <span>{film.year}</span>
                <span className="w-1 h-1 rounded-full bg-border"></span>
                <span>{film.runtime_minutes || film.runtime} min</span>
                <span className="w-1 h-1 rounded-full bg-border"></span>
                <span>{film.language}</span>
                <span className="w-1 h-1 rounded-full bg-border"></span>
                <span className="bg-surface-2 text-text-primary px-2 py-0.5 rounded text-xs font-bold border border-border">
                  {film.nfvcb_rating}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                {(film.genres || []).map(genre => (
                  <span key={genre} className="px-3 py-1 text-xs font-medium bg-surface-2/60 backdrop-blur-md text-text-primary rounded-full border border-border">
                    {genre}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap items-end gap-6">
                <div className="flex items-center gap-3">
                  <span className="text-gold text-4xl md:text-5xl font-bold leading-none">{film.tmdb_rating || film.rating}</span>
                  <div className="flex flex-col justify-end pb-1">
                    <span className="text-text-muted text-sm font-medium">/ 10</span>
                    <div className="flex items-center gap-1 mt-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <svg key={star} xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill={star <= Math.round((film.tmdb_rating || film.rating) / 2) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className="text-gold">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      ))}
                      <span className="text-text-muted text-xs ml-1">(1,204 ratings)</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-text-muted pb-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z" />
                    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="var(--color-bg)" />
                  </svg>
                  <span className="font-medium">{formatViews(film.view_count)} views</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. CONTENT SECTION */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 md:pt-32">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

          {/* MAIN CONTENT (70%) */}
          <div className="lg:col-span-2 space-y-12">

            {/* Synopsis */}
            <section>
              <h2 className="font-heading font-bold text-2xl text-text-primary mb-4">Synopsis</h2>
              <p className="text-text-muted text-lg leading-relaxed">
                {film.synopsis}
              </p>
            </section>

            {/* Trailer */}
            <section id="trailer-section">
              <h2 className="font-heading font-bold text-2xl text-text-primary mb-4">Official Trailer</h2>
              <div className="aspect-video rounded-2xl overflow-hidden border border-border bg-surface-2 shadow-2xl">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${film.trailer_youtube_id || 'dQw4w9WgXcQ'}?autoplay=0&rel=0&modestbranding=1`}
                  title={`${film.title} Trailer`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            </section>

            {/* Cast */}
            {cast.length > 0 && (
              <section>
                <h2 className="font-heading font-bold text-2xl text-text-primary mb-4">Cast</h2>
                <div className="flex overflow-x-auto gap-6 pb-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                  {cast.map(person => (
                    <div key={person.id} className="shrink-0 w-28">
                      <PersonCard person={person} variant="compact" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Crew */}
            {crew.length > 0 && (
              <section>
                <h2 className="font-heading font-bold text-2xl text-text-primary mb-4">Crew</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  {crew.map((member, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-surface p-3 rounded-xl border border-border">
                      <img src={member.photo_url || `https://placehold.co/150x150/13192B/C1440E?text=${member.name.split(' ').map(n => n[0]).join('')}`} alt={member.name} className="w-12 h-12 rounded-full object-cover" />
                      <div>
                        <div className="font-bold text-text-primary text-sm line-clamp-1">{member.name}</div>
                        <div className="text-text-muted text-xs capitalize">{member.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Reviews — replaced with real ReviewSection */}
            <section>
              <ReviewSection
                filmId={film.id}
                currentUser={user}
              />
            </section>

          </div>

          {/* SIDEBAR (30%) */}
          <div className="space-y-8">

            {/* Production Company */}
            <div className="bg-surface rounded-2xl p-6 border border-border flex items-center gap-4">
              <div className="w-12 h-12 bg-surface-2 rounded-full flex items-center justify-center text-gold font-bold text-xl shrink-0">
                K
              </div>
              <div>
                <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Production Company</div>
                <div className="font-bold text-text-primary">Kemi Adetiba Visuals</div>
              </div>
            </div>

            {/* Film Details List */}
            <div className="bg-surface rounded-2xl p-6 border border-border">
              <h3 className="font-heading font-bold text-lg text-text-primary mb-4">Details</h3>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between items-center border-b border-border pb-3">
                  <span className="text-text-muted">Status</span>
                  <span className="font-medium text-text-primary capitalize">{film.status}</span>
                </div>
                <div className="flex justify-between items-center border-b border-border pb-3">
                  <span className="text-text-muted">Language</span>
                  <span className="font-medium text-text-primary">{film.language}</span>
                </div>
                <div className="flex justify-between items-center border-b border-border pb-3">
                  <span className="text-text-muted">Runtime</span>
                  <span className="font-medium text-text-primary">{film.runtime_minutes || film.runtime} min</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">NFVCB Rating</span>
                  <span className="font-medium bg-surface-2 text-text-primary px-2 py-0.5 rounded text-xs border border-border">
                    {film.nfvcb_rating}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {film.release_type && film.release_type !== 'cinema' && film.youtube_watch_url ? (
                <a
                  href={film.youtube_watch_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-bold transition-all duration-300 active:scale-95 min-h-[44px] text-white hover:scale-[1.02] ${
                    film.release_type === 'youtube' ? 'bg-[#FF0000] hover:shadow-[0_0_15px_rgba(255,0,0,0.4)]' :
                    film.release_type === 'netflix' ? 'bg-[#E50914] hover:shadow-[0_0_15px_rgba(229,9,20,0.4)]' :
                    film.release_type === 'prime_video' ? 'bg-[#00A8E1] hover:shadow-[0_0_15px_rgba(0,168,225,0.4)]' :
                    film.release_type === 'showmax' ? 'bg-[#E10098] hover:shadow-[0_0_15px_rgba(225,0,152,0.4)]' :
                    'bg-gold text-dark hover:shadow-[0_0_15px_rgba(212,160,23,0.4)]'
                  }`}
                >
                  {film.release_type === 'youtube' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="currentColor" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                  )}
                  Watch on {film.release_type.replace('_', ' ')}
                </a>
              ) : (
                <button
                  onClick={handleWatchlist}
                  disabled={watchlistLoading}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-bold transition-all duration-300 active:scale-95 min-h-[44px] disabled:opacity-50 ${inWatchlist
                    ? 'bg-surface-2 border border-gold text-gold'
                    : 'bg-gold text-bg hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(212,160,23,0.4)]'
                    }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  {inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
                </button>
              )}
              <button
                onClick={handleShare}
                className="w-full flex items-center justify-center gap-2 border border-border text-text-primary hover:border-gold hover:text-gold px-6 py-3.5 rounded-full font-bold transition-all duration-300 active:scale-95 min-h-[44px]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                Share
              </button>
            </div>

            {/* Related Films */}
            <div>
              <h3 className="font-heading font-bold text-lg text-text-primary mb-4">Related Films</h3>
              <div className="flex flex-col gap-4">
                {relatedFilms.map(relatedFilm => (
                  <Link
                    key={relatedFilm.id}
                    to={`/film/${relatedFilm.id}`}
                    className="flex gap-4 bg-surface hover:bg-surface-2 p-3 rounded-xl border border-border hover:border-gold/50 transition-all group"
                  >
                    <img
                      src={relatedFilm.poster_url || relatedFilm.poster} 
                      alt={relatedFilm.title}
                      className="w-16 h-24 object-cover rounded-lg"
                    />
                    <div className="flex flex-col justify-center">
                      <h4 className="font-bold text-text-primary text-sm group-hover:text-gold transition-colors line-clamp-2 mb-1">
                        {relatedFilm.title}
                      </h4>
                      <div className="text-xs text-text-muted mb-2">
                        {relatedFilm.year} {relatedFilm.genres && relatedFilm.genres.length > 0 ? `• ${relatedFilm.genres[0]}` : ''}
                      </div>
                      <div className="flex items-center gap-1 text-gold text-xs font-bold">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        {relatedFilm.tmdb_rating || relatedFilm.rating}
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