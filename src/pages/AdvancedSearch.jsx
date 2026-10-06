import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { supabase } from '../lib/supabase';
import FilmCard from '../components/film/FilmCard';
import PersonCard from '../components/person/PersonCard';
import SkeletonCard from '../components/ui/SkeletonCard';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import { PLATFORMS, isFilmOnPlatform } from '../lib/platforms';
import { formatFilmTitle, toTitleCase } from '../utils/format';
import { AFRICAN_COUNTRY_NAMES } from '../utils/africanCountries';

const GENRE_OPTIONS = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Epic', 'Family', 'Fantasy', 'History', 'Horror',
  'Musical', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'Traditional'
];

const LANGUAGE_OPTIONS = [
  'English', 'Yoruba', 'Igbo', 'Hausa', 'Nigerian Pidgin', 'Swahili', 'French', 'Twi'
];

const NFVCB_OPTIONS = ['18', '15', 'PG', '12', 'G'];

const ERA_PRESETS = [
  { label: 'All Eras', min: '', max: '' },
  { label: '2020s Streaming Boom', min: '2020', max: '2026' },
  { label: '2010s Multiplex Revival', min: '2010', max: '2019' },
  { label: '2000s Home Video Era', min: '2000', max: '2009' },
  { label: '1990s Classic Golden Age', min: '1990', max: '1999' },
  { label: '1980s & Earlier Pioneers', min: '1960', max: '1989' }
];

const RUNTIME_PRESETS = [
  { label: 'Any Duration', min: '', max: '' },
  { label: 'Short (< 45m)', min: '1', max: '45' },
  { label: 'Standard (60 - 90m)', min: '60', max: '90' },
  { label: 'Feature Length (90 - 120m)', min: '90', max: '120' },
  { label: 'Epic / Extended (> 120m)', min: '120', max: '360' }
];

const BOX_OFFICE_PRESETS = [
  { label: 'Any Gross', min: 0 },
  { label: '₦50M+ Box Office', min: 50_000_000 },
  { label: '₦100M+ Hit', min: 100_000_000 },
  { label: '₦500M+ Blockbuster', min: 500_000_000 },
  { label: '₦1 Billion Club 🏆', min: 1_000_000_000 }
];

const COLLAB_PRESETS = [
  { p1: 'Funke Akindele', p2: 'Mercy Aigbe', label: 'Funke Akindele & Mercy Aigbe' },
  { p1: 'Richard Mofe-Damijo', p2: 'Sola Sobowale', label: 'RMD & Sola Sobowale' },
  { p1: 'Kunle Afolayan', p2: 'Gabriel Afolayan', label: 'Kunle & Gabriel Afolayan' },
  { p1: 'Bimbo Ademoye', p2: 'Stan Nze', label: 'Bimbo Ademoye & Stan Nze' }
];

const COMPARE_PRESETS = [
  { f1: 'A Tribe Called Judah', f2: 'The Wedding Party', label: 'A Tribe Called Judah vs The Wedding Party' },
  { f1: 'King of Boys', f2: 'Battle on Buka Street', label: 'King of Boys vs Battle on Buka Street' },
  { f1: 'Anikulapo', f2: 'Jagun Jagun', label: 'Anikulapo vs Jagun Jagun' }
];

function formatNaira(amount) {
  if (!amount || amount <= 0) return '—';
  if (amount >= 1_000_000_000) return `₦${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₦${(amount / 1_000).toFixed(0)}K`;
  return `₦${amount.toLocaleString()}`;
}

export default function AdvancedSearch() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Active top-level mode: 'titles' | 'names' | 'collaborations'
  const activeTab = searchParams.get('tab') || 'titles';
  const setActiveTab = (tab) => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('tab', tab);
      return p;
    });
  };

  // ----------------------------------------------------
  // TAB 1: ADVANCED TITLES FILTER STATE
  // ----------------------------------------------------
  const [titleQuery, setTitleQuery] = useState(searchParams.get('q') || '');
  const [titleMatchType, setTitleMatchType] = useState(searchParams.get('match') || 'contains'); // 'contains' | 'starts' | 'exact'
  const [selectedTypes, setSelectedTypes] = useState(searchParams.getAll('type') || []);
  const [minYear, setMinYear] = useState(searchParams.get('minYear') || '');
  const [maxYear, setMaxYear] = useState(searchParams.get('maxYear') || '');
  const [minRating, setMinRating] = useState(searchParams.get('minRating') || '');
  const [minLiked, setMinLiked] = useState(searchParams.get('minLiked') || '');
  const [selectedGenres, setSelectedGenres] = useState(searchParams.getAll('genre') || []);
  const [selectedPlatform, setSelectedPlatform] = useState(searchParams.get('platform') || '');
  const [talentQuery, setTalentQuery] = useState(searchParams.get('talent') || '');
  const [talentRole, setTalentRole] = useState(searchParams.get('role') || 'all'); // 'all' | 'Actor' | 'Director' | 'Producer' | 'Writer'
  const [companyQuery, setCompanyQuery] = useState(searchParams.get('company') || '');
  const [selectedLanguage, setSelectedLanguage] = useState(searchParams.get('lang') || '');
  const [selectedCountry, setSelectedCountry] = useState(searchParams.get('country') || '');
  const [selectedRatings, setSelectedRatings] = useState(searchParams.getAll('rating') || []);
  const [minRuntime, setMinRuntime] = useState(searchParams.get('minRuntime') || '');
  const [maxRuntime, setMaxRuntime] = useState(searchParams.get('maxRuntime') || '');
  const [minBoxOffice, setMinBoxOffice] = useState(searchParams.get('minGross') || 0);
  const [hasCriticsOnly, setHasCriticsOnly] = useState(searchParams.get('critics') === 'true');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'views_desc');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'detailed'

  // Results State for Titles
  const [titlesResults, setTitlesResults] = useState([]);
  const [isTitlesLoading, setIsTitlesLoading] = useState(false);
  const [totalTitlesCount, setTotalTitlesCount] = useState(0);

  // Accordion toggle state on sidebar
  const [collapsedSections, setCollapsedSections] = useState({
    titleName: false,
    titleType: false,
    releaseDate: false,
    ratings: false,
    genres: false,
    streaming: false,
    talent: false,
    companies: false,
    language: false,
    nfvcb: false,
    runtime: false,
    boxOffice: false
  });

  const toggleSection = (key) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAllSections = (expand = true) => {
    setCollapsedSections({
      titleName: !expand,
      titleType: !expand,
      releaseDate: !expand,
      ratings: !expand,
      genres: !expand,
      streaming: !expand,
      talent: !expand,
      companies: !expand,
      language: !expand,
      nfvcb: !expand,
      runtime: !expand,
      boxOffice: !expand
    });
  };

  // ----------------------------------------------------
  // TAB 2: COLLABORATIONS & CONTRAST STATE
  // ----------------------------------------------------
  const [collabMode, setCollabMode] = useState('people'); // 'people' | 'compare_films'
  
  // People Collaboration sub-mode
  const [person1Input, setPerson1Input] = useState('Richard Mofe-Damijo');
  const [person2Input, setPerson2Input] = useState('Sola Sobowale');
  const [isCollabSearching, setIsCollabSearching] = useState(false);
  const [collabResults, setCollabResults] = useState(null);

  // Side-by-Side Film Comparison sub-mode
  const [film1Input, setFilm1Input] = useState('A Tribe Called Judah');
  const [film2Input, setFilm2Input] = useState('The Wedding Party');
  const [isCompareSearching, setIsCompareSearching] = useState(false);
  const [compareResults, setCompareResults] = useState(null);

  // ----------------------------------------------------
  // TAB 3: TALENT / NAMES FILTER STATE
  // ----------------------------------------------------
  const [nameQuery, setNameQuery] = useState('');
  const [nameProfession, setNameProfession] = useState('all');
  const [minFilmsCount, setMinFilmsCount] = useState('');
  const [namesResults, setNamesResults] = useState([]);
  const [isNamesLoading, setIsNamesLoading] = useState(false);

  // ----------------------------------------------------
  // EXECUTE TITLES SEARCH
  // ----------------------------------------------------
  const executeTitlesSearch = useCallback(async () => {
    setIsTitlesLoading(true);
    try {
      let query = supabase.from('films').select(`
        id, slug, title, poster_url, backdrop_url, year, language, languages,
        runtime_minutes, view_count, average_rating, liked_percent, audience_rating,
        tmdb_rating, nfvcb_rating, content_type, release_type, streaming_links, source,
        countries, budget, box_office_gross, synopsis,
        film_genres!left(genres(name))
      `, { count: 'exact' });

      // Title Name Filter
      if (titleQuery.trim()) {
        const clean = titleQuery.trim();
        if (titleMatchType === 'starts') {
          query = query.ilike('title', `${clean}%`);
        } else if (titleMatchType === 'exact') {
          query = query.ilike('title', clean);
        } else {
          query = query.ilike('title', `%${clean}%`);
        }
      }

      // Title Type
      if (selectedTypes.length > 0) {
        query = query.in('content_type', selectedTypes);
      }

      // Year Range
      if (minYear) query = query.gte('year', parseInt(minYear, 10));
      if (maxYear) query = query.lte('year', parseInt(maxYear, 10));

      // Ratings
      if (minRating) query = query.gte('average_rating', parseFloat(minRating));
      if (minLiked) query = query.gte('liked_percent', parseInt(minLiked, 10));

      // Language & Country
      if (selectedLanguage) query = query.eq('language', selectedLanguage);
      if (selectedCountry) query = query.contains('countries', [selectedCountry]);

      // NFVCB Rating
      if (selectedRatings.length > 0) {
        query = query.in('nfvcb_rating', selectedRatings);
      }

      // Runtime
      if (minRuntime) query = query.gte('runtime_minutes', parseInt(minRuntime, 10));
      if (maxRuntime) query = query.lte('runtime_minutes', parseInt(maxRuntime, 10));

      // Box Office
      if (minBoxOffice && Number(minBoxOffice) > 0) {
        query = query.gte('box_office_gross', Number(minBoxOffice));
      }

      // Talent Filtering (Actor / Director / Writer)
      if (talentQuery.trim()) {
        const { data: matchedPeople } = await supabase
          .from('people')
          .select('id')
          .ilike('name', `%${talentQuery.trim()}%`)
          .limit(10);

        if (matchedPeople && matchedPeople.length > 0) {
          const personIds = matchedPeople.map(p => p.id);
          let creditQuery = supabase.from('credits').select('film_id').in('person_id', personIds);
          if (talentRole !== 'all') {
            creditQuery = creditQuery.ilike('role', `%${talentRole}%`);
          }
          const { data: creditRows } = await creditQuery.limit(200);
          const filmIds = [...new Set((creditRows || []).map(c => c.film_id).filter(Boolean))];
          if (filmIds.length > 0) {
            query = query.in('id', filmIds);
          } else {
            // No films found for this talent
            setTitlesResults([]);
            setTotalTitlesCount(0);
            setIsTitlesLoading(false);
            return;
          }
        }
      }

      // Sorting
      const sortConfig = {
        'views_desc': { col: 'view_count', asc: false },
        'rating_desc': { col: 'average_rating', asc: false },
        'liked_desc': { col: 'liked_percent', asc: false },
        'year_desc': { col: 'year', asc: false },
        'year_asc': { col: 'year', asc: true },
        'gross_desc': { col: 'box_office_gross', asc: false },
        'title_asc': { col: 'title', asc: true }
      }[sortBy] || { col: 'view_count', asc: false };

      query = query.order(sortConfig.col, { ascending: sortConfig.asc, nullsFirst: false });
      query = query.limit(60);

      const { data, count, error } = await query;
      if (error) throw error;

      let processed = (data || []).map(f => ({
        ...f,
        genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || (Array.isArray(f.genres) ? f.genres : [])
      }));

      // In-memory filters for platform and genres if specified
      if (selectedGenres.length > 0) {
        processed = processed.filter(f => 
          selectedGenres.every(g => f.genres.some(fg => fg.toLowerCase() === g.toLowerCase()))
        );
      }

      if (selectedPlatform) {
        processed = processed.filter(f => isFilmOnPlatform(f, selectedPlatform));
      }

      setTitlesResults(processed);
      setTotalTitlesCount(count || processed.length);
    } catch (err) {
      console.error('Error executing advanced title search:', err);
    } finally {
      setIsTitlesLoading(false);
    }
  }, [
    titleQuery, titleMatchType, selectedTypes, minYear, maxYear, minRating, minLiked,
    selectedGenres, selectedPlatform, talentQuery, talentRole, selectedLanguage,
    selectedCountry, selectedRatings, minRuntime, maxRuntime, minBoxOffice, sortBy
  ]);

  // Sync state to URL and execute on mount or explicit search
  useEffect(() => {
    if (activeTab === 'titles') {
      executeTitlesSearch();
    }
  }, [activeTab, sortBy]);

  // ----------------------------------------------------
  // EXECUTE COLLABORATIONS SEARCH
  // ----------------------------------------------------
  const executeCollaborationsSearch = async (p1Name = person1Input, p2Name = person2Input) => {
    if (!p1Name.trim() || !p2Name.trim()) return;
    setIsCollabSearching(true);
    setCollabResults(null);

    try {
      // 1. Resolve both people
      const [res1, res2] = await Promise.all([
        supabase.from('people').select('id, name, slug, photo_url, primary_profession').ilike('name', `%${p1Name.trim()}%`).limit(1),
        supabase.from('people').select('id, name, slug, photo_url, primary_profession').ilike('name', `%${p2Name.trim()}%`).limit(1)
      ]);

      const person1 = res1.data?.[0];
      const person2 = res2.data?.[0];

      if (!person1 || !person2) {
        setCollabResults({
          found: false,
          error: `Could not locate profile for ${!person1 ? `"${p1Name}"` : `"${p2Name}"`}. Try checking the spelling.`
        });
        setIsCollabSearching(false);
        return;
      }

      // 2. Fetch credits for both persons
      const [credits1, credits2] = await Promise.all([
        supabase.from('credits').select('film_id, role, character_name, billing_order').eq('person_id', person1.id),
        supabase.from('credits').select('film_id, role, character_name, billing_order').eq('person_id', person2.id)
      ]);

      const c1Map = new Map((credits1.data || []).map(c => [c.film_id, c]));
      const sharedFilmIds = (credits2.data || [])
        .map(c => c.film_id)
        .filter(fid => fid && c1Map.has(fid));

      if (sharedFilmIds.length === 0) {
        setCollabResults({
          found: true,
          person1,
          person2,
          sharedFilms: [],
          totalGross: 0
        });
        setIsCollabSearching(false);
        return;
      }

      // 3. Fetch shared film details
      const { data: filmsData } = await supabase
        .from('films')
        .select('id, slug, title, year, poster_url, runtime_minutes, average_rating, liked_percent, box_office_gross, genres')
        .in('id', sharedFilmIds)
        .order('year', { ascending: false });

      const c2Map = new Map((credits2.data || []).map(c => [c.film_id, c]));

      const enrichedShared = (filmsData || []).map(f => ({
        ...f,
        p1Credit: c1Map.get(f.id),
        p2Credit: c2Map.get(f.id)
      }));

      const totalGross = enrichedShared.reduce((acc, f) => acc + (f.box_office_gross || 0), 0);

      setCollabResults({
        found: true,
        person1,
        person2,
        sharedFilms: enrichedShared,
        totalGross
      });
    } catch (err) {
      console.error('Error fetching collaborations:', err);
    } finally {
      setIsCollabSearching(false);
    }
  };

  // ----------------------------------------------------
  // EXECUTE FILM SIDE-BY-SIDE CONTRAST
  // ----------------------------------------------------
  const executeFilmContrast = async (f1Title = film1Input, f2Title = film2Input) => {
    if (!f1Title.trim() || !f2Title.trim()) return;
    setIsCompareSearching(true);
    setCompareResults(null);

    try {
      const [res1, res2] = await Promise.all([
        supabase.from('films').select(`
          id, slug, title, year, poster_url, backdrop_url, runtime_minutes,
          average_rating, liked_percent, audience_rating, nfvcb_rating,
          content_type, release_type, streaming_links, box_office_gross, budget, synopsis,
          film_genres!left(genres(name))
        `).ilike('title', `%${f1Title.trim()}%`).limit(1),
        supabase.from('films').select(`
          id, slug, title, year, poster_url, backdrop_url, runtime_minutes,
          average_rating, liked_percent, audience_rating, nfvcb_rating,
          content_type, release_type, streaming_links, box_office_gross, budget, synopsis,
          film_genres!left(genres(name))
        `).ilike('title', `%${f2Title.trim()}%`).limit(1)
      ]);

      const film1 = res1.data?.[0];
      const film2 = res2.data?.[0];

      if (!film1 || !film2) {
        setCompareResults({
          found: false,
          error: `Could not locate title for ${!film1 ? `"${f1Title}"` : `"${f2Title}"`}.`
        });
        setIsCompareSearching(false);
        return;
      }

      // Fetch credits for both to identify shared cast members
      const [credits1, credits2] = await Promise.all([
        supabase.from('credits').select('person_id, role, character_name, people(id, name, slug, photo_url)').eq('film_id', film1.id),
        supabase.from('credits').select('person_id, role, character_name, people(id, name, slug, photo_url)').eq('film_id', film2.id)
      ]);

      const c1People = new Map((credits1.data || []).map(c => [c.person_id, c]));
      const sharedCast = [];

      (credits2.data || []).forEach(c2 => {
        if (c1People.has(c2.person_id)) {
          const c1 = c1People.get(c2.person_id);
          sharedCast.push({
            person: c2.people,
            roleInFilm1: c1.role || c1.character_name,
            roleInFilm2: c2.role || c2.character_name
          });
        }
      });

      setCompareResults({
        found: true,
        film1: {
          ...film1,
          genres: film1.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
        },
        film2: {
          ...film2,
          genres: film2.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
        },
        sharedCast
      });
    } catch (err) {
      console.error('Error comparing films:', err);
    } finally {
      setIsCompareSearching(false);
    }
  };

  // ----------------------------------------------------
  // EXECUTE NAMES / TALENT SEARCH
  // ----------------------------------------------------
  const executeNamesSearch = async () => {
    setIsNamesLoading(true);
    try {
      let query = supabase.from('people').select('id, name, slug, photo_url, primary_profession, film_count, bio');
      if (nameQuery.trim()) {
        query = query.ilike('name', `%${nameQuery.trim()}%`);
      }
      if (nameProfession !== 'all') {
        query = query.ilike('primary_profession', `%${nameProfession}%`);
      }
      if (minFilmsCount) {
        query = query.gte('film_count', parseInt(minFilmsCount, 10));
      }
      query = query.order('film_count', { ascending: false, nullsFirst: false }).limit(40);

      const { data, error } = await query;
      if (error) throw error;
      setNamesResults(data || []);
    } catch (err) {
      console.error('Error fetching names:', err);
    } finally {
      setIsNamesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'names') {
      executeNamesSearch();
    }
  }, [activeTab, nameProfession]);

  // Reset all filters in Titles tab
  const handleResetFilters = () => {
    setTitleQuery('');
    setTitleMatchType('contains');
    setSelectedTypes([]);
    setMinYear('');
    setMaxYear('');
    setMinRating('');
    setMinLiked('');
    setSelectedGenres([]);
    setSelectedPlatform('');
    setTalentQuery('');
    setTalentRole('all');
    setCompanyQuery('');
    setSelectedLanguage('');
    setSelectedCountry('');
    setSelectedRatings([]);
    setMinRuntime('');
    setMaxRuntime('');
    setMinBoxOffice(0);
    setHasCriticsOnly(false);
    setSortBy('views_desc');
  };

  return (
    <div className="min-h-screen bg-[#080A0D] text-slate-100 selection:bg-brand selection:text-white font-sans pb-32">
      
      {/* ── Page Header ── */}
      <div className="border-b border-white/10 bg-[#0E1217]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-brand mb-1">
                <Icon icon="solar:tuning-square-2-bold" className="text-sm" />
                <span>Precision Cinema Discovery</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black font-heading text-white tracking-tight">
                Advanced Title Search
              </h1>
            </div>

            {/* Quick Share / Reset */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetFilters}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition flex items-center gap-1.5"
              >
                <Icon icon="solar:restart-bold" />
                <span>Reset Filters</span>
              </button>
              <Link
                to="/search"
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition flex items-center gap-1.5"
              >
                <Icon icon="solar:magnifer-linear" />
                <span>Standard Search</span>
              </Link>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-400 max-w-3xl leading-relaxed">
            Discover MuviDB&apos;s robust search engine. Mix and match criteria to find hidden gems, cross-examine talent filmographies, or compare Nollywood titles and collaborators side-by-side.
          </p>

          {/* ── Mode Switcher Tabs (IMDb Style: TITLES, NAMES, COLLABORATIONS) ── */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/5 overflow-x-auto">
            {[
              { id: 'titles', label: 'Titles', icon: 'solar:clapperboard-play-bold' },
              { id: 'collaborations', label: 'Collaborations & Compare', icon: 'solar:users-group-two-rounded-bold' },
              { id: 'names', label: 'Names & Talent', icon: 'solar:user-bold' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap uppercase tracking-wider ${
                  activeTab === tab.id
                    ? 'bg-brand text-white shadow-sm'
                    : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5'
                }`}
              >
                <Icon icon={tab.icon} className="text-sm" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">

        {/* ═══════════════════════════════════════════════════ */}
        {/* TAB 1: ADVANCED TITLES SEARCH                       */}
        {/* ═══════════════════════════════════════════════════ */}
        {activeTab === 'titles' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* ── Filter Sidebar (Accordion Style matching IMDb) ── */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-[#0E1217] border border-white/10 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="font-bold text-sm text-white flex items-center gap-2">
                    <Icon icon="solar:filter-bold" className="text-brand" />
                    Search Filters
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => expandAllSections(true)}
                      className="text-[11px] text-slate-400 hover:text-white underline font-mono"
                    >
                      Expand all
                    </button>
                    <span className="text-slate-600">•</span>
                    <button
                      onClick={() => expandAllSections(false)}
                      className="text-[11px] text-slate-400 hover:text-white underline font-mono"
                    >
                      Collapse
                    </button>
                  </div>
                </div>

                {/* 1. Title Name */}
                <div className="border-b border-white/5 pb-3">
                  <button
                    onClick={() => toggleSection('titleName')}
                    className="w-full flex items-center justify-between py-1 text-xs font-bold text-slate-200 hover:text-white"
                  >
                    <span>Title name</span>
                    <Icon icon={collapsedSections.titleName ? "solar:alt-arrow-down-linear" : "solar:alt-arrow-up-linear"} />
                  </button>
                  {!collapsedSections.titleName && (
                    <div className="mt-2.5 space-y-2">
                      <input
                        type="text"
                        value={titleQuery}
                        onChange={(e) => setTitleQuery(e.target.value)}
                        placeholder="e.g. Wedding, King, Battle..."
                        className="w-full px-3 py-2 rounded-lg bg-[#141A22] border border-white/10 text-xs text-white focus:outline-none focus:border-brand"
                      />
                      <div className="flex items-center gap-1.5 text-[11px]">
                        {[
                          { id: 'contains', label: 'Contains' },
                          { id: 'starts', label: 'Starts with' },
                          { id: 'exact', label: 'Exact' }
                        ].map(m => (
                          <button
                            key={m.id}
                            onClick={() => setTitleMatchType(m.id)}
                            className={`px-2 py-1 rounded text-[10px] font-semibold transition ${
                              titleMatchType === m.id
                                ? 'bg-brand text-white'
                                : 'bg-white/5 text-slate-400 hover:text-white'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Title Type */}
                <div className="border-b border-white/5 pb-3">
                  <button
                    onClick={() => toggleSection('titleType')}
                    className="w-full flex items-center justify-between py-1 text-xs font-bold text-slate-200 hover:text-white"
                  >
                    <span>Title type</span>
                    <Icon icon={collapsedSections.titleType ? "solar:alt-arrow-down-linear" : "solar:alt-arrow-up-linear"} />
                  </button>
                  {!collapsedSections.titleType && (
                    <div className="mt-2.5 space-y-1.5">
                      {[
                        { id: 'movie', label: 'Feature Film' },
                        { id: 'series', label: 'TV Series / Show' },
                        { id: 'short', label: 'Short Film' },
                        { id: 'documentary', label: 'Documentary' }
                      ].map(t => {
                        const checked = selectedTypes.includes(t.id);
                        return (
                          <label key={t.id} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setSelectedTypes(prev => 
                                  checked ? prev.filter(x => x !== t.id) : [...prev, t.id]
                                );
                              }}
                              className="rounded border-white/20 bg-[#141A22] text-brand focus:ring-0"
                            />
                            <span>{t.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Release Date / Year */}
                <div className="border-b border-white/5 pb-3">
                  <button
                    onClick={() => toggleSection('releaseDate')}
                    className="w-full flex items-center justify-between py-1 text-xs font-bold text-slate-200 hover:text-white"
                  >
                    <span>Release date &amp; Era</span>
                    <Icon icon={collapsedSections.releaseDate ? "solar:alt-arrow-down-linear" : "solar:alt-arrow-up-linear"} />
                  </button>
                  {!collapsedSections.releaseDate && (
                    <div className="mt-2.5 space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 font-mono">Min Year</label>
                          <input
                            type="number"
                            placeholder="e.g. 2015"
                            value={minYear}
                            onChange={(e) => setMinYear(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-[#141A22] border border-white/10 text-xs text-white focus:outline-none focus:border-brand"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-mono">Max Year</label>
                          <input
                            type="number"
                            placeholder="e.g. 2024"
                            value={maxYear}
                            onChange={(e) => setMaxYear(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-[#141A22] border border-white/10 text-xs text-white focus:outline-none focus:border-brand"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {ERA_PRESETS.map((era, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setMinYear(era.min);
                              setMaxYear(era.max);
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] border transition ${
                              minYear === era.min && maxYear === era.max
                                ? 'bg-brand text-white border-brand'
                                : 'bg-[#141A22] text-slate-400 hover:text-white border-white/5'
                            }`}
                          >
                            {era.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Ratings & Liked % */}
                <div className="border-b border-white/5 pb-3">
                  <button
                    onClick={() => toggleSection('ratings')}
                    className="w-full flex items-center justify-between py-1 text-xs font-bold text-slate-200 hover:text-white"
                  >
                    <span>Audience ratings &amp; score</span>
                    <Icon icon={collapsedSections.ratings ? "solar:alt-arrow-down-linear" : "solar:alt-arrow-up-linear"} />
                  </button>
                  {!collapsedSections.ratings && (
                    <div className="mt-2.5 space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 font-mono">Min Star Rating</label>
                          <select
                            value={minRating}
                            onChange={(e) => setMinRating(e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg bg-[#141A22] border border-white/10 text-xs text-white focus:outline-none focus:border-brand"
                          >
                            <option value="">Any Rating</option>
                            <option value="6.0">6.0+ Stars</option>
                            <option value="7.0">7.0+ Stars</option>
                            <option value="8.0">8.0+ Stars</option>
                            <option value="9.0">9.0+ High Acclaim</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-mono">Min Liked %</label>
                          <select
                            value={minLiked}
                            onChange={(e) => setMinLiked(e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg bg-[#141A22] border border-white/10 text-xs text-white focus:outline-none focus:border-brand"
                          >
                            <option value="">Any Liked %</option>
                            <option value="60">60%+ Liked</option>
                            <option value="70">70%+ Liked</option>
                            <option value="80">80%+ Highly Rated</option>
                            <option value="90">90%+ Masterpiece</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Genres (Multi-select) */}
                <div className="border-b border-white/5 pb-3">
                  <button
                    onClick={() => toggleSection('genres')}
                    className="w-full flex items-center justify-between py-1 text-xs font-bold text-slate-200 hover:text-white"
                  >
                    <span>Genres {selectedGenres.length > 0 && `(${selectedGenres.length})`}</span>
                    <Icon icon={collapsedSections.genres ? "solar:alt-arrow-down-linear" : "solar:alt-arrow-up-linear"} />
                  </button>
                  {!collapsedSections.genres && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
                      {GENRE_OPTIONS.map(g => {
                        const isSelected = selectedGenres.includes(g);
                        return (
                          <button
                            key={g}
                            onClick={() => {
                              setSelectedGenres(prev =>
                                isSelected ? prev.filter(x => x !== g) : [...prev, g]
                              );
                            }}
                            className={`px-2.5 py-1 rounded text-xs transition border ${
                              isSelected
                                ? 'bg-brand text-white border-brand font-bold'
                                : 'bg-[#141A22] text-slate-300 hover:text-white border-white/5 hover:border-white/20'
                            }`}
                          >
                            {g}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 6. Instant Watch Options */}
                <div className="border-b border-white/5 pb-3">
                  <button
                    onClick={() => toggleSection('streaming')}
                    className="w-full flex items-center justify-between py-1 text-xs font-bold text-slate-200 hover:text-white"
                  >
                    <span>Instant watch options</span>
                    <Icon icon={collapsedSections.streaming ? "solar:alt-arrow-down-linear" : "solar:alt-arrow-up-linear"} />
                  </button>
                  {!collapsedSections.streaming && (
                    <div className="mt-2.5 space-y-1.5">
                      <button
                        onClick={() => setSelectedPlatform('')}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          !selectedPlatform ? 'bg-brand text-white' : 'text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        All Platforms / Any
                      </button>
                      {PLATFORMS.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPlatform(p.id)}
                          className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                            selectedPlatform === p.id ? 'bg-brand text-white' : 'text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Icon icon={p.icon} className="text-sm" />
                            {p.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 7. Cast or Crew */}
                <div className="border-b border-white/5 pb-3">
                  <button
                    onClick={() => toggleSection('talent')}
                    className="w-full flex items-center justify-between py-1 text-xs font-bold text-slate-200 hover:text-white"
                  >
                    <span>Cast or crew member</span>
                    <Icon icon={collapsedSections.talent ? "solar:alt-arrow-down-linear" : "solar:alt-arrow-up-linear"} />
                  </button>
                  {!collapsedSections.talent && (
                    <div className="mt-2.5 space-y-2">
                      <input
                        type="text"
                        value={talentQuery}
                        onChange={(e) => setTalentQuery(e.target.value)}
                        placeholder="e.g. Stan Nze, Kemi Adetiba..."
                        className="w-full px-3 py-2 rounded-lg bg-[#141A22] border border-white/10 text-xs text-white focus:outline-none focus:border-brand"
                      />
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {['all', 'Actor', 'Director', 'Writer'].map(r => (
                          <button
                            key={r}
                            onClick={() => setTalentRole(r)}
                            className={`py-1 px-2 rounded text-[11px] font-semibold border ${
                              talentRole === r
                                ? 'bg-brand text-white border-brand'
                                : 'bg-[#141A22] text-slate-400 border-white/5'
                            }`}
                          >
                            {r === 'all' ? 'Any Role' : r}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 8. Box Office Gross */}
                <div className="border-b border-white/5 pb-3">
                  <button
                    onClick={() => toggleSection('boxOffice')}
                    className="w-full flex items-center justify-between py-1 text-xs font-bold text-slate-200 hover:text-white"
                  >
                    <span>Box Office gross</span>
                    <Icon icon={collapsedSections.boxOffice ? "solar:alt-arrow-down-linear" : "solar:alt-arrow-up-linear"} />
                  </button>
                  {!collapsedSections.boxOffice && (
                    <div className="mt-2.5 space-y-1.5">
                      {BOX_OFFICE_PRESETS.map((bo, idx) => (
                        <button
                          key={idx}
                          onClick={() => setMinBoxOffice(bo.min)}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                            Number(minBoxOffice) === bo.min ? 'bg-brand text-white font-bold' : 'text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          {bo.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 9. Runtime */}
                <div className="border-b border-white/5 pb-3">
                  <button
                    onClick={() => toggleSection('runtime')}
                    className="w-full flex items-center justify-between py-1 text-xs font-bold text-slate-200 hover:text-white"
                  >
                    <span>Runtime</span>
                    <Icon icon={collapsedSections.runtime ? "solar:alt-arrow-down-linear" : "solar:alt-arrow-up-linear"} />
                  </button>
                  {!collapsedSections.runtime && (
                    <div className="mt-2.5 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          placeholder="Min mins"
                          value={minRuntime}
                          onChange={(e) => setMinRuntime(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#141A22] border border-white/10 text-xs text-white focus:outline-none focus:border-brand"
                        />
                        <input
                          type="number"
                          placeholder="Max mins"
                          value={maxRuntime}
                          onChange={(e) => setMaxRuntime(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#141A22] border border-white/10 text-xs text-white focus:outline-none focus:border-brand"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {RUNTIME_PRESETS.map((rp, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setMinRuntime(rp.min);
                              setMaxRuntime(rp.max);
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] border transition ${
                              minRuntime === rp.min && maxRuntime === rp.max
                                ? 'bg-brand text-white border-brand'
                                : 'bg-[#141A22] text-slate-400 hover:text-white border-white/5'
                            }`}
                          >
                            {rp.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 10. Language & NFVCB */}
                <div className="pb-1 space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-200 block mb-1.5">Language</label>
                    <select
                      value={selectedLanguage}
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#141A22] border border-white/10 text-xs text-white focus:outline-none focus:border-brand"
                    >
                      <option value="">Any Language</option>
                      {LANGUAGE_OPTIONS.map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-200 block mb-1.5">NFVCB Nigerian Rating</label>
                    <div className="flex items-center gap-1.5">
                      {NFVCB_OPTIONS.map(r => {
                        const checked = selectedRatings.includes(r);
                        return (
                          <button
                            key={r}
                            onClick={() => {
                              setSelectedRatings(prev =>
                                checked ? prev.filter(x => x !== r) : [...prev, r]
                              );
                            }}
                            className={`flex-1 py-1 rounded text-xs font-mono font-bold border transition ${
                              checked
                                ? 'bg-brand text-white border-brand'
                                : 'bg-[#141A22] text-slate-400 border-white/10 hover:text-white'
                            }`}
                          >
                            {r}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Primary Action Button */}
                <div className="pt-2">
                  <button
                    onClick={executeTitlesSearch}
                    disabled={isTitlesLoading}
                    className="w-full py-3 rounded-lg bg-brand hover:bg-brand-hover text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2"
                  >
                    {isTitlesLoading ? (
                      <Icon icon="solar:refresh-linear" className="animate-spin text-base" />
                    ) : (
                      <Icon icon="solar:magnifer-bold" className="text-base" />
                    )}
                    <span>Apply &amp; See Results</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ── Results Panel (Right Column) ── */}
            <div className="lg:col-span-8 space-y-4">
              
              {/* Results Topbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#0E1217] border border-white/10">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white">
                    {isTitlesLoading ? 'Searching catalog...' : `${totalTitlesCount} Titles Found`}
                  </span>
                  {totalTitlesCount > 0 && (
                    <span className="px-2 py-0.5 rounded bg-white/5 text-[11px] text-slate-400 font-mono">
                      Page 1
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-[#141A22] p-1 rounded-lg border border-white/10">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded transition ${viewMode === 'grid' ? 'bg-brand text-white' : 'text-slate-400 hover:text-white'}`}
                      title="Grid View"
                    >
                      <Icon icon="solar:widget-linear" className="text-sm" />
                    </button>
                    <button
                      onClick={() => setViewMode('detailed')}
                      className={`p-1.5 rounded transition ${viewMode === 'detailed' ? 'bg-brand text-white' : 'text-slate-400 hover:text-white'}`}
                      title="Detailed List View"
                    >
                      <Icon icon="solar:list-bold" className="text-sm" />
                    </button>
                  </div>

                  {/* Sort Dropdown */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-300">
                    <span className="text-slate-500 font-mono hidden sm:inline">Sort:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#141A22] border border-white/10 text-xs text-white focus:outline-none focus:border-brand font-medium"
                    >
                      <option value="views_desc">Popularity (Most Viewed)</option>
                      <option value="rating_desc">Highest User Rating</option>
                      <option value="liked_desc">Highest Liked %</option>
                      <option value="year_desc">Release Date (Newest)</option>
                      <option value="year_asc">Release Date (Oldest)</option>
                      <option value="gross_desc">Box Office Gross</option>
                      <option value="title_asc">Title (A - Z)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Active Filter Chips */}
              {(titleQuery || selectedGenres.length > 0 || selectedPlatform || minYear || talentQuery || minBoxOffice > 0) && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-slate-500 font-mono text-[11px]">Active:</span>
                  {titleQuery && (
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 flex items-center gap-1">
                      Title: {titleQuery}
                      <button onClick={() => setTitleQuery('')} className="hover:text-white"><Icon icon="solar:close-circle-bold" /></button>
                    </span>
                  )}
                  {selectedGenres.map(g => (
                    <span key={g} className="px-2 py-0.5 rounded bg-brand/10 border border-brand/20 text-brand flex items-center gap-1">
                      {g}
                      <button onClick={() => setSelectedGenres(prev => prev.filter(x => x !== g))} className="hover:text-white"><Icon icon="solar:close-circle-bold" /></button>
                    </span>
                  ))}
                  {selectedPlatform && (
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 flex items-center gap-1">
                      Platform: {selectedPlatform}
                      <button onClick={() => setSelectedPlatform('')} className="hover:text-white"><Icon icon="solar:close-circle-bold" /></button>
                    </span>
                  )}
                  {minYear && (
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 flex items-center gap-1">
                      From: {minYear}
                      <button onClick={() => setMinYear('')} className="hover:text-white"><Icon icon="solar:close-circle-bold" /></button>
                    </span>
                  )}
                  {talentQuery && (
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 flex items-center gap-1">
                      With: {talentQuery}
                      <button onClick={() => setTalentQuery('')} className="hover:text-white"><Icon icon="solar:close-circle-bold" /></button>
                    </span>
                  )}
                  {minBoxOffice > 0 && (
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 flex items-center gap-1">
                      Gross: {formatNaira(minBoxOffice)}+
                      <button onClick={() => setMinBoxOffice(0)} className="hover:text-white"><Icon icon="solar:close-circle-bold" /></button>
                    </span>
                  )}
                  <button onClick={handleResetFilters} className="text-[11px] text-brand hover:underline font-bold ml-1">
                    Clear all
                  </button>
                </div>
              )}

              {/* Grid or Detailed Results */}
              {isTitlesLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : titlesResults.length > 0 ? (
                viewMode === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {titlesResults.map(film => (
                      <FilmCard key={film.id} film={film} />
                    ))}
                  </div>
                ) : (
                  /* Detailed IMDb List View */
                  <div className="space-y-3">
                    {titlesResults.map(film => (
                      <div
                        key={film.id}
                        className="p-4 rounded-xl bg-[#0E1217] border border-white/10 hover:border-white/20 transition flex flex-col sm:flex-row gap-4 items-start"
                      >
                        <Link to={`/films/${film.slug || film.id}`} className="shrink-0 w-24 sm:w-28 aspect-[2/3] rounded-lg overflow-hidden bg-[#141A22] border border-white/5">
                          <ImageWithFallback
                            src={film.poster_url}
                            alt={film.title}
                            fallbackType="poster"
                            className="w-full h-full object-cover"
                          />
                        </Link>

                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <Link
                                to={`/films/${film.slug || film.id}`}
                                className="font-heading font-bold text-base text-white hover:text-brand transition"
                              >
                                {formatFilmTitle(film.title)}
                              </Link>
                              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                <span>{film.year || '—'}</span>
                                <span>•</span>
                                <span>{film.runtime_minutes ? `${film.runtime_minutes}m` : '—'}</span>
                                {film.nfvcb_rating && (
                                  <>
                                    <span>•</span>
                                    <span className="px-1.5 py-0.2 rounded bg-white/5 border border-white/10 text-[10px] font-mono">
                                      {film.nfvcb_rating}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {film.average_rating ? (
                              <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#141A22] border border-white/10 font-bold text-xs text-white">
                                <Icon icon="solar:star-bold" className="text-amber-400 text-sm" />
                                <span>{Number(film.average_rating).toFixed(1)}</span>
                              </div>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {(film.genres || []).slice(0, 4).map((g, i) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-white/5 text-[10px] text-slate-300">
                                {g}
                              </span>
                            ))}
                          </div>

                          {film.synopsis && (
                            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                              {film.synopsis}
                            </p>
                          )}

                          {film.box_office_gross > 0 && (
                            <div className="text-[11px] font-mono text-emerald-400">
                              Box Office: {formatNaira(film.box_office_gross)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* Empty Results State */
                <div className="text-center py-16 px-4 bg-[#0E1217] border border-white/10 rounded-xl space-y-4">
                  <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 text-slate-400 flex items-center justify-center mx-auto text-2xl">
                    <Icon icon="solar:clapperboard-linear" />
                  </div>
                  <h3 className="font-bold text-lg text-white">No titles match your combined criteria</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                    Try broadening your year range, clearing specific genres, or reducing minimum audience score constraints.
                  </p>
                  <button
                    onClick={handleResetFilters}
                    className="px-4 py-2 rounded-lg bg-brand text-white font-bold text-xs transition hover:bg-brand-hover"
                  >
                    Reset All Filters
                  </button>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* TAB 2: COLLABORATIONS & CONTRAST (Compare & Synergy) */}
        {/* ═══════════════════════════════════════════════════ */}
        {activeTab === 'collaborations' && (
          <div className="space-y-8 max-w-5xl mx-auto">
            
            {/* Submode Switcher */}
            <div className="flex items-center justify-center gap-2 p-1.5 rounded-xl bg-[#0E1217] border border-white/10 w-fit mx-auto">
              <button
                onClick={() => setCollabMode('people')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                  collabMode === 'people'
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon icon="solar:users-group-two-rounded-bold" />
                <span>Two People Working Together (Collaborations)</span>
              </button>
              <button
                onClick={() => setCollabMode('compare_films')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                  collabMode === 'compare_films'
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon icon="solar:scale-bold" />
                <span>Side-by-Side Film Comparison (Contrast)</span>
              </button>
            </div>

            {/* ── Sub-mode A: People Collaborations ── */}
            {collabMode === 'people' && (
              <div className="space-y-6">
                <div className="p-6 rounded-xl bg-[#0E1217] border border-white/10 space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-white">Find Joint Projects &amp; Shared Filmographies</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Enter any two Nollywood actors, directors, or producers to discover every film and play where both collaborated.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-mono text-slate-300 block mb-1">Person 1 (Actor / Director)</label>
                      <input
                        type="text"
                        value={person1Input}
                        onChange={(e) => setPerson1Input(e.target.value)}
                        placeholder="e.g. Richard Mofe-Damijo"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-[#141A22] border border-white/10 text-xs text-white focus:outline-none focus:border-brand"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-mono text-slate-300 block mb-1">Person 2 (Co-star / Collaborator)</label>
                      <input
                        type="text"
                        value={person2Input}
                        onChange={(e) => setPerson2Input(e.target.value)}
                        placeholder="e.g. Sola Sobowale"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-[#141A22] border border-white/10 text-xs text-white focus:outline-none focus:border-brand"
                      />
                    </div>
                  </div>

                  {/* Preset Collaboration Buttons */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] text-slate-500 font-mono">Popular Partnerships:</span>
                    {COLLAB_PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setPerson1Input(p.p1);
                          setPerson2Input(p.p2);
                          executeCollaborationsSearch(p.p1, p.p2);
                        }}
                        className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => executeCollaborationsSearch()}
                    disabled={isCollabSearching}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-brand hover:bg-brand-hover text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2"
                  >
                    {isCollabSearching ? (
                      <Icon icon="solar:refresh-linear" className="animate-spin text-base" />
                    ) : (
                      <Icon icon="solar:users-group-two-rounded-bold" className="text-base" />
                    )}
                    <span>Find Shared Titles</span>
                  </button>
                </div>

                {/* Collaboration Results Display */}
                {isCollabSearching && (
                  <div className="text-center py-12 text-slate-400 font-mono text-xs">
                    Searching ensemble graph for shared titles...
                  </div>
                )}

                {collabResults && collabResults.found && (
                  <div className="space-y-6 animate-in fade-in">
                    {/* Header Summary Card */}
                    <div className="p-6 rounded-xl bg-[#0E1217] border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6">
                      <div className="flex items-center gap-4">
                        <div className="flex -space-x-4">
                          <img
                            src={collabResults.person1.photo_url || '/placeholder-avatar.png'}
                            alt={collabResults.person1.name}
                            className="w-14 h-14 rounded-full border-2 border-brand object-cover bg-[#141A22]"
                          />
                          <img
                            src={collabResults.person2.photo_url || '/placeholder-avatar.png'}
                            alt={collabResults.person2.name}
                            className="w-14 h-14 rounded-full border-2 border-white/30 object-cover bg-[#141A22]"
                          />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-white">
                            {collabResults.person1.name} &amp; {collabResults.person2.name}
                          </h3>
                          <p className="text-xs text-slate-400">
                            Shared credit on {collabResults.sharedFilms.length} {collabResults.sharedFilms.length === 1 ? 'title' : 'titles'}
                          </p>
                        </div>
                      </div>

                      {collabResults.totalGross > 0 && (
                        <div className="text-right">
                          <span className="text-[11px] font-mono text-slate-400 uppercase">Combined Box Office</span>
                          <div className="text-xl font-bold font-mono text-emerald-400">
                            {formatNaira(collabResults.totalGross)}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Shared Titles Cards */}
                    {collabResults.sharedFilms.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {collabResults.sharedFilms.map(film => (
                          <div
                            key={film.id}
                            className="p-4 rounded-xl bg-[#0E1217] border border-white/10 hover:border-white/20 transition flex gap-4 items-start"
                          >
                            <Link to={`/films/${film.slug || film.id}`} className="shrink-0 w-20 aspect-[2/3] rounded-lg overflow-hidden bg-[#141A22]">
                              <ImageWithFallback
                                src={film.poster_url}
                                alt={film.title}
                                fallbackType="poster"
                                className="w-full h-full object-cover"
                              />
                            </Link>

                            <div className="flex-1 space-y-2">
                              <div>
                                <Link
                                  to={`/films/${film.slug || film.id}`}
                                  className="font-bold text-sm text-white hover:text-brand transition"
                                >
                                  {formatFilmTitle(film.title)} ({film.year || '—'})
                                </Link>
                                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                  {film.runtime_minutes ? `${film.runtime_minutes} mins` : ''}
                                  {film.box_office_gross > 0 && ` • ${formatNaira(film.box_office_gross)}`}
                                </div>
                              </div>

                              <div className="p-2.5 rounded-lg bg-[#141A22] border border-white/5 space-y-1 text-xs">
                                <div className="flex items-center justify-between text-slate-300">
                                  <span className="text-slate-400 text-[11px]">{collabResults.person1.name}:</span>
                                  <span className="font-semibold text-brand text-right">{film.p1Credit?.character_name || film.p1Credit?.role || 'Credited'}</span>
                                </div>
                                <div className="flex items-center justify-between text-slate-300 border-t border-white/5 pt-1">
                                  <span className="text-slate-400 text-[11px]">{collabResults.person2.name}:</span>
                                  <span className="font-semibold text-white text-right">{film.p2Credit?.character_name || film.p2Credit?.role || 'Credited'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-[#0E1217] border border-white/10 rounded-xl space-y-2">
                        <h4 className="font-bold text-base text-white">No Direct Shared Titles Found</h4>
                        <p className="text-xs text-slate-400">
                          These two talents have not worked on the same verified movie or play in our archive.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Sub-mode B: Film Comparison (Side-by-Side Contrast) ── */}
            {collabMode === 'compare_films' && (
              <div className="space-y-6">
                <div className="p-6 rounded-xl bg-[#0E1217] border border-white/10 space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-white">Side-by-Side Film Comparison</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Contrast budget, box office earnings, audience ratings, runtime, and discover overlapping cast members between two films.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-mono text-slate-300 block mb-1">Film 1</label>
                      <input
                        type="text"
                        value={film1Input}
                        onChange={(e) => setFilm1Input(e.target.value)}
                        placeholder="e.g. A Tribe Called Judah"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-[#141A22] border border-white/10 text-xs text-white focus:outline-none focus:border-brand"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-mono text-slate-300 block mb-1">Film 2</label>
                      <input
                        type="text"
                        value={film2Input}
                        onChange={(e) => setFilm2Input(e.target.value)}
                        placeholder="e.g. The Wedding Party"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-[#141A22] border border-white/10 text-xs text-white focus:outline-none focus:border-brand"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] text-slate-500 font-mono">Preset Comparisons:</span>
                    {COMPARE_PRESETS.map((cp, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setFilm1Input(cp.f1);
                          setFilm2Input(cp.f2);
                          executeFilmContrast(cp.f1, cp.f2);
                        }}
                        className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition"
                      >
                        {cp.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => executeFilmContrast()}
                    disabled={isCompareSearching}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-brand hover:bg-brand-hover text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2"
                  >
                    {isCompareSearching ? (
                      <Icon icon="solar:refresh-linear" className="animate-spin text-base" />
                    ) : (
                      <Icon icon="solar:scale-bold" className="text-base" />
                    )}
                    <span>Compare Side-by-Side</span>
                  </button>
                </div>

                {/* Compare Results Display */}
                {compareResults && compareResults.found && (
                  <div className="space-y-6 animate-in fade-in">
                    {/* Side-by-Side Matrix Table */}
                    <div className="rounded-xl border border-white/10 overflow-hidden bg-[#0E1217]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#141A22] text-slate-300 font-mono border-b border-white/10">
                          <tr>
                            <th className="p-4 w-1/4">Metric</th>
                            <th className="p-4 w-3/8 text-white font-bold text-sm">
                              {compareResults.film1.title} ({compareResults.film1.year})
                            </th>
                            <th className="p-4 w-3/8 text-brand font-bold text-sm">
                              {compareResults.film2.title} ({compareResults.film2.year})
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-200">
                          <tr>
                            <td className="p-4 font-mono text-slate-400">Artwork</td>
                            <td className="p-4">
                              <img
                                src={compareResults.film1.poster_url}
                                alt={compareResults.film1.title}
                                className="w-20 aspect-[2/3] rounded object-cover border border-white/10"
                              />
                            </td>
                            <td className="p-4">
                              <img
                                src={compareResults.film2.poster_url}
                                alt={compareResults.film2.title}
                                className="w-20 aspect-[2/3] rounded object-cover border border-white/10"
                              />
                            </td>
                          </tr>

                          <tr>
                            <td className="p-4 font-mono text-slate-400">Box Office Gross</td>
                            <td className="p-4 font-mono font-bold text-emerald-400 text-sm">
                              {formatNaira(compareResults.film1.box_office_gross)}
                            </td>
                            <td className="p-4 font-mono font-bold text-emerald-400 text-sm">
                              {formatNaira(compareResults.film2.box_office_gross)}
                            </td>
                          </tr>

                          <tr>
                            <td className="p-4 font-mono text-slate-400">Audience Rating</td>
                            <td className="p-4 font-bold">
                              {compareResults.film1.average_rating ? `⭐ ${Number(compareResults.film1.average_rating).toFixed(1)} / 10` : '—'}
                              {compareResults.film1.liked_percent ? ` (${compareResults.film1.liked_percent}% liked)` : ''}
                            </td>
                            <td className="p-4 font-bold">
                              {compareResults.film2.average_rating ? `⭐ ${Number(compareResults.film2.average_rating).toFixed(1)} / 10` : '—'}
                              {compareResults.film2.liked_percent ? ` (${compareResults.film2.liked_percent}% liked)` : ''}
                            </td>
                          </tr>

                          <tr>
                            <td className="p-4 font-mono text-slate-400">Runtime</td>
                            <td className="p-4">{compareResults.film1.runtime_minutes ? `${compareResults.film1.runtime_minutes} minutes` : '—'}</td>
                            <td className="p-4">{compareResults.film2.runtime_minutes ? `${compareResults.film2.runtime_minutes} minutes` : '—'}</td>
                          </tr>

                          <tr>
                            <td className="p-4 font-mono text-slate-400">Genres</td>
                            <td className="p-4">{compareResults.film1.genres.join(', ') || '—'}</td>
                            <td className="p-4">{compareResults.film2.genres.join(', ') || '—'}</td>
                          </tr>

                          <tr>
                            <td className="p-4 font-mono text-slate-400">Classification</td>
                            <td className="p-4 font-mono">{compareResults.film1.nfvcb_rating || 'Unrated'}</td>
                            <td className="p-4 font-mono">{compareResults.film2.nfvcb_rating || 'Unrated'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Shared Cast Members (Overlapping Actors) */}
                    <div className="p-6 rounded-xl bg-[#0E1217] border border-white/10 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-base text-white flex items-center gap-2">
                          <Icon icon="solar:users-group-two-rounded-bold" className="text-brand" />
                          <span>Overlapping Cast &amp; Crew ({compareResults.sharedCast.length})</span>
                        </h3>
                        <span className="text-xs text-slate-400">Actors who appeared in both films</span>
                      </div>

                      {compareResults.sharedCast.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {compareResults.sharedCast.map((item, idx) => (
                            <div key={idx} className="p-3 rounded-lg bg-[#141A22] border border-white/5 space-y-1 text-xs">
                              <span className="font-bold text-white block">{item.person?.name}</span>
                              <div className="text-[11px] text-slate-400">
                                <div><span className="text-slate-500">{compareResults.film1.title}:</span> {item.roleInFilm1}</div>
                                <div><span className="text-slate-500">{compareResults.film2.title}:</span> {item.roleInFilm2}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">No shared actors found between these two productions.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* TAB 3: NAMES & TALENT SEARCH                        */}
        {/* ═══════════════════════════════════════════════════ */}
        {activeTab === 'names' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="p-6 rounded-xl bg-[#0E1217] border border-white/10 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-white">Advanced Talent &amp; Creative Search</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Discover actors, directors, writers, cinematographers, and producers by filmography volume and profession.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-mono text-slate-300 block mb-1">Name Contains</label>
                  <input
                    type="text"
                    value={nameQuery}
                    onChange={(e) => setNameQuery(e.target.value)}
                    placeholder="e.g. Gabriel, Kunle..."
                    className="w-full px-3 py-2 rounded-lg bg-[#141A22] border border-white/10 text-xs text-white focus:outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono text-slate-300 block mb-1">Profession</label>
                  <select
                    value={nameProfession}
                    onChange={(e) => setNameProfession(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#141A22] border border-white/10 text-xs text-white focus:outline-none focus:border-brand"
                  >
                    <option value="all">Any Profession</option>
                    <option value="Actor">Actor / Actress</option>
                    <option value="Director">Director</option>
                    <option value="Producer">Producer</option>
                    <option value="Writer">Writer / Screenplay</option>
                    <option value="Cinematographer">Cinematographer (DoP)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono text-slate-300 block mb-1">Min Filmography Credits</label>
                  <select
                    value={minFilmsCount}
                    onChange={(e) => setMinFilmsCount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#141A22] border border-white/10 text-xs text-white focus:outline-none focus:border-brand"
                  >
                    <option value="">Any Volume</option>
                    <option value="5">5+ Verified Films</option>
                    <option value="15">15+ Credits</option>
                    <option value="30">30+ Veteran Credits</option>
                    <option value="50">50+ Nollywood Legends</option>
                  </select>
                </div>
              </div>

              <button
                onClick={executeNamesSearch}
                disabled={isNamesLoading}
                className="px-6 py-2.5 rounded-lg bg-brand hover:bg-brand-hover text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2"
              >
                {isNamesLoading ? (
                  <Icon icon="solar:refresh-linear" className="animate-spin text-base" />
                ) : (
                  <Icon icon="solar:magnifer-bold" className="text-base" />
                )}
                <span>Search Talent</span>
              </button>
            </div>

            {/* Names Results */}
            {isNamesLoading ? (
              <div className="text-center py-12 text-slate-400 font-mono text-xs">
                Searching verified talent records...
              </div>
            ) : namesResults.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {namesResults.map(person => (
                  <PersonCard key={person.id} person={person} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 text-xs">
                No talents matched the given search filters.
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
}
