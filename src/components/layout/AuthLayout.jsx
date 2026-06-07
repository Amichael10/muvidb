import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { films } from '../../data/mockData';
import { useTheme } from '../../context/ThemeContext';

export default function AuthLayout({ children }) {
  const [currentFilmIndex, setCurrentFilmIndex] = useState(0);
  const { theme } = useTheme();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentFilmIndex((prev) => (prev + 1) % films.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

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
                alt={film.title} 
                className="w-full h-full object-cover grayscale blur-[1px]"
              />
            </div>
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/40 to-transparent"></div>
          <div className="absolute inset-0 grid-bg opacity-10"></div>
        </div>

        {/* Empty Spacer (Logo was here) */}
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
            The premier industry film database.
          </p>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-16 bg-surface relative">
        <div className="absolute inset-0 grid-bg opacity-[0.03] pointer-events-none"></div>
        
        {/* Mobile Logo */}
        <div className="absolute top-10 left-10 lg:hidden">
          <Link to="/" className="flex items-center group shrink-0">
            <img 
              src={theme === 'dark' ? "/images/MuviDB Brand/White Wordmark.svg" : "/images/MuviDB Brand/Wordmark.svg"} 
              alt="MuviDB" 
              className="h-6 object-contain group-hover:scale-105 transition-all duration-500" 
            />
          </Link>
        </div>

        <div className="w-full max-w-md relative z-10">
          {children}
        </div>
      </div>
    </div>
  );
}
