import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Extract chain name from the cinema's display name
function extractChain(name = '') {
  const chains = ['Filmhouse', 'Genesis', 'Silverbird', 'Ozone', 'Blu Star', 'Kada', 'Viva']
  return chains.find(c => name.toLowerCase().includes(c.toLowerCase())) || null
}

const chainStyles = {
  Filmhouse:  'bg-brand/20 text-brand',
  Genesis:    'bg-blue-500/20 text-blue-400',
  Silverbird: 'bg-purple-500/20 text-purple-400',
  Ozone:      'bg-green-500/20 text-green-400',
  'Blu Star': 'bg-orange-500/20 text-orange-400',
  Kada:       'bg-teal-500/20 text-teal-400',
  Viva:       'bg-pink-500/20 text-pink-400',
}

const CinemaCard = ({ cinema, showCount }) => {
  const chain = extractChain(cinema.name)
  const initials = cinema.name?.charAt(0) || '?'

  return (
    <Link
      to={`/cinemas/${cinema.id}`}
      className="group block bg-surface rounded-2xl overflow-hidden border border-border hover:border-brand/40 transition-all hover:shadow-lg hover:shadow-brand/5"
    >
      {/* Top section */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Logo / initials */}
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold flex-shrink-0 ${
            chainStyles[chain] || 'bg-surface-2 text-text-muted'
          }`}>
            {initials}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-text-primary font-bold text-base group-hover:text-brand transition-colors line-clamp-1">
              {cinema.name}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {chain && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${chainStyles[chain] || 'bg-surface-2 text-text-muted'}`}>
                  {chain}
                </span>
              )}
              {!cinema.is_active && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400">
                  Closed
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Location */}
        {(cinema.address || cinema.city) && (
          <p className="text-text-muted text-sm mt-3 line-clamp-1">
            📍 {[cinema.address, cinema.city].filter(Boolean).join(', ')}
          </p>
        )}

        {/* Now showing badge */}
        {showCount > 0 && (
          <p className="text-brand text-xs font-medium mt-2">
            🎬 {showCount} film{showCount !== 1 ? 's' : ''} showing now
          </p>
        )}
      </div>

      {/* Bottom bar */}
      <div className="px-5 py-3 bg-surface-2/50 border-t border-border flex items-center justify-between">
        <span className="text-text-muted text-xs truncate">
          {cinema.city || '—'}
        </span>
        <div className="flex items-center gap-3 flex-shrink-0">
          {cinema.booking_url && (
            <span className="text-brand text-xs">🎟 Book</span>
          )}
          <span className="text-text-muted text-xs group-hover:text-brand transition-colors">
            View →
          </span>
        </div>
      </div>
    </Link>
  )
}

const Cinemas = () => {
  const [cinemas, setCinemas] = useState([])
  const [showCounts, setShowCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedCity, setSelectedCity] = useState('All')
  const [selectedChain, setSelectedChain] = useState('All')
  const [search, setSearch] = useState('')

  const CHAINS = ['All', 'Filmhouse', 'Genesis', 'Silverbird', 'Ozone', 'Blu Star', 'Kada', 'Viva']

  useEffect(() => {
    document.title = 'Lumi | Cinemas'
    fetchCinemas()
  }, [])

  const fetchCinemas = async () => {
    setLoading(true)

    const { data } = await supabase
      .from('cinemas')
      .select('id, name, city, address, state, is_active, booking_url')
      .eq('is_active', true)
      .order('city')
      .order('name')

    setCinemas(data || [])

    // Fetch showtime counts
    if (data?.length) {
      const today = new Date().toISOString().split('T')[0]
      const { data: showtimes } = await supabase
        .from('showtimes')
        .select('cinema_id, film_id')
        .gte('show_date', today)

      if (showtimes) {
        const counts = {}
        showtimes.forEach(s => {
          if (!counts[s.cinema_id]) counts[s.cinema_id] = new Set()
          counts[s.cinema_id].add(s.film_id)
        })
        Object.keys(counts).forEach(cid => { counts[cid] = counts[cid].size })
        setShowCounts(counts)
      }
    }

    setLoading(false)
  }

  // Derive unique cities for filter dropdown
  const cities = ['All', ...Array.from(new Set(cinemas.map(c => c.city).filter(Boolean))).sort()]

  // Filter
  const filtered = cinemas.filter(c => {
    const chain = extractChain(c.name)
    const matchCity  = selectedCity  === 'All' || c.city === selectedCity
    const matchChain = selectedChain === 'All' || chain  === selectedChain
    const matchSearch = !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.city?.toLowerCase().includes(search.toLowerCase()) ||
      c.address?.toLowerCase().includes(search.toLowerCase())
    return matchCity && matchChain && matchSearch
  })

  // Group by city
  const groupedByCity = filtered.reduce((acc, cinema) => {
    const city = cinema.city || 'Other'
    if (!acc[city]) acc[city] = []
    acc[city].push(cinema)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-bg pt-20">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Cinemas</h1>
          <p className="text-text-muted">Find Nollywood films showing near you</p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search cinemas…"
            className="bg-surface border border-border text-text-primary rounded-xl px-4 py-2.5 text-sm focus:border-brand focus:outline-none placeholder-text-muted"
          />
          <select
            value={selectedCity}
            onChange={e => setSelectedCity(e.target.value)}
            className="bg-surface border border-border text-text-primary rounded-xl px-4 py-2.5 text-sm focus:border-brand focus:outline-none"
          >
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={selectedChain}
            onChange={e => setSelectedChain(e.target.value)}
            className="bg-surface border border-border text-text-primary rounded-xl px-4 py-2.5 text-sm focus:border-brand focus:outline-none"
          >
            {CHAINS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-surface border border-border rounded-2xl h-44 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎭</div>
            <h3 className="text-text-primary text-xl font-bold mb-2">No cinemas found</h3>
            <p className="text-text-muted">Try adjusting your filters</p>
          </div>
        )}

        {/* Grouped list */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-10">
            {Object.entries(groupedByCity).map(([city, cityCinemas]) => (
              <div key={city}>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-text-primary text-xl font-bold">{city}</h2>
                  <span className="text-text-muted text-sm">
                    {cityCinemas.length} cinema{cityCinemas.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cityCinemas.map(cinema => (
                    <CinemaCard
                      key={cinema.id}
                      cinema={cinema}
                      showCount={showCounts[cinema.id] || 0}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Cinemas
