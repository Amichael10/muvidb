import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { films as mockFilms } from '../../data/mockData';
import { getFilmBackdrop, getFilmPoster } from '../../lib/filmImages';

function normalizeTop10(rows) {
  return (rows || [])
    .filter((item) => item?.films)
    .map((item) => {
      const film = item.films;
      return {
        id: film.id,
        title: film.title,
        poster: getFilmPoster(film),
        backdrop: getFilmBackdrop(film),
        rank: item.rank,
      };
    })
    .filter((f) => f.poster);
}

function normalizeMock() {
  return mockFilms.map((f) => ({
    id: f.id,
    title: f.title,
    poster: f.poster,
    backdrop: f.backdrop || f.poster,
  }));
}

export default function AuthLayout({ children }) {
  const [films, setFilms] = useState(normalizeMock);
  const [currentFilmIndex, setCurrentFilmIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('top_10_films')
        .select(`
          rank,
          films ( id, title, poster_url, backdrop_url )
        `)
        .order('rank', { ascending: true })
        .limit(10);

      if (cancelled) return;

      if (!error) {
        const next = normalizeTop10(data);
        if (next.length > 0) {
          setFilms(next);
          setCurrentFilmIndex(0);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (films.length <= 1) return undefined;
    const timer = setInterval(() => {
      setCurrentFilmIndex((prev) => (prev + 1) % films.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [films.length]);

  return (
    <div className="min-h-screen flex w-full bg-surface">
      {/* LEFT PANEL (Desktop Only) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-bg overflow-hidden flex-col justify-between p-16 border-r border-border">
        {/* Background Ticker */}
        <div className="absolute inset-0 z-0">
          {films.map((film, index) => (
            <div
              key={film.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                index === currentFilmIndex ? 'opacity-40 scale-105' : 'opacity-0 scale-100'
              } transition-transform duration-[5000ms]`}
            >
              <img
                src={film.backdrop || film.poster}
                alt=""
                className="w-full h-full object-cover grayscale blur-[1px]"
              />
            </div>
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/40 to-transparent" />
          <div className="absolute inset-0 grid-bg opacity-10" />
        </div>

        <div className="relative z-10 h-10" />

        {/* Poster Ticker */}
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <div className="relative w-80 h-[500px] perspective-1000">
            {films.map((film, index) => (
              <div
                key={film.id}
                className={`absolute inset-0 transition-all duration-1000 ease-in-out transform ${
                  index === currentFilmIndex
                    ? 'opacity-100 translate-x-0 rotate-0 scale-100'
                    : 'opacity-0 translate-x-12 rotate-6 scale-95 pointer-events-none'
                }`}
              >
                <div className="w-full h-full rounded-2xl overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.9)] border border-white/10 bg-bg group">
                  <img
                    src={film.poster}
                    alt={film.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Text */}
        <div className="relative z-10 mt-12 space-y-6">
          <h1 className="font-heading font-bold text-6xl text-white tracking-tighter leading-[0.9]">
            The Digital <br />Database of <br /><span className="text-brand">Nollywood.</span>
          </h1>
          <p className="text-xs font-bold text-text-muted opacity-60">
            {films[currentFilmIndex]?.rank
              ? `This week’s Top 10 · #${films[currentFilmIndex].rank} ${films[currentFilmIndex].title}`
              : 'The premier industry film database.'}
          </p>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-16 bg-surface relative">
        <div className="absolute inset-0 grid-bg opacity-[0.03] pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          {children}
        </div>
      </div>
    </div>
  );
}
