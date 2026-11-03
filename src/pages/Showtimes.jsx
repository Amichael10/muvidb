import { useState, useEffect, useRef } from 'react'
import { useLoaderData } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PopcornField from '../components/ui/PopcornField'
import PageHeader from '../components/ui/PageHeader'
import { getNext7Dates, getZonedClock, isPublicCinemaShowtime } from '../utils/showtimes'
import MobileShowtimesView from '../components/showtimes/mobile/MobileShowtimesView'
import DesktopShowtimesView from '../components/showtimes/desktop/DesktopShowtimesView'

const Showtimes = () => {
    const loaderData = useLoaderData()
    const seeded = !!loaderData?.seeded && (loaderData.showtimes?.length ?? 0) > 0
    const [showtimes, setShowtimes] = useState(loaderData?.showtimes ?? [])
    const [loading, setLoading] = useState(!seeded)
    const [currentTime, setCurrentTime] = useState(() => new Date())
    const [selectedCity, setSelectedCity] = useState('All')
    const [selectedDate, setSelectedDate] = useState(
      () => loaderData?.selectedDate || getZonedClock().date
    )
    const [selectedCinema, setSelectedCinema] = useState('All')
    const [selectedFormat, setSelectedFormat] = useState('All')
    const [selectedChain, setSelectedChain] = useState('All')
    const [searchQuery, setSearchQuery] = useState('')
    const [cinemas, setCinemas] = useState(loaderData?.cinemas ?? [])
    const skipInitialFetch = useRef(seeded)

    const cities = ['All', 'Lagos', 'Abuja', 'Port Harcourt']
    const formats = ['All', 'Standard', 'IMAX', '3D', '4DX', 'Dolby']
    const chains = ['All', 'Filmhouse', 'Genesis', 'Silverbird', 'Ozone', 'Blu Star', 'Kada', 'Viva']
    const cinemaClock = getZonedClock(currentTime)
    const next7Days = getNext7Dates(currentTime)

    useEffect(() => {
        if (skipInitialFetch.current) {
            skipInitialFetch.current = false
        } else {
            fetchShowtimes()
            fetchCinemas()
        }

        const clockRefresh = window.setInterval(() => {
            setCurrentTime(new Date())
        }, 60_000)

        return () => window.clearInterval(clockRefresh)
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
        const today = getZonedClock().date

        const { data, error } = await supabase
            .from('showtimes')
            .select(`
        *,
        films(
          id, slug, title, year, poster_url,
          backdrop_url, average_rating, liked_percent,
          status, coming_soon, is_in_cinemas,
          runtime_minutes, trailer_youtube_id,
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
        const matchChain = selectedChain === 'All' ||
            (s.cinemas?.name && s.cinemas.name.toLowerCase().includes(selectedChain.toLowerCase())) ||
            (s.cinemas?.chain && s.cinemas.chain.toLowerCase().includes(selectedChain.toLowerCase()))

        const q = searchQuery.trim().toLowerCase()
        const matchQuery = !q ||
            (s.films?.title && s.films.title.toLowerCase().includes(q)) ||
            (s.cinemas?.name && s.cinemas.name.toLowerCase().includes(q)) ||
            (s.cinemas?.city && s.cinemas.city.toLowerCase().includes(q))

        const isUpcoming = isPublicCinemaShowtime(s, cinemaClock)
        return matchCity && matchDate && matchCinema && matchFormat && matchChain && matchQuery && isUpcoming
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

    const groupedByCinema = filtered.reduce((acc, showtime) => {
        const cinemaId = showtime.cinema_id
        if (!acc[cinemaId]) {
            acc[cinemaId] = {
                cinema: showtime.cinemas,
                films: {}
            }
        }
        const filmId = showtime.film_id
        if (!acc[cinemaId].films[filmId]) {
            acc[cinemaId].films[filmId] = {
                film: showtime.films,
                times: []
            }
        }
        acc[cinemaId].films[filmId].times.push(showtime)
        return acc
    }, {})

    return (
        <div className="min-h-screen bg-bg relative">
            <PopcornField />

            {/* Mobile-First Showtimes (< md) */}
            <MobileShowtimesView
                groupedByFilm={groupedByFilm}
                loading={loading}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                selectedCity={selectedCity}
                setSelectedCity={setSelectedCity}
                selectedCinema={selectedCinema}
                setSelectedCinema={setSelectedCinema}
                selectedFormat={selectedFormat}
                setSelectedFormat={setSelectedFormat}
                next7Days={next7Days}
                cities={cities}
                cinemas={cinemas}
                formats={formats}
            />

            {/* Desktop Showtimes (>= md) */}
            <div className="hidden md:block">
                <PageHeader
                    icon="solar:ticket-bold"
                    eyebrow="In theatres"
                    title="Showtimes"
                    description="Experience Nollywood as it was meant to be seen. Real-time showtimes across all major cinema chains in Nigeria."
                />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-x border-border min-h-[600px] pb-20">
                    <DesktopShowtimesView
                        groupedByFilm={groupedByFilm}
                        groupedByCinema={groupedByCinema}
                        loading={loading}
                        selectedDate={selectedDate}
                        setSelectedDate={setSelectedDate}
                        selectedCity={selectedCity}
                        setSelectedCity={setSelectedCity}
                        selectedCinema={selectedCinema}
                        setSelectedCinema={setSelectedCinema}
                        selectedFormat={selectedFormat}
                        setSelectedFormat={setSelectedFormat}
                        selectedChain={selectedChain}
                        setSelectedChain={setSelectedChain}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        next7Days={next7Days}
                        cities={cities}
                        cinemas={cinemas}
                        formats={formats}
                        CHAINS={chains}
                    />
                </div>
            </div>
        </div>
    )
}

export default Showtimes
