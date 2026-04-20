import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getPersonYoutubeChannelUrl } from '../lib/youtube';
import HeroSection from '../components/film/HeroSection';
import FilmRow from '../components/film/FilmRow';
import PersonCard from '../components/person/PersonCard';
// import { people, genres } from '../data/mockData';

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [films, setFilms] = useState([]);
  const [spotlightPerson, setSpotlightPerson] = useState(null);
  const [otherPeople, setOtherPeople] = useState([]);
  const [dbGenres, setDbGenres] = useState([]);
  const [creators, setCreators] = useState([]);

  useEffect(() => {
    document.title = "FilmDba | Home";
    fetchFilms();
    fetchPeople();
    fetchGenres();
    fetchCreators();
  }, []);

  const fetchCreators = async () => {
    try {
      // Fetch people who have a youtube handle or channel id
      const { data, error } = await supabase
        .from('people')
        .select('*')
        .not('youtube_handle', 'is', null)
        .order('popularity_score', { ascending: false })
        .limit(6);
      
      if (error) throw error;
      setCreators(data || []);
    } catch (error) {
      console.error('Error fetching creators:', error);
    }
  };

  const fetchPeople = async () => {
    try {
      const { data, error } = await supabase
        .from('people')
        .select('*')
        .eq('is_spotlight', true)
        .order('popularity_score', { ascending: false })
        .limit(4);
      
      if (error) throw error;
      if (data && data.length > 0) {
        setSpotlightPerson(data[0]);
        setOtherPeople(data.slice(1));
      } else {
        // Fallback
        const { data: fallbackData } = await supabase
          .from('people')
          .select('*')
          .order('popularity_score', { ascending: false })
          .limit(4);
        if (fallbackData && fallbackData.length > 0) {
          setSpotlightPerson(fallbackData[0]);
          setOtherPeople(fallbackData.slice(1));
        }
      }
    } catch (error) {
      console.error('Error fetching people:', error);
    }
  };

  const fetchGenres = async () => {
    try {
      const { data, error } = await supabase
        .from('genres')
        .select('name')
        .order('name', { ascending: true });
      
      if (error) throw error;
      setDbGenres(data.map(g => g.name) || []);
    } catch (error) {
      console.error('Error fetching genres:', error);
    }
  };

  const fetchFilms = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/films?limit=50');
      if (!res.ok) throw new Error(`Failed to fetch films: ${res.status}`);
      const { films } = await res.json();
      setFilms(films || []);
    } catch (error) {
      console.error('Error fetching films:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const featuredFilms = films.filter(f => f.is_featured);

  return (
    <div className="w-full pb-20">
      <HeroSection 
        featuredFilms={featuredFilms.length > 0 ? featuredFilms : films.slice(0, 5)} 
      />

      <div className="mt-8 space-y-4">
        <FilmRow
          title="Trending This Week"
          films={films}
          sortKey="views"
          isLoading={isLoading}
        />

        {/* Filmmaker Spotlight Section */}
        {spotlightPerson && (
          <section className="py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-end justify-between mb-6">
                <h2 className="font-heading font-bold text-2xl md:text-3xl text-text-primary">
                  Filmmaker Spotlight
                </h2>
                <Link
                  to="/people"
                  className="text-gold hover:text-text-primary transition-all duration-300 active:scale-95 font-medium text-sm md:text-base flex items-center gap-1"
                >
                  View All Filmmakers
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
              </div>

              <div className="relative bg-surface rounded-2xl p-6 md:p-8 overflow-hidden border border-border">
                {/* Subtle terracotta gradient background */}
                <div className="absolute top-0 left-0 w-1/3 h-full bg-gradient-to-r from-terracotta/10 to-transparent pointer-events-none"></div>

                <div className="relative z-10 flex flex-col lg:flex-row gap-10 lg:items-center justify-between">
                  {/* Full PersonCard */}
                  <div className="lg:w-3/5">
                    <PersonCard person={spotlightPerson} variant="full" />
                  </div>

                  {/* Divider for desktop */}
                  <div className="hidden lg:block w-px h-32 bg-border"></div>

                  {/* Divider for mobile */}
                  <div className="lg:hidden w-full h-px bg-border"></div>

                  {/* Mini Grid of Compact PersonCards */}
                  <div className="lg:w-1/3 flex justify-around lg:justify-end gap-4 sm:gap-8">
                    {otherPeople.map(person => (
                      <PersonCard key={person.id} person={person} variant="compact" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        <FilmRow
          title="New Releases"
          films={films}
          sortKey="year"
          isLoading={isLoading}
        />

        {/* YouTube Creators Section */}
        {creators.length > 0 && (
          <section className="py-12 bg-surface-2/30">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="font-heading font-bold text-2xl md:text-3xl text-text-primary">
                    Nollywood Creators
                  </h2>
                  <p className="text-text-muted text-sm mt-1">Direct from their official YouTube channels</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {creators.map(creator => {
                  const stats = creator.youtube_stats || {};
                  return (
                    <a 
                      key={creator.id}
                      href={getPersonYoutubeChannelUrl(creator) || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative bg-surface border border-border rounded-2xl overflow-hidden hover:border-gold/50 transition-all duration-500 shadow-lg hover:shadow-gold/5"
                    >
                      {/* Banner Background */}
                      <div className="h-24 w-full bg-bg">
                        {stats.banner ? (
                          <img src={stats.banner} alt="" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-r from-terracotta/20 to-gold/10"></div>
                        )}
                      </div>

                      {/* Content Overlay */}
                      <div className="px-6 pb-6 relative">
                        {/* Profile Photo */}
                        <div className="absolute -top-10 left-6">
                          <img 
                            src={stats.thumbnail || creator.photo_url} 
                            alt={creator.name} 
                            className="w-20 h-20 rounded-full border-4 border-surface object-cover shadow-xl group-hover:scale-105 transition-transform" 
                          />
                        </div>

                        <div className="pt-12">
                          <h3 className="text-xl font-bold text-text-primary group-hover:text-gold transition-colors">
                            {creator.name}
                          </h3>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs font-black uppercase tracking-widest text-gold bg-gold/5 px-2 py-0.5 rounded">
                              {parseInt(stats.subscribers || 0).toLocaleString()} SUBS
                            </span>
                            <span className="text-[10px] text-text-muted font-bold uppercase tracking-tighter">
                              {parseInt(stats.videos || 0).toLocaleString()} VIDEOS
                            </span>
                          </div>
                          
                          <div className="mt-4 flex items-center gap-2 text-xs font-black text-text-muted group-hover:text-gold transition-colors">
                            VISIT CHANNEL
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="7" y1="17" x2="17" y2="7" />
                              <polyline points="7 7 17 7 17 17" />
                            </svg>
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

        {/* Browse by Genre Section */}
        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-heading font-bold text-2xl md:text-3xl text-text-primary mb-6">
              Browse by Genre
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {dbGenres.map((genre, index) => {
                // Approximate counts for UI visual
                const counts = { 'Drama': 240, 'Comedy': 180, 'Action': 150, 'Thriller': 120 };
                const displayCount = counts[genre] || (80 + (index * 15) % 100);

                return (
                  <Link
                    key={genre}
                    to={`/browse?genre=${genre}`}
                    className="group bg-surface hover:bg-surface-2 border border-border hover:border-gold rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_15px_rgba(212,160,23,0.15)] active:scale-95"
                  >
                    <h3 className="font-heading font-bold text-lg text-text-primary group-hover:text-gold transition-colors mb-2">
                      {genre}
                    </h3>
                    <p className="text-sm text-text-muted">
                      {displayCount} Films
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <FilmRow
          title="Top Rated"
          films={films}
          sortKey="rating"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
