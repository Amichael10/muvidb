import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Icon } from '@iconify/react';
import ShareAction from '../components/ui/ShareAction';
import { toTitleCase, toSentenceCase } from '../utils/format';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import SEO from '../components/SEO';

function CompanyFilmCard({ film, role }) {
  return (
    <Link
      to={`/films/${film.slug || film.id}`}
      className="group bg-surface border border-border hover:border-brand/60 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-brand/5 flex flex-col justify-between"
    >
      <div>
        {/* Poster Image */}
        <div className="relative aspect-[2/3] bg-surface-2 overflow-hidden">
          <ImageWithFallback
            src={film.poster_url}
            alt={film.title}
            name={film.title}
            fallbackType="film"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />

          {/* Role / Type Badge */}
          {role && (
            <span className="absolute top-2.5 left-2.5 bg-brand text-on-brand text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shadow-lg z-10">
              {role.replace('_', ' ')}
            </span>
          )}

          {/* Rating Badge */}
          {film.liked_percent != null && (
            <span className="absolute bottom-2.5 right-2.5 bg-black/80 backdrop-blur-md text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-md z-10 flex items-center gap-1">
              <Icon icon="solar:star-bold" className="w-3 h-3" />
              {film.liked_percent}%
            </span>
          )}
        </div>

        {/* Title & Metadata */}
        <div className="p-4">
          <h3 className="text-text-primary text-sm font-bold leading-snug group-hover:text-brand transition-colors line-clamp-2 mb-1.5" title={toSentenceCase(film.title)}>
            {toSentenceCase(film.title)}
          </h3>

          <div className="flex items-center gap-2 text-xs text-text-muted font-semibold">
            <span>{film.year || 'N/A'}</span>
            {film.film_genres?.[0]?.genres?.name && (
              <>
                <span>•</span>
                <span className="truncate">{film.film_genres[0].genres.name}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

const Description = ({ text }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = text && text.length > 140;
  const displayText = isExpanded ? text : text?.slice(0, 140) + (isLong ? '...' : '');

  if (!text) return null;

  return (
    <div className="text-text-muted text-xs max-w-2xl leading-relaxed mt-3">
      {displayText}
      {isLong && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-brand hover:underline font-bold ml-2 transition-colors"
        >
          {isExpanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
};

export default function CompanyDetail() {
  const { id, slug: slugParam } = useParams();
  const slug = slugParam || id;
  const navigate = useNavigate();

  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'production', 'distribution', 'top'
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(16);

  useEffect(() => {
    fetchCompany();
  }, [slug]);

  const fetchCompany = async () => {
    setLoading(true);
    setError(null);

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

    // 1. Fetch Company
    const { data: comp, error: compErr } = await supabase
      .from('companies')
      .select('*')
      .eq(isUUID ? 'id' : 'slug', slug)
      .maybeSingle();

    if (compErr || !comp) {
      setError('Company not found');
      setLoading(false);
      return;
    }

    // 2. Fetch Films linked via film_companies OR production_company_id
    const { data: fcLinks } = await supabase
      .from('film_companies')
      .select('role, films(id, title, year, poster_url, liked_percent, average_rating, slug, film_genres(genres(name)))')
      .eq('company_id', comp.id);

    const { data: directProdFilms } = await supabase
      .from('films')
      .select('id, title, year, poster_url, liked_percent, average_rating, slug, film_genres(genres(name))')
      .eq('production_company_id', comp.id);

    // Merge film entries with roles
    const filmMap = new Map();

    (directProdFilms || []).forEach(f => {
      if (f && f.id) {
        filmMap.set(f.id, { film: f, role: 'production' });
      }
    });

    (fcLinks || []).forEach(link => {
      if (link.films && link.films.id) {
        const existing = filmMap.get(link.films.id);
        filmMap.set(link.films.id, {
          film: link.films,
          role: link.role || existing?.role || 'production'
        });
      }
    });

    comp.filmsWithRole = Array.from(filmMap.values());
    setCompany(comp);
    document.title = `MuviDB | ${toTitleCase(comp.name)}`;
    setLoading(false);
  };

  const allFilmsWithRole = useMemo(() => {
    return company?.filmsWithRole || [];
  }, [company]);

  // Filter & Search Logic
  const filteredFilms = useMemo(() => {
    let result = [...allFilmsWithRole];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(item => item.film?.title?.toLowerCase().includes(q));
    }

    if (activeTab === 'production') {
      result = result.filter(item => item.role === 'production' || item.role === 'co_production');
    } else if (activeTab === 'distribution') {
      result = result.filter(item => item.role === 'distribution' || item.role === 'international_distribution');
    } else if (activeTab === 'top') {
      result.sort((a, b) => (b.film?.liked_percent || 0) - (a.film?.liked_percent || 0));
    }

    return result;
  }, [allFilmsWithRole, activeTab, searchQuery]);

  const displayedFilms = useMemo(() => {
    return filteredFilms.slice(0, visibleCount);
  }, [filteredFilms, visibleCount]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="min-h-screen bg-bg pt-20 flex items-center justify-center text-center p-6">
        <div>
          <p className="text-text-primary text-xl font-bold mb-4">{error || 'Company not found'}</p>
          <button
            onClick={() => navigate('/companies')}
            className="bg-brand text-on-brand px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-brand-hover"
          >
            Back to Companies Directory
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary pb-20">
      <SEO 
        title={`${toTitleCase(company.name)} - Studio & Production Company Profile | MuviDB`}
        description={company.description || `Explore movies, productions, distribution partners, and studio history for ${company.name} on MuviDB.`}
      />

      {/* RICH HERO HEADER */}
      <div className="relative border-b border-border bg-surface/30">
        <div className="absolute inset-0 h-[280px] md:h-[360px] bg-gradient-to-r from-brand/10 to-amber-500/10">
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-transparent to-transparent opacity-80" />
        </div>

        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 relative z-10 pt-16 md:pt-28 pb-8">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start justify-between">
            
            {/* Left Core Info */}
            <div className="flex gap-6 items-start">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-2 border-border overflow-hidden bg-surface-2 shadow-2xl shrink-0">
                <ImageWithFallback
                  src={company.logo_url}
                  alt={toTitleCase(company.name)}
                  fallbackType="company"
                  name={toTitleCase(company.name)}
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              </div>

              <div className="pt-2">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl md:text-4xl font-heading font-bold text-text-primary tracking-tight">{toTitleCase(company.name)}</h1>
                  <Icon icon="solar:verified-check-bold" className="text-brand text-xl" />
                </div>
                
                <div className="flex flex-wrap items-center gap-3 text-text-muted text-[11px] font-bold">
                  {company.company_type && <span className="capitalize">{company.company_type}</span>}
                  {company.company_type && company.headquarters && <span>•</span>}
                  {company.headquarters && <span>📍 {company.headquarters}</span>}
                  {company.founded_year && <span>• Est. {company.founded_year}</span>}
                </div>

                <Description text={toSentenceCase(company.description)} />

                <div className="flex items-center gap-3 mt-5">
                  {company.website && (
                    <a href={company.website} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-brand hover:bg-brand-hover text-on-brand font-bold text-[11px] px-6 py-2.5 rounded-lg transition-all shadow-lg hover:scale-[1.02]">
                      <Icon icon="solar:global-bold" className="text-sm" />
                      Official Website <Icon icon="solar:arrow-right-up-linear" className="text-sm" />
                    </a>
                  )}
                  <ShareAction title={toTitleCase(company.name)} text={`Check out ${toTitleCase(company.name)} on MuviDB`} className="!w-auto !bg-surface border border-border !px-4 !py-2.5 !rounded-lg text-text-primary text-xs font-bold" />
                </div>
              </div>
            </div>

            {/* Right Quick Stats */}
            <div className="flex items-center gap-8 md:gap-12 md:pr-12 pt-4 md:pt-6">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1.5 text-brand mb-1">
                  <Icon icon="solar:clapperboard-play-bold" className="text-base" />
                  <span className="text-text-primary font-heading font-bold text-lg">{allFilmsWithRole.length}</span>
                </div>
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Films</span>
              </div>

              {company.founded_year && (
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1.5 text-brand mb-1">
                    <Icon icon="solar:calendar-bold" className="text-base" />
                    <span className="text-text-primary font-heading font-bold text-lg">{company.founded_year}</span>
                  </div>
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Founded</span>
                </div>
              )}

              {company.company_type && (
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1.5 text-brand mb-1">
                    <Icon icon="solar:buildings-bold" className="text-base" />
                    <span className="text-text-primary font-heading font-bold text-sm capitalize">{company.company_type}</span>
                  </div>
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Type</span>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* MAIN CATALOG CONTENT */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-10">
        
        {/* Filter & Control Bar */}
        <div className="bg-surface border border-border p-4 rounded-2xl mb-8 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {[
              { id: 'all', label: `All Films (${allFilmsWithRole.length})` },
              { id: 'production', label: `Production (${allFilmsWithRole.filter(f => f.role === 'production' || f.role === 'co_production').length})` },
              { id: 'distribution', label: `Distribution (${allFilmsWithRole.filter(f => f.role === 'distribution' || f.role === 'international_distribution').length})` },
              { id: 'top', label: 'Top Rated ⭐' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setVisibleCount(16);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-brand text-on-brand shadow-md'
                    : 'bg-surface-2 border border-border text-text-muted hover:text-text-primary hover:border-brand/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Instant Search Bar */}
          <div className="relative w-full md:w-64">
            <Icon icon="solar:magnifer-linear" className="absolute left-3 top-2.5 text-text-muted w-4 h-4" />
            <input
              type="text"
              placeholder="Search company films..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(16);
              }}
              className="w-full pl-9 pr-3 py-2 bg-bg border border-border rounded-xl text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-brand transition-colors"
            />
          </div>
        </div>

        {/* Company Film Grid */}
        {displayedFilms.length === 0 ? (
          <div className="bg-surface border border-border p-16 rounded-2xl text-center">
            <Icon icon="solar:clapperboard-line-duotone" className="w-16 h-16 text-text-muted mx-auto mb-3 opacity-40" />
            <h3 className="text-lg font-bold text-text-primary mb-1">No films found</h3>
            <p className="text-xs text-text-muted">No films match your selected filter or search query.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {displayedFilms.map(item => (
                <CompanyFilmCard key={item.film.id} film={item.film} role={item.role} />
              ))}
            </div>

            {/* Load More Button */}
            {filteredFilms.length > visibleCount && (
              <div className="mt-12 text-center">
                <button
                  onClick={() => setVisibleCount(prev => prev + 16)}
                  className="px-8 py-3.5 bg-surface border border-border hover:border-brand/50 text-text-primary font-bold text-xs rounded-xl shadow-md hover:bg-surface-2 transition-all inline-flex items-center gap-2"
                >
                  <span>Load More Films ({filteredFilms.length - visibleCount} remaining)</span>
                  <Icon icon="solar:alt-arrow-down-linear" className="w-4 h-4 text-brand" />
                </button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}