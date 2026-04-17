import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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
  Filmhouse: 'bg-[#D4A017]/20 text-[#D4A017]',
  Genesis: 'bg-blue-900/40 text-blue-400',
  Silverbird: 'bg-purple-900/40 text-purple-400',
  Ozone: 'bg-green-900/40 text-green-400',
  'Blu Star': 'bg-orange-900/40 text-orange-400',
  Kada: 'bg-teal-900/40 text-teal-400'
}

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
    return (
      <div className="min-h-screen bg-[#0A0F1E] pt-20">
        <div className="max-w-5xl mx-auto px-4 py-8 animate-pulse">
          <div className="h-48 bg-[#13192B] rounded-2xl mb-6" />
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="h-40 bg-[#13192B] rounded-2xl"
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !cinema) {
    return (
      <div className="min-h-screen bg-[#0A0F1E] pt-20 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">
            {error || 'Cinema not found'}
          </p>
          <button
            onClick={() => navigate('/cinemas')}
            className="text-[#D4A017] hover:underline"
          >
            Back to Cinemas
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0F1E] pt-20">

      {/* Cinema Header */}
      <div className="bg-[#13192B] border-b border-[#252D45]">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-start gap-6">

            {/* Logo */}
            <div className="flex-shrink-0">
              {cinema.logo_url ? (
                <img
                  src={cinema.logo_url}
                  alt={cinema.name}
                  className="w-24 h-24 rounded-2xl object-contain bg-white p-2"
                />
              ) : (
                <div className={`w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-bold ${
                  chainColors[cinema.chain] ||
                  'bg-[#1C2440] text-[#7A8099]'
                }`}>
                  {cinema.chain?.charAt(0) ||
                    cinema.name?.charAt(0)}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="text-2xl md:text-3xl font-bold text-[#F5F0E8]">
                  {cinema.name}
                </h1>
                <span className={`text-sm px-3 py-1 rounded-full ${
                  chainColors[cinema.chain] ||
                  'bg-[#252D45] text-[#7A8099]'
                }`}>
                  {cinema.chain}
                </span>
              </div>

              {cinema.address && (
                <p className="text-[#7A8099] text-sm mb-3">
                  📍 {cinema.address}, {cinema.city}, {cinema.state}
                </p>
              )}

              {cinema.description && (
                <p className="text-[#F5F0E8] text-sm leading-relaxed mb-4 max-w-2xl">
                  {cinema.description}
                </p>
              )}

              {/* Meta */}
              <div className="flex flex-wrap gap-4 mb-4">
                {cinema.screens_count && (
                  <span className="text-[#7A8099] text-sm">
                    🎬 {cinema.screens_count} screens
                  </span>
                )}
                {cinema.seating_capacity && (
                  <span className="text-[#7A8099] text-sm">
                    💺 {cinema.seating_capacity.toLocaleString()} seats
                  </span>
                )}
                <span className="text-[#D4A017] text-sm font-medium">
                  🎭 {Object.keys(groupedByFilm).length} showing today
                </span>
              </div>

              {/* Links */}
              <div className="flex gap-3 flex-wrap">
                {cinema.google_maps_url && (
                  <a
                    href={cinema.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-[#1C2440] text-[#F5F0E8] text-sm px-4 py-2 rounded-xl hover:bg-[#252D45] transition-colors"
                  >
                    📍 Get Directions
                  </a>
                )}
                {cinema.website && (
                  <a
                    href={cinema.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-[#D4A017] text-black text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#D4A017]/90 transition-colors"
                  >
                    Buy Tickets ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Showtimes Section */}
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Section heading */}
        <h2 className="text-[#F5F0E8] text-2xl font-bold mb-6">
          Now Showing
        </h2>

        {/* No showtimes at all */}
        {showtimes.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎬</div>
            <h3 className="text-[#F5F0E8] text-xl font-bold mb-2">
              No upcoming showtimes
            </h3>
            <p className="text-[#7A8099]">
              Check back soon for upcoming screenings.
            </p>
            <Link
              to="/cinemas"
              className="inline-block mt-4 text-[#D4A017] hover:underline text-sm"
            >
              ← Back to Cinemas
            </Link>
          </div>
        )}

        {showtimes.length > 0 && (
          <>
            {/* Date tabs */}
            <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
              {availableDates.map(date => (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`px-5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                    selectedDate === date
                      ? 'bg-[#D4A017] text-black'
                      : 'bg-[#13192B] text-[#7A8099] hover:text-[#F5F0E8] border border-[#252D45]'
                  }`}
                >
                  {formatDate(date)}
                </button>
              ))}
            </div>

            {/* No films on selected date */}
            {Object.keys(groupedByFilm).length === 0 && (
              <div className="text-center py-12">
                <p className="text-[#7A8099]">
                  No screenings on this date.
                </p>
                <p className="text-[#7A8099] text-sm mt-1">
                  Try another date above.
                </p>
              </div>
            )}

            {/* Films showing */}
            <div className="space-y-5">
              {Object.values(groupedByFilm).map(
                ({ film, times }) => (
                  <div
                    key={film?.id}
                    className="bg-[#13192B] rounded-2xl overflow-hidden border border-[#252D45]"
                  >
                    <div className="flex gap-4 p-5">

                      {/* Poster */}
                      <Link
                        to={`/films/${film?.id}`}
                        className="flex-shrink-0"
                      >
                        {film?.poster_url ? (
                          <img
                            src={film.poster_url}
                            alt={film.title}
                            className="w-20 h-28 object-cover rounded-xl hover:opacity-80 transition-opacity"
                          />
                        ) : (
                          <div className="w-20 h-28 bg-[#1C2440] rounded-xl flex items-center justify-center">
                            <span className="text-2xl">🎬</span>
                          </div>
                        )}
                      </Link>

                      {/* Film info + times */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <Link
                              to={`/films/${film?.id}`}
                              className="text-[#F5F0E8] font-bold text-lg hover:text-[#D4A017] transition-colors"
                            >
                              {film?.title}
                            </Link>
                            <p className="text-[#7A8099] text-sm">
                              {film?.year}
                            </p>
                          </div>
                          {film?.average_rating > 0 && (
                            <span className="bg-[#D4A017] text-black text-sm font-bold px-3 py-1 rounded-xl flex-shrink-0">
                              {film.average_rating} ★
                            </span>
                          )}
                        </div>

                        {/* Genres */}
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {film?.film_genres?.map(fg => (
                            <span
                              key={fg.genres?.name}
                              className="text-xs bg-[#252D45] text-[#7A8099] px-2 py-0.5 rounded-full"
                            >
                              {fg.genres?.name}
                            </span>
                          ))}
                        </div>

                        {/* Time pills */}
                        <div className="flex flex-wrap gap-2">
                          {times.map(showtime => (
                            showtime.ticket_url ? (
                              <a
                                key={showtime.id}
                                href={showtime.ticket_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex flex-col items-center px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105 ${
                                  showtime.format !== 'Standard'
                                    ? 'bg-[#D4A017] text-black'
                                    : 'bg-[#1C2440] text-[#F5F0E8] border border-[#252D45] hover:bg-[#252D45]'
                                }`}
                              >
                                <span>
                                  {formatTime(showtime.show_time)}
                                </span>
                                {showtime.format !== 'Standard' && (
                                  <span className="text-xs font-bold mt-0.5">
                                    {showtime.format}
                                  </span>
                                )}
                              </a>
                            ) : (
                              <div
                                key={showtime.id}
                                title="Available at box office"
                                className={`inline-flex flex-col items-center px-4 py-2 rounded-xl text-sm font-medium cursor-default ${
                                  showtime.format !== 'Standard'
                                    ? 'bg-[#D4A017]/20 text-[#D4A017] border border-[#D4A017]/30'
                                    : 'bg-[#1C2440] text-[#F5F0E8] border border-[#252D45]'
                                }`}
                              >
                                <span>
                                  {formatTime(showtime.show_time)}
                                </span>
                                {showtime.format !== 'Standard' && (
                                  <span className="text-xs font-bold mt-0.5">
                                    {showtime.format}
                                  </span>
                                )}
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default CinemaDetail