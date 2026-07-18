import { Icon } from '@iconify/react';

/**
 * Unified audience score badge — the site's single rating, "% liked".
 *
 * Reads films.liked_percent (0-100): a Rotten-Tomatoes-style share of the
 * audience that responded positively, computed the same way for TMDB films
 * (vote-count-aware) and YouTube-comment films (de-inflated). When it's null
 * the film simply has no rating — render nothing, never a fake number.
 *
 * variant:
 *   'badge'  — compact overlay chip (card corner)
 *   'inline' — small inline row (card metadata)
 *   'hero'   — large figure (film detail header)
 */
export default function LikedScore({ percent, variant = 'inline', className = '' }) {
  const pct = percent == null ? null : Math.round(Number(percent));
  if (pct == null || Number.isNaN(pct)) return null;

  // Fresh vs. rotten split, mirroring the popcorn metaphor users know.
  const fresh = pct >= 60;
  const color = fresh ? 'text-[#FA320A]' : 'text-[#6B7280]';

  if (variant === 'hero') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <Icon icon="mdi:popcorn" className={`${color} text-4xl md:text-5xl drop-shadow-lg`} />
        <div className="flex flex-col justify-end pb-1">
          <span className="text-brand text-4xl md:text-5xl font-bold font-heading leading-none tracking-tighter">{pct}%</span>
          <span className="text-white/60 text-[10px] font-bold tracking-wide mt-1">liked this</span>
        </div>
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <div className={`flex items-center gap-1 bg-black/75 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-white/10 shadow-lg ${className}`}>
        <Icon icon="mdi:popcorn" className={`${color} text-[11px]`} />
        <span className="text-[10px] font-bold text-white leading-none">{pct}%</span>
      </div>
    );
  }

  return (
    <span className={`flex items-center gap-1 font-bold ${className}`}>
      <Icon icon="mdi:popcorn" className={`${color} text-[12px]`} /> {pct}%
    </span>
  );
}
