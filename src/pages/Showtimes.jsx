import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
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
    const date = new Date(dateStr)
    const today = new Date()
    const tomorrow = new Date()
    tomorrow.setDate(today.getDate() + 1)

    if (dateStr === today.toISOString().split('T')[0]) {
        return 'Today'
    }
    if (dateStr === tomorrow.toISOString().split('T')[0]) {
        return 'Tomorrow'
    }
    return date.toLocaleDateString('en-NG', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    })
}

const getNext7Days = () => {
    const days = []
    for (let i = 0; i < 7; i++) {
        const date = new Date()
        date.setDate(date.getDate() + i)
        days.push(date.toISOString().split('T')[0])
    }
    return days
}

const formatBadgeColor = (format) => {
    switch (format) {
        case 'IMAX': return 'bg-[#D4A017] text-black'
        case '3D': return 'bg-blue-600 text-white'
        case '4DX': return 'bg-purple-600 text-white'
        case 'Dolby': return 'bg-green-700 text-white'
        default: return 'bg-[#252D45] text-[#F5F0E8]'
    }
}

const Showtimes = () => {
    const [showtimes, setShowtimes] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedCity, setSelectedCity] = useState('All')
    const [selectedDate, setSelectedDate] = useState(
        new Date().toISOString().split('T')[0]
    )
    const [selectedCinema, setSelectedCinema] = useState('All')
    const [selectedFormat, setSelectedFormat] = useState('All')
    const [cinemas, setCinemas] = useState([])

    const cities = ['All', 'Lagos', 'Abuja', 'Port Harcourt']
    const formats = ['All', 'Standard', 'IMAX', '3D', '4DX', 'Dolby']
    const next7Days = getNext7Days()

    useEffect(() => {
        fetchShowtimes()
        fetchCinemas()
    }, [])

    const fetchCinemas = async () => {
        const { data } = await supabase
            .from('cinemas')
            .select('id, name, city, chain')
            .eq('is_active', true)
            .order('name')
        setCinemas(data || [])
    }

    const fetchShowtimes = async () => {
        setLoading(true)
        const today = new Date().toISOString().split('T')[0]

        const { data, error } = await supabase
            .from('showtimes')
            .select(`
        *,
        films(
          id, title, year, poster_url,
          backdrop_url, average_rating,
          film_genres(genres(name))
        ),
        cinemas(
          id, name, chain, city,
          address, google_maps_url
        )
      `)
            .gte('show_date', today)
            .eq('is_available', true)
            .order('show_date')
            .order('show_time')

        if (!error) setShowtimes(data || [])
        setLoading(false)
    }

    // Filter showtimes
    const filtered = showtimes.filter(s => {
        const matchCity = selectedCity === 'All' ||
            s.cinemas?.city === selectedCity
        const matchDate = s.show_date === selectedDate
        const matchCinema = selectedCinema === 'All' ||
            s.cinema_id === selectedCinema
        const matchFormat = selectedFormat === 'All' ||
            s.format === selectedFormat
        return matchCity && matchDate && matchCinema && matchFormat
    })

    // Group by film
    const groupedByFilm = filtered.reduce((acc, showtime) => {
        const filmId = showtime.film_id
        if (!acc[filmId]) {
            acc[filmId] = {
                film: showtime.films,
                cinemas: {}
            }
        }
        const cinemaId = showtime.cinema_id
        if (!acc[filmId].cinemas[cinemaId]) {
            acc[filmId].cinemas[cinemaId] = {
                cinema: showtime.cinemas,
                times: []
            }
        }
        acc[filmId].cinemas[cinemaId].times.push(showtime)
        return acc
    }, {})

    return (
        <div className="min-h-screen bg-[#0A0F1E] pt-20">
            <div className="max-w-6xl mx-auto px-4 py-8">

                {/* Page Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-[#F5F0E8] mb-2">
                        Now Showing
                    </h1>
                    <p className="text-[#7A8099]">
                        Find Nigerian films showing in cinemas near you
                    </p>
                </div>

                {/* Date Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
                    {next7Days.map(date => (
                        <button
                            key={date}
                            onClick={() => setSelectedDate(date)}
                            className={`px-5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${selectedDate === date
                                    ? 'bg-[#D4A017] text-black'
                                    : 'bg-[#13192B] text-[#7A8099] hover:text-[#F5F0E8] border border-[#252D45]'
                                }`}
                        >
                            {formatDate(date)}
                        </button>
                    ))}
                </div>

                {/* Filters */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    {/* City filter */}
                    <select
                        value={selectedCity}
                        onChange={e => setSelectedCity(e.target.value)}
                        className="bg-[#13192B] border border-[#252D45] text-[#F5F0E8] rounded-xl px-4 py-2.5 text-sm focus:border-[#D4A017] focus:outline-none"
                    >
                        {cities.map(city => (
                            <option key={city} value={city}>{city}</option>
                        ))}
                    </select>

                    {/* Cinema filter */}
                    <select
                        value={selectedCinema}
                        onChange={e => setSelectedCinema(e.target.value)}
                        className="bg-[#13192B] border border-[#252D45] text-[#F5F0E8] rounded-xl px-4 py-2.5 text-sm focus:border-[#D4A017] focus:outline-none"
                    >
                        <option value="All">All Cinemas</option>
                        {cinemas
                            .filter(c => selectedCity === 'All' ||
                                c.city === selectedCity)
                            .map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))
                        }
                    </select>

                    {/* Format filter */}
                    <select
                        value={selectedFormat}
                        onChange={e => setSelectedFormat(e.target.value)}
                        className="bg-[#13192B] border border-[#252D45] text-[#F5F0E8] rounded-xl px-4 py-2.5 text-sm focus:border-[#D4A017] focus:outline-none"
                    >
                        {formats.map(f => (
                            <option key={f} value={f}>{f}</option>
                        ))}
                    </select>

                    {/* Results count */}
                    <div className="flex items-center px-4 py-2.5 bg-[#13192B] border border-[#252D45] rounded-xl">
                        <span className="text-[#7A8099] text-sm">
                            {Object.keys(groupedByFilm).length} film
                            {Object.keys(groupedByFilm).length !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div
                                key={i}
                                className="bg-[#13192B] rounded-2xl h-48 animate-pulse"
                            />
                        ))}
                    </div>
                )}

                {/* Empty state */}
                {!loading && Object.keys(groupedByFilm).length === 0 && (
                    <div className="text-center py-20">
                        <div className="text-6xl mb-4">🎭</div>
                        <h3 className="text-[#F5F0E8] text-xl font-bold mb-2">
                            No films showing
                        </h3>
                        <p className="text-[#7A8099]">
                            No Nollywood films are showing on this date.
                        </p>
                        <p className="text-[#7A8099] text-sm mt-1">
                            Try a different date or city.
                        </p>
                    </div>
                )}

                {/* Showtimes grouped by film */}
                {!loading && (
                    <div className="space-y-6">
                        {Object.values(groupedByFilm).map(({ film, cinemas: filmCinemas }) => (
                            <div
                                key={film?.id}
                                className="bg-[#13192B] rounded-2xl overflow-hidden border border-[#252D45]"
                            >
                                {/* Film header */}
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

                                    {/* Film info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <Link
                                                    to={`/films/${film?.id}`}
                                                    className="text-[#F5F0E8] font-bold text-lg hover:text-[#D4A017] transition-colors"
                                                >
                                                    {film?.title}
                                                </Link>
                                                <p className="text-[#7A8099] text-sm mt-0.5">
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
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {film?.film_genres?.map(fg => (
                                                <span
                                                    key={fg.genres?.name}
                                                    className="text-xs bg-[#252D45] text-[#7A8099] px-2 py-0.5 rounded-full"
                                                >
                                                    {fg.genres?.name}
                                                </span>
                                            ))}
                                        </div>

                                        {/* NOW SHOWING badge */}
                                        <span className="inline-block mt-2 bg-[#C1440E]/20 text-[#C1440E] text-xs font-bold px-3 py-1 rounded-full border border-[#C1440E]/30">
                                            NOW SHOWING
                                        </span>
                                    </div>
                                </div>

                                {/* Cinemas and times */}
                                <div className="border-t border-[#252D45]">
                                    {Object.values(filmCinemas).map(
                                        ({ cinema, times }) => (
                                            <div
                                                key={cinema?.id}
                                                className="p-5 border-b border-[#252D45]/50 last:border-0"
                                            >
                                                {/* Cinema name */}
                                                <div className="flex items-center justify-between mb-3">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <Link
                                                                to={`/cinemas/${cinema?.id}`}
                                                                className="text-[#F5F0E8] font-medium text-sm hover:text-[#D4A017] transition-colors"
                                                            >
                                                                {cinema?.name}
                                                            </Link>
                                                            <span className={`text-xs px-2 py-0.5 rounded-full ${cinema?.chain === 'Filmhouse'
                                                                    ? 'bg-[#D4A017]/20 text-[#D4A017]'
                                                                    : cinema?.chain === 'Genesis'
                                                                        ? 'bg-blue-900/40 text-blue-400'
                                                                        : cinema?.chain === 'Silverbird'
                                                                            ? 'bg-purple-900/40 text-purple-400'
                                                                            : 'bg-[#252D45] text-[#7A8099]'
                                                                }`}>
                                                                {cinema?.chain}
                                                            </span>
                                                        </div>
                                                        <p className="text-[#7A8099] text-xs mt-0.5">
                                                            📍 {cinema?.city}
                                                            {cinema?.address &&
                                                                ` · ${cinema.address}`}
                                                        </p>
                                                    </div>
                                                    {cinema?.google_maps_url && (
                                                        <a
                                                        href={cinema.google_maps_url}
                              target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[#D4A017] text-xs hover:underline"
                            >
                                                    Directions ↗
                                                </a>
                          )}
                                            </div>

                        {/* Time pills */ }
                                        < div className = "flex flex-wrap gap-2" >
                                        {
                                            times.map(showtime => (
                                                showtime.ticket_url ? (
                                                  <a
                                                    key={showtime.id}
                                                    href={showtime.ticket_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`inline-flex flex-col items-center px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105 hover:shadow-lg ${showtime.format !== 'Standard'
                                                        ? 'bg-[#D4A017] text-black hover:bg-[#D4A017]/90'
                                                        : 'bg-[#1C2440] text-[#F5F0E8] hover:bg-[#252D45] border border-[#252D45]'
                                                    }`}
                                        >
                                        <span>
                                            {formatTime(showtime.show_time)}
                                        </span>
                                {
                                            showtime.format !== 'Standard' && (
                                                <span className={`text-xs mt-0.5 font-bold ${showtime.format !== 'Standard'
                                                        ? 'text-black'
                                                        : 'text-[#7A8099]'
                                                    }`}>
                                                    {showtime.format}
                                                </span>
                                            )
                                        }
                              </a>
                                ) : (
                                <div
                                    key={showtime.id}
                                    className={`inline-flex flex-col items-center px-4 py-2 rounded-xl text-sm font-medium ${showtime.format !== 'Standard'
                                            ? 'bg-[#D4A017]/20 text-[#D4A017] border border-[#D4A017]/30'
                                            : 'bg-[#1C2440] text-[#F5F0E8] border border-[#252D45]'
                                        }`}
                                >
                                    <span>
                                        {formatTime(showtime.show_time)}
                                    </span>
                                    {showtime.format !== 'Standard' && (
                                        <span className="text-xs mt-0.5 font-bold">
                                            {showtime.format}
                                        </span>
                                    )}
                                </div>
                                )
                          ))}
                            </div>
                      </div>
                )
                  )}
            </div>
        </div>
    ))
}
          </div >
        )}
      </div >
    </div >
  )
}

export default Showtimes