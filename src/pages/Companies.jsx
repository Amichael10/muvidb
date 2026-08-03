import { useMemo, useState, useEffect, useRef } from 'react'
import { Link, useLoaderData } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/ui/PageHeader'
import { Icon } from '@iconify/react'
import { toTitleCase, toSentenceCase } from '../utils/format'
import ImageWithFallback from '../components/ui/ImageWithFallback'
import { getCompanyLogoStrict } from '../lib/companyImages'

const CompanyCard = ({ company, filmCount }) => {
  const hasLogo = Boolean(getCompanyLogoStrict(company))

  return (
    <Link
      to={`/companies/${company.id}`}
      className="group block bg-surface rounded-xl overflow-hidden border border-border hover:border-brand transition-all shadow-sm"
    >
      <div className="p-6">
        <div className="flex items-start gap-5">
          <div className="flex-shrink-0">
            <div className={`w-16 h-16 rounded-xl border border-border flex items-center justify-center overflow-hidden ${hasLogo ? 'bg-white p-2' : 'bg-black'}`}>
              <ImageWithFallback
                src={company.logo_url}
                alt={toTitleCase(company.name)}
                fallbackType="company"
                name={toTitleCase(company.name)}
                className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                width={128}
                sizes="64px"
                loading="lazy"
              />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-text-primary font-bold text-sm tracking-tight group-hover:text-brand transition-colors line-clamp-1 leading-tight">
              {toTitleCase(company.name)}
            </h3>
            {company.founded_year && (
              <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mt-1 opacity-60">
                Est. {company.founded_year}
              </p>
            )}
            {company.company_type && (
              <p className="text-brand text-[10px] font-bold capitalize mt-1">
                {company.company_type}
              </p>
            )}
            {company.description && (
              <p className="text-text-muted text-[11px] mt-3 line-clamp-2 leading-relaxed opacity-80">
                {toSentenceCase(company.description)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-4 bg-surface-2/30 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon icon="solar:clapperboard-play-linear" className="text-text-muted" width="14" />
          <span className="text-text-muted text-[9px] font-black uppercase tracking-widest">
            {filmCount} films
          </span>
        </div>
        {company.website && (
          <a
            href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-brand text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:underline"
          >
            Website
            <Icon icon="solar:arrow-right-up-linear" width="12" />
          </a>
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
  const loaderData = useLoaderData()
  const seeded = !!loaderData?.seeded && (loaderData.companies?.length ?? 0) > 0
  const [companies, setCompanies] = useState(loaderData?.companies ?? [])
  const [filmCounts, setFilmCounts] = useState(loaderData?.filmCounts ?? {})
  const [loading, setLoading] = useState(!seeded)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [catalogFilter, setCatalogFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false)
  const skipInitialFetch = useRef(seeded)

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false
      return
    }
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

  const typeOptions = useMemo(() => {
    const set = new Set()
    companies.forEach((c) => {
      if (c.company_type) set.add(String(c.company_type).toLowerCase())
    })
    return [...set].sort()
  }, [companies])

  const filtered = useMemo(() => {
    let list = companies.filter((c) => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false

      const type = (c.company_type || '').toLowerCase()
      if (typeFilter === 'unspecified') {
        if (type) return false
      } else if (typeFilter !== 'all' && type !== typeFilter) {
        return false
      }

      const count = filmCounts[c.id] || 0
      if (catalogFilter === 'with_films' && count < 1) return false
      if (catalogFilter === 'with_logo' && !c.logo_url) return false
      if (catalogFilter === 'with_website' && !c.website) return false
      if (catalogFilter === 'founded' && !c.founded_year) return false

      return true
    })

    list = [...list].sort((a, b) => {
      if (sortBy === 'films') {
        return (filmCounts[b.id] || 0) - (filmCounts[a.id] || 0)
      }
      if (sortBy === 'founded') {
        return (b.founded_year || 0) - (a.founded_year || 0)
      }
      return String(a.name || '').localeCompare(String(b.name || ''))
    })

    return list
  }, [companies, filmCounts, search, typeFilter, catalogFilter, sortBy])

  const clearFilters = () => {
    setSearch('')
    setTypeFilter('all')
    setCatalogFilter('all')
    setSortBy('name')
  }

  return (
    <div className="min-h-screen bg-bg">
      <PageHeader
        icon="solar:buildings-2-bold"
        eyebrow="Industry"
        title="Companies"
        description="The creative engines and production powerhouses driving African storytelling through cinema."
        count={filtered.length}
        countLabel={filtered.length === 1 ? 'studio in view' : 'studios in view'}
        actions={
          <button
            className="md:hidden flex items-center justify-center gap-2 bg-surface border border-border px-6 py-3 rounded-lg text-xs font-bold text-text-primary"
            onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
          >
            <Icon icon="solar:filter-linear" width="16" />
            Filters
          </button>
        }
      />

      <div className="max-w-7xl mx-auto border-x border-border min-h-[600px] pb-20">
        <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border">
          <aside
            className={`md:w-72 shrink-0 p-8 space-y-8 bg-surface-2/5 ${
              isMobileFiltersOpen ? 'block' : 'hidden md:block'
            }`}
          >
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="font-heading font-bold text-sm text-text-primary">Filters</h3>
              <button
                type="button"
                onClick={clearFilters}
                className="text-[9px] font-bold text-brand hover:underline"
              >
                Clear
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-text-muted text-[10px] tracking-wider">Search</h4>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Studio name…"
                className="w-full bg-surface border border-border text-text-primary rounded-lg px-4 py-3 text-xs font-medium outline-none focus:border-brand transition-all"
              />
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-text-muted text-[10px] tracking-wider">Sort by</h4>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full bg-surface border border-border text-text-primary rounded-lg p-3 text-[10px] font-bold tracking-wider outline-none focus:border-brand"
              >
                <option value="name">Name A–Z</option>
                <option value="films">Most films</option>
                <option value="founded">Newest founded</option>
              </select>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-text-muted text-[10px] tracking-wider">Type</h4>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full bg-surface border border-border text-text-primary rounded-lg p-3 text-[10px] font-bold tracking-wider outline-none focus:border-brand capitalize"
              >
                <option value="all">All types</option>
                {typeOptions.map((t) => (
                  <option key={t} value={t} className="capitalize">{t}</option>
                ))}
                <option value="unspecified">Unspecified</option>
              </select>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-text-muted text-[10px] tracking-wider">Catalogue</h4>
              <div className="space-y-2">
                {[
                  { id: 'all', label: 'All studios' },
                  { id: 'with_films', label: 'Linked to films' },
                  { id: 'with_logo', label: 'Has logo' },
                  { id: 'with_website', label: 'Has website' },
                  { id: 'founded', label: 'Has founded year' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCatalogFilter(opt.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs font-bold transition-all ${
                      catalogFilter === opt.id
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-border bg-surface text-text-muted hover:border-brand/40 hover:text-text-primary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="flex-1 p-8 md:p-12">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <CompanySkeleton key={i} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-32 bg-surface-2/10 rounded-xl border-2 border-dashed border-border">
                <Icon icon="solar:buildings-linear" className="text-4xl mx-auto mb-4 opacity-20 text-brand" />
                <h3 className="text-text-muted font-bold text-sm">No studios match these filters</h3>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 text-xs font-bold text-brand hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((company) => (
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
    </div>
  )
}

export default Companies;
