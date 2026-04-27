import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Skeleton } from '../components/ui/Skeleton'
import { Icon } from '@iconify/react'

const formatTime = (timeStr) => {
  if (!timeStr) return ''
  const [hours, minutes] = timeStr.split(':')
  const h = parseInt(hours)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

const formatDate = (dateStr) => {
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  if (dateStr === today) return 'Today'
  if (dateStr === tomorrowStr) return 'Tomorrow'

  return new Date(dateStr).toLocaleDateString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  })
}

const chainColors = {
  Filmhouse: 'bg-brand/20 text-brand',
  Genesis: 'bg-blue-900/40 text-blue-400',
  Silverbird: 'bg-purple-900/40 text-purple-400',
  Ozone: 'bg-green-900/40 text-green-400',
  'Blu Star': 'bg-orange-900/40 text-orange-400',
  Kada: 'bg-teal-900/40 text-teal-400'
}

const CinemaDetailSkeleton = () => (
    <div className="min-h-screen bg-bg">
        <div className="bg-surface-2/10 border-b border-border relative overflow-hidden">
            <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none"></div>
            <div className="max-w-7xl mx-auto px-4 py-12 pt-24 border-x border-border relative z-10">
                <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                    <div className="w-32 h-32 rounded-xl bg-surface-2 animate-shimmer shadow-2xl shrink-0" />
                    <div className="flex-1 space-y-6 w-full">
                        <div className="space-y-3">
                            <div className="h-10 w-1/3 bg-surface-2 rounded-lg animate-shimmer mx-auto md:mx-0" />
                            <div className="h-4 w-1/4 bg-surface-2 rounded-md animate-shimmer mx-auto md:mx-0" />
                        </div>
                        <div className="grid grid-cols-3 gap-0 border border-border rounded-lg max-w-md mx-auto md:mx-0 bg-surface overflow-hidden">
                            <div className="p-4 border-r border-border"><div className="h-8 w-full bg-surface-2 rounded-md animate-shimmer" /></div>
                            <div className="p-4 border-r border-border"><div className="h-8 w-full bg-surface-2 rounded-md animate-shimmer" /></div>
                            <div className="p-4"><div className="h-8 w-full bg-surface-2 rounded-md animate-shimmer" /></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div className="max-w-7xl mx-auto border-x border-border">
            <div className="grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border">
                <div className="lg:col-span-1 p-8 md:p-12 space-y-8">
                    <div className="h-4 w-24 bg-surface-2 rounded animate-shimmer" />
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="h-12 w-full bg-surface-2 rounded-lg border border-border animate-shimmer" />
                        ))}
                    </div>
                </div>
                <div className="lg:col-span-3 p-8 md:p-12 space-y-8">
                    <div className="h-12 w-full bg-surface-2/10 rounded-xl border border-border animate-shimmer" />
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-surface rounded-xl border border-border overflow-hidden animate-shimmer">
                            <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border">
                                <div className="sm:w-32 lg:w-40 h-48 sm:h-auto bg-surface-2 animate-shimmer" />
                                <div className="flex-1 p-8 space-y-4">
                                    <div className="h-6 w-1/2 bg-surface-2 rounded animate-shimmer" />
                                    <div className="h-4 w-1/3 bg-surface-2 rounded animate-shimmer opacity-60" />
                                    <div className="flex gap-2">
                                        <div className="h-6 w-16 bg-surface-2 rounded border border-border animate-shimmer" />
                                        <div className="h-6 w-16 bg-surface-2 rounded border border-border animate-shimmer" />
                                    </div>
                                    <div className="grid grid-cols-4 gap-3 pt-4">
                                        {[1, 2, 3, 4].map(j => (
                                            <div key={j} className="h-10 bg-surface-2 rounded-lg border border-border animate-shimmer" />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
)

const ShowtimeGrid = ({ times }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const displayTimes = isExpanded ? times : times.slice(0, 4)
  const hasMore = times.length > 4

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {displayTimes.map(showtime => (
          <a
            key={showtime.id}
            href={showtime.ticket_url || '#'}
            target={showtime.ticket_url ? "_blank" : "_self"}
            rel="noopener noreferrer"
            className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all text-center ${
              showtime.format !== 'Standard'
                ? 'bg-brand/10 border-brand/30 text-brand hover:bg-brand hover:text-white'
                : 'bg-surface border-border text-text-primary hover:border-brand hover:text-brand'
            } ${!showtime.ticket_url && 'cursor-default opacity-80'}`}
          >
            <span className="text-[11px] font-bold tracking-tight">
              {formatTime(showtime.show_time)}
            </span>
            <span className="text-[9px] font-bold mt-1 opacity-60">
              {showtime.format}
            </span>
          </a>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full sm:w-auto px-6 py-2.5 bg-surface-2/30 hover:bg-surface-2 border border-border hover:border-brand rounded-lg text-xs font-bold text-text-muted hover:text-brand transition-all flex items-center justify-center gap-3 group shadow-sm"
        >
          {isExpanded ? (
            <>
              <span>Collapse Times</span>
              <span className="text-xs group-hover:-translate-y-0.5 transition-transform">↑</span>
            </>
          ) : (
            <>
              <span>+ {times.length - 4} More Showings</span>
              <span className="text-xs group-hover:translate-y-0.5 transition-transform">↓</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}

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
          className="text-brand text-xs font-bold hover:underline ml-7 transition-all"
        >
          {isExpanded ? 'Read Less ↑' : 'Read Full Description ↓'}
        </button>
      )}
    </div>
  );
};

const CinemaDetail = () => {

  const { id } = useParams()
  const navigate = useNavigate()
  const [cinema, setCinema] = useState(null)
  const [showtimes, setShowtimes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  )

  useEffect(() => {
    fetchCinema()
    fetchShowtimes()
  }, [id])

  const fetchCinema = async () => {
    const { data, error } = await supabase
      .from('cinemas')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      setError('Cinema not found')
      setLoading(false)
      return
    }
    setCinema(data)
  }

  const fetchShowtimes = async () => {
    const today = new Date().toISOString().split('T')[0]

    const { data } = await supabase
      .from('showtimes')
      .select(`
        *,
        films(
          id, title, year, poster_url,
          backdrop_url, average_rating,
          synopsis,
          film_genres(genres(name))
        )
      `)
      .eq('cinema_id', id)
      .gte('show_date', today)
      .eq('is_available', true)
      .order('show_date')
      .order('show_time')

    setShowtimes(data || [])
    setLoading(false)
  }

  // Get unique dates
  const availableDates = [...new Set(
    showtimes.map(s => s.show_date)
  )].slice(0, 7)

  // Filter by selected date
  const todayShowtimes = showtimes.filter(
    s => s.show_date === selectedDate
  )

  // Group by film
  const groupedByFilm = todayShowtimes.reduce((acc, showtime) => {
    const filmId = showtime.film_id
    if (!acc[filmId]) {
      acc[filmId] = {
        film: showtime.films,
        times: []
      }
    }
    acc[filmId].times.push(showtime)
    return acc
  }, {})

  if (loading) {
    return <CinemaDetailSkeleton />
  }

  if (error || !cinema) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="max-w-7xl mx-auto px-4 border-x border-border py-32 text-center w-full">
          <p className="text-red-400 text-lg mb-8 font-bold">
            {error || 'Cinema not found'}
          </p>
          <button
            onClick={() => navigate('/cinemas')}
            className="bg-brand text-white font-bold px-8 py-4 rounded-lg hover:shadow-brand/20 transition-all"
          >
            Back to Cinemas
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Cinema Header */}
      <div className="bg-surface-2/10 border-b border-border relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 py-12 pt-24 border-x border-border relative z-10">
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">

            {/* Logo */}
            <div className="flex-shrink-0 relative">
              <div className="absolute -inset-1 bg-brand/20 blur-xl rounded-full"></div>
              {cinema.logo_url ? (
                <img
                  src={cinema.logo_url}
                  alt={cinema.name}
                  className="relative w-32 h-32 rounded-xl object-contain bg-white p-4 shadow-2xl border border-border"
                />
              ) : (
                <div className={`relative w-32 h-32 rounded-xl flex items-center justify-center text-4xl font-heading font-bold shadow-2xl border border-border ${
                  chainColors[cinema.chain] || 'bg-surface text-text-muted'
                }`}>
                  {cinema.chain?.charAt(0) || cinema.name?.charAt(0)}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 space-y-6">
              <div>
                <div className="flex items-center gap-3 flex-wrap justify-center md:justify-start mb-2">
                  <h1 className="text-3xl md:text-5xl font-heading font-bold text-text-primary tracking-tighter">
                    {cinema.name}
                  </h1>
                  <span className={`text-xs font-bold px-3 py-1 rounded-lg border ${
                    chainColors[cinema.chain] || 'bg-surface-2 text-text-muted border-border'
                  }`}>
                    {cinema.chain}
                  </span>
                </div>

                {cinema.address && (
                  <p className="text-text-muted text-xs font-bold flex items-center justify-center md:justify-start gap-2">
                    <Icon icon="solar:map-point-linear" className="text-brand" width="14" />
                    {cinema.address}, {cinema.city}, {cinema.state}
                  </p>
                )}
              </div>

              {cinema.description && (
                <Description text={cinema.description} />
              )}

              {/* Meta Grid */}
              <div className="grid grid-cols-3 gap-0 border border-border rounded-lg overflow-hidden bg-surface max-w-md mx-auto md:mx-0 shadow-sm">
                <div className="p-4 border-r border-border text-center">
                  <p className="text-brand text-xl font-bold font-heading">
                    {cinema.screens_count || '0'}
                  </p>
                  <p className="text-text-muted text-[10px] font-bold">Screens</p>
                </div>
                <div className="p-4 border-r border-border text-center">
                  <p className="text-text-primary text-xl font-bold font-heading">
                    {cinema.seating_capacity ? (cinema.seating_capacity / 1000).toFixed(1) + 'k' : '—'}
                  </p>
                  <p className="text-text-muted text-[10px] font-bold">Capacity</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-text-primary text-xl font-bold font-heading">
                    {Object.keys(groupedByFilm).length}
                  </p>
                  <p className="text-text-muted text-[10px] font-bold">Now Playing</p>
                </div>
              </div>

              {/* Links */}
              <div className="flex gap-4 flex-wrap justify-center md:justify-start pt-2">
                {cinema.google_maps_url && (
                  <a
                    href={cinema.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-surface border border-border text-text-primary text-xs font-bold px-8 py-4 rounded-lg hover:border-brand hover:text-brand transition-all min-h-[44px]"
                  >
                    Directions
                  </a>
                )}
                {cinema.website && (
                  <a
                    href={cinema.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-brand text-white text-xs font-bold px-8 py-4 rounded-lg hover:shadow-brand/20 hover:scale-[1.02] transition-all min-h-[44px]"
                  >
                    Official Site
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Showtimes Section */}
      <div className="max-w-7xl mx-auto border-x border-border">
        <div className="grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border">
          
          {/* Sidebar / Filters (25%) */}
          <div className="lg:col-span-1 p-8 md:p-12 space-y-12">
             <div>
                <h3 className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em] mb-6">Select Date</h3>
                <div className="flex flex-col gap-2">
                  {availableDates.map(date => (
                    <button
                      key={date}
                      onClick={() => setSelectedDate(date)}
                      className={`w-full flex items-center justify-between p-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                        selectedDate === date
                          ? 'bg-brand text-white shadow-lg shadow-brand/20 border-brand'
                          : 'bg-surface border border-border text-text-muted hover:text-text-primary'
                      }`}
                    >
                      <span>{formatDate(date)}</span>
                      {selectedDate === date && <span className="text-white/60">→</span>}
                    </button>
                  ))}
                </div>
             </div>

             {/* Booking Note */}
             <div className="p-6 bg-surface-2/10 rounded-xl border border-border italic text-[11px] text-text-muted leading-relaxed">
                "Showtimes are subject to change by cinema management. Online booking is recommended where available."
             </div>
          </div>

          {/* Main List (75%) */}
          <div className="lg:col-span-3">
            <div className="p-8 md:p-12 border-b border-border bg-surface-2/5 relative overflow-hidden">
               <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none"></div>
               <h2 className="relative z-10 text-text-primary text-2xl font-bold font-heading tracking-tighter uppercase italic">
                 Now Playing Archive
               </h2>
            </div>

            <div className="p-8 md:p-12 min-h-[400px]">
              {/* No films on selected date */}
              {Object.keys(groupedByFilm).length === 0 && (
                <div className="text-center py-24 bg-surface-2/10 rounded-xl border-2 border-dashed border-border">
                  <Icon icon="solar:clapperboard-play-linear" className="text-4xl mx-auto mb-4 opacity-20 text-brand" />
                  <p className="text-text-muted font-bold text-xs">No screenings scheduled for this date</p>
                </div>
              )}

              {/* Films showing */}
              <div className="space-y-8">
                {Object.values(groupedByFilm).map(({ film, times }) => (
                  <div
                    key={film?.id}
                    className="group bg-surface rounded-xl overflow-hidden border border-border hover:border-brand transition-all shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border">
                      {/* Poster */}
                      <Link
                        to={`/films/${film?.id}`}
                        className="sm:w-32 lg:w-40 flex-shrink-0 relative overflow-hidden"
                      >
                        {film?.poster_url ? (
                          <img
                            src={film.poster_url}
                            alt={film.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-48 sm:h-full bg-surface-2 flex items-center justify-center">
                            <Icon icon="solar:clapperboard-play-linear" className="text-3xl text-brand/30" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-bg/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>

                      {/* Film info + times */}
                      <div className="flex-1 p-6 sm:p-8">
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div>
                            <Link
                              to={`/films/${film?.id}`}
                              className="text-text-primary font-bold text-xl uppercase tracking-tighter group-hover:text-brand transition-colors"
                            >
                              {film?.title}
                            </Link>
                            <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mt-1">
                              RELEASED: {film?.year} • {film?.average_rating} ★ RATING
                            </p>
                          </div>
                        </div>

                        {/* Genres */}
                        <div className="flex flex-wrap gap-2 mb-8">
                          {film?.film_genres?.map(fg => (
                            <span
                              key={fg.genres?.name}
                              className="text-[9px] font-black uppercase tracking-widest text-text-primary bg-surface-2 px-3 py-1 rounded border border-border"
                            >
                              {fg.genres?.name}
                            </span>
                          ))}
                        </div>

                        {/* Time pills */}
                        <ShowtimeGrid times={times} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

export default CinemaDetail