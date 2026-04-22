import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const CompanyCard = ({ company, filmCount }) => {
  const initial = company.name?.charAt(0)

  return (
    <Link
      to={`/companies/${company.id}`}
      className="group block bg-surface rounded-2xl overflow-hidden border border-border hover:border-brand/40 transition-all hover:shadow-lg hover:shadow-brand/5"
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Logo */}
          <div className="flex-shrink-0">
            {company.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.name}
                className="w-16 h-16 rounded-xl object-contain bg-white p-1"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-surface-2 flex items-center justify-center text-2xl font-bold text-brand">
                {initial}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-text-primary font-bold text-base group-hover:text-brand transition-colors">
              {company.name}
            </h3>
            {company.founded_year && (
              <p className="text-text-muted text-xs mt-1">
                Est. {company.founded_year}
              </p>
            )}
            {company.description && (
              <p className="text-text-muted text-sm mt-2 line-clamp-2">
                {company.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-surface-2/50 border-t border-border flex items-center justify-between">
        <span className="text-text-muted text-xs">
          🎬 {filmCount} film{filmCount !== 1 ? 's' : ''}
        </span>
        {company.website && (
          <span className="text-brand text-xs">
            Visit ↗
          </span>
        )}
      </div>
    </Link>
  )
}

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
      // Calculate film counts
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
    <div className="min-h-screen bg-bg pt-20">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Production Companies
          </h1>
          <p className="text-text-muted">
            The studios and companies behind Nollywood
          </p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search companies..."
            className="w-full md:w-80 bg-surface border border-border text-text-primary rounded-xl px-4 py-2.5 text-sm focus:border-brand focus:outline-none placeholder-text-muted"
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div
                key={i}
                className="bg-surface border border-border rounded-2xl h-40 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🏢</div>
            <h3 className="text-text-primary text-xl font-bold mb-2">
              No companies found
            </h3>
            <p className="text-text-muted">
              Try a different search term
            </p>
          </div>
        )}

        {/* Grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
  )
}

export default Companies