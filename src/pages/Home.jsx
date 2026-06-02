import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getPersonYoutubeChannelUrl } from '../lib/youtube';
import HeroSection from '../components/film/HeroSection';
import FilmRow from '../components/film/FilmRow';
import GenreRail from '../components/film/GenreRail';
import CountryRail from '../components/film/CountryRail';
import PersonCard from '../components/person/PersonCard';
import { Icon } from '@iconify/react';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isHeroLoading, setIsHeroLoading] = useState(true);
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
  const [spotlightContent, setSpotlightContent] = useState(null);
  const [top10Films, setTop10Films] = useState([]);
  const [crewMembers, setCrewMembers] = useState([]);
  const [productionCompanies, setProductionCompanies] = useState([]);

  // Spotlight Image Fallback state (Issue 24)
  const [spotlightImgError, setSpotlightImgError] = useState(false);

  // External YouTube Channel warning dialog states (Issue 19)
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  const [externalUrl, setExternalUrl] = useState('');
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    document.title = "Ensembla | Home";
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setIsLoading(true);
    setIsHeroLoading(true);
    
    // 1. Fetch above-the-fold content first for instant loading experience (Issue 1)
    try {
      await Promise.all([
        fetchFeaturedFilms().catch(e => console.error('Error fetching featured films:', e)),
        fetchInCinemasData().catch(e => console.error('Error fetching cinemas data:', e))
      ]);
    } catch (e) {
      console.error('Error in critical fetches:', e);
    } finally {
      setIsHeroLoading(false);
    }

    // 2. Fetch all other sections in the background progressively
    try {
      await Promise.all([
        fetchFilms().catch(e => console.error('Error fetching films:', e)),
        fetchNewReleases().catch(e => console.error('Error fetching new releases:', e)),
        fetchComingSoon().catch(e => console.error('Error fetching coming soon:', e)),
        fetchYoutubeFeed().catch(e => console.error('Error fetching youtube feed:', e)),
        fetchPeople().catch(e => console.error('Error fetching people:', e)),
        fetchCreators().catch(e => console.error('Error fetching creators:', e)),
        fetchCuratedCollection().catch(e => console.error('Error fetching curated collection:', e)),
        fetchSpotlightContent().catch(e => console.error('Error fetching spotlight content:', e)),
        fetchTop10Films().catch(e => console.error('Error fetching top 10:', e)),
        fetchCrewMembers().catch(e => console.error('Error fetching crew:', e)),
        fetchCompanies().catch(e => console.error('Error fetching companies:', e))
      ]);
    } catch (error) {
      console.error('Error in progressive fetches:', error);
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
      .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
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
      .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
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
    // Fetch curated new releases (designated by admin via is_trending flag)
    const { data, error } = await supabase
      .from('films')
      .select(`
        id, title, poster_url, backdrop_url, year, language, 
        runtime_minutes, view_count, average_rating, nfvcb_rating, 
        is_featured, is_trending, release_type, created_at, release_date,
        film_genres(genres(name))
      `)
      .eq('is_trending', true)
      .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
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
    // 1. Fetch by explicit is_in_cinemas flag
    const { data: cinemaMovies } = await supabase
      .from('films')
      .select(`*, film_genres(genres(name))`)
      .eq('is_in_cinemas', true)
      .neq('source', 'youtube')
      .or('youtube_watch_url.is.null,youtube_watch_url.eq.""')
      .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
      .order('release_date', { ascending: false })
      .limit(20);

    // 2. Fetch from showtimes (movies currently showing)
    const today = new Date().toISOString().split('T')[0];
    const { data: showtimesData } = await supabase
      .from('showtimes')
      .select(`
        film_id, 
        films!inner(*, film_genres(genres(name)))
      `)
      .gte('show_date', today)
      .eq('is_available', true)
      .neq('films.source', 'youtube')
      .or('youtube_watch_url.is.null,youtube_watch_url.eq.""', { foreignTable: 'films' })
      .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}', { foreignTable: 'films' })
      .order('show_date', { ascending: true })
      .limit(60);

    const filmMap = new Map();

    // Prioritize explicit flag
    if (cinemaMovies) {
      cinemaMovies.forEach(f => {
        // Double check to ensure no youtube movies sneak in
        const isYoutube = f.source === 'youtube' || (f.youtube_watch_url && f.youtube_watch_url.length > 5);
        if (!isYoutube) {
          filmMap.set(f.id, {
            ...f,
            genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
          });
        }
      });
    }

    // Add movies with active showtimes
    if (showtimesData) {
      showtimesData.forEach(s => {
        if (s.films && !filmMap.has(s.films.id)) {
          // Double check to ensure no youtube movies sneak in
          const f = s.films;
          const isYoutube = f.source === 'youtube' || (f.youtube_watch_url && String(f.youtube_watch_url).length > 5);
          if (!isYoutube) {
            filmMap.set(f.id, {
              ...f,
              genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
            });
          }
        }
      });
    }

    setInCinemas(Array.from(filmMap.values()));
  };

  const fetchComingSoon = async () => {
    const { data, error } = await supabase
      .from('films')
      .select(`*, film_genres(genres(name))`)
      .in('status', ['upcoming', 'in_production', 'post-production'])
      .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
      .order('release_date', { ascending: true })
      .limit(20);
    
    if (error) {
      console.error('Error fetching coming soon:', error);
    }
    
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
        .filter(f => f.id && (f.source !== 'mubi' || (f.countries && Array.isArray(f.countries) && f.countries.includes('Nigeria'))));
      
      setCuratedCollection({ ...collection, films });
    }
  };

  const fetchSpotlightContent = async () => {
    const { data, error } = await supabase
      .from('spotlights')
      .select(`
        *,
        people (*)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching spotlight content:', error);
      return;
    }

    if (data) {
      if (data.featured_film_ids && data.featured_film_ids.length > 0) {
        const { data: filmsData, error: filmsErr } = await supabase
          .from('films')
          .select('id, title, poster_url, release_type, source, year')
          .in('id', data.featured_film_ids);
        
        if (!filmsErr && filmsData) {
          const sortedFilms = data.featured_film_ids
            .map(id => filmsData.find(f => f.id === id))
            .filter(Boolean);
          
          setSpotlightContent({
            ...data,
            featured_films: sortedFilms
          });
        } else {
          setSpotlightContent({
            ...data,
            featured_films: []
          });
        }
      } else {
        setSpotlightContent({
          ...data,
          featured_films: []
        });
      }
    } else {
      setSpotlightContent(null);
    }
  };

  const fetchTop10Films = async () => {
    const { data, error } = await supabase
      .from('films')
      .select(`
        id, title, poster_url, backdrop_url, year, language, 
        runtime_minutes, view_count, average_rating, nfvcb_rating, 
        is_featured, is_trending, release_type, created_at, release_date,
        film_genres(genres(name))
      `)
      .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
      .order('view_count', { ascending: false })
      .limit(10);
      
    if (!error && data) {
      setTop10Films(data.map(f => ({
        ...f,
        genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
      })));
    }
  };

  const fetchCrewMembers = async () => {
    const { data, error } = await supabase
      .from('people')
      .select('*')
      .not('known_for_department', 'in', '("Acting","Directing","Skit Maker","Unknown")')
      .order('popularity_score', { ascending: false })
      .limit(12);

    if (!error && data) {
      setCrewMembers(data);
    }
  };

  const fetchCompanies = async () => {
    const { data, error } = await supabase
      .from('companies')
      .select(`
        *,
        film_companies(film_id)
      `)
      .limit(12);

    if (!error && data) {
      setProductionCompanies(data);
    }
  };

  const fetchYoutubeFeed = async () => {
    // Recently added are the new fetches from youtube (Issue 3)
    const { data } = await supabase
      .from('films')
      .select(`
        id, title, poster_url, backdrop_url, year, language, 
        runtime_minutes, view_count, average_rating, nfvcb_rating, 
        is_featured, is_trending, release_type, created_at, release_date,
        film_genres(genres(name))
      `)
      .eq('source', 'youtube')
      .order('created_at', { ascending: false })
      .limit(40);

    if (data) {
      const mapped = data.map(f => ({
        ...f,
        genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || [],
        channel_name: 'YouTube Featured'
      }));
      setYoutubeFeed(mapped);
    }
  };

  // Keep recentlyAdded synchronized and deduplicated (Issue 3)
  useEffect(() => {
    if (youtubeFeed.length > 0) {
      const filtered = youtubeFeed.filter(film => 
        !inCinemas.some(ic => ic.id === film.id) &&
        !newReleases.some(nr => nr.id === film.id)
      );
      setRecentlyAdded(filtered.slice(0, 20));
    }
  }, [youtubeFeed, inCinemas, newReleases]);

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

  const handleExternalClick = (e, url) => {
    if (!url || url === '#') return;
    const hideWarning = localStorage.getItem('ensembla_hide_external_warning') === 'true';
    if (hideWarning) {
      return; // Let the browser open the link normally
    }
    
    e.preventDefault();
    setExternalUrl(url);
    setIsWarningModalOpen(true);
  };

  const proceedToExternal = () => {
    if (dontShowAgain) {
      localStorage.setItem('ensembla_hide_external_warning', 'true');
    }
    window.open(externalUrl, '_blank', 'noopener,noreferrer');
    setIsWarningModalOpen(false);
  };



  return (
    <div className="w-full pb-20 bg-bg min-h-screen">
      {/* 1. HERO (Progressive Above-the-Fold Loading) (Issue 1) */}
      <HeroSection 
        featuredFilms={[...inCinemas, ...featuredFilms].filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i)} 
        isLoading={isHeroLoading}
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
              linkTo="/showtimes"
            />
          </div>
        )}
        {/* 2.5. TOP 10 IN NIGERIA TODAY */}
        {(isLoading || top10Films.length > 0) && (
          <div className="border-b border-border py-12 bg-surface-2/5">
            <FilmRow
              title="Top 10 in Nigeria"
              subtitle="The most popular Nollywood stories today"
              films={top10Films}
              isLoading={isLoading}
              cardVariant="top10"
            />
          </div>
        )}

        {/* 3. GENRE MOOD RAIL - FilmFlux-style dynamic covers and count badges (Issue 10) */}
        <div className="border-b border-border">
          <GenreRail films={films} />
        </div>

{/* 3.5. COUNTRY RAIL - DISABLED AS REQUESTED */}
{/* <div className="border-b border-border">
  <CountryRail />
</div> */}

        {/* 4. COMING SOON */}
        {(isLoading || comingSoon.length > 0) && (
          <div className="border-b border-border py-16 bg-brand/5">
            <FilmRow
              title="Coming Soon"
              subtitle="Confirmed upcoming Nigerian releases"
              films={comingSoon}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* 5. NEW RELEASES */}
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
            subtitle="Latest additions to the Ensembla library"
            films={recentlyAdded}
            isLoading={isLoading}
            linkTo="/browse?sort=newest"
          />
        </div>

        {/* 6. BEHIND THE MAGIC (Crew Spotlights) */}
        {(isLoading || crewMembers.length > 0) && (
          <div className="border-b border-border py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-end justify-between mb-12">
                <div className="space-y-1">
                  <h2 className="font-heading font-bold text-2xl md:text-3xl text-text-primary tracking-tighter">
                    Behind the Magic
                  </h2>
                  <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mt-1 opacity-65">
                    The creative crew crafting Nollywood's best stories
                  </p>
                </div>
                <Link to="/people?craft=crew" className="text-brand text-[10px] font-bold uppercase tracking-widest hover:underline">
                  Explore Crew
                </Link>
              </div>

              <div className="flex overflow-x-auto gap-6 pb-6 pt-2 scrollbar-hide touch-pan-x">
                {isLoading ? (
                  [...Array(6)].map((_, i) => (
                    <div key={i} className="shrink-0 w-44 bg-surface border border-border rounded-2xl p-5 text-center flex flex-col items-center gap-4">
                      <div className="w-24 h-24 rounded-full bg-surface-2 animate-pulse" />
                      <div className="w-24 h-4 bg-surface-2 animate-pulse rounded" />
                      <div className="w-16 h-3 bg-surface-2 animate-pulse rounded" />
                    </div>
                  ))
                ) : (
                  crewMembers.map((crew) => (
                    <Link 
                      key={crew.id}
                      to={`/people/${crew.mubi_slug || crew.id}`}
                      className="shrink-0 w-44 bg-surface border border-border hover:border-brand rounded-2xl p-5 text-center transition-all group shadow-sm flex flex-col items-center gap-4"
                    >
                      <div className="relative">
                        <img 
                          src={crew.photo_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} 
                          alt={crew.name}
                          className="w-24 h-24 rounded-full object-cover border-2 border-transparent group-hover:border-brand transition-all duration-300"
                          onError={(e) => { e.target.src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'; }}
                        />
                      </div>
                      <div className="space-y-2 w-full">
                        <h4 className="font-bold text-text-primary text-sm group-hover:text-brand transition-colors line-clamp-1">
                          {crew.name}
                        </h4>
                        <span className="inline-block bg-brand/10 text-brand text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
                          {crew.known_for_department || 'Crew'}
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* 6.5. NOLLYWOOD STUDIOS (Production Companies) */}
        {(isLoading || productionCompanies.length > 0) && (
          <div className="border-b border-border py-16 bg-surface-2/5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-end justify-between mb-12">
                <div className="space-y-1">
                  <h2 className="font-heading font-bold text-2xl md:text-3xl text-text-primary tracking-tighter">
                    Nollywood Studios
                  </h2>
                  <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mt-1 opacity-65">
                    The creative production powerhouses
                  </p>
                </div>
                <Link to="/companies" className="text-brand text-[10px] font-bold uppercase tracking-widest hover:underline">
                  View all
                </Link>
              </div>

              <div className="flex overflow-x-auto gap-6 pb-6 pt-2 scrollbar-hide touch-pan-x">
                {isLoading ? (
                  [...Array(4)].map((_, i) => (
                    <div key={i} className="shrink-0 w-64 bg-surface border border-border rounded-2xl p-6 flex flex-col gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-surface-2 animate-pulse shrink-0" />
                        <div className="space-y-2 flex-1">
                          <div className="h-4 w-2/3 bg-surface-2 animate-pulse rounded" />
                          <div className="h-3 w-1/3 bg-surface-2 animate-pulse rounded" />
                        </div>
                      </div>
                      <div className="h-3 w-1/2 bg-surface-2 animate-pulse rounded pt-2" />
                    </div>
                  ))
                ) : (
                  productionCompanies.map((company) => {
                    const initial = company.name?.charAt(0);
                    const filmCount = company.film_companies?.length || 0;
                    return (
                      <Link 
                        key={company.id}
                        to={`/companies/${company.mubi_slug || company.id}`}
                        className="shrink-0 w-64 bg-surface border border-border hover:border-brand rounded-2xl p-6 transition-all group shadow-sm flex flex-col gap-4"
                      >
                        <div className="flex items-center gap-4">
                          {company.logo_url ? (
                            <div className="w-12 h-12 rounded-xl bg-white p-1 border border-border flex items-center justify-center overflow-hidden shrink-0">
                              <img 
                                src={company.logo_url} 
                                alt={company.name}
                                className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center text-lg font-bold text-brand font-heading border border-border shrink-0">
                              {initial}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="font-bold text-text-primary text-xs uppercase tracking-tight group-hover:text-brand transition-colors line-clamp-1 leading-tight">
                              {company.name}
                            </h4>
                            {company.founded_year && (
                              <p className="text-text-muted text-[8px] font-black uppercase tracking-widest mt-0.5 opacity-60">
                                EST. {company.founded_year}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="pt-2 border-t border-border flex items-center gap-1.5">
                          <Icon icon="solar:clapperboard-play-linear" className="text-text-muted text-xs" />
                          <span className="text-text-muted text-[8px] font-black uppercase tracking-widest">
                            {filmCount} {filmCount === 1 ? 'Film' : 'Films'} Produced
                          </span>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}


        {/* 7. CURATED PICK (Editorial Row) */}
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

        {/* 8. FEATURED CHANNELS */}
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
                      const channelUrl = getPersonYoutubeChannelUrl(creator);
                      return (
                        <a 
                          key={creator.id}
                          href={channelUrl || '#'}
                          onClick={(e) => handleExternalClick(e, channelUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group bg-surface p-8 hover:bg-surface-2/50 transition-all duration-500 flex flex-col gap-6 border-r border-b border-border animate-in fade-in"
                        >
                          <div className="flex items-center gap-5">
                            <img 
                              src={stats.thumbnail || creator.photo_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} 
                              alt={creator.name} 
                              className="w-16 h-16 rounded-lg object-cover shadow-sm border border-border group-hover:scale-105 transition-transform" 
                              onError={(e) => { e.target.src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'; }}
                            />
                            <div>
                              <h3 className="text-lg font-black text-text-primary group-hover:text-brand transition-colors tracking-tight flex items-center gap-1.5">
                                {creator.name}
                                <Icon icon="solar:arrow-right-up-linear" className="text-xs opacity-40 group-hover:opacity-100 group-hover:text-brand transition-all shrink-0" />
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

        {/* 9. SPOTLIGHT (Editorial) */}
        {(isLoading || spotlightContent) && (
          <div className="border-b border-border py-16 bg-surface-2/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-2 mb-10">
                <Icon icon="solar:star-linear" className="text-brand text-xl" />
                <h2 className="font-heading font-bold text-2xl md:text-3xl text-text-primary tracking-tighter">
                  Spotlight
                </h2>
              </div>
 
              <div className="relative bg-surface rounded-xl overflow-hidden border border-border shadow-sm">
                {isLoading ? (
                  <div className="h-[400px] animate-pulse bg-surface-2" />
                ) : spotlightContent && spotlightContent.people && (
                  <div className="flex flex-col md:flex-row items-stretch min-h-[400px]">
                    {/* 1. Artist Photo Cover (Left Pane) */}
                    <div className="md:w-[28%] relative h-64 md:h-auto overflow-hidden bg-surface-2 shrink-0">
                      {!spotlightImgError && (spotlightContent.photo_url || spotlightContent.people.photo_url) ? (
                        <img 
                          src={spotlightContent.photo_url || spotlightContent.people.photo_url} 
                          alt={spotlightContent.people.name}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={() => setSpotlightImgError(true)}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-tr from-brand/20 via-surface-2 to-surface-3 flex items-center justify-center">
                          <span className="text-white/20 text-7xl font-heading font-black tracking-tighter select-none">
                            {spotlightContent.people.name ? spotlightContent.people.name.split(' ').map(n => n[0]).join('') : 'AA'}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/40 via-transparent to-black/20 pointer-events-none" />
                    </div>

                    {/* 2. Editorial Story & Info (Middle Pane) */}
                    <div className="md:w-[42%] p-8 flex flex-col justify-center shrink-0">
                      <span className="text-brand text-[9px] font-black uppercase tracking-widest mb-2 block">
                        Spotlight
                      </span>
                      <Link 
                        to={`/people/${spotlightContent.people.mubi_slug || spotlightContent.people.id}`}
                        className="font-heading font-bold text-3xl md:text-4xl text-text-primary tracking-tighter mb-4 block hover:text-brand transition-colors"
                      >
                        {spotlightContent.people.name}
                      </Link>
                      <p className="text-text-secondary text-xs md:text-sm mb-8 leading-relaxed whitespace-pre-wrap line-clamp-6 text-justify">
                        {spotlightContent.story}
                      </p>
                      <div>
                        <Link 
                          to={`/people/${spotlightContent.people.mubi_slug || spotlightContent.people.id}`}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-surface-2 hover:bg-brand/10 hover:text-brand border border-border rounded-lg text-[10px] font-black uppercase tracking-widest text-text-primary transition-all"
                        >
                          Explore More
                          <Icon icon="solar:arrow-right-linear" className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>

                    {/* 3. Pane Divider */}
                    <div className="hidden md:block w-px bg-border my-8 shrink-0" />

                    {/* 4. Featured Works (Right Pane) */}
                    <div className="md:w-[30%] p-8 flex flex-col justify-center flex-1">
                      <h3 className="text-text-muted text-[10px] font-black uppercase tracking-widest mb-6">
                        Featured Works
                      </h3>
                      {spotlightContent.featured_films && spotlightContent.featured_films.length > 0 ? (
                        <div className="grid grid-cols-4 gap-3">
                          {spotlightContent.featured_films.map((film) => (
                            <Link 
                              key={film.id}
                              to={`/film/${film.id}`}
                              className="group flex flex-col gap-1.5 transition-all"
                              title={film.title}
                            >
                              <div className="aspect-[2/3] w-full rounded-lg overflow-hidden border border-border bg-surface-2 relative shadow-md">
                                <img 
                                  src={film.poster_url || 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=300'} 
                                  alt={film.title}
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                  onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=300'; }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-2">
                                  <span className="text-[8px] font-bold text-white line-clamp-2 leading-tight">
                                    {film.title}
                                  </span>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-text-muted py-8">
                          No featured works curated.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 10. FEATURED ARTIST */}
        {(isLoading || spotlightPerson) && (
          <div className="border-b border-border">
            <section className="py-16">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-end justify-between mb-10">
                  <div className="space-y-1">
                    <h2 className="font-heading font-bold text-2xl md:text-3xl text-text-primary tracking-tighter">
                      Featured Artist
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
        {/* 11. NEW MEMBER CTA BANNER (Issue 29) */}
        {!isAuthenticated && (
          <div className="px-4 sm:px-6 lg:px-8 py-16 border-t border-border/40">
            <div className="relative bg-gradient-to-br from-brand/20 via-surface-2 to-surface border border-border rounded-3xl p-8 md:p-16 overflow-hidden shadow-2xl text-center max-w-5xl mx-auto group">
              {/* Decorative Glow */}
              <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand/10 rounded-full blur-[120px] transition-all group-hover:bg-brand/20 pointer-events-none"></div>
              <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-brand/10 rounded-full blur-[120px] transition-all group-hover:bg-brand/20 pointer-events-none"></div>
              
              <div className="relative z-10 max-w-2xl mx-auto space-y-6">
                <span className="text-brand text-xs font-bold tracking-[0.3em] uppercase block">Join the Nollywood Movement</span>
                <h2 className="font-heading font-bold text-3xl md:text-5xl text-text-primary tracking-tighter leading-tight">
                  Preserve the legacy. Celebrate the future.
                </h2>
                <p className="text-text-secondary text-sm md:text-base leading-relaxed">
                  Join Ensembla today to rate films, write reviews, follow your favourite artists, and build your own custom library of African cinematic excellence.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                  <Link 
                    to="/signup" 
                    className="bg-brand hover:bg-brand-hover text-white px-8 py-4 rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all shadow-lg hover:shadow-brand/20 active:scale-95 shrink-0"
                  >
                    Join Ensembla
                  </Link>
                  <Link 
                    to="/browse" 
                    className="bg-white/5 hover:bg-white/10 text-text-primary border border-border px-8 py-4 rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all active:scale-95 shrink-0"
                  >
                    Browse Database
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* 12. EXTERNAL LINK WARNING DIALOG MODAL (Issue 19) */}
      {isWarningModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            onClick={() => setIsWarningModalOpen(false)}
          />
          
          {/* Modal Content Card */}
          <div className="relative bg-surface border border-border rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl z-10 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 text-brand">
              <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center text-brand">
                <Icon icon="solar:danger-triangle-linear" width="28" height="28" />
              </div>
              <h3 className="font-heading font-bold text-lg md:text-xl text-text-primary tracking-tight">
                Leaving Ensembla
              </h3>
            </div>
            
            <p className="text-text-secondary text-sm leading-relaxed">
              You are about to open an external YouTube channel in a new tab. Ensembla does not control external websites or content.
            </p>
            
            {/* Don't show again checkbox */}
            <label className="flex items-center gap-3 cursor-pointer select-none group w-fit">
              <input 
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="hidden"
              />
              <div className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${dontShowAgain ? 'bg-brand border-brand' : 'border-border bg-surface-2 group-hover:border-brand/50'}`}>
                {dontShowAgain && <Icon icon="solar:check-read-linear" className="text-white text-xs" />}
              </div>
              <span className="text-xs text-text-muted font-bold group-hover:text-text-secondary transition-colors uppercase tracking-wider">
                Don't show this reminder again
              </span>
            </label>
            
            <div className="flex gap-4 pt-2">
              <button 
                onClick={() => setIsWarningModalOpen(false)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-text-primary py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all active:scale-95 border border-border"
              >
                Cancel
              </button>
              <button 
                onClick={proceedToExternal}
                className="flex-1 bg-brand hover:bg-brand-hover text-white py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-brand/10"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
