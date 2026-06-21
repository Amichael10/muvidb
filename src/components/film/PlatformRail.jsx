import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { PLATFORMS, isFilmOnPlatform } from '../../lib/platforms';

// "Where to Watch" — the signature top-level entry point answering the #1
// Nollywood query: "where can I watch it?". Each tile links to /watch/:platform.
export default function PlatformRail({ films = [], counts = {} }) {
  // Counts come from accurate DB-level queries (passed in). Cover art is a
  // best-effort pick from the client film list (may be absent for low-view
  // platforms — the gradient fallback covers that).
  const activePlatforms = PLATFORMS
    .filter((platform) => !platform.isCinema && platform.id !== 'cinema')
    .map((platform) => {
      const coverFilm = films
        .filter((f) => (f.backdrop_url || f.poster_url) && isFilmOnPlatform(f, platform.id))
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];

      return {
        ...platform,
        count: counts[platform.id] || 0,
        coverImage: coverFilm?.backdrop_url || coverFilm?.poster_url || '',
      };
    }).filter((p) => p.count > 0 || p.id === 'ebonylife');

  if (activePlatforms.length === 0) return null;

  return (
    <section className="relative overflow-hidden py-16 bg-gradient-to-b from-surface-2/20 to-bg">
      {/* Brand radial glow (mockup .watch treatment) */}
      <div className="absolute top-0 left-[12%] w-[700px] h-[300px] bg-brand/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h2 className="font-heading font-black text-2xl md:text-4xl text-text-primary tracking-tighter">
            Where can <span className="text-brand">I watch it?</span>
          </h2>
          <p className="text-text-secondary text-sm mt-2 max-w-xl">
            Every Nollywood title, and exactly where it&apos;s streaming right now.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-5">
          {activePlatforms.map((platform, i) => (
            <motion.div
              key={platform.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.3), duration: 0.5 }}
              viewport={{ once: true }}
            >
              <Link
                to={`/watch/${platform.id}`}
                className="group relative flex flex-col justify-end w-full h-36 md:h-40 rounded-2xl border border-border overflow-hidden bg-surface hover:border-brand/50 hover:shadow-2xl hover:shadow-brand/10 hover:-translate-y-1 transition-all duration-500"
              >
                {/* Cover art */}
                {platform.coverImage ? (
                  <img
                    src={platform.coverImage}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-25 group-hover:opacity-40 group-hover:scale-110 transition-all duration-700"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{ background: `linear-gradient(135deg, ${platform.color}33, transparent)` }}
                  />
                )}

                {/* Brand-color left accent (mockup .plat::before) */}
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: platform.color }} />

                {/* Readability overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent" />

                {/* Arrow */}
                <span className="absolute top-3.5 right-3.5 text-white/40 group-hover:text-brand group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all z-10">
                  <Icon icon="solar:arrow-right-up-linear" className="text-base" />
                </span>

                <div className="relative z-10 p-4">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 border border-white/10"
                    style={{ background: `${platform.color}22`, color: platform.color }}
                  >
                    <Icon icon={platform.icon} className="text-lg" />
                  </div>
                  <span className="block text-white font-heading font-bold text-sm md:text-base tracking-tight group-hover:text-brand transition-colors">
                    {platform.name}
                  </span>
                  <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mt-0.5">
                    {platform.count} {platform.count === 1 ? 'title' : 'titles'}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
