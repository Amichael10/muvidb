import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatViewCount } from '../utils/youtube'

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
          <span className="text-4xl">🎬</span>
        </div>
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

      {/* Rating */}
      {film.average_rating > 0 && (
        <div className="absolute top-2 right-2 bg-[#D4A017] text-black text-xs font-bold px-2 py-0.5 rounded-lg">
          {film.average_rating} ★
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
      <div className="min-h-screen bg-[#0A0F1E] pt-20">
        <div className="max-w-5xl mx-auto px-4 py-8 animate-pulse">
          <div className="flex gap-6 mb-8">
            <div className="w-24 h-24 bg-[#13192B] rounded-2xl" />
            <div className="flex-1 space-y-3">
              <div className="h-8 bg-[#13192B] rounded w-64" />
              <div className="h-4 bg-[#13192B] rounded w-48" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="aspect-[2/3] bg-[#13192B] rounded-xl"
              />
            ))}
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
            className="text-[#D4A017] hover:underline"
          >
            Back to Companies
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0F1E]">

      {/* Header */}
      <div className="bg-[#13192B] border-b border-[#252D45]">
        <div className="max-w-5xl mx-auto px-4 py-8 pt-24">
          <div className="flex items-start gap-6">

            {/* Logo */}
            <div className="flex-shrink-0">
              {company.logo_url ? (
                <img
                  src={company.logo_url}
                  alt={company.name}
                  className="w-24 h-24 rounded-2xl object-contain bg-white p-2"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-[#1C2440] flex items-center justify-center text-3xl font-bold text-[#D4A017]">
                  {company.name?.charAt(0)}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-[#F5F0E8] mb-1">
                {company.name}
              </h1>

              {company.founded_year && (
                <p className="text-[#7A8099] text-sm mb-3">
                  Est. {company.founded_year}
                </p>
              )}

              {company.description && (
                <p className="text-[#F5F0E8] text-sm leading-relaxed mb-4 max-w-2xl">
                  {company.description}
                </p>
              )}

              {/* Stats */}
              <div className="flex flex-wrap gap-6 mb-4">
                <div>
                  <p className="text-[#D4A017] text-2xl font-bold">
                    {totalFilms}
                  </p>
                  <p className="text-[#7A8099] text-xs">
                    Films
                  </p>
                </div>
                <div>
                  <p className="text-[#D4A017] text-2xl font-bold">
                    {formatViewCount(totalViews)}
                  </p>
                  <p className="text-[#7A8099] text-xs">
                    Total Views
                  </p>
                </div>
              </div>

              {/* Website */}
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#D4A017] text-black text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#D4A017]/90 transition-colors"
                >
                  Visit Website ↗
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Films Section */}
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Tabs */}
        {availableTabs.length > 1 && (
          <div className="flex gap-2 mb-6">
            {availableTabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-full text-sm font-medium capitalize transition-all ${
                  activeTab === tab
                    ? 'bg-[#D4A017] text-black'
                    : 'bg-[#13192B] text-[#7A8099] hover:text-[#F5F0E8]'
                }`}
              >
                {tab} ({
                  tab === 'production'
                    ? productionFilms.length
                    : distributionFilms.length
                })
              </button>
            ))}
          </div>
        )}

        {/* Films grid */}
        {activeTab === 'production' && (
          <>
            <h2 className="text-[#F5F0E8] text-xl font-bold mb-5">
              Productions
            </h2>
            {productionFilms.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {productionFilms.map(film => (
                  <FilmCard key={film.id} film={film} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-[#7A8099]">
                  No production credits yet
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === 'distribution' && (
          <>
            <h2 className="text-[#F5F0E8] text-xl font-bold mb-5">
              Distribution
            </h2>
            {distributionFilms.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {distributionFilms.map(film => (
                  <FilmCard key={film.id} film={film} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-[#7A8099]">
                  No distribution credits yet
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default CompanyDetail