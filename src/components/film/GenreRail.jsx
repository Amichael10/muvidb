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

export default function GenreRail() {
  return (
    <section className="py-12 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <h2 className="font-heading font-bold text-2xl text-text-primary tracking-tighter">
          Genre Moods
        </h2>
        <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mt-1 opacity-60">
          Find your next obsession
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 px-4 sm:px-6 lg:px-8 pb-4">
        {GENRES.map((genre, i) => (
          <motion.div
            key={genre.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            viewport={{ once: true }}
          >
            <Link
              to={`/browse?genre=${genre.name}`}
              className={`group relative flex flex-col items-center justify-center w-full aspect-square rounded-2xl border border-border bg-gradient-to-br ${genre.color} hover:border-brand/40 transition-all duration-500 overflow-hidden`}
            >
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <Icon 
                icon={genre.icon} 
                className="text-3xl text-text-primary group-hover:scale-110 group-hover:text-brand transition-all duration-500" 
              />
              <span className="mt-3 text-[10px] sm:text-xs font-black uppercase tracking-widest text-text-primary/80 group-hover:text-text-primary transition-colors text-center px-2">
                {genre.name}
              </span>
              
              {/* Decorative accent */}
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-brand/10 rounded-full blur-xl group-hover:bg-brand/20 transition-all" />
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
