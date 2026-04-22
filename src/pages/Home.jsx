import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getPersonYoutubeChannelUrl } from '../lib/youtube';
import HeroSection from '../components/film/HeroSection';
import FilmRow from '../components/film/FilmRow';
import PersonCard from '../components/person/PersonCard';

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [films, setFilms] = useState([]);
  const [inCinemas, setInCinemas] = useState([]);
  const [youtubeFeed, setYoutubeFeed] = useState([]);
  const [youtubeFilter, setYoutubeFilter] = useState('All');
  const [spotlightPerson, setSpotlightPerson] = useState(null);
  const [otherPeople, setOtherPeople] = useState([]);
  const [creators, setCreators] = useState([]);

  useEffect(() => {
    document.title = "Lumi | Home";
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchFilms(),
        fetchInCinemasData(),
        fetchYoutubeFeed(),
        fetchPeople(),
        fetchCreators()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFilms = async () => {
    const { data, error } = await supabase
      .from('films')
      .select(`
        id, title, poster_url, backdrop_url, year, language, 
        runtime_minutes, view_count, average_rating, nfvcb_rating, 
        is_featured, is_trending, release_type,
        film_genres(genres(name))
      `)
      .order('view_count', { ascending: false });

    if (!error) {
      const transformed = (data || []).map(f => ({
        ...f,
        genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
      }));
      setFilms(transformed);
    }
  };

  const fetchInCinemasData = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    // First try: Today only
    const { data, error } = await supabase
      .from('showtimes')
      .select(`
        film_id, 
        show_date,
        films(*, film_genres(genres(name)))
      `)
      .gte('show_date', today)
      .eq('is_available', true)
      .order('show_date', { ascending: true })
      .limit(20);

    if (!error && data) {
      const filmMap = {};
      data.forEach(s => {
        if (s.films) {
          filmMap[s.films.id] = {
            ...s.films,
            genres: s.films.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || [],
            is_today: s.show_date === today
          };
        }
      });
      setInCinemas(Object.values(filmMap));
    }
  };

  const fetchYoutubeFeed = async () => {
    // Fetch films added in the last 24 hours OR just the latest 20 for reliability
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    
    const { data, error } = await supabase
      .from('films')
      .select(`
        *,
        film_genres(genres(name))
      `)
      .eq('source', 'youtube')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error) {
      setYoutubeFeed((data || []).map(f => ({
        ...f,
        genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
      })));
    }
  };

  const fetchPeople = async () => {
    const { data } = await supabase
      .from('people')
      .select('*')
      .eq('is_spotlight', true)
      .order('popularity_score', { ascending: false })
      .limit(4);
    
    if (data && data.length > 0) {
      setSpotlightPerson(data[0]);
      setOtherPeople(data.slice(1));
    }
  };

  const fetchCreators = async () => {
    const { data } = await supabase
      .from('people')
      .select('*')
      .not('youtube_handle', 'is', null)
      .order('popularity_score', { ascending: false })
      .limit(6);
    if (data) setCreators(data);
  };

  const filteredYoutube = youtubeFeed.filter(film => {
    if (youtubeFilter === 'All') return true;
    const runtime = film.runtime_minutes || 0;
    if (youtubeFilter === 'Skits') return runtime > 0 && runtime < 15;
    if (youtubeFilter === 'Movies') return runtime >= 15;
    return true;
  });

  const featuredFilms = films.filter(f => f.is_featured);
  const trendingFilms = films.filter(f => f.is_trending || f.view_count > 500);
  // Show 2026/2025 movies for New Releases
  const newReleases = films.filter(f => f.year === 2026 || f.year === 2025).sort((a, b) => b.year - a.year);

  return (
    <div className="w-full pb-20 bg-bg">
      <HeroSection 
        featuredFilms={featuredFilms.length > 0 ? featuredFilms : films.slice(0, 5)} 
      />

      <div className="mt-8 space-y-12">
        {/* In Cinemas Section */}
        {inCinemas.length > 0 ? (
          <FilmRow
            title={inCinemas.some(f => f.is_today) ? "Showing in Cinemas Today" : "Coming Soon to Cinemas"}
            subtitle={inCinemas.some(f => f.is_today) ? "Catch these productions on the big screen near you" : "Upcoming screenings scheduled for this week"}
            films={inCinemas}
            isLoading={isLoading}
          />
        ) : (
          /* Fallback if no showtimes found, to ensure the section isn't "missed" */
          <FilmRow
            title="Showing in Cinemas"
            subtitle="Catch the latest Nollywood productions on the big screen"
            films={films.slice(0, 4)} // Show some top films as placeholders
            isLoading={isLoading}
          />
        )}

        {/* New Releases (2026/2025) */}
        {newReleases.length > 0 && (
          <FilmRow
            title="New Releases"
            subtitle="The latest additions to the Nollywood archive (2026)"
            films={newReleases}
            isLoading={isLoading}
          />
        )}

        {/* Trending This Week */}
        <FilmRow
          title="Trending This Week"
          subtitle="Top productions across Netflix, Prime Video & Kava"
          films={trendingFilms}
          isLoading={isLoading}
        />

        {/* New on YouTube with Filters (Today Only Focus) */}
        <section className="py-12 bg-surface-2/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
              <div>
                <h2 className="font-heading font-bold text-2xl md:text-3xl text-text-primary">
                  New on YouTube
                </h2>
                <p className="text-text-muted text-sm mt-1">Nollywood Daily: The latest imports from the last 24 hours</p>
              </div>
              <div className="flex bg-surface p-1 rounded-xl border border-border shadow-sm">
                {['All', 'Movies', 'Skits'].map(filter => (
                  <button
                    key={filter}
                    onClick={() => setYoutubeFilter(filter)}
                    className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${
                      youtubeFilter === filter 
                        ? 'bg-brand text-white shadow-md' 
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {filter.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <FilmRow
              title=""
              films={filteredYoutube}
              isLoading={isLoading}
              noHeader
            />
          </div>
        </section>

        {/* Filmmaker Spotlight */}
        {spotlightPerson && (
          <section className="py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <h2 className="font-heading font-bold text-2xl md:text-3xl text-text-primary italic">
                    Filmmaker Spotlight
                  </h2>
                  <p className="text-brand text-[10px] font-black uppercase tracking-[0.3em] mt-2 italic shadow-gold/20">The Visionaries behind the screens</p>
                </div>
                <Link
                  to="/people"
                  className="bg-surface border border-border text-text-primary font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-full hover:border-brand hover:text-brand transition-all duration-300 active:scale-95 flex items-center gap-2"
                >
                  DIRECTORY
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
              </div>

              <div className="relative bg-surface rounded-3xl p-8 md:p-12 overflow-hidden border border-border shadow-2xl">
                <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-brand/5 to-transparent pointer-events-none"></div>
                <div className="relative z-10 flex flex-col xl:flex-row gap-12 xl:items-center">
                  <div className="xl:flex-1">
                    <PersonCard person={spotlightPerson} variant="full" />
                  </div>
                  <div className="h-px xl:w-px xl:h-64 bg-border"></div>
                  <div className="xl:w-80 flex justify-around xl:grid xl:grid-cols-2 gap-4">
                    {otherPeople.map(person => (
                      <PersonCard key={person.id} person={person} variant="compact" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Creator Hub Section */}
        {creators.length > 0 && (
          <section className="py-20 bg-surface border-y border-border">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-12">
                <h2 className="font-heading font-bold text-3xl md:text-4xl text-text-primary tracking-tighter">
                  Nollywood Creator Hub
                </h2>
                <div className="h-1 w-20 bg-brand mx-auto mt-4 rounded-full" />
                <p className="text-text-muted mt-6 max-w-lg mx-auto leading-relaxed">
                  Direct from the official YouTube channels of Nigeria's most influential storytellers.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {creators.map(creator => {
                  const stats = creator.youtube_stats || {};
                  return (
                    <a 
                      key={creator.id}
                      href={getPersonYoutubeChannelUrl(creator) || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group bg-surface-2/50 border border-border rounded-3xl p-6 hover:border-brand/40 hover:bg-surface transition-all duration-500 shadow-sm hover:shadow-xl hover:-translate-y-1"
                    >
                      <div className="flex items-center gap-5">
                        <img 
                          src={stats.thumbnail || creator.photo_url} 
                          alt={creator.name} 
                          className="w-20 h-20 rounded-2xl object-cover shadow-lg border-2 border-surface group-hover:scale-105 transition-transform" 
                        />
                        <div>
                          <h3 className="text-lg font-black text-text-primary group-hover:text-brand transition-colors">
                            {creator.name}
                          </h3>
                          <div className="mt-2 flex items-center gap-4">
                            <span className="text-[10px] font-black text-brand uppercase tracking-widest">{parseInt(stats.subscribers || 0).toLocaleString()} SUBS</span>
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{parseInt(stats.videos || 0).toLocaleString()} 🎞️</span>
                          </div>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Closing Row */}
        <FilmRow
          title="Most Critically Acclaimed"
          subtitle="Top rated productions by the Lumi community"
          films={films}
          sortKey="rating"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
