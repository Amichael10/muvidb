/**
 * RankBadge: Standardized leaderboard position badge.
 * 
 * Renders:
 * - Rank 1: Gold / Primary brand circle with white text
 * - Rank 2: Silver circle with black text
 * - Rank 3: Bronze circle with white text
 * - Rank 4+: Clean monospaced #N text
 *
 * @param {Object} props
 * @param {number} props.rank - 1-based position in the ranking
 * @param {'brand'|'purple'|'red'} [props.variant='brand'] - Accent color for Rank 1
 * @param {string} [props.className=''] - Additional container classes
 */
export default function RankBadge({
  rank,
  variant = 'brand',
  className = '',
}) {
  const num = Number(rank);

  if (num === 1) {
    const bgClass =
      variant === 'purple'
        ? 'bg-purple-500 text-white'
        : variant === 'red'
        ? 'bg-red-600 text-white'
        : 'bg-brand text-white';

    return (
      <span
        className={`w-6 h-6 rounded-full font-black text-xs inline-flex items-center justify-center shadow-xs shrink-0 ${bgClass} ${className}`}
        aria-label={`Rank 1`}
      >
        1
      </span>
    );
  }

  if (num === 2) {
    return (
      <span
        className={`w-6 h-6 rounded-full bg-slate-300 text-black font-black text-xs inline-flex items-center justify-center shadow-xs shrink-0 ${className}`}
        aria-label={`Rank 2`}
      >
        2
      </span>
    );
  }

  if (num === 3) {
    return (
      <span
        className={`w-6 h-6 rounded-full bg-[#9A3412] text-white font-black text-xs inline-flex items-center justify-center shadow-xs shrink-0 ${className}`}
        aria-label={`Rank 3`}
      >
        3
      </span>
    );
  }

  return (
    <span
      className={`font-mono text-text-muted font-bold text-xs shrink-0 ${className}`}
      aria-label={`Rank ${num}`}
    >
      #{num}
    </span>
  );
}
