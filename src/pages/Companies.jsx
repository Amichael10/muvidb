import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Skeleton } from '../components/ui/Skeleton'
import { Icon } from '@iconify/react'

const CompanyCard = ({ company, filmCount }) => {
  const initial = company.name?.charAt(0)

  return (
    <Link
      to={`/companies/${company.id}`}
      className="group block bg-surface rounded-xl overflow-hidden border border-border hover:border-brand transition-all shadow-sm"
    >
      <div className="p-6">
        <div className="flex items-start gap-5">
          <div className="flex-shrink-0">
            {company.logo_url ? (
              <div className="w-16 h-16 rounded-xl bg-white p-2 border border-border flex items-center justify-center overflow-hidden">
                <img
                    src={company.logo_url}
                    alt={company.name}
                    className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-xl bg-surface-2 flex items-center justify-center text-2xl font-bold text-brand font-heading border border-border">
                {initial}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-text-primary font-bold text-sm uppercase tracking-tight group-hover:text-brand transition-colors line-clamp-1 leading-tight">
              {company.name}
            </h3>
            {company.founded_year && (
              <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mt-1 opacity-60">
                EST. {company.founded_year}
              </p>
            )}
            {company.description && (
              <p className="text-text-muted text-[11px] mt-3 line-clamp-2 italic leading-relaxed opacity-80">
                {company.description}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-4 bg-surface-2/30 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon icon="solar:clapperboard-play-linear" className="text-text-muted" width="14" />
          <span className="text-text-muted text-[9px] font-black uppercase tracking-widest">
            {filmCount} FILMS PRODUCED
          </span>
        </div>
        {company.website && (
          <span className="text-brand text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
            WEBSITE
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </span>
        )}
      </div>
    </Link>
  )
}

const CompanySkeleton = () => (
    <div className="bg-surface rounded-xl overflow-hidden border border-border">
        <div className="p-6 space-y-6">
            <div className="flex gap-5">
                <div className="w-16 h-16 rounded-xl bg-surface-2 animate-shimmer shrink-0" />
                <div className="flex-1 space-y-3">
                    <div className="h-4 w-3/4 bg-surface-2 rounded-md animate-shimmer" />
                    <div className="h-3 w-1/4 bg-surface-2 rounded-md animate-shimmer opacity-60" />
                </div>
            </div>
            <div className="space-y-3">
                <div className="h-3 w-full bg-surface-2 rounded-md animate-shimmer opacity-40" />
                <div className="h-3 w-5/6 bg-surface-2 rounded-md animate-shimmer opacity-40" />
            </div>
        </div>
        <div className="px-6 py-4 bg-surface-2/30 border-t border-border">
            <div className="h-3 w-1/3 bg-surface-2 rounded-md animate-shimmer" />
        </div>
    </div>
)

const Companies = () => {
  const [companies, setCompanies] = useState([])
  const [filmCounts, setFilmCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchCompanies()
  }, [])

  const fetchCompanies = async () => {
    setLoading(true)

    const { data } = await supabase
      .from('companies')
      .select(`
        *,
        film_companies(film_id)
      `)
      .order('name')

    if (data) {
      const counts = {}
      data.forEach(company => {
        counts[company.id] = company.film_companies?.length || 0
      })
      setFilmCounts(counts)
      setCompanies(data)
    }

    setLoading(false)
  }

  const filtered = companies.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-bg">
      {/* Page Header */}
      <div className="bg-surface-2/10 border-b border-border relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 py-16 pt-32 border-x border-border relative z-10">
          <h1 className="text-4xl md:text-6xl font-heading font-bold text-text-primary mb-4 tracking-tighter uppercase italic">
            Nollywood Studios
          </h1>
          <p className="text-text-muted text-sm max-w-xl italic border-l-2 border-brand pl-6">
            The creative engines and production powerhouses driving the evolution of African storytelling through cinema.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto border-x border-border min-h-[600px] pb-20">
        {/* Search Section */}
        <div className="p-8 border-b border-border bg-surface-2/5">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="SEARCH STUDIO ARCHIVE..."
            className="w-full md:w-96 bg-surface border border-border text-text-primary rounded-lg px-6 py-4 text-[10px] font-black tracking-widest focus:border-brand focus:outline-none transition-all"
          />
        </div>

        {/* Content Section */}
        <div className="p-8 md:p-12">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => <CompanySkeleton key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-32 bg-surface-2/10 rounded-xl border-2 border-dashed border-border">
              <Icon icon="solar:buildings-linear" className="text-4xl mx-auto mb-4 opacity-20 text-brand" />
              <h3 className="text-text-muted font-black uppercase tracking-widest text-xs">No studios discovered in this search</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(company => (
                <CompanyCard
                  key={company.id}
                  company={company}
                  filmCount={filmCounts[company.id] || 0}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Companies;