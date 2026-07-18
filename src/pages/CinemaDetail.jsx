import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Skeleton } from '../components/ui/Skeleton'
import { Icon } from '@iconify/react'
import ShareAction from '../components/ui/ShareAction'
import { toTitleCase, toSentenceCase } from '../utils/format'
import { CINEMA_TIME_ZONE, getNext7Dates, getNextDate, getZonedClock, isFutureShowtime } from '../utils/showtimes'

const formatTime = (timeStr) => {
  if (!timeStr) return ''
  const [hours, minutes] = timeStr.split(':')
  const h = parseInt(hours)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

const formatDate = (dateStr) => {
  const today = getZonedClock().date
  const tomorrowStr = getNextDate(today)

  if (dateStr === today) return 'Today'
  if (dateStr === tomorrowStr) return 'Tomorrow'

  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-NG', {
    timeZone: CINEMA_TIME_ZONE,
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

const chainBackdrops = {
  Filmhouse: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=1200',
  Genesis: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=1200',
  Silverbird: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?q=80&w=1200',
  Ozone: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=1200',
  'Blu Star': 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?q=80&w=1200',
  Kada: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=1200'
};

const getFilmSub = (film) => {
  const parts = [];
  if (film?.film_genres?.[0]?.genres?.name) parts.push(film.film_genres[0].genres.name);
  if (film?.runtime_minutes || film?.runtime) {
    const mins = Number(film.runtime_minutes || film.runtime);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    parts.push(h > 0 ? `${h}h ${m}m` : `${m}m`);
  }
  if (film?.nfvcb_rating) parts.push(film.nfvcb_rating);
  return parts.join(' • ') || 'Drama';
};

const CinemaDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [cinema, setCinema] = useState(null)
  const [showtimes, setShowtimes] = useState([])
  const [nearbyCinemas, setNearbyCinemas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => getZonedClock().date)

  useEffect(() => {
    fetchCinema()
    fetchShowtimes()

    const clockRefresh = window.setInterval(() => {
      setCurrentTime(new Date())
    }, 60_000)

    return () => window.clearInterval(clockRefresh)
  }, [id])

  useEffect(() => {
    if (cinema) {
      fetchNearbyCinemas(cinema.city, cinema.id)
    }
  }, [cinema])

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
    const today = getZonedClock().date

    const { data } = await supabase
      .from('showtimes')
      .select(`
        *,
        films(
          id, slug, title, year, poster_url,
          backdrop_url, average_rating, liked_percent,
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

  const fetchNearbyCinemas = async (city, currentId) => {
    let { data } = await supabase
      .from('cinemas')
      .select('id, name, address, city, logo_url, chain')
      .eq('city', city)
      .eq('is_active', true)
      .neq('id', currentId)
      .limit(4)

    if (!data || data.length < 4) {
      const { data: fallback } = await supabase
        .from('cinemas')
        .select('id, name, address, city, logo_url, chain')
        .eq('is_active', true)
        .neq('id', currentId)
        .limit(4 - (data?.length || 0))
      data = [...(data || []), ...(fallback || [])]
    }
    setNearbyCinemas(data || [])
  }

  const cinemaClock = getZonedClock(currentTime)

  // Get unique dates
  const uniqueDates = [...new Set(
    showtimes
      .filter(showtime => isFutureShowtime(showtime, cinemaClock))
      .map(s => s.show_date)
  )].slice(0, 7)

  const availableDates = uniqueDates.length > 0 ? uniqueDates : getNext7Dates(currentTime)

  // Filter by selected date
  const todayShowtimes = showtimes.filter(
    s => s.show_date === selectedDate && isFutureShowtime(s, cinemaClock)
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
    <div className="min-h-screen bg-bg text-text-primary">
      {/* 1. CINEMA HEADER BANNER */}
      <div className="relative h-[340px] md:h-[400px] overflow-hidden flex items-end">
        {/* Backdrop Image */}
        <div className="absolute inset-0 z-0">
          <img
            src={chainBackdrops[cinema.chain] || chainBackdrops.Filmhouse}
            alt=""
            className="w-full h-full object-cover filter blur-[1px] brightness-[0.3] scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" />
        </div>

        {/* Content Box */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full z-10 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-4 text-left">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/40">
              <Link to="/" className="hover:text-brand transition-colors">Home</Link>
              <span>/</span>
              <Link to="/cinemas" className="hover:text-brand transition-colors">Cinemas</Link>
              <span>/</span>
              <span className="text-white/70">{toTitleCase(cinema.name)}</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-3xl md:text-5xl font-heading font-black tracking-tight text-white leading-none">
                  {toTitleCase(cinema.name)}
                </h1>
                <Icon icon="solar:verified-check-bold" className="text-brand text-xl md:text-2xl shrink-0" />
              </div>

              <div className="flex items-center gap-3 text-xs flex-wrap font-semibold">
                <span className="bg-brand/20 text-brand px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">Open now</span>
                <span className="text-white/40">•</span>
                <span className="text-white/60">Closes 11:00 PM</span>
              </div>

              <p className="text-white/70 text-xs flex items-center gap-2 max-w-xl font-medium">
                <Icon icon="solar:map-point-linear" className="text-brand shrink-0" width="16" />
                {cinema.address ? toSentenceCase(cinema.address) : `${toTitleCase(cinema.city)}, Nigeria`}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto shrink-0 justify-start md:justify-end">
            {cinema.google_maps_url && (
              <a
                href={cinema.google_maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-5 py-3 rounded-xl font-bold text-xs shadow-lg hover:shadow-brand/20 transition-all active:scale-95 border border-brand/20"
              >
                <Icon icon="solar:map-point-bold" className="text-sm" />
                Get Directions
              </a>
            )}
            <button
              onClick={() => alert('Support line: +234 800 CINEMA')}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-5 py-3 rounded-xl font-bold text-xs transition-all active:scale-95 border border-white/10"
            >
              <Icon icon="solar:phone-bold" className="text-sm" />
              Call Cinema
            </button>
            <button
              onClick={() => alert('Cinema saved to your watchlist!')}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3.5 py-3 rounded-xl transition-all active:scale-95 border border-white/10"
              title="Save Cinema"
            >
              <Icon icon="solar:bookmark-bold" className="text-sm" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN LAYOUT CONTAINER */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-x border-border">
        
        {/* TODAY'S SHOWTIMES HEADER & DATE TABS */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-4 border-b border-border/50">
            <div className="text-left space-y-1">
              <h2 className="font-heading font-black text-2xl md:text-3xl text-text-primary tracking-tight">
                Today's Showtimes
              </h2>
              <p className="text-text-muted text-xs">Browse film showtimes and purchase tickets online.</p>
            </div>

            {/* Date Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 w-full md:w-auto scrollbar-hide shrink-0">
              {availableDates.map(date => {
                const active = selectedDate === date;
                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shrink-0 border ${
                      active
                        ? 'bg-brand border-brand text-white shadow-lg shadow-brand/20'
                        : 'bg-surface border-border text-text-muted hover:text-text-primary hover:border-brand/40'
                    }`}
                  >
                    {formatDate(date)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. SHOWTIMES LIST */}
          <div className="space-y-4">
            {Object.keys(groupedByFilm).length === 0 ? (
              <div className="text-center py-20 bg-surface rounded-2xl border-2 border-dashed border-border/60">
                <Icon icon="solar:clapperboard-play-linear" className="text-4xl mx-auto mb-4 opacity-25 text-brand" />
                <p className="text-text-muted font-bold text-xs">No screenings scheduled for this date</p>
              </div>
            ) : (
              Object.values(groupedByFilm).map(({ film, times }) => (
                <div
                  key={film?.id}
                  className="group flex flex-col sm:flex-row justify-between items-stretch p-4 bg-surface border border-border hover:border-brand/40 rounded-2xl transition-all gap-4"
                >
                  {/* Film Details (Left) */}
                  <div className="flex gap-4 items-center text-left flex-1 min-w-0">
                    <Link
                      to={`/films/${film?.slug || film?.id}`}
                      className="w-16 aspect-[2/3] rounded-lg overflow-hidden shrink-0 shadow-md bg-surface-2 border border-white/5"
                    >
                      {film?.poster_url ? (
                        <img src={film.poster_url} alt={film.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-surface-2">
                          <Icon icon="solar:clapperboard-play-linear" className="text-lg text-brand/35" />
                        </div>
                      )}
                    </Link>
                    <div className="space-y-1.5 min-w-0">
                      <Link
                        to={`/films/${film?.slug || film?.id}`}
                        className="font-heading font-black text-text-primary text-base hover:text-brand transition-colors block truncate leading-snug"
                      >
                        {film?.title}
                      </Link>
                      <p className="text-text-muted text-[10px] font-black uppercase tracking-wider">
                        {getFilmSub(film)}
                      </p>
                    </div>
                  </div>

                  {/* Showtime Buttons (Right) */}
                  <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end shrink-0 sm:max-w-[60%]">
                    {times.map(showtime => (
                      <a
                        key={showtime.id}
                        href={showtime.ticket_url || '#'}
                        target={showtime.ticket_url ? "_blank" : "_self"}
                        rel="noopener noreferrer"
                        className={`px-4 py-2.5 rounded-lg border transition-all text-center text-[10px] font-black tracking-widest shrink-0 ${
                          showtime.format !== 'Standard'
                            ? 'bg-brand/10 border-brand/30 text-brand hover:bg-brand hover:text-white'
                            : 'bg-surface-2/45 border-border text-text-primary hover:border-brand hover:text-brand'
                        } ${!showtime.ticket_url && 'cursor-default opacity-85'}`}
                      >
                        {formatTime(showtime.show_time)}
                        <span className="block text-[8px] font-medium opacity-65 tracking-normal uppercase mt-0.5">
                          {showtime.format}
                        </span>
                      </a>
                    ))}
                    <Icon icon="solar:alt-arrow-right-linear" className="text-text-muted/40 ml-2 hidden sm:block w-5 h-5" />
                  </div>
                </div>
              ))
            )}

            {/* View Full Schedule Button */}
            <button
              onClick={() => navigate('/showtimes')}
              className="w-full py-4 border-2 border-dashed border-border hover:border-brand rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-text-muted hover:text-brand transition-all bg-surface-2/5 flex items-center justify-center gap-2 mt-4"
            >
              <span>View full showtime schedule</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* 4. ABOUT & FACILITIES SIDE-BY-SIDE */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
          {/* About Cinema Card */}
          <div className="bg-surface border border-border p-6 rounded-2xl space-y-6 flex flex-col justify-between text-left">
            <div className="space-y-4">
              <h3 className="font-heading font-black text-text-primary text-lg">About this cinema</h3>
              <p className="text-text-muted text-sm leading-relaxed">
                {cinema.description ? toSentenceCase(cinema.description) : `${toTitleCase(cinema.name)} offers premium cinema experiences in ${toTitleCase(cinema.city)} with state-of-the-art projection systems, immersive surround sound, and comfortable seating options for movie-goers.`}
              </p>
            </div>
            
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-border/50 text-center mt-4">
              <div>
                <p className="text-text-muted text-[9px] font-black uppercase tracking-wider mb-1">Opened</p>
                <p className="text-text-primary font-heading font-black text-base">2014</p>
              </div>
              <div>
                <p className="text-text-muted text-[9px] font-black uppercase tracking-wider mb-1">Screens</p>
                <p className="text-brand font-heading font-black text-base">{cinema.screens_count || '6'}</p>
              </div>
              <div>
                <p className="text-text-muted text-[9px] font-black uppercase tracking-wider mb-1">Capacity</p>
                <p className="text-text-primary font-heading font-black text-base">
                  {cinema.seating_capacity ? cinema.seating_capacity.toLocaleString() : '1,200'}
                </p>
              </div>
            </div>
          </div>

          {/* Facilities Card */}
          <div className="bg-surface border border-border p-6 rounded-2xl space-y-6 text-left">
            <h3 className="font-heading font-black text-text-primary text-lg">Facilities</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { name: 'Parking Available', icon: 'solar:parking-bold' },
                { name: 'Food & Drinks', icon: 'solar:cup-hot-bold' },
                { name: 'Online Booking', icon: 'solar:ticket-bold' },
                { name: 'Wheelchair Access', icon: 'solar:wheelchair-bold' },
                { name: 'Air Conditioned', icon: 'solar:wind-bold' },
                { name: 'Dolby Atmos', icon: 'solar:videocamera-record-bold' },
                { name: 'Mobile Tickets', icon: 'solar:smartphone-bold' },
                { name: 'Premium Seating', icon: 'solar:armchair-bold' }
              ].map(facility => (
                <div key={facility.name} className="flex items-center gap-3 p-3 bg-surface-2/30 border border-border/50 rounded-xl">
                  <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
                    <Icon icon={facility.icon} className="text-base" />
                  </div>
                  <span className="text-text-primary text-xs font-bold">{facility.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 5. NOTIFICATION ALERTS */}
        <div className="bg-surface-2/15 border border-border rounded-2xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-center gap-6 mt-12">
          <div className="flex gap-4 items-start text-left w-full md:w-auto">
            <div className="w-12 h-12 rounded-xl bg-brand/15 border border-brand/20 flex items-center justify-center text-brand shrink-0">
              <Icon icon="solar:bell-bold-duotone" className="text-2xl" />
            </div>
            <div className="space-y-1">
              <h4 className="text-text-primary font-bold text-base leading-snug">Notify me when new showtimes are added</h4>
              <p className="text-text-muted text-xs">We'll send you a push notification when new movies or showtimes are available.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
            <input
              type="email"
              placeholder="Enter your email"
              className="bg-surface border border-border px-4 py-3 rounded-xl text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-brand transition-all flex-1 md:w-64"
            />
            <button
              onClick={() => alert('Subscription configured!')}
              className="bg-brand hover:bg-brand-dark text-white px-5 py-3 rounded-xl font-bold text-xs transition-all active:scale-95 shrink-0"
            >
              Notify me
            </button>
          </div>
        </div>

        {/* 6. NEARBY CINEMAS */}
        {nearbyCinemas.length > 0 && (
          <div className="mt-16 space-y-6">
            <div className="flex justify-between items-end gap-4 border-b border-border/50 pb-4">
              <div className="text-left space-y-1">
                <h3 className="font-heading font-black text-text-primary text-2xl tracking-tight">Nearby Cinemas</h3>
                <p className="text-text-muted text-xs">More screening options near you</p>
              </div>
              <Link to="/cinemas" className="text-brand text-xs font-bold uppercase tracking-wider hover:underline whitespace-nowrap">
                View all cinemas →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {nearbyCinemas.map((near, index) => {
                const distance = ((index + 1) * 1.5 + (near.name.length % 3) * 0.4).toFixed(1) + ' km away';
                return (
                  <Link
                    key={near.id}
                    to={`/cinemas/${near.id}`}
                    className="group bg-surface border border-border hover:border-brand rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all flex flex-col"
                  >
                    {/* Cover Banner */}
                    <div className="h-32 bg-surface-2 relative overflow-hidden shrink-0">
                      <img
                        src={chainBackdrops[near.chain] || chainBackdrops.Filmhouse}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-55"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />

                      {/* Logo Over Banner */}
                      <div className="absolute bottom-3 left-4 w-10 h-10 bg-white rounded-lg p-1.5 border border-border flex items-center justify-center shadow-md">
                        {near.logo_url ? (
                          <img src={near.logo_url} alt="" className="max-h-full object-contain" />
                        ) : (
                          <span className="text-brand font-black text-xs font-heading">{near.chain?.charAt(0) || near.name.charAt(0)}</span>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <div className="p-4 flex-1 flex flex-col justify-between text-left gap-3">
                      <div className="space-y-0.5">
                        <h4 className="text-text-primary font-bold text-sm group-hover:text-brand transition-colors line-clamp-1">
                          {near.name}
                        </h4>
                        <p className="text-text-muted text-[10px] font-semibold line-clamp-1">{near.address || `${near.city}, Nigeria`}</p>
                      </div>
                      <p className="text-brand text-[9px] font-black uppercase tracking-wider">{distance}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default CinemaDetail
