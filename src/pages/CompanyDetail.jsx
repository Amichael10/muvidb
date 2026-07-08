import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatViewCount } from '../utils/youtube'
import { Icon } from '@iconify/react'
import ShareAction from '../components/ui/ShareAction'
import { toTitleCase, toSentenceCase } from '../utils/format'

const FilmCard = ({ film }) => (
  <Link
    to={`/films/${film.slug || film.id}`}
    className="group block"
  >
    <div className="relative overflow-hidden rounded-xl aspect-[2/3] bg-[#13192B]">
      {film.poster_url ? (
        <img
          src={film.poster_url}
          alt={film.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Icon icon="solar:clapperboard-play-linear" className="text-4xl text-text-muted/30" />
        </div>
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

      {/* Rating */}
      {film.average_rating > 0 && (
        <div className="absolute top-2 right-2 bg-brand text-bg text-[10px] font-bold px-3 py-1 rounded-full shadow-lg shadow-brand/20">
          Official
        </div>
      )}

      {/* Info */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-[#F5F0E8] text-xs font-semibold line-clamp-2">
          {toSentenceCase(film.title)}
        </p>
        <p className="text-[#7A8099] text-xs mt-0.5 flex items-center gap-1">
          {film.film_genres?.[0]?.genres?.name && <span>{film.film_genres[0].genres.name} &bull;</span>}
          <span>{film.year}</span>
        </p>
      </div>
    </div>
  </Link>
)

const PersonCard = ({ person, role }) => (
  <Link to={`/people/${person.slug || person.id}`} className="block group text-center w-[120px] shrink-0">
    <div className="w-24 h-24 mx-auto rounded-full overflow-hidden bg-surface-2 border-2 border-border group-hover:border-brand transition-colors mb-3">
      {person.photo_url ? (
        <img src={person.photo_url} alt={person.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Icon icon="solar:user-linear" className="text-3xl text-text-muted/50" />
        </div>
      )}
    </div>
    <p className="text-sm font-semibold text-text-primary line-clamp-1">{person.name}</p>
    <p className="text-[10px] text-text-muted font-bold tracking-wide mt-1 line-clamp-1">{role}</p>
  </Link>
)

const PartnerCard = ({ company }) => (
  <Link to={`/companies/${company.slug || company.id}`} className="block group text-center w-[120px] shrink-0">
    <div className="w-24 h-24 mx-auto rounded-xl bg-white p-3 shadow-sm border-2 border-transparent group-hover:border-brand transition-colors mb-3 flex items-center justify-center overflow-hidden">
      {company.logo_url ? (
        <img src={company.logo_url} alt={toTitleCase(company.name)} className="max-w-full max-h-full object-contain" />
      ) : (
        <span className="text-2xl font-heading font-bold text-black">{toTitleCase(company.name).charAt(0)}</span>
      )}
    </div>
    <p className="text-sm font-semibold text-text-primary line-clamp-2">{toTitleCase(company.name)}</p>
  </Link>
)

const Description = ({ text }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = text.length > 280;
  const displayText = isExpanded ? text : text.slice(0, 280) + (isLong ? '...' : '');

  return (
    <div className="space-y-4">
      <p className="text-text-muted text-sm leading-relaxed max-w-2xl">
        {displayText}
      </p>
      {isLong && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-brand text-xs font-bold hover:underline transition-all flex items-center gap-1"
        >
          {isExpanded ? 'Read less' : 'Read more'}
          <Icon icon={isExpanded ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"} />
        </button>
      )}
    </div>
  );
};

const CompanyDetail = () => {
  const { id, slug: slugParam } = useParams()
  const slug = slugParam || id
  const navigate = useNavigate()
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchCompany()
  }, [slug])

  const fetchCompany = async () => {
    setLoading(true)
    setError(null)

    // Check if slug is UUID or string
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

    const { data, error } = await supabase
      .from('companies')
      .select(`
        *,
        channels ( channel_id, channel_url, channel_handle ),
        film_companies(
          role,
          films(
            id, title, year, poster_url,
            view_count, average_rating,
            film_genres(genres(name)),
            credits(role, people(id, name, photo_url)),
            film_companies(role, companies(id, name, logo_url))
          )
        )
      `)
      .eq(isUUID ? 'id' : 'slug', slug)
      .single()

    if (error) {
      console.error(error)
      setError('Company not found')
      setLoading(false)
      return
    }

    setCompany(data)
    setLoading(false)
  }

  // Derived Data
  const allFilms = useMemo(() => {
    if (!company?.film_companies) return [];
    return company.film_companies
      .map(fc => fc.films)
      .filter(Boolean)
      // Deduplicate films
      .filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
  }, [company])

  const topFilms = useMemo(() => {
    return [...allFilms].sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0)).slice(0, 10);
  }, [allFilms])

  const recentReleases = useMemo(() => {
    return [...allFilms].sort((a, b) => (b.year || 0) - (a.year || 0)).slice(0, 10);
  }, [allFilms])

  const associatedPeople = useMemo(() => {
    const peopleMap = new Map();
    allFilms.forEach(film => {
      film.credits?.forEach(credit => {
        if (!credit.people) return;
        const p = credit.people;
        if (!peopleMap.has(p.id)) {
          peopleMap.set(p.id, { ...p, roles: new Set([credit.role]), count: 0 });
        }
        peopleMap.get(p.id).count += 1;
        peopleMap.get(p.id).roles.add(credit.role);
      })
    })
    return Array.from(peopleMap.values())
      .sort((a, b) => b.count - a.count)
      .map(p => ({
        ...p,
        displayRole: Array.from(p.roles)[0] // Pick primary role
      }))
      .slice(0, 10);
  }, [allFilms])

  const productionPartners = useMemo(() => {
    const partnerMap = new Map();
    allFilms.forEach(film => {
      film.film_companies?.forEach(fc => {
        if (!fc.companies || fc.companies.id === company?.id) return;
        const c = fc.companies;
        if (!partnerMap.has(c.id)) {
          partnerMap.set(c.id, { ...c, roles: new Set([fc.role]), count: 0 });
        }
        partnerMap.get(c.id).count += 1;
        partnerMap.get(c.id).roles.add(fc.role);
      })
    })
    return Array.from(partnerMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [allFilms, company])


  if (loading) {
    return (
      <div className="min-h-screen bg-bg">
        <div className="h-[400px] bg-surface-2/10 animate-shimmer" />
        <div className="max-w-7xl mx-auto px-4 -mt-32 relative z-10 flex gap-8">
          <div className="w-[300px] h-[400px] rounded-xl bg-surface-2 animate-shimmer shrink-0" />
          <div className="flex-1 space-y-4 pt-32">
            <div className="h-12 w-1/3 bg-surface-2 animate-shimmer rounded-lg" />
            <div className="h-6 w-1/4 bg-surface-2 animate-shimmer rounded-md" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !company) {
    return (
      <div className="min-h-screen bg-bg pt-20 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">{error || 'Company not found'}</p>
          <button
            onClick={() => navigate('/companies')}
            className="text-brand font-bold hover:underline tracking-widest uppercase text-[10px]"
          >
            Back to Companies
          </button>
        </div>
      </div>
    )
  }

  const hasDetails = company.founded_year || company.company_type || company.headquarters || company.focus || company.years_active || company.employees || company.languages;
  const youtubeUrl = company.youtube_url || company.channels?.[0]?.channel_url;

  return (
    <div className="min-h-screen bg-bg font-sans pb-20">
      
      {/* Hero Section */}
      <div className="bg-surface-2/10 border-b border-border relative overflow-hidden">
        {/* Background Grid */}
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto border-x border-border relative z-10 pt-32 pb-16 px-4 md:px-8 flex flex-col lg:flex-row gap-12 items-start justify-between">
          
          {/* Left: Logo & Core Info */}
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
            <div className="shrink-0">
              <div className="w-48 h-48 md:w-56 md:h-56 rounded-full overflow-hidden border border-brand/30 bg-black/40 flex items-center justify-center p-6 shadow-2xl relative">
                {company.logo_url ? (
                  <img src={company.logo_url} alt={toTitleCase(company.name)} className="max-w-full max-h-full object-contain" />
                ) : (
                  <span className="text-6xl font-heading font-bold text-brand">{toTitleCase(company.name).charAt(0)}</span>
                )}
                {/* Glow behind logo */}
                <div className="absolute inset-0 bg-brand/10 blur-2xl -z-10 mix-blend-screen" />
              </div>
            </div>

            <div className="space-y-4 max-w-xl pt-4">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                <h1 className="text-4xl md:text-5xl font-heading font-bold text-white tracking-tight">
                  {toTitleCase(company.name)}
                </h1>
                <Icon icon="solar:verified-check-bold" className="text-brand text-2xl shrink-0" />
              </div>
              
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-text-muted text-sm font-medium">
                {company.company_type && <span>{toTitleCase(company.company_type)}</span>}
                {company.company_type && company.headquarters && <span className="w-1 h-1 rounded-full bg-border" />}
                {company.headquarters && (
                  <span className="flex items-center gap-1">
                    <Icon icon="solar:map-point-linear" className="text-lg" />
                    {toTitleCase(company.headquarters)}
                  </span>
                )}
              </div>

              {company.description && (
                <div className="pt-2 text-left">
                  <Description text={toSentenceCase(company.description)} />
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-4">
                {company.website && (
                  <a href={company.website} target="_blank" rel="noopener noreferrer" className="bg-brand text-bg font-bold text-xs px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-brand/90 transition-colors">
                    <Icon icon="solar:global-linear" className="text-lg" />
                    Visit Website
                  </a>
                )}

                <ShareAction title={toTitleCase(company.name)} text={`Check out ${toTitleCase(company.name)} on MuviDB`} className="!w-auto !bg-transparent border border-border !px-4 !rounded-lg" />
              </div>
            </div>
          </div>

          {/* Right: Quick Info Panel */}
          {hasDetails && (
            <div className="w-full lg:w-80 shrink-0 bg-surface/50 border border-border/50 rounded-2xl p-6 backdrop-blur-sm space-y-6">
              {company.founded_year && (
                <div>
                  <div className="flex items-center gap-2 text-text-muted text-xs font-bold uppercase tracking-wider mb-1">
                    <Icon icon="solar:calendar-bold" className="text-brand text-base" /> Founded
                  </div>
                  <p className="text-white text-sm font-medium">{company.founded_year}</p>
                </div>
              )}
              {company.company_type && (
                <div>
                  <div className="flex items-center gap-2 text-text-muted text-xs font-bold uppercase tracking-wider mb-1">
                    <Icon icon="solar:buildings-bold" className="text-brand text-base" /> Company Type
                  </div>
                  <p className="text-white text-sm font-medium">{company.company_type}</p>
                </div>
              )}
              {company.headquarters && (
                <div>
                  <div className="flex items-center gap-2 text-text-muted text-xs font-bold uppercase tracking-wider mb-1">
                    <Icon icon="solar:map-point-bold" className="text-brand text-base" /> Headquarters
                  </div>
                  <p className="text-white text-sm font-medium flex items-center gap-2">
                    {company.headquarters}
                  </p>
                </div>
              )}
              {company.focus && (
                <div>
                  <div className="flex items-center gap-2 text-text-muted text-xs font-bold uppercase tracking-wider mb-1">
                    <Icon icon="solar:target-bold" className="text-brand text-base" /> Focus
                  </div>
                  <p className="text-white text-sm font-medium leading-relaxed">{company.focus}</p>
                </div>
              )}
              {/* Optional static field matching mockup */}
              <div>
                <div className="flex items-center gap-2 text-text-muted text-xs font-bold uppercase tracking-wider mb-1">
                  <Icon icon="solar:star-bold" className="text-brand text-base" /> Known For
                </div>
                <p className="text-white text-sm font-medium leading-relaxed">
                  Emotional storytelling, strong characters, high production quality
                </p>
              </div>
            </div>
          )}

        </div>
      </div>

      <div className="max-w-7xl mx-auto border-x border-border px-4 md:px-8 py-12 space-y-16">
        
        {/* Top Films */}
        {topFilms.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-heading font-bold text-white tracking-tight">Top Films</h2>
              <Link to="#" className="text-xs font-bold text-brand hover:underline flex items-center gap-1">
                View all <Icon icon="solar:alt-arrow-right-linear" />
              </Link>
            </div>
            <div className="flex overflow-x-auto gap-4 pb-4 no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
              {topFilms.map(film => (
                <div key={film.id} className="w-[140px] md:w-[160px] shrink-0">
                  <FilmCard film={film} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent Releases */}
        {recentReleases.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-heading font-bold text-white tracking-tight">Recent Releases</h2>
              <Link to="#" className="text-xs font-bold text-brand hover:underline flex items-center gap-1">
                View all <Icon icon="solar:alt-arrow-right-linear" />
              </Link>
            </div>
            <div className="flex overflow-x-auto gap-4 pb-4 no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
              {recentReleases.map(film => (
                <div key={film.id} className="w-[140px] md:w-[160px] shrink-0">
                  <FilmCard film={film} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Associated People */}
        {associatedPeople.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-heading font-bold text-white tracking-tight">Associated People</h2>
              <Link to="#" className="text-xs font-bold text-brand hover:underline flex items-center gap-1">
                View all <Icon icon="solar:alt-arrow-right-linear" />
              </Link>
            </div>
            <div className="flex overflow-x-auto gap-6 pb-4 no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
              {associatedPeople.map(person => (
                <PersonCard key={person.id} person={person} role={person.displayRole} />
              ))}
            </div>
          </section>
        )}

        {/* Production Partners */}
        {productionPartners.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-heading font-bold text-white tracking-tight">Production Partners</h2>
              <Link to="#" className="text-xs font-bold text-brand hover:underline flex items-center gap-1">
                View all <Icon icon="solar:alt-arrow-right-linear" />
              </Link>
            </div>
            <div className="flex overflow-x-auto gap-6 pb-4 no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
              {productionPartners.map(partner => (
                <PartnerCard key={partner.id} company={partner} />
              ))}
            </div>
          </section>
        )}

        {/* Bottom Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 pt-8 border-t border-border/50">
          
          {/* Official Links */}
          <div>
            <h3 className="text-lg font-heading font-bold text-white mb-6">Official Links</h3>
            <div className="space-y-4">
              {company.website && (
                <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between group">
                  <div className="flex items-center gap-3 text-text-primary group-hover:text-brand transition-colors">
                    <Icon icon="mdi:web" className="text-xl text-text-muted group-hover:text-brand transition-colors" />
                    <span className="text-sm font-medium">Website</span>
                  </div>
                  <Icon icon="solar:arrow-right-up-linear" className="text-text-muted group-hover:text-brand transition-colors" />
                </a>
              )}
              {company.instagram_url && (
                <a href={company.instagram_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between group">
                  <div className="flex items-center gap-3 text-text-primary group-hover:text-brand transition-colors">
                    <Icon icon="mdi:instagram" className="text-xl text-text-muted group-hover:text-brand transition-colors" />
                    <span className="text-sm font-medium">Instagram</span>
                  </div>
                  <Icon icon="solar:arrow-right-up-linear" className="text-text-muted group-hover:text-brand transition-colors" />
                </a>
              )}
              {company.twitter_url && (
                <a href={company.twitter_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between group">
                  <div className="flex items-center gap-3 text-text-primary group-hover:text-brand transition-colors">
                    <Icon icon="mdi:twitter" className="text-xl text-text-muted group-hover:text-brand transition-colors" />
                    <span className="text-sm font-medium">X (Twitter)</span>
                  </div>
                  <Icon icon="solar:arrow-right-up-linear" className="text-text-muted group-hover:text-brand transition-colors" />
                </a>
              )}
              {youtubeUrl && (
                <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between group">
                  <div className="flex items-center gap-3 text-text-primary group-hover:text-brand transition-colors">
                    <Icon icon="mdi:youtube" className="text-xl text-text-muted group-hover:text-brand transition-colors" />
                    <span className="text-sm font-medium">YouTube</span>
                  </div>
                  <Icon icon="solar:arrow-right-up-linear" className="text-text-muted group-hover:text-brand transition-colors" />
                </a>
              )}
            </div>
          </div>

          {/* About */}
          <div className="md:col-span-1">
            <h3 className="text-lg font-heading font-bold text-white mb-6">About {toTitleCase(company.name)}</h3>
            {company.description ? (
              <div className="text-sm text-text-muted leading-relaxed space-y-4">
                <p>{toSentenceCase(company.description)}</p>
                <p>We believe in nurturing talent, elevating industry standards and building timeless stories for generations to come.</p>
              </div>
            ) : (
              <p className="text-sm text-text-muted italic">No description available.</p>
            )}
          </div>

          {/* Company Details Table */}
          {hasDetails && (
            <div>
              <h3 className="text-lg font-heading font-bold text-white mb-6">Company Details</h3>
              <div className="space-y-3 text-sm">
                {company.founded_year && (
                  <div className="flex gap-4">
                    <span className="text-text-muted w-32 shrink-0">&middot; Founded</span>
                    <span className="text-white font-medium">{company.founded_year}</span>
                  </div>
                )}
                {company.company_type && (
                  <div className="flex gap-4">
                    <span className="text-text-muted w-32 shrink-0">&middot; Company Type</span>
                    <span className="text-white font-medium">{toTitleCase(company.company_type)}</span>
                  </div>
                )}
                {company.headquarters && (
                  <div className="flex gap-4">
                    <span className="text-text-muted w-32 shrink-0">&middot; Headquarters</span>
                    <span className="text-white font-medium">{toTitleCase(company.headquarters)}</span>
                  </div>
                )}
                {company.focus && (
                  <div className="flex gap-4">
                    <span className="text-text-muted w-32 shrink-0">&middot; Focus</span>
                    <span className="text-white font-medium">{toSentenceCase(company.focus)}</span>
                  </div>
                )}
                {company.years_active && (
                  <div className="flex gap-4">
                    <span className="text-text-muted w-32 shrink-0">&middot; Years Active</span>
                    <span className="text-white font-medium">{company.years_active}</span>
                  </div>
                )}
                {company.employees && (
                  <div className="flex gap-4">
                    <span className="text-text-muted w-32 shrink-0">&middot; Employees</span>
                    <span className="text-white font-medium">{company.employees}</span>
                  </div>
                )}
                {company.languages && (
                  <div className="flex gap-4">
                    <span className="text-text-muted w-32 shrink-0">&middot; Languages</span>
                    <span className="text-white font-medium">{company.languages}</span>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export default CompanyDetail