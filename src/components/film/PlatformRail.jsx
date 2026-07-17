import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { PLATFORMS, isFilmOnPlatform } from '../../lib/platforms';
import { getProxiedImageUrl } from '../../lib/imageUrl';

const compactCount = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

// "Where to Watch" — the signature top-level entry point answering the #1
// Nollywood query: "where can I watch it?". Each tile links to /watch/:platform.
export default function PlatformRail({ films = [], counts = {} }) {
  // The streaming platforms are a FIXED set — this is the product's headline
  // "where to watch" hub, so the tiles must be stable on every load. We always
  // render the full non-cinema platform list; counts are best-effort labels that
  // fill in when their (slow) DB queries return. A missing/failed count therefore
  // never makes a platform appear or disappear — it just shows no number yet.
  const activePlatforms = PLATFORMS
    .filter((platform) => !platform.isCinema && platform.id !== 'cinema')
    .map((platform) => {
      const coverFilm = films
        .filter((f) => (f.backdrop_url || f.poster_url) && isFilmOnPlatform(f, platform.id))
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];

      return {
        ...platform,
        count: counts[platform.id], // number | null (failed) | undefined (loading)
        coverImage: coverFilm?.backdrop_url || coverFilm?.poster_url || '',
      };
    });

  return (
    <section className="relative overflow-hidden py-12 md:py-16">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 md:mb-10">
          <p className="text-brand text-[10px] font-bold uppercase tracking-[0.25em] mb-2">
            Explore by platform
          </p>
          <h2 className="font-heading font-black text-2xl md:text-4xl text-white tracking-tighter">
            Where can <span className="text-brand">I watch it?</span>
          </h2>
          <p className="text-white/60 text-sm mt-2 max-w-xl">
            Every Nollywood title, and exactly where it&apos;s streaming right now.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
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
                style={{
                  '--platform-color': platform.color,
                  '--platform-glow': `${platform.color}33`
                }}
                className="group relative flex flex-col w-full min-h-[220px] rounded-lg border border-white/15 overflow-hidden bg-[#17181b] shadow-[0_10px_28px_rgba(0,0,0,0.24)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--platform-color)] hover:shadow-[0_16px_32px_rgba(0,0,0,0.34),0_0_22px_var(--platform-glow)]"
              >
                <div className="relative h-32 overflow-hidden bg-[#0d0e10]">
                  {platform.coverImage ? (
                    <img
                      src={getProxiedImageUrl(platform.coverImage, { width: 640 })}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-95 group-hover:scale-105 transition-all duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <>
                      <div
                        className="absolute inset-0"
                        style={{ background: `linear-gradient(135deg, ${platform.color}42 0%, #111216 72%)` }}
                      />
                      <Icon
                        icon={platform.icon}
                        className="absolute right-5 bottom-2 text-7xl opacity-15"
                        style={{ color: platform.color }}
                      />
                    </>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#17181b] via-transparent to-black/10" />
                  <div className="absolute left-0 right-0 top-0 h-1" style={{ background: platform.color }} />
                </div>

                <div className="relative flex flex-1 flex-col px-4 pt-7 pb-4 md:px-5">
                  <div
                    className="absolute -top-6 left-4 md:left-5 w-12 h-12 rounded-lg flex items-center justify-center border border-white/20 overflow-hidden shadow-[0_8px_20px_rgba(0,0,0,0.45)]"
                    style={platform.logo ? { background: '#fff' } : { background: `${platform.color}2e`, color: platform.color }}
                  >
                    {platform.logo ? (
                      <img src={platform.logo} alt={platform.name} className="w-full h-full object-contain p-1.5" loading="lazy" />
                    ) : (
                      <Icon icon={platform.icon} className="text-xl" />
                    )}
                  </div>

                  <span className="block text-white font-heading font-bold text-base tracking-tight group-hover:text-brand transition-colors line-clamp-1">
                    {platform.name}
                  </span>
                  <div className="mt-auto pt-3 flex items-center justify-between gap-3 border-t border-white/10">
                    <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider line-clamp-1">
                      {platform.count > 0
                        ? `${compactCount.format(platform.count)} ${platform.count === 1 ? 'title' : 'titles'}`
                        : 'Catalogue'}
                    </p>
                    <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-brand group-hover:text-white transition-colors">
                      Browse
                      <Icon icon="solar:arrow-right-linear" className="text-sm group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
