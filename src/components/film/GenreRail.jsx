import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';

const GENRES = [
  { name: 'Drama', icon: 'solar:mask-happly-bold', color: 'from-blue-500/20 to-blue-600/5' },
  { name: 'Romance', icon: 'solar:heart-bold', color: 'from-pink-500/20 to-pink-600/5' },
  { name: 'Comedy', icon: 'solar:smile-circle-bold', color: 'from-yellow-400/20 to-yellow-500/5' },
  { name: 'Horror', icon: 'solar:skull-bold', color: 'from-gray-700/20 to-black/5' },
  { name: 'Crime', icon: 'solar:danger-triangle-bold', color: 'from-slate-600/20 to-slate-800/5' },
  { name: 'Action', icon: 'solar:bolt-bold', color: 'from-red-500/20 to-red-600/5' },
  { name: 'Thriller', icon: 'solar:ghost-bold', color: 'from-purple-500/20 to-purple-600/5' },
  { name: 'Epic', icon: 'solar:crown-bold', color: 'from-amber-600/20 to-amber-700/5' },
  { name: 'Faith', icon: 'solar:star-bold', color: 'from-sky-400/20 to-sky-500/5' },
  { name: 'Social Issue', icon: 'solar:users-group-rounded-bold', color: 'from-teal-500/20 to-teal-600/5' },
  { name: 'Melodrama', icon: 'solar:sad-circle-bold', color: 'from-indigo-500/20 to-indigo-600/5' },
  { name: 'Urban', icon: 'solar:city-bold', color: 'from-zinc-500/20 to-zinc-600/5' },
  { name: 'RomCom', icon: 'solar:heart-angle-bold', color: 'from-rose-400/20 to-rose-500/5' },
  { name: 'Mystery', icon: 'solar:eye-bold', color: 'from-violet-600/20 to-violet-700/5' },
  { name: 'Musical', icon: 'solar:music-note-bold', color: 'from-fuchsia-500/20 to-fuchsia-600/5' },
  { name: 'Family', icon: 'solar:home-smile-bold', color: 'from-orange-400/20 to-orange-500/5' },
  { name: 'Biography', icon: 'solar:user-id-bold', color: 'from-emerald-500/20 to-emerald-600/5' },
  { name: 'Documentary', icon: 'solar:videocamera-record-bold', color: 'from-cyan-500/20 to-cyan-600/5' },
  { name: 'Animation', icon: 'solar:ghost-bold', color: 'from-lime-500/20 to-lime-600/5' },
];

export default function GenreRail({ films = [] }) {
  // Compute valid genres with films
  const activeGenres = GENRES.map(genre => {
    const genreFilms = films.filter(f => f.genres?.includes(genre.name));
    const count = genreFilms.length;
    
    // Find the latest added film (by created_at or year) to use as the cover background
    const coverFilm = [...genreFilms]
      .filter(f => f.backdrop_url || f.poster_url)
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];

    const coverImage = coverFilm?.backdrop_url || coverFilm?.poster_url || '';
    
    return {
      ...genre,
      count,
      coverImage
    };
  }).filter(g => g.count > 0);

  if (activeGenres.length === 0) return null;

  return (
    <section className="py-16 overflow-hidden bg-surface-2/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10 border-x border-white/5">
        <h2 className="font-heading font-bold text-2xl text-text-primary tracking-tighter">
          Genre Moods
        </h2>
        <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mt-1 opacity-60">
          Find your next obsession — dynamically updated
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-x border-white/5">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {activeGenres.map((genre, i) => (
            <motion.div
              key={genre.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.4), duration: 0.5 }}
              viewport={{ once: true }}
            >
              <Link
                to={`/browse?genre=${encodeURIComponent(genre.name)}`}
                className="group relative flex flex-col justify-end w-full h-44 rounded-2xl border border-border overflow-hidden bg-surface hover:border-brand/40 hover:shadow-2xl hover:shadow-brand/5 transition-all duration-500"
              >
                {/* Background Cover Image (with blur-up effect) */}
                {genre.coverImage ? (
                  <img 
                    src={genre.coverImage} 
                    alt="" 
                    className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-50 group-hover:scale-110 transition-all duration-700" 
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-brand/10 to-transparent opacity-20" />
                )}
                
                {/* Overlay Gradient for Text Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                
                {/* Content Overlay */}
                <div className="relative z-10 p-5 flex items-center justify-between w-full">
                  <div className="space-y-1">
                    <span className="text-white text-lg font-heading font-black tracking-tight group-hover:text-brand transition-colors block">
                      {genre.name}
                    </span>
                    <p className="text-[10px] font-bold text-text-muted group-hover:text-white/80 transition-colors uppercase tracking-widest">
                      {genre.count} {genre.count === 1 ? 'Film' : 'Films'}
                    </p>
                  </div>
                  
                  <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-brand/20 border border-white/10 group-hover:border-brand/30 flex items-center justify-center text-white group-hover:text-brand transition-all shrink-0">
                    <Icon icon={genre.icon} className="text-xl" />
                  </div>
                </div>
                
                {/* Bottom Line Accent */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
