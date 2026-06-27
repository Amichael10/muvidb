import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { useQuickView } from '../../context/QuickViewContext';
import ImageWithFallback from '../ui/ImageWithFallback';
import FilmCard from './FilmCard';
import { supabase } from '../../lib/supabase';

const formatRuntimeHours = (minutes) => {
  if (!minutes) return null;
  const mins = Number(minutes);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

export default function QuickViewModal() {
  const { selectedFilm, closeQuickView } = useQuickView();
  const [similarFilms, setSimilarFilms] = useState([]);
  const [cast, setCast] = useState([]);
  const [crew, setCrew] = useState([]);
  const modalRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeQuickView();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeQuickView]);

  // Lock body scroll when open
  useEffect(() => {
    if (selectedFilm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedFilm]);

  // Fetch similar films and credits
  useEffect(() => {
    async function fetchData() {
      if (!selectedFilm) return;
      try {
        const { data: related } = await supabase
          .from('films')
          .select('*, film_genres(genres(name))')
          .neq('id', selectedFilm.id)
          .limit(6);
          
        setSimilarFilms(related || []);

        const { data: creditsData } = await supabase
          .from('credits')
          .select(`
            id, role, character_name, billing_order,
            people(id, name, photo_url, popularity_score, slug)
          `)
          .eq('film_id', selectedFilm.id)
          .order('billing_order', { ascending: true });
          
        if (creditsData) {
          const castMembers = creditsData
            .filter(c => {
              const role = (c.role || '').trim().toLowerCase();
              return role === 'actor' || role === 'cast';
            })
            .map(c => {
              const person = Array.isArray(c.people) ? c.people[0] : c.people;
              return person ? { ...person, role: c.character_name || 'Cast' } : null;
            })
            .filter(Boolean);
            
          const crewMembers = creditsData
            .filter(c => {
              const role = (c.role || '').trim().toLowerCase();
              return role !== 'actor' && role !== 'cast';
            })
            .map(c => {
              const person = Array.isArray(c.people) ? c.people[0] : c.people;
              return person ? { ...person, role: c.role || 'Crew' } : null;
            })
            .filter(Boolean);

          setCast(castMembers);
          setCrew(crewMembers);
        } else {
          setCast([]);
          setCrew([]);
        }
      } catch (err) {
        console.error("Failed to fetch modal data", err);
      }
    }
    fetchData();
  }, [selectedFilm]);

  const durationLabel = selectedFilm ? formatRuntimeHours(selectedFilm.runtime_minutes || selectedFilm.runtime) : null;

  return (
    <AnimatePresence>
      {selectedFilm && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 pointer-events-auto"
      >
        {/* Backdrop overlay */}
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeQuickView} />

        {/* Modal Container */}
        <motion.div 
          ref={modalRef}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-[850px] max-h-[90vh] bg-[#141414] rounded-xl shadow-2xl shadow-black border border-white/10 flex flex-col overflow-hidden z-10"
        >
          {/* Scrollable Inner Container */}
          <div className="flex-1 w-full overflow-y-auto overflow-x-hidden scrollbar-hide overscroll-contain">
            {/* Close Button */}
          <button 
            onClick={closeQuickView}
            className="absolute top-4 right-4 z-50 w-9 h-9 rounded-full bg-[#181818] flex items-center justify-center text-white hover:bg-white/20 transition-all border border-white/10"
          >
            <Icon icon="solar:close-linear" className="text-xl" />
          </button>

          {/* Hero Section */}
          <div className="relative w-full h-[450px] shrink-0 bg-black">
            <ImageWithFallback 
              src={selectedFilm.backdrop_url || selectedFilm.poster_url || selectedFilm.poster} 
              alt={selectedFilm.title} 
              className="w-full h-full object-cover"
              fallbackType="banner"
              name={selectedFilm.title}
            />
            {/* Gradients */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#141414]/80 via-transparent to-transparent" />

            {/* Title and Controls */}
            <div className="absolute bottom-6 left-10 right-10">
              <h2 className="text-white text-5xl sm:text-6xl font-heading font-black tracking-tighter leading-tight drop-shadow-xl mb-6 max-w-2xl">
                {selectedFilm.title}
              </h2>
              
              <div className="flex items-center gap-3">
                <Link 
                  to={`/films/${selectedFilm.slug || selectedFilm.id}`}
                  className="flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded hover:bg-white/90 transition-all font-bold text-lg active:scale-95"
                >
                  <Icon icon="solar:play-bold" className="text-xl" />
                  Play
                </Link>
                
                <button className="w-10 h-10 rounded-full border-2 border-white/50 hover:border-white bg-[#181818]/50 flex items-center justify-center text-white transition-all hover:bg-white/10 active:scale-95">
                  <Icon icon="solar:add-linear" className="text-xl" />
                </button>
                
                <button className="w-10 h-10 rounded-full border-2 border-white/50 hover:border-white bg-[#181818]/50 flex items-center justify-center text-white transition-all hover:bg-white/10 active:scale-95">
                  <Icon icon="solar:like-linear" className="text-xl" />
                </button>
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="px-10 py-6 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Left Column: Meta & Synopsis */}
            <div className="md:col-span-2 space-y-4">
              {/* Meta Row */}
              <div className="flex items-center gap-3 text-sm font-bold text-white/90">
                {selectedFilm.year || selectedFilm.release_date?.split('-')[0]}
                {durationLabel && <span>{durationLabel}</span>}
                <span className="border border-white/40 px-1.5 py-0.5 rounded text-[10px] text-white/70">HD</span>
              </div>
              
              {/* Maturity Rating */}
              <div className="flex items-center gap-2">
                <span className="border border-white/40 px-2 py-0.5 rounded text-xs font-bold text-white">
                  {selectedFilm.maturity_rating || '18+'}
                </span>
              </div>

              {/* Tagline */}
              {selectedFilm.tagline && (
                <p className="text-xl font-bold text-white mt-4">{selectedFilm.tagline}</p>
              )}

              {/* Synopsis */}
              <p className="text-sm text-white/90 leading-relaxed mt-2">
                {selectedFilm.synopsis || selectedFilm.overview || selectedFilm.description || 'No synopsis available.'}
              </p>
            </div>

            {/* Right Column: Cast, Genres, Tags */}
            <div className="space-y-4 text-sm">
              <div className="text-white/60">
                <span className="font-medium text-white/40">Cast: </span>
                <span className="text-white/90 hover:underline cursor-pointer">
                  {cast.length > 0 ? cast.slice(0, 3).map(c => c.name).join(', ') : (selectedFilm.cast ? selectedFilm.cast.slice(0, 3).join(', ') : 'Not Available')}
                </span>
                {cast.length > 3 && <span className="italic text-white/60">, more</span>}
              </div>
              
              <div className="text-white/60">
                <span className="font-medium text-white/40">Director: </span>
                <span className="text-white/90 hover:underline cursor-pointer">
                  {crew.find(c => (c.role || '').toLowerCase().includes('director'))?.name || selectedFilm.director || 'Not Available'}
                </span>
              </div>

              <div className="text-white/60">
                <span className="font-medium text-white/40">Genres: </span>
                <span className="text-white/90 hover:underline cursor-pointer">
                  {selectedFilm.genres && selectedFilm.genres.length > 0 ? selectedFilm.genres.join(', ') : 'Movies'}
                </span>
              </div>
            </div>
          </div>

          {/* More Like This Section */}
          {similarFilms.length > 0 && (
            <div className="px-10 pb-10">
              <h3 className="text-2xl font-bold text-white mb-6">More Like This</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {similarFilms.map(film => (
                  <div key={film.id} className="bg-[#2F2F2F] rounded-lg overflow-hidden group cursor-pointer">
                    <div className="relative aspect-video">
                      <ImageWithFallback 
                        src={film.backdrop_url || film.poster_url} 
                        alt={film.title} 
                        className="w-full h-full object-cover"
                      />
                      {/* Play overlay on hover */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                         <Icon icon="solar:play-circle-bold" className="text-white text-4xl hover:scale-110 transition-transform" />
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="border border-white/40 px-1 rounded text-[10px] font-bold text-white/80">{film.maturity_rating || '16+'}</span>
                        </div>
                        <button className="w-8 h-8 rounded-full border border-white/50 hover:border-white flex items-center justify-center text-white">
                          <Icon icon="solar:add-linear" />
                        </button>
                      </div>
                      <p className="text-white text-sm font-bold line-clamp-1">{film.title}</p>
                      <p className="text-white/60 text-xs mt-1 line-clamp-3">
                        {film.synopsis || film.overview || film.description || ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* About Section */}
          <div className="px-10 pb-16 pt-4 border-t border-white/10 mt-8">
            <h3 className="text-2xl font-bold text-white mb-6">About <span className="font-medium">{selectedFilm.title}</span></h3>
            <div className="space-y-2 text-sm text-white/90">
               <p><span className="text-white/50">Director: </span> {crew.find(c => (c.role || '').toLowerCase().includes('director'))?.name || selectedFilm.director || 'Not Available'}</p>
               <p><span className="text-white/50">Cast: </span> {cast.length > 0 ? cast.map(c => c.name).join(', ') : 'Not Available'}</p>
               <p><span className="text-white/50">Writer: </span> {crew.filter(c => (c.role || '').toLowerCase().includes('writer')).map(c => c.name).join(', ') || 'Not Available'}</p>
               <p><span className="text-white/50">Genres: </span> {selectedFilm.genres && selectedFilm.genres.length > 0 ? selectedFilm.genres.join(', ') : 'Movies'}</p>
               <div className="flex items-center gap-2 mt-2">
                 <span className="text-white/50">Maturity Rating: </span>
                 <span className="border border-white/40 px-1.5 py-0.5 rounded text-xs font-bold text-white">{selectedFilm.maturity_rating || '18+'}</span>
               </div>
            </div>
          </div>
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
