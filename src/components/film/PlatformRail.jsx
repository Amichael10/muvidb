import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';

const PLATFORMS = [
  { id: 'netflix', name: 'Netflix', icon: 'simple-icons:netflix', color: 'from-[#E50914]/20 to-[#E50914]/5' },
  { id: 'kava', name: 'Kava', icon: 'solar:play-circle-bold', color: 'from-[#FF5C00]/20 to-[#FF5C00]/5' },
  { id: 'docuth', name: 'Docuth', icon: 'solar:play-bold', color: 'from-zinc-500/20 to-zinc-600/5' },
  { id: 'prime_video', name: 'Prime Video', icon: 'simple-icons:primevideo', color: 'from-[#00A8E1]/20 to-[#00A8E1]/5' },
  { id: 'youtube', name: 'YouTube', icon: 'simple-icons:youtube', color: 'from-[#FF0000]/20 to-[#FF0000]/5' },
  { id: 'showmax', name: 'Showmax', icon: 'solar:tv-linear', color: 'from-[#E10098]/20 to-[#E10098]/5' },
];

export default function PlatformRail({ films = [] }) {
  // Compute valid platforms with films
  const activePlatforms = PLATFORMS.map(platform => {
    const platformFilms = films.filter(f => {
      if (f.release_type === platform.id) return true;
      if (platform.id === 'youtube' && f.source === 'youtube') return true;
      
      let streamingLinks = {};
      if (typeof f.streaming_links === 'string') {
        try { streamingLinks = JSON.parse(f.streaming_links); } catch(e) {}
      } else if (f.streaming_links) {
        streamingLinks = f.streaming_links;
      }
      return !!streamingLinks[platform.id];
    });
    
    const count = platformFilms.length;
    
    // Find the latest added film (by created_at or year) to use as the cover background
    const coverFilm = [...platformFilms]
      .filter(f => f.backdrop_url || f.poster_url)
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];

    const coverImage = coverFilm?.backdrop_url || coverFilm?.poster_url || '';
    
    return {
      ...platform,
      count,
      coverImage
    };
  }).filter(p => p.count > 0);

  if (activePlatforms.length === 0) return null;

  return (
    <section className="py-16 overflow-hidden bg-surface-2/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10 border-x border-white/5">
        <h2 className="font-heading font-bold text-2xl text-text-primary tracking-tighter">
          Watch Platforms
        </h2>
        <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mt-1 opacity-60">
          Stream Nollywood favorites instantly on your choice of service
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-x border-white/5">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {activePlatforms.map((platform, i) => (
            <motion.div
              key={platform.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.4), duration: 0.5 }}
              viewport={{ once: true }}
            >
              <Link
                to={`/browse?platform=${encodeURIComponent(platform.id)}`}
                className="group relative flex flex-col justify-end w-full h-44 rounded-2xl border border-border overflow-hidden bg-surface hover:border-brand/40 hover:shadow-2xl hover:shadow-brand/5 transition-all duration-500"
              >
                {/* Background Cover Image (with blur-up effect) */}
                {platform.coverImage ? (
                  <img 
                    src={platform.coverImage} 
                    alt="" 
                    className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-50 group-hover:scale-110 transition-all duration-700" 
                    loading="lazy"
                  />
                ) : (
                  <div className={`absolute inset-0 bg-gradient-to-br ${platform.color} opacity-20`} />
                )}
                
                {/* Overlay Gradient for Text Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                
                {/* Content Overlay */}
                <div className="relative z-10 p-5 flex items-center justify-between w-full">
                  <div className="space-y-1">
                    <span className="text-white text-lg font-heading font-black tracking-tight group-hover:text-brand transition-colors block">
                      {platform.name}
                    </span>
                    <p className="text-[10px] font-bold text-text-muted group-hover:text-white/80 transition-colors uppercase tracking-widest">
                      {platform.count} {platform.count === 1 ? 'Film' : 'Films'}
                    </p>
                  </div>
                  
                  <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-brand/20 border border-white/10 group-hover:border-brand/30 flex items-center justify-center text-white group-hover:text-brand transition-all shrink-0">
                    <Icon icon={platform.icon} className="text-xl" />
                  </div>
                </div>
                
                {/* Bottom Line Accent using brand color (orange) instead of netflix red */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
