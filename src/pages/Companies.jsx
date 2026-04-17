import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const CompanyCard = ({ company, filmCount }) => {
  const initial = company.name?.charAt(0)

  return (
    <Link
      to={`/companies/${company.id}`}
      className="group block bg-[#13192B] rounded-2xl overflow-hidden border border-[#252D45] hover:border-[#D4A017]/40 transition-all hover:shadow-lg hover:shadow-[#D4A017]/5"
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
              <div className="w-16 h-16 rounded-xl bg-[#1C2440] flex items-center justify-center text-2xl font-bold text-[#D4A017]">
                {initial}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-[#F5F0E8] font-bold text-base group-hover:text-[#D4A017] transition-colors">
              {company.name}
            </h3>
            {company.founded_year && (
              <p className="text-[#7A8099] text-xs mt-1">
                Est. {company.founded_year}
              </p>
            )}
            {company.description && (
              <p className="text-[#7A8099] text-sm mt-2 line-clamp-2">
                {company.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-[#0A0F1E]/50 border-t border-[#252D45] flex items-center justify-between">
        <span className="text-[#7A8099] text-xs">
          🎬 {filmCount} film{filmCount !== 1 ? 's' : ''}
        </span>
        {company.website && (
          <span className="text-[#D4A017] text-xs">
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
    <div className="min-h-screen bg-[#0A0F1E] pt-20">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#F5F0E8] mb-2">
            Production Companies
          </h1>
          <p className="text-[#7A8099]">
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
            className="w-full md:w-80 bg-[#13192B] border border-[#252D45] text-[#F5F0E8] rounded-xl px-4 py-2.5 text-sm focus:border-[#D4A017] focus:outline-none placeholder-[#7A8099]"
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div
                key={i}
                className="bg-[#13192B] rounded-2xl h-40 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🏢</div>
            <h3 className="text-[#F5F0E8] text-xl font-bold mb-2">
              No companies found
            </h3>
            <p className="text-[#7A8099]">
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