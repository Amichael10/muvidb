import { useState, useEffect, useRef } from 'react'
import { useLoaderData } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getZonedClock, isPublicCinemaShowtime } from '../utils/showtimes'
import MobileCinemasView from '../components/cinemas/mobile/MobileCinemasView'
import DesktopCinemasView, { extractChain } from '../components/cinemas/desktop/DesktopCinemasView'

const Cinemas = () => {
  const loaderData = useLoaderData()
  const seeded = !!loaderData?.seeded && (loaderData.cinemas?.length ?? 0) > 0
  const [cinemas, setCinemas] = useState(loaderData?.cinemas ?? [])
  const [showCounts, setShowCounts] = useState(loaderData?.showCounts ?? {})
  const [loading, setLoading] = useState(!seeded)
  const [selectedCity, setSelectedCity] = useState('All')
  const [selectedChain, setSelectedChain] = useState('All')
  const [search, setSearch] = useState('')
  const skipInitialFetch = useRef(seeded)

  const CHAINS = ['All', 'Filmhouse', 'Genesis', 'Silverbird', 'Ozone', 'Blu Star', 'Kada', 'Viva']

  useEffect(() => {
    // Title comes from the route `meta` export.
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false
      return
    }
    fetchCinemas()
  }, [])

  const fetchCinemas = async () => {
    setLoading(true)

    const { data } = await supabase
      .from('cinemas')
      .select('id, name, city, address, state, is_active, booking_url, google_maps_url')
      .eq('is_active', true)
      .order('city')
      .order('name')

    setCinemas(data || [])

    if (data?.length) {
      const cinemaClock = getZonedClock()
      const { data: showtimes } = await supabase
        .from('showtimes')
        .select('cinema_id, film_id, show_date, show_time, films(id, status, coming_soon, is_in_cinemas)')
        .gte('show_date', cinemaClock.date)
        .eq('is_available', true)

      if (showtimes) {
        const counts = {}
        showtimes
          .filter(showtime => isPublicCinemaShowtime(showtime, cinemaClock))
          .forEach(s => {
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
    const matchCity = selectedCity === 'All' || c.city === selectedCity
    const matchChain = selectedChain === 'All' || chain === selectedChain
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

      {/* Mobile-First Cinemas View (< md) */}
      <MobileCinemasView
        cinemas={filtered}
        showCounts={showCounts}
        loading={loading}
        selectedCity={selectedCity}
        setSelectedCity={setSelectedCity}
        selectedChain={selectedChain}
        setSelectedChain={setSelectedChain}
        search={search}
        setSearch={setSearch}
        cities={cities}
        CHAINS={CHAINS}
        groupedByCity={groupedByCity}
      />

      {/* Desktop Cinemas View (>= md) */}
      <div className="hidden md:block">
        <DesktopCinemasView
          allCinemas={cinemas}
          filtered={filtered}
          groupedByCity={groupedByCity}
          showCounts={showCounts}
          loading={loading}
          selectedCity={selectedCity}
          setSelectedCity={setSelectedCity}
          selectedChain={selectedChain}
          setSelectedChain={setSelectedChain}
          search={search}
          setSearch={setSearch}
          cities={cities}
          CHAINS={CHAINS}
        />
      </div>
    </div>
  )
}

export default Cinemas;
