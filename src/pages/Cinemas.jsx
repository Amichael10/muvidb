import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Skeleton } from '../components/ui/Skeleton'
import { Icon } from '@iconify/react'

// Extract chain name from the cinema's display name
function extractChain(name = '') {
  const chains = ['Filmhouse', 'Genesis', 'Silverbird', 'Ozone', 'Blu Star', 'Kada', 'Viva']
  return chains.find(c => name.toLowerCase().includes(c.toLowerCase())) || null
}

const chainStyles = {
  Filmhouse:  'bg-brand text-white border-brand/20',
  Genesis:    'bg-blue-600 text-white border-blue-600/20',
  Silverbird: 'bg-purple-600 text-white border-purple-600/20',
  Ozone:      'bg-green-600 text-white border-green-600/20',
  'Blu Star': 'bg-orange-600 text-white border-orange-600/20',
  Kada:       'bg-teal-600 text-white border-teal-600/20',
  Viva:       'bg-pink-600 text-white border-pink-600/20',
}

const CinemaCard = ({ cinema, showCount }) => {
  const chain = extractChain(cinema.name)
  const initials = cinema.name?.charAt(0) || '?'

  return (
    <Link
      to={`/cinemas/${cinema.id}`}
      className="group block bg-surface rounded-xl overflow-hidden border border-border hover:border-brand transition-all shadow-sm"
    >
      <div className="p-6">
        <div className="flex items-start gap-5">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold font-heading flex-shrink-0 transition-all ${
            chain ? chainStyles[chain] : 'bg-surface-2 text-text-muted border border-border'
          }`}>
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-text-primary font-bold text-sm uppercase tracking-tight group-hover:text-brand transition-colors line-clamp-2 leading-tight">
              {cinema.name}
            </h3>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {chain && (
                <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${chainStyles[chain]}`}>
                  {chain}
                </span>
              )}
              {!cinema.is_active && (
                <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20">
                  CLOSED
                </span>
              )}
            </div>
          </div>
        </div>

        {(cinema.address || cinema.city) && (
          <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mt-4 line-clamp-1 opacity-60 flex items-center gap-2">
             <Icon icon="solar:map-point-linear" className="text-brand/50" width="12" />
             {[cinema.city, cinema.state].filter(Boolean).join(', ')}
          </p>
        )}

        {showCount > 0 && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            <p className="text-brand text-[9px] font-black uppercase tracking-widest">
              {showCount} FILMS ARCHIVED TODAY
            </p>
          </div>
        )}
      </div>

      <div className="px-6 py-4 bg-surface-2/30 border-t border-border flex items-center justify-between">
        <span className="text-text-muted text-[9px] font-black uppercase tracking-widest truncate max-w-[120px]">
          {cinema.address || 'VIEW LOCATION'}
        </span>
        <div className="flex items-center gap-4 flex-shrink-0">
          {cinema.booking_url && (
            <span className="text-brand text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
               TICKETS
            </span>
          )}
          <Icon icon="solar:arrow-right-linear" className="w-4 h-4 text-text-muted group-hover:text-brand group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    </Link>
  )
}

const CinemaSkeleton = () => (
    <div className="bg-surface rounded-xl overflow-hidden border border-border">
        <div className="p-6 space-y-6">
            <div className="flex gap-5">
                <div className="w-14 h-14 rounded-xl bg-surface-2 animate-shimmer shrink-0" />
                <div className="flex-1 space-y-3">
                    <div className="h-4 w-3/4 bg-surface-2 rounded-md animate-shimmer" />
                    <div className="h-3 w-1/4 bg-surface-2 rounded-md animate-shimmer opacity-60" />
                </div>
            </div>
            <div className="space-y-3">
                <div className="h-3 w-full bg-surface-2 rounded-md animate-shimmer opacity-40" />
                <div className="h-3 w-2/3 bg-surface-2 rounded-md animate-shimmer opacity-40" />
            </div>
            <div className="h-6 w-1/2 bg-surface-2 rounded-md animate-shimmer" />
        </div>
        <div className="px-6 py-4 bg-surface-2/30 border-t border-border flex justify-between items-center">
            <div className="h-3 w-1/3 bg-surface-2 rounded-md animate-shimmer" />
            <div className="h-4 w-4 bg-surface-2 rounded animate-shimmer" />
        </div>
    </div>
)

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

  const cities = ['All', ...Array.from(new Set(cinemas.map(c => c.city).filter(Boolean))).sort()]

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

  const groupedByCity = filtered.reduce((acc, cinema) => {
    const city = cinema.city || 'Other'
    if (!acc[city]) acc[city] = []
    acc[city].push(cinema)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-bg">
      {/* Page Header */}
      <div className="bg-surface-2/10 border-b border-border relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 py-16 pt-32 border-x border-border relative z-10">
          <h1 className="text-4xl md:text-6xl font-heading font-bold text-text-primary mb-4 tracking-tighter uppercase italic">
            Exhibition Hubs
          </h1>
          <p className="text-text-muted text-sm max-w-xl italic border-l-2 border-brand pl-6">
            Discover premier cinema locations across Nigeria and find where your favorite Nollywood blockbusters are playing today.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto border-x border-border min-h-[600px] pb-20">
        {/* Filters Section */}
        <div className="grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border border-b border-border">
          <div className="lg:col-span-2 p-8 space-y-4 bg-surface-2/5">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="SEARCH THEATRES..."
                className="w-full bg-surface border border-border text-text-primary rounded-lg px-6 py-4 pl-12 text-[10px] font-black tracking-widest focus:border-brand focus:outline-none transition-all"
              />
              <Icon icon="solar:magnifer-linear" className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 text-text-primary" width="20" />
            </div>
          </div>
          
          <div className="lg:col-span-1 p-8">
            <select
              value={selectedCity}
              onChange={e => setSelectedCity(e.target.value)}
              className="w-full bg-surface border border-border text-text-primary rounded-lg px-6 py-4 text-[10px] font-black tracking-widest focus:border-brand focus:outline-none transition-all"
            >
              {cities.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
            </select>
          </div>

          <div className="lg:col-span-1 p-8 bg-surface-2/5">
            <select
              value={selectedChain}
              onChange={e => setSelectedChain(e.target.value)}
              className="w-full bg-surface border border-border text-text-primary rounded-lg px-6 py-4 text-[10px] font-black tracking-widest focus:border-brand focus:outline-none transition-all"
            >
              {CHAINS.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
            </select>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-8 md:p-12">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => <CinemaSkeleton key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-32 bg-surface-2/10 rounded-xl border-2 border-dashed border-border">
              <Icon icon="solar:buildings-2-linear" className="text-4xl mx-auto mb-4 opacity-20 text-brand" />
              <h3 className="text-text-muted font-black uppercase tracking-widest text-xs">No theatres discovered in this sector</h3>
            </div>
          ) : (
            <div className="space-y-16">
              {Object.entries(groupedByCity).map(([city, cityCinemas]) => (
                <div key={city} className="space-y-8">
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <h2 className="text-text-primary text-2xl font-bold font-heading tracking-tighter uppercase italic">{city}</h2>
                    <span className="text-text-muted text-[10px] font-black uppercase tracking-widest border border-border px-3 py-1 rounded">
                      {cityCinemas.length} SECTORS
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
    </div>
  )
}

export default Cinemas;
