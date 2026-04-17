import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const chainColors = {
  Filmhouse: 'bg-[#D4A017]/20 text-[#D4A017]',
  Genesis: 'bg-blue-900/40 text-blue-400',
  Silverbird: 'bg-purple-900/40 text-purple-400',
  Ozone: 'bg-green-900/40 text-green-400',
  'Blu Star': 'bg-orange-900/40 text-orange-400',
  Kada: 'bg-teal-900/40 text-teal-400'
}

const CinemaCard = ({ cinema, showCount }) => {
  const initials = cinema.chain?.charAt(0) ||
    cinema.name?.charAt(0)

  return (
    <Link
      to={`/cinemas/${cinema.id}`}
      className="group block bg-[#13192B] rounded-2xl overflow-hidden border border-[#252D45] hover:border-[#D4A017]/40 transition-all hover:shadow-lg hover:shadow-[#D4A017]/5"
    >
      {/* Top section */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Logo */}
          <div className="flex-shrink-0">
            {cinema.logo_url ? (
              <img
                src={cinema.logo_url}
                alt={cinema.name}
                className="w-14 h-14 rounded-xl object-contain bg-white p-1"
              />
            ) : (
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold ${
                chainColors[cinema.chain]?.includes('D4A017')
                  ? 'bg-[#D4A017]/20 text-[#D4A017]'
                  : chainColors[cinema.chain]?.includes('blue')
                  ? 'bg-blue-900/40 text-blue-400'
                  : chainColors[cinema.chain]?.includes('purple')
                  ? 'bg-purple-900/40 text-purple-400'
                  : 'bg-[#1C2440] text-[#7A8099]'
              }`}>
                {initials}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-[#F5F0E8] font-bold text-base group-hover:text-[#D4A017] transition-colors line-clamp-1">
              {cinema.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                chainColors[cinema.chain] ||
                'bg-[#252D45] text-[#7A8099]'
              }`}>
                {cinema.chain}
              </span>
            </div>
          </div>
        </div>

        {/* Address */}
        {cinema.address && (
          <p className="text-[#7A8099] text-sm mt-3 line-clamp-1">
            📍 {cinema.address}, {cinema.city}
          </p>
        )}

        {/* Meta */}
        <div className="flex items-center gap-4 mt-3">
          {cinema.screens_count && (
            <span className="text-[#7A8099] text-xs">
              🎬 {cinema.screens_count} screens
            </span>
          )}
          {cinema.seating_capacity && (
            <span className="text-[#7A8099] text-xs">
              💺 {cinema.seating_capacity.toLocaleString()} seats
            </span>
          )}
          {showCount > 0 && (
            <span className="text-[#D4A017] text-xs font-medium">
              {showCount} showing now
            </span>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="px-5 py-3 bg-[#0A0F1E]/50 border-t border-[#252D45] flex items-center justify-between">
        <span className="text-[#7A8099] text-xs">
          {cinema.city}, {cinema.state}
        </span>
        <div className="flex items-center gap-3">
          {cinema.google_maps_url && (
            <span className="text-[#D4A017] text-xs">
              📍 Directions
            </span>
          )}
          <span className="text-[#7A8099] text-xs group-hover:text-[#D4A017] transition-colors">
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

  const cities = ['All', 'Lagos', 'Abuja', 'Port Harcourt']
  const chains = [
    'All', 'Filmhouse', 'Genesis',
    'Silverbird', 'Ozone', 'Blu Star', 'Kada'
  ]

  useEffect(() => {
    fetchCinemas()
  }, [])

  const fetchCinemas = async () => {
    setLoading(true)

    const { data } = await supabase
      .from('cinemas')
      .select('*')
      .eq('is_active', true)
      .order('city')
      .order('name')

    setCinemas(data || [])

    // Fetch showtime counts for each cinema
    const today = new Date().toISOString().split('T')[0]
    const counts = {}

    if (data?.length > 0) {
      const { data: showtimes } = await supabase
        .from('showtimes')
        .select('cinema_id, film_id')
        .gte('show_date', today)

      if (showtimes) {
        showtimes.forEach(s => {
          if (!counts[s.cinema_id]) {
            counts[s.cinema_id] = new Set()
          }
          counts[s.cinema_id].add(s.film_id)
        })

        // Convert sets to counts
        Object.keys(counts).forEach(id => {
          counts[id] = counts[id].size
        })
      }
    }

    setShowCounts(counts)
    setLoading(false)
  }

  // Filter cinemas
  const filtered = cinemas.filter(c => {
    const matchCity = selectedCity === 'All' ||
      c.city === selectedCity
    const matchChain = selectedChain === 'All' ||
      c.chain === selectedChain
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.city.toLowerCase().includes(search.toLowerCase())
    return matchCity && matchChain && matchSearch
  })

  // Group by city
  const groupedByCity = filtered.reduce((acc, cinema) => {
    const city = cinema.city
    if (!acc[city]) acc[city] = []
    acc[city].push(cinema)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-[#0A0F1E] pt-20">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#F5F0E8] mb-2">
            Cinemas
          </h1>
          <p className="text-[#7A8099]">
            Find Nollywood films showing near you
          </p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search cinemas..."
            className="bg-[#13192B] border border-[#252D45] text-[#F5F0E8] rounded-xl px-4 py-2.5 text-sm focus:border-[#D4A017] focus:outline-none placeholder-[#7A8099]"
          />
          <select
            value={selectedCity}
            onChange={e => setSelectedCity(e.target.value)}
            className="bg-[#13192B] border border-[#252D45] text-[#F5F0E8] rounded-xl px-4 py-2.5 text-sm focus:border-[#D4A017] focus:outline-none"
          >
            {cities.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={selectedChain}
            onChange={e => setSelectedChain(e.target.value)}
            className="bg-[#13192B] border border-[#252D45] text-[#F5F0E8] rounded-xl px-4 py-2.5 text-sm focus:border-[#D4A017] focus:outline-none"
          >
            {chains.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div
                key={i}
                className="bg-[#13192B] rounded-2xl h-48 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎭</div>
            <h3 className="text-[#F5F0E8] text-xl font-bold mb-2">
              No cinemas found
            </h3>
            <p className="text-[#7A8099]">
              Try adjusting your filters
            </p>
          </div>
        )}

        {/* Cinemas grouped by city */}
        {!loading && (
          <div className="space-y-10">
            {Object.entries(groupedByCity).map(
              ([city, cityCinemas]) => (
                <div key={city}>
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-[#F5F0E8] text-xl font-bold">
                      {city}
                    </h2>
                    <span className="text-[#7A8099] text-sm">
                      {cityCinemas.length} cinema
                      {cityCinemas.length !== 1 ? 's' : ''}
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
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Cinemas