import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getPersonYoutubeChannelUrl } from '../lib/youtube';
import HeroSection from '../components/film/HeroSection';
import FilmRow from '../components/film/FilmRow';
import GenreRail from '../components/film/GenreRail';
import PersonCard from '../components/person/PersonCard';
import { Icon } from '@iconify/react';

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [films, setFilms] = useState([]);
  const [inCinemas, setInCinemas] = useState([]);
  const [youtubeFeed, setYoutubeFeed] = useState([]);
  const [youtubeFilter, setYoutubeFilter] = useState('All');
  const [spotlightPerson, setSpotlightPerson] = useState(null);
  const [otherPeople, setOtherPeople] = useState([]);
  const [creators, setCreators] = useState([]);
  const [newReleases, setNewReleases] = useState([]);

  const [featuredFilms, setFeaturedFilms] = useState([]);
  const [comingSoon, setComingSoon] = useState([]);
  const [curatedCollection, setCuratedCollection] = useState(null);
  const [recentlyAdded, setRecentlyAdded] = useState([]);

  useEffect(() => {
    document.title = "Lumi | Home";
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchFeaturedFilms(),
        fetchFilms(),
        fetchNewReleases(),
        fetchComingSoon(),
        fetchInCinemasData(),
        fetchYoutubeFeed(),
        fetchPeople(),
        fetchCreators(),
        fetchCuratedCollection()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFeaturedFilms = async () => {
    const { data } = await supabase
      .from('films')
      .select(`
        *,
        film_genres(genres(name))
      `)
      .eq('is_featured', true)
      .order('view_count', { ascending: false });
    
    if (data) {
      setFeaturedFilms(data.map(f => ({
        ...f,
        genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
      })));
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
      // Deduplicate regular films list
      const filmMap = new Map();
      (data || []).forEach(f => {
        const titleKey = f.title?.toLowerCase().trim();
        if (!titleKey) return;
        if (!filmMap.has(titleKey)) {
          filmMap.set(titleKey, {
            ...f,
            genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
          });
        }
      });
      setFilms(Array.from(filmMap.values()));
    }
  };

  const fetchNewReleases = async () => {
    // Fetch latest 2026 releases specifically from recent fetches (Cinema & YouTube)
    const { data, error } = await supabase
      .from('films')
      .select(`
        id, title, poster_url, backdrop_url, year, language, 
        runtime_minutes, view_count, average_rating, nfvcb_rating, 
        is_featured, is_trending, release_type, created_at, release_date,
        film_genres(genres(name))
      `)
      .eq('year', 2026)
      .order('release_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setNewReleases(data.map(f => ({
        ...f,
        genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
      })));
    }
  };

  const fetchInCinemasData = async () => {
    // 1. Fetch by is_in_cinemas flag first
    const { data: flagged } = await supabase
      .from('films')
      .select(`*, film_genres(genres(name))`)
      .eq('is_in_cinemas', true)
      .order('release_date', { ascending: false })
      .limit(20);

    if (flagged && flagged.length > 0) {
      setInCinemas(flagged.map(f => ({
        ...f,
        genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
      })));
      return;
    }

    // 2. Fallback to showtimes if no flags set
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
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

    if (data) {
      const filmMap = {};
      data.forEach(s => {
        if (s.films) {
          filmMap[s.films.id] = {
            ...s.films,
            genres: s.films.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
          };
        }
      });
      setInCinemas(Object.values(filmMap));
    }
  };

  const fetchComingSoon = async () => {
    const { data } = await supabase
      .from('films')
      .select(`*, film_genres(genres(name))`)
      .eq('coming_soon', true)
      .order('release_date', { ascending: true })
      .limit(20);
    
    if (data) {
      setComingSoon(data.map(f => ({
        ...f,
        genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
      })));
    }
  };

  const fetchCuratedCollection = async () => {
    const { data: collection } = await supabase
      .from('collections')
      .select(`
        *,
        collection_films(
          display_order,
          films(*, film_genres(genres(name)))
        )
      `)
      .eq('is_featured', true)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (collection) {
      const films = (collection.collection_films || [])
        .sort((a, b) => a.display_order - b.display_order)
        .map(cf => ({
          ...cf.films,
          genres: cf.films?.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
        }))
        .filter(f => f.id);
      
      setCuratedCollection({ ...collection, films });
    }
  };

  const fetchYoutubeFeed = async () => {
    const { data } = await supabase
      .from('films')
      .select(`
        *,
        film_genres(genres(name))
      `)
      .order('created_at', { ascending: false })
      .limit(30);

    if (data) {
      const mapped = data.map(f => ({
        ...f,
        genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
      }));
      setYoutubeFeed(mapped);
      setRecentlyAdded(mapped.slice(0, 20));
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
      .eq('is_spotlight', true)
      .or('youtube_handle.neq.null,youtube_handle.neq."",youtube_channel_id.neq.null,youtube_channel_id.neq.""')
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

  const formatViews = (count) => {
    if (!count) return '0';
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  };

  return (
    <div className="w-full pb-20 bg-bg min-h-screen">
      {/* 1. HERO */}
      <HeroSection 
        featuredFilms={featuredFilms} 
        isLoading={isLoading}
      />

      <div className="max-w-7xl mx-auto border-x border-border">
        {/* 2. IN CINEMAS NOW */}
        {(isLoading || inCinemas.length > 0) && (
          <div className="border-b border-border py-12">
            <FilmRow
              title="In Cinemas Now"
              subtitle="Catch the latest Nollywood magic on the big screen"
              films={inCinemas}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* 3. GENRE MOOD RAIL */}
        <div className="border-b border-border">
          <GenreRail />
        </div>

        {/* 4. NEW RELEASES */}
        {(isLoading || newReleases.length > 0) && (
          <div className="border-b border-border py-12">
            <FilmRow
              title="New Releases"
              subtitle="The freshest stories from this quarter"
              films={newReleases}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* 5. RECENTLY ADDED */}
        <div className="border-b border-border py-12 bg-surface-2/5">
          <FilmRow
            title="Recently Added"
            subtitle="Latest additions to the Lumi library"
            films={recentlyAdded}
            isLoading={isLoading}
          />
        </div>

        {/* 6. CURATED PICK (Editorial Row) */}
        {curatedCollection && curatedCollection.films.length > 0 && (
          <div className="border-b border-border py-16 bg-brand/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand/10 blur-[100px] rounded-full -mr-32 -mt-32"></div>
            <FilmRow
              title={curatedCollection.name}
              subtitle={curatedCollection.description}
              films={curatedCollection.films}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* 7. FEATURED CHANNELS */}
        {(isLoading || creators.length > 0) && (
          <div className="border-b border-border bg-surface-2/10 relative overflow-hidden">
             <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none"></div>
            <section className="py-16 relative z-10">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-end justify-between mb-12">
                  <div className="space-y-1">
                    <h2 className="font-heading font-bold text-2xl md:text-3xl text-text-primary tracking-tighter">
                      Featured Channels
                    </h2>
                    <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mt-1 opacity-60">The storytellers of YouTube</p>
                  </div>
                  <Link to="/channels" className="text-brand text-[10px] font-bold uppercase tracking-widest hover:underline">View all</Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border-t border-l border-border rounded-xl overflow-hidden shadow-sm">
                  {isLoading ? (
                    [...Array(6)].map((_, i) => (
                      <div key={i} className="bg-surface p-8 border-r border-b border-border flex items-center gap-5">
                        <div className="w-16 h-16 rounded-lg bg-surface-2 animate-shimmer shrink-0"></div>
                        <div className="flex-1 space-y-3">
                          <div className="w-2/3 h-5 bg-surface-2 animate-shimmer rounded"></div>
                          <div className="w-1/2 h-3 bg-surface-2 animate-shimmer rounded opacity-60"></div>
                        </div>
                      </div>
                    ))
                  ) : (
                    creators.map((creator) => {
                      const stats = creator.youtube_stats || {};
                      return (
                        <a 
                          key={creator.id}
                          href={getPersonYoutubeChannelUrl(creator) || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group bg-surface p-8 hover:bg-surface-2/50 transition-all duration-500 flex flex-col gap-6 border-r border-b border-border"
                        >
                          <div className="flex items-center gap-5">
                            <img 
                              src={stats.thumbnail || creator.photo_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} 
                              alt={creator.name} 
                              className="w-16 h-16 rounded-lg object-cover shadow-sm border border-border group-hover:scale-105 transition-transform" 
                              onError={(e) => { e.target.src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'; }}
                            />
                            <div>
                              <h3 className="text-lg font-black text-text-primary group-hover:text-brand transition-colors tracking-tight">
                                {creator.name}
                              </h3>
                              <div className="mt-2 flex items-center gap-4">
                                {(parseInt(stats.subscribers) > 0) && (
                                  <span className="text-[9px] font-bold text-brand">{parseInt(stats.subscribers).toLocaleString()} subs</span>
                                )}
                                {(parseInt(stats.videos) > 0) && (
                                  <span className="text-[9px] font-bold text-text-muted flex items-center gap-1.5">
                                    {parseInt(stats.videos).toLocaleString()} videos
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </a>
                      );
                    })
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* 8. SPOTLIGHT: PEOPLE */}
        {(isLoading || spotlightPerson) && (
          <div className="border-b border-border">
            <section className="py-16">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-end justify-between mb-10">
                  <div className="space-y-1">
                    <h2 className="font-heading font-bold text-2xl md:text-3xl text-text-primary tracking-tighter">
                      Spotlight: People
                    </h2>
                    <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mt-1 opacity-60">The talent behind the camera</p>
                  </div>
                  <Link
                    to="/people"
                    className="text-brand text-[10px] font-bold uppercase tracking-widest hover:underline"
                  >
                    View all
                  </Link>
                </div>

                <div className="relative bg-surface rounded-xl p-8 md:p-12 overflow-hidden border border-border shadow-sm">
                  <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none"></div>
                  <div className="relative z-10 flex flex-col xl:flex-row gap-12 xl:items-center">
                    <div className="xl:flex-1">
                      <PersonCard person={spotlightPerson} variant="full" isLoading={isLoading} />
                    </div>
                    <div className="h-px xl:w-px xl:h-64 bg-border"></div>
                    <div className="xl:w-80 flex justify-around xl:grid xl:grid-cols-2 gap-4">
                      {isLoading ? (
                        [...Array(4)].map((_, i) => (
                          <PersonCard key={i} variant="compact" isLoading={true} />
                        ))
                      ) : (
                        otherPeople.map(person => (
                          <PersonCard key={person.id} person={person} variant="compact" />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* 9. COMING SOON */}
        {(isLoading || comingSoon.length > 0) && (
          <div className="py-16">
            <FilmRow
              title="Coming Soon"
              subtitle="Confirmed upcoming Nigerian releases"
              films={comingSoon}
              isLoading={isLoading}
            />
          </div>
        )}
      </div>
    </div>
  );
}
