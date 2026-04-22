import { Link } from 'react-router-dom';
import { films } from '../../data/mockData';
import FilmCard from '../film/FilmCard';

export default function AuthLayout({ children }) {
  // Use the first 3 films for the decorative stack
  const stackFilms = films.slice(0, 3);

  return (
    <div className="min-h-screen flex w-full bg-surface">
      {/* LEFT PANEL (Desktop Only) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-bg overflow-hidden flex-col justify-between p-12">
        {/* Background Image with Gradient */}
        <div className="absolute inset-0 z-0">
          <img 
            src={films[0]?.backdrop || "https://placehold.co/1920x1080/0A0F1E/D4A017?text=Backdrop"} 
            alt="Background" 
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-bg/90 via-bg/50 to-transparent"></div>
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2 text-brand font-heading font-bold text-2xl hover:opacity-80 transition-opacity">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
              <line x1="7" y1="2" x2="7" y2="22"/>
              <line x1="17" y1="2" x2="17" y2="22"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <line x1="2" y1="7" x2="7" y2="7"/>
              <line x1="2" y1="17" x2="7" y2="17"/>
              <line x1="17" y1="17" x2="22" y2="17"/>
              <line x1="17" y1="7" x2="22" y2="7"/>
            </svg>
            FilmDba
          </Link>
        </div>

        {/* Decorative Film Stack */}
        <div className="relative z-10 flex-1 flex items-center justify-center mt-12">
          <div className="relative w-64 h-96">
            {stackFilms.map((film, index) => {
              const rotations = ['rotate-3', 'rotate-0', '-rotate-2'];
              const zIndexes = ['z-10', 'z-20', 'z-30'];
              const translations = ['translate-x-8 translate-y-4', 'translate-x-0 translate-y-0', '-translate-x-8 -translate-y-4'];
              
              return (
                <div 
                  key={film.id} 
                  className={`absolute inset-0 ${rotations[index]} ${zIndexes[index]} ${translations[index]} transition-transform duration-500 hover:scale-105`}
                  style={{ pointerEvents: 'none' }}
                >
                  <div className="w-full h-full rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-border/50 bg-bg">
                    <img src={film.poster} alt={film.title} className="w-full h-full object-cover" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Text */}
        <div className="relative z-10 mt-12">
          <h1 className="font-heading font-bold text-5xl text-text-primary mb-4 leading-tight">
            The home of <br />African cinema.
          </h1>
          <p className="text-xl text-text-muted">
            Discover. Rate. Celebrate Nollywood.
          </p>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-surface relative">
        {/* Mobile Logo */}
        <div className="absolute top-6 left-6 lg:hidden">
          <Link to="/" className="flex items-center gap-2 text-brand font-heading font-bold text-xl">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
              <line x1="7" y1="2" x2="7" y2="22"/>
              <line x1="17" y1="2" x2="17" y2="22"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <line x1="2" y1="7" x2="7" y2="7"/>
              <line x1="2" y1="17" x2="7" y2="17"/>
              <line x1="17" y1="17" x2="22" y2="17"/>
              <line x1="17" y1="7" x2="22" y2="7"/>
            </svg>
            FilmDba
          </Link>
        </div>

        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
