import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
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

const ShowtimeSkeleton = () => (
    <div className="bg-surface rounded-xl overflow-hidden border border-border">
        <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border">
            <div className="sm:w-48 lg:w-80 h-48 bg-surface-2/20 animate-pulse" />
            <div className="flex-1 p-6 sm:p-8 space-y-4">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
                <div className="flex gap-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {displayTimes.map(showtime => (
                    <a
                        key={showtime.id}
                        href={showtime.ticket_url || '#'}
                        target={showtime.ticket_url ? "_blank" : "_self"}
                        rel="noopener noreferrer"
                        className={`flex flex-col items-center justify-center p-2.5 rounded-lg border transition-all text-center ${
                            showtime.format !== 'Standard'
                                ? 'bg-brand/10 border-brand/30 text-brand hover:bg-brand hover:text-white'
                                : 'bg-surface border-border text-text-primary hover:border-brand hover:text-brand'
                        } ${!showtime.ticket_url && 'cursor-default opacity-80'}`}
                    >
                        <span className="text-[10px] font-black tracking-tight">
                            {formatTime(showtime.show_time)}
                        </span>
                        <span className="text-[8px] font-black uppercase tracking-widest mt-0.5 opacity-60">
                            {showtime.format}
                        </span>
                    </a>
                ))}
            </div>
            {hasMore && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full sm:w-auto px-6 py-2.5 bg-surface-2/30 hover:bg-surface-2 border border-border hover:border-brand rounded-lg text-[9px] font-black uppercase tracking-[0.2em] text-text-muted hover:text-brand transition-all flex items-center justify-center gap-3 group shadow-sm"
                >
                    {isExpanded ? (
                        <>
                            <span>COLLAPSE TIMES</span>
                            <span className="text-xs group-hover:-translate-y-0.5 transition-transform">↑</span>
                        </>
                    ) : (
                        <>
                            <span>+ {times.length - 4} MORE SHOWINGS</span>
                            <span className="text-xs group-hover:translate-y-0.5 transition-transform">↓</span>
                        </>
                    )}
                </button>
            )}
        </div>
    )
}

const CinemaList = ({ filmCinemas }) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const cinemasArray = Object.values(filmCinemas)
    const displayCinemas = isExpanded ? cinemasArray : cinemasArray.slice(0, 3)
    const hasMore = cinemasArray.length > 3

    return (
        <div className="space-y-6 mt-8">
            {displayCinemas.map(({ cinema, times }) => (
                <div key={cinema?.id} className="pt-6 border-t border-border/50 first:border-0 first:pt-0">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <Link to={`/cinemas/${cinema?.id}`} className="text-text-primary font-bold text-xs uppercase tracking-tight hover:text-brand transition-colors">
                                {cinema?.name}
                            </Link>
                            <p className="text-text-muted text-[9px] font-black uppercase tracking-widest mt-0.5 flex items-center gap-1.5 opacity-60">
                                <Icon icon="solar:map-point-linear" className="text-brand" width="10" />
                                {cinema?.city} {cinema?.address && ` · ${cinema.address}`}
                            </p>
                        </div>
                        {cinema?.google_maps_url && (
                            <a href={cinema.google_maps_url} target="_blank" rel="noopener noreferrer" className="text-brand text-[9px] font-black uppercase tracking-widest hover:underline">
                                DIRECTIONS →
                            </a>
                        )}
                    </div>

                    <ShowtimeGrid times={times} />
                </div>
            ))}

            {hasMore && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full py-4 border-2 border-dashed border-border rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-text-muted hover:text-brand hover:border-brand transition-all bg-surface-2/5 flex items-center justify-center gap-3 group mt-4"
                >
                    {isExpanded ? (
                        <>
                            <span>COLLAPSE CINEMA LIST</span>
                            <span className="text-xs group-hover:-translate-y-0.5 transition-transform">↑</span>
                        </>
                    ) : (
                        <>
                            <span>+ {cinemasArray.length - 3} MORE CINEMAS SHOWING THIS</span>
                            <span className="text-xs group-hover:translate-y-0.5 transition-transform">↓</span>
                        </>
                    )}
                </button>
            )}
        </div>
    )
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
        <div className="min-h-screen bg-bg">
            {/* Page Header */}
            <div className="bg-surface-2/10 border-b border-border relative overflow-hidden">
                <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none"></div>
                <div className="max-w-7xl mx-auto px-4 py-16 pt-32 border-x border-border relative z-10">
                    <h1 className="text-4xl md:text-6xl font-heading font-bold text-text-primary mb-4 tracking-tighter uppercase italic">
                        The Big Screen
                    </h1>
                    <p className="text-text-muted text-sm max-w-xl italic border-l-2 border-brand pl-6">
                        Experience Nollywood as it was meant to be seen. Real-time showtimes across all major cinema chains in Nigeria.
                    </p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto border-x border-border min-h-[600px] pb-20">
                {/* Controls Section */}
                <div className="grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border border-b border-border">
                    {/* Date Sidebar */}
                    <div className="lg:col-span-1 p-8 space-y-8 bg-surface-2/5">
                        <div>
                            <h3 className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em] mb-4">SELECT DATE</h3>
                            <div className="flex flex-col gap-2">
                                {next7Days.map(date => (
                                    <button
                                        key={date}
                                        onClick={() => setSelectedDate(date)}
                                        className={`w-full flex items-center justify-between p-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                            selectedDate === date
                                                ? 'bg-brand text-white shadow-lg shadow-brand/20'
                                                : 'bg-surface border border-border text-text-muted hover:text-text-primary'
                                        }`}
                                    >
                                        <span>{formatDate(date)}</span>
                                        {selectedDate === date && <span className="animate-pulse">→</span>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Main Filters & Content */}
                    <div className="lg:col-span-3">
                        <div className="p-8 border-b border-border bg-surface-2/5">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* City filter */}
                                <div className="space-y-2">
                                    <label className="text-text-muted text-[9px] font-black uppercase tracking-widest pl-1">CITY</label>
                                    <select
                                        value={selectedCity}
                                        onChange={e => setSelectedCity(e.target.value)}
                                        className="w-full bg-surface border border-border text-text-primary rounded-lg px-4 py-3 text-[10px] font-black tracking-widest focus:border-brand focus:outline-none transition-all"
                                    >
                                        {cities.map(city => (
                                            <option key={city} value={city}>{city.toUpperCase()}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Cinema filter */}
                                <div className="space-y-2">
                                    <label className="text-text-muted text-[9px] font-black uppercase tracking-widest pl-1">CINEMA</label>
                                    <select
                                        value={selectedCinema}
                                        onChange={e => setSelectedCinema(e.target.value)}
                                        className="w-full bg-surface border border-border text-text-primary rounded-lg px-4 py-3 text-[10px] font-black tracking-widest focus:border-brand focus:outline-none transition-all"
                                    >
                                        <option value="All">ALL CINEMAS</option>
                                        {cinemas
                                            .filter(c => selectedCity === 'All' || c.city === selectedCity)
                                            .map(c => (
                                                <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
                                            ))
                                        }
                                    </select>
                                </div>

                                {/* Format filter */}
                                <div className="space-y-2">
                                    <label className="text-text-muted text-[9px] font-black uppercase tracking-widest pl-1">EXPERIENCE</label>
                                    <select
                                        value={selectedFormat}
                                        onChange={e => setSelectedFormat(e.target.value)}
                                        className="w-full bg-surface border border-border text-text-primary rounded-lg px-4 py-3 text-[10px] font-black tracking-widest focus:border-brand focus:outline-none transition-all"
                                    >
                                        {formats.map(f => (
                                            <option key={f} value={f}>{f.toUpperCase()}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 md:p-12">
                            {/* Loading */}
                            {loading ? (
                                <div className="space-y-8">
                                    {[1, 2, 3].map(i => <ShowtimeSkeleton key={i} />)}
                                </div>
                            ) : Object.keys(groupedByFilm).length === 0 ? (
                                <div className="text-center py-32 bg-surface-2/10 rounded-xl border-2 border-dashed border-border">
                                    <Icon icon="solar:masks-linear" className="text-4xl mx-auto mb-4 opacity-20 text-brand" />
                                    <h3 className="text-text-muted font-black uppercase tracking-widest text-xs">No screenings archived for this search</h3>
                                </div>
                            ) : (
                                <div className="space-y-12">
                                    {Object.values(groupedByFilm).map(({ film, cinemas: filmCinemas }) => (
                                        <div
                                            key={film?.id}
                                            className="group bg-surface rounded-xl overflow-hidden border border-border hover:border-brand transition-all shadow-sm"
                                        >
                                            {/* Film Header */}
                                            <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border">
                                                <Link
                                                    to={`/films/${film?.slug || film?.id}`}
                                                    className="sm:w-48 lg:w-80 flex-shrink-0 relative overflow-hidden"
                                                >
                                                    {film?.poster_url ? (
                                                        <img
                                                            src={film.poster_url}
                                                            alt={film.title}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-48 sm:h-full bg-surface-2 flex items-center justify-center">
                                                            <Icon icon="solar:clapperboard-play-linear" className="text-4xl text-brand/30" />
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-bg/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </Link>

                                                <div className="flex-1 p-6 sm:p-8">
                                                    <div className="flex items-start justify-between gap-4 mb-4">
                                                        <div>
                                                            <Link
                                                                to={`/films/${film?.slug || film?.id}`}
                                                                className="text-text-primary font-bold text-xl uppercase tracking-tighter group-hover:text-brand transition-colors"
                                                            >
                                                                {film?.title}
                                                            </Link>
                                                            <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mt-1">
                                                                RELEASED: {film?.year} • {film?.average_rating} ★ RATING
                                                            </p>
                                                        </div>
                                                        <span className="bg-brand/10 text-brand text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded border border-brand/30">
                                                            IN CINEMAS
                                                        </span>
                                                    </div>

                                                    {/* Cinemas & Times */}
                                                    <CinemaList filmCinemas={filmCinemas} />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}

export default Showtimes