/**
 * KAP Cinema adapter — Kunle Afolayan Production Cinema (Ikeja, Lagos).
 *
 * KAP Cinema exposes a direct public JSON REST API at `https://kapcinema.com/tables`:
 *   - `/tables/movies`    → film catalog with metadata (synopsis, cast, genre, duration)
 *   - `/tables/showtimes` → screening schedule with dates, times, halls, and capacity
 *
 * Each showtime contains `total_seats` and `available_seats`, allowing live occupancy
 * and seat availability calculation.
 */

import type { AdapterResult, CinemaAdapter, CinemaRow, ScrapedShowtime } from './types.js';
import { inferFormat, todayLagos } from './types.js';
import { cinemaFetch } from './cinema-fetch.js';

const KAP_BASE = 'https://kapcinema.com';

interface KapMovieDTO {
  id: string;
  title: string;
  synopsis?: string;
  genre?: string;
  duration?: number;
  rating?: string;
  cast?: string;
  director?: string;
  poster?: string;
  trailer?: string;
  status?: string;
  active?: boolean;
}

interface KapShowtimeDTO {
  id: string;
  movie_id: string;
  date: string;         // 'YYYY-MM-DD'
  time: string;         // 'HH:mm'
  hall?: string;        // 'Hall A'
  format?: string;      // '2D', '3D', 'VIP'
  total_seats?: number;
  available_seats?: number;
}

export const kapCinemaAdapter: CinemaAdapter = async (cinema: CinemaRow): Promise<AdapterResult> => {
  const baseUrl = cinema.scrape_config?.baseUrl || KAP_BASE;
  const today = todayLagos(0);

  try {
    const [moviesRes, showtimesRes] = await Promise.all([
      cinemaFetch(`${baseUrl}/tables/movies`, {
        headers: { Accept: 'application/json' },
      }),
      cinemaFetch(`${baseUrl}/tables/showtimes`, {
        headers: { Accept: 'application/json' },
      }),
    ]);

    if (!moviesRes.ok || !showtimesRes.ok) {
      throw new Error(`KAP API error: movies status ${moviesRes.status}, showtimes status ${showtimesRes.status}`);
    }

    const moviesJson = await moviesRes.json() as { data?: KapMovieDTO[] };
    const showtimesJson = await showtimesRes.json() as { data?: KapShowtimeDTO[] };

    const movies = moviesJson.data || [];
    const showtimesRaw = showtimesJson.data || [];

    const movieMap = new Map<string, KapMovieDTO>(
      movies.map((m) => [m.id, m])
    );

    const showtimes: ScrapedShowtime[] = [];

    for (const st of showtimesRaw) {
      // Filter out past showtimes
      if (!st.date || st.date < today) continue;
      if (!st.time) continue;

      const movie = movieMap.get(st.movie_id);
      if (!movie || !movie.title) continue;

      const title = movie.title.trim();
      const format = inferFormat(title) || (st.format === '3D' ? '3D' : 'Standard');
      const timeFormatted = st.time.length === 5 ? `${st.time}:00` : st.time;

      showtimes.push({
        externalFilmId: `kap-${movie.id}`,
        filmTitle: title,
        showDate: st.date,
        showTime: timeFormatted,
        format,
        screenName: st.hall || 'Main Screen',
        ticketUrl: `${baseUrl}/booking.html?movie=${encodeURIComponent(st.movie_id)}&showtime=${encodeURIComponent(st.id)}`,
        price: 15000, // Standard ticket price
        filmMeta: {
          synopsis: movie.synopsis || null,
          posterUrl: movie.poster || null,
          trailerUrl: movie.trailer || null,
          runtimeMinutes: movie.duration || null,
          rating: movie.rating || null,
        },
      });
    }

    return {
      cinemaId: cinema.id,
      showtimes,
    };
  } catch (err: any) {
    return {
      cinemaId: cinema.id,
      showtimes: [],
      error: `kapCinemaAdapter failed: ${err.message}`,
    };
  }
};
