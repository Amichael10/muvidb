import { Icon } from '@iconify/react';
import { score10FromLikedPercent, formatRatingVotes } from '../../lib/rating';

/**
 * Unified rating & score badge for MuviDB.
 *
 * Supports:
 * - IMDb-style Gold Star Rating (0-10, e.g. "★ 7.8")
 * - Rotten-Tomatoes-style Popcorn "% liked" (0-100, e.g. "🍿 84%")
 * - Verified Critic Score (e.g. "✍️ 8.2 Critic Score")
 *
 * Variants:
 * - 'badge'  — compact overlay chip for film cards
 * - 'star'   — IMDb-style gold star badge
 * - 'dual'   — Gold star + Popcorn score side-by-side
 * - 'hero'   — Full hero rating block for film details header
 * - 'inline' — Minimal inline metadata row
 */
export default function LikedScore({
  percent,
  starRating,
  criticScore,
  criticCount = 0,
  votesCount,
  variant = 'inline',
  className = '',
}) {
  const pct = percent != null ? Math.round(Number(percent)) : null;
  const star =
    starRating != null
      ? Number(starRating).toFixed(1)
      : pct != null
      ? score10FromLikedPercent(pct).toFixed(1)
      : null;

  if (pct == null && star == null && criticScore == null) return null;

  // Fresh vs. rotten split for the popcorn metaphor
  const fresh = (pct ?? 60) >= 60;
  const popcornColor = fresh ? 'text-[#FA320A]' : 'text-[#6B7280]';
  const votesLabel = formatRatingVotes(votesCount);

  // 1. HERO VARIANT (FilmDetail header)
  if (variant === 'hero') {
    return (
      <div className={`flex flex-wrap items-center gap-4 sm:gap-6 ${className}`}>
        {/* Primary IMDb-Style Star Rating */}
        {star != null && (
          <div className="flex items-center gap-2.5 bg-black/60 backdrop-blur-md px-3.5 py-2 rounded-xl border border-amber-500/30 shadow-lg shadow-amber-500/5">
            <Icon icon="solar:star-bold" className="text-amber-400 text-3xl sm:text-4xl drop-shadow-md" />
            <div className="flex flex-col justify-center">
              <div className="flex items-baseline gap-1">
                <span className="text-white text-2xl sm:text-3xl font-black font-heading leading-none tracking-tight">
                  {star}
                </span>
                <span className="text-white/40 text-xs font-bold">/10</span>
              </div>
              <span className="text-amber-400/80 text-[10px] font-bold tracking-wider uppercase">
                {votesLabel ? `${votesLabel} ratings` : 'MuviDB Star'}
              </span>
            </div>
          </div>
        )}

        {/* Audience Popcorn % */}
        {pct != null && (
          <div className="flex items-center gap-2.5 bg-black/60 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 shadow-lg">
            <Icon icon="mdi:popcorn" className={`${popcornColor} text-3xl sm:text-4xl drop-shadow-md`} />
            <div className="flex flex-col justify-center">
              <div className="flex items-baseline gap-1">
                <span className="text-brand text-2xl sm:text-3xl font-black font-heading leading-none tracking-tight">
                  {pct}%
                </span>
              </div>
              <span className="text-white/60 text-[10px] font-bold tracking-wider uppercase">
                Audience Liked
              </span>
            </div>
          </div>
        )}

        {/* Verified Critic Score (if present) */}
        {criticScore != null && (
          <div className="flex items-center gap-2.5 bg-black/60 backdrop-blur-md px-3.5 py-2 rounded-xl border border-emerald-500/30 shadow-lg shadow-emerald-500/5">
            <Icon icon="solar:medal-ribbon-star-bold" className="text-emerald-400 text-3xl sm:text-4xl drop-shadow-md" />
            <div className="flex flex-col justify-center">
              <div className="flex items-baseline gap-1">
                <span className="text-emerald-400 text-2xl sm:text-3xl font-black font-heading leading-none tracking-tight">
                  {Number(criticScore).toFixed(1)}
                </span>
                <span className="text-emerald-400/50 text-xs font-bold">/10</span>
              </div>
              <span className="text-emerald-400/80 text-[10px] font-bold tracking-wider uppercase">
                {criticCount > 1 ? `${criticCount} Critics` : 'Critic Score'}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. DUAL VARIANT (Star + Popcorn)
  if (variant === 'dual') {
    return (
      <div className={`inline-flex items-center gap-1.5 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/10 shadow-md ${className}`}>
        {star != null && (
          <span className="flex items-center gap-0.5 text-amber-400 text-xs font-black">
            <Icon icon="solar:star-bold" className="text-amber-400 text-[12px]" />
            {star}
          </span>
        )}
        {star != null && pct != null && (
          <span className="text-white/30 text-[10px]">•</span>
        )}
        {pct != null && (
          <span className="flex items-center gap-0.5 text-white text-[11px] font-bold">
            <Icon icon="mdi:popcorn" className={`${popcornColor} text-[11px]`} />
            {pct}%
          </span>
        )}
      </div>
    );
  }

  // 3. STAR VARIANT (IMDb Gold Star)
  if (variant === 'star') {
    return (
      <div className={`inline-flex items-center gap-1 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-md border border-amber-500/30 text-amber-400 text-xs font-black shadow-md ${className}`}>
        <Icon icon="solar:star-bold" className="text-amber-400 text-[13px]" />
        <span>{star || '—'}</span>
        {votesLabel && <span className="text-white/40 text-[9px] font-normal">({votesLabel})</span>}
      </div>
    );
  }

  // 4. BADGE VARIANT (Card corner chip)
  if (variant === 'badge') {
    return (
      <div className={`flex items-center gap-1.5 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 shadow-lg ${className}`}>
        {star != null && (
          <span className="flex items-center gap-0.5 text-amber-400 text-[10px] font-black leading-none">
            <Icon icon="solar:star-bold" className="text-amber-400 text-[11px]" />
            {star}
          </span>
        )}
        {pct != null && (
          <span className="flex items-center gap-0.5 text-white text-[10px] font-bold leading-none">
            <Icon icon="mdi:popcorn" className={`${popcornColor} text-[11px]`} />
            {pct}%
          </span>
        )}
      </div>
    );
  }

  // 5. INLINE DEFAULT
  return (
    <span className={`inline-flex items-center gap-2 font-bold ${className}`}>
      {star != null && (
        <span className="flex items-center gap-1 text-amber-400">
          <Icon icon="solar:star-bold" className="text-amber-400 text-[13px]" />
          {star}
        </span>
      )}
      {pct != null && (
        <span className="flex items-center gap-1 text-white">
          <Icon icon="mdi:popcorn" className={`${popcornColor} text-[12px]`} />
          {pct}%
        </span>
      )}
    </span>
  );
}

