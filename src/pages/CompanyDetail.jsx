import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatViewCount } from '../utils/youtube'
import { Icon } from '@iconify/react'

const FilmCard = ({ film }) => (
  <Link
    to={`/films/${film.id}`}
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
          {film.title}
        </p>
        <p className="text-[#7A8099] text-xs mt-0.5">
          {film.year}
        </p>
      </div>
    </div>
  </Link>
)

const Description = ({ text }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = text.length > 280;
  const displayText = isExpanded ? text : text.slice(0, 280) + (isLong ? '...' : '');

  return (
    <div className="space-y-4">
      <p className="text-text-muted text-sm leading-relaxed max-w-2xl italic border-l-2 border-border pl-6">
        {displayText}
      </p>
      {isLong && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-brand text-[10px] font-bold hover:underline ml-7 transition-all"
        >
          {isExpanded ? 'Read less' : 'Read full description'}
        </button>
      )}
    </div>
  );
};

const CompanyDetail = () => {

  const { id } = useParams()
  const navigate = useNavigate()
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('production')

  useEffect(() => {
    fetchCompany()
  }, [id])

  const fetchCompany = async () => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('companies')
      .select(`
        *,
        film_companies(
          role,
          films(
            id, title, year, poster_url,
            view_count, average_rating,
            film_genres(genres(name))
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      setError('Company not found')
      setLoading(false)
      return
    }

    setCompany(data)
    setLoading(false)
  }

  const productionFilms = company?.film_companies
    ?.filter(fc => fc.role === 'production')
    ?.map(fc => fc.films)
    ?.filter(Boolean) || []

  const distributionFilms = company?.film_companies
    ?.filter(fc => fc.role === 'distribution')
    ?.map(fc => fc.films)
    ?.filter(Boolean) || []

  const totalViews = company?.film_companies
    ?.reduce((sum, fc) => sum + (fc.films?.view_count || 0), 0) || 0

  const totalFilms = company?.film_companies?.length || 0

  const availableTabs = [
    productionFilms.length > 0 && 'production',
    distributionFilms.length > 0 && 'distribution'
  ].filter(Boolean)

  if (loading) {
    return (
      <div className="w-full bg-bg min-h-screen">
        <div className="bg-surface-2/10 border-b border-border relative overflow-hidden">
          <div className="absolute inset-0 bg-surface-2 animate-shimmer opacity-20" />
          <div className="max-w-7xl mx-auto px-4 py-12 pt-24 border-x border-border flex flex-col md:flex-row gap-10 items-center md:items-start">
            <div className="w-32 h-32 rounded-xl bg-surface-2 animate-shimmer shrink-0 shadow-2xl border border-border" />
            <div className="flex-1 space-y-6 w-full">
              <div className="space-y-3">
                <div className="h-10 w-64 bg-surface-2 rounded-lg animate-shimmer" />
                <div className="h-4 w-32 bg-surface-2 rounded-md animate-shimmer opacity-60" />
              </div>
              <div className="h-16 w-full max-w-2xl bg-surface-2 rounded-lg animate-shimmer opacity-40" />
              <div className="h-20 w-64 bg-surface-2 rounded-xl animate-shimmer border border-border" />
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto border-x border-border min-h-[400px]">
          <div className="p-8 md:p-12 border-b border-border bg-surface-2/5">
            <div className="h-8 w-32 bg-surface-2 rounded-md animate-shimmer" />
          </div>
          <div className="p-8 md:p-12">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="space-y-3">
                  <div className="aspect-[2/3] bg-surface-2 rounded-xl animate-shimmer border border-border" />
                  <div className="h-3 w-3/4 bg-surface-2 rounded animate-shimmer" />
                  <div className="h-2 w-1/4 bg-surface-2 rounded animate-shimmer opacity-60" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !company) {
    return (
      <div className="min-h-screen bg-[#0A0F1E] pt-20 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">
            {error || 'Company not found'}
          </p>
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

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="bg-surface-2/10 border-b border-border relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 py-12 pt-24 border-x border-border relative z-10">
          <div className="flex flex-col md:flex-row gap-10 items-center md:items-start text-center md:text-left">

            {/* Logo */}
            <div className="flex-shrink-0 relative">
              <div className="absolute -inset-1 bg-brand/20 blur-xl rounded-full"></div>
              {company.logo_url ? (
                <img
                  src={company.logo_url}
                  alt={company.name}
                  className="relative w-32 h-32 rounded-xl object-contain bg-white p-4 shadow-2xl border border-border"
                />
              ) : (
                <div className="relative w-32 h-32 rounded-xl bg-surface flex items-center justify-center text-4xl font-heading font-bold text-brand shadow-2xl border border-border">
                  {company.name?.charAt(0)}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 space-y-6">
              <div>
                <div className="flex items-center gap-3 flex-wrap justify-center md:justify-start mb-2">
                  <h1 className="text-3xl md:text-5xl font-heading font-bold text-text-primary tracking-tighter">
                    {company.name}
                  </h1>
                  {company.founded_year && (
                    <span className="bg-surface-2 text-text-muted text-[10px] font-bold px-3 py-1 rounded-lg border border-border">
                      Est. {company.founded_year}
                    </span>
                  )}
                </div>
                
                <p className="text-text-muted text-[10px] font-bold tracking-wider flex items-center justify-center md:justify-start gap-2">
                  <span className="text-brand">Verified Studio</span>
                </p>
              </div>

              {company.description && (
                <Description text={company.description} />
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-0 border border-border rounded-lg overflow-hidden bg-surface max-w-sm mx-auto md:mx-0 shadow-sm">
                <div className="p-4 border-r border-border text-center">
                  <p className="text-brand text-xl font-bold font-heading">
                    {totalFilms}
                  </p>
                  <p className="text-text-muted text-[9px] font-bold">Movies</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-text-primary text-xl font-bold font-heading">
                    {formatViewCount(totalViews)}
                  </p>
                  <p className="text-text-muted text-[9px] font-bold">Total Views</p>
                </div>
              </div>

              {/* Website */}
              {company.website && (
                <div className="flex justify-center md:justify-start pt-2">
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-brand text-white text-xs font-bold px-8 py-4 rounded-lg hover:shadow-brand/20 hover:scale-[1.02] transition-all min-h-[44px]"
                  >
                    Visit Website
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Films Section */}
      <div className="max-w-7xl mx-auto border-x border-border pb-20 min-h-[400px]">
        {/* Section Header */}
        <div className="p-8 md:p-12 border-b border-border bg-surface-2/5 relative overflow-hidden">
           <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none"></div>
           <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <h2 className="text-text-primary text-2xl font-bold font-heading tracking-tighter">
                Credits
              </h2>

              {/* Tabs */}
              {availableTabs.length > 1 && (
                <div className="flex bg-surface p-1 rounded-lg border border-border w-fit overflow-x-auto no-scrollbar">
                  {availableTabs.map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-6 py-2 rounded-md text-[10px] font-bold transition-all whitespace-nowrap ${
                        activeTab === tab
                          ? 'bg-brand text-white shadow-md'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {tab} ({tab === 'production' ? productionFilms.length : distributionFilms.length})
                    </button>
                  ))}
                </div>
              )}
           </div>
        </div>

        {/* Films grid */}
        <div className="p-8 md:p-12">
          {activeTab === 'production' && (
            <>
              {productionFilms.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                  {productionFilms.map(film => (
                    <FilmCard key={film.id} film={film} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-surface-2/10 rounded-xl border-2 border-dashed border-border">
                  <Icon icon="solar:clapperboard-play-linear" className="text-4xl mx-auto mb-4 opacity-20 text-brand" />
                  <p className="text-text-muted font-bold text-xs">No production credits available</p>
                </div>
              )}
            </>
          )}

          {activeTab === 'distribution' && (
            <>
              {distributionFilms.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                  {distributionFilms.map(film => (
                    <FilmCard key={film.id} film={film} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-surface-2/10 rounded-xl border-2 border-dashed border-border">
                  <Icon icon="solar:clapperboard-play-linear" className="text-4xl mx-auto mb-4 opacity-20 text-brand" />
                  <p className="text-text-muted font-bold text-xs">No distribution credits available</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default CompanyDetail