import React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { formatRatingVotes } from '../../lib/rating';

/**
 * Rotten Tomatoes-inspired Dual-Scorecard & Consensus Module for MuviDB.
 * Displays Critics Meter (Tomatometer) and Audience Meter (Popcornmeter)
 * side-by-side with an editorial consensus quote and quick action docks.
 */
export default function RottenTomatoesScorecard({
  film,
  criticScore,
  criticCount = 0,
  featuredQuote = null,
  audiencePercent,
  starRating,
  votesCount = 0,
  onRateClick,
  onWatchClick,
  onTrailerClick,
  className = '',
}) {
  const pct = audiencePercent != null && !isNaN(audiencePercent) ? Math.round(Number(audiencePercent)) : null;
  const star = starRating != null && !isNaN(starRating) && Number(starRating) > 0 ? Number(starRating).toFixed(1) : null;
  const cScore = criticScore != null && !isNaN(criticScore) && Number(criticScore) > 0 ? Number(criticScore).toFixed(1) : null;
  const cScorePct = cScore != null ? Math.round(Number(cScore) * 10) : null;

  const isCriticFresh = cScorePct == null ? null : cScorePct >= 60;
  const isAudienceFresh = pct == null ? null : pct >= 60;

  const votesLabel = formatRatingVotes(votesCount);

  // Only display consensus if an actual featured critic review or editorial consensus is recorded
  const consensusText = featuredQuote?.quote || film?.editorial_consensus || null;
  const consensusSource = featuredQuote ? `${featuredQuote.critic_name || 'Critic'}${featuredQuote.publication ? ` (${featuredQuote.publication})` : ''}` : 'MuviDB Editorial Take';

  const reviewsUrl = film?.slug || film?.id ? `/films/${film.slug || film.id}/reviews` : null;

  return (
    <div className={`w-full bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 md:p-5 shadow-xl transition-all duration-300 ${className}`}>
      {/* 1. TOP METERS ROW: Critics Score + Audience Score + Star & Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 divide-y sm:divide-y-0 sm:divide-x divide-white/10 pb-3">
        
        {/* CRITICS SCORE (TOMATOMETER STYLE) */}
        {reviewsUrl ? (
          <Link
            to={`${reviewsUrl}?tab=all_critics`}
            className="flex items-center gap-3 pr-2 group/critic hover:opacity-95 cursor-pointer transition-opacity"
            title="View all critic reviews"
          >
            <div className="relative shrink-0 flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/5 border border-white/10 group-hover/critic:border-emerald-500/40 transition-colors">
              {cScorePct != null ? (
                isCriticFresh ? (
                  <Icon icon="solar:medal-ribbon-star-bold" className="text-emerald-400 text-2xl drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
                ) : (
                  <Icon icon="solar:danger-triangle-bold" className="text-amber-500 text-2xl drop-shadow" />
                )
              ) : (
                <Icon icon="solar:pen-2-bold" className="text-white/30 text-xl" />
              )}
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black font-heading text-white tracking-tight leading-none group-hover/critic:text-emerald-400 transition-colors">
                  {cScorePct != null ? `${cScorePct}%` : (cScore ? `${cScore}/10` : '—')}
                </span>
                {cScorePct != null && isCriticFresh && (
                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    Fresh
                  </span>
                )}
              </div>
              <div className="text-[11px] font-bold text-white/70 uppercase tracking-wider mt-0.5 flex items-center gap-1 whitespace-nowrap group-hover/critic:text-white transition-colors">
                <span>Critics Score</span>
                <Icon icon="solar:alt-arrow-right-linear" className="text-[10px] opacity-0 group-hover/critic:opacity-100 transition-opacity" />
              </div>
              <div className="text-[10px] text-white/40 font-medium">
                {criticCount > 0 ? `${criticCount} Reviews Counted` : 'Awaiting reviews'}
              </div>
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-3 pr-2">
            <div className="relative shrink-0 flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/5 border border-white/10">
              {cScorePct != null ? (
                isCriticFresh ? (
                  <Icon icon="solar:medal-ribbon-star-bold" className="text-emerald-400 text-2xl drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
                ) : (
                  <Icon icon="solar:danger-triangle-bold" className="text-amber-500 text-2xl drop-shadow" />
                )
              ) : (
                <Icon icon="solar:pen-2-bold" className="text-white/30 text-xl" />
              )}
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black font-heading text-white tracking-tight leading-none">
                  {cScorePct != null ? `${cScorePct}%` : (cScore ? `${cScore}/10` : '—')}
                </span>
                {cScorePct != null && isCriticFresh && (
                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    Fresh
                  </span>
                )}
              </div>
              <div className="text-[11px] font-bold text-white/70 uppercase tracking-wider mt-0.5 whitespace-nowrap">
                Critics Score
              </div>
              <div className="text-[10px] text-white/40 font-medium">
                {criticCount > 0 ? `${criticCount} Reviews Counted` : 'Awaiting reviews'}
              </div>
            </div>
          </div>
        )}

        {/* AUDIENCE SCORE (POPCORNMETER STYLE) */}
        {reviewsUrl ? (
          <Link
            to={`${reviewsUrl}?tab=all_audience`}
            className="flex items-center gap-3 pt-3 sm:pt-0 sm:px-3 md:px-4 group/audience hover:opacity-95 cursor-pointer transition-opacity"
            title="View all audience reviews"
          >
            <div className="relative shrink-0 flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/5 border border-white/10 group-hover/audience:border-brand/40 transition-colors">
              {pct != null ? (
                <Icon
                  icon="mdi:popcorn"
                  className={`text-2xl ${isAudienceFresh ? 'text-[#FA320A] drop-shadow-[0_0_10px_rgba(250,50,10,0.5)]' : 'text-gray-400'}`}
                />
              ) : (
                <Icon icon="mdi:popcorn" className="text-white/30 text-2xl" />
              )}
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black font-heading text-white tracking-tight leading-none group-hover/audience:text-brand transition-colors">
                  {pct != null ? `${pct}%` : '—'}
                </span>
                {pct != null && isAudienceFresh && (
                  <span className="text-[9px] font-black uppercase tracking-wider text-brand bg-brand/10 px-1.5 py-0.5 rounded border border-brand/20">
                    Liked
                  </span>
                )}
              </div>
              <div className="text-[11px] font-bold text-white/70 uppercase tracking-wider mt-0.5 flex items-center gap-1 whitespace-nowrap group-hover/audience:text-white transition-colors">
                <span>Audience Score</span>
                <Icon icon="solar:alt-arrow-right-linear" className="text-[10px] opacity-0 group-hover/audience:opacity-100 transition-opacity" />
              </div>
              <div className="text-[10px] text-white/40 font-medium">
                {votesLabel ? `${votesLabel} Ratings Logged` : 'Audience Verified'}
              </div>
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-3 pt-3 sm:pt-0 sm:px-3 md:px-4">
            <div className="relative shrink-0 flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/5 border border-white/10">
              {pct != null ? (
                <Icon
                  icon="mdi:popcorn"
                  className={`text-2xl ${isAudienceFresh ? 'text-[#FA320A] drop-shadow-[0_0_10px_rgba(250,50,10,0.5)]' : 'text-gray-400'}`}
                />
              ) : (
                <Icon icon="mdi:popcorn" className="text-white/30 text-2xl" />
              )}
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black font-heading text-white tracking-tight leading-none">
                  {pct != null ? `${pct}%` : '—'}
                </span>
                {pct != null && isAudienceFresh && (
                  <span className="text-[9px] font-black uppercase tracking-wider text-brand bg-brand/10 px-1.5 py-0.5 rounded border border-brand/20">
                    Liked
                  </span>
                )}
              </div>
              <div className="text-[11px] font-bold text-white/70 uppercase tracking-wider mt-0.5 whitespace-nowrap">
                Audience Score
              </div>
              <div className="text-[10px] text-white/40 font-medium">
                {votesLabel ? `${votesLabel} Ratings Logged` : 'Audience Verified'}
              </div>
            </div>
          </div>
        )}

        {/* MBD/STAR & QUICK ACTION DOCK */}
        <div className="flex items-center justify-between gap-3 pt-3 sm:pt-0 sm:pl-3 md:pl-4">
          {star != null ? (
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                <Icon icon="solar:star-bold" className="text-xl drop-shadow" />
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg sm:text-xl font-black font-heading text-white leading-none">
                    {star}
                  </span>
                  <span className="text-white/40 text-[10px] font-bold">/10</span>
                </div>
                <div className="text-[10px] text-amber-400/80 font-bold uppercase tracking-wider mt-0.5 whitespace-nowrap">
                  MuviDB Score
                </div>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-white/40 font-medium">
              Community Ratings
            </div>
          )}

          {onRateClick && (
            <button
              type="button"
              onClick={onRateClick}
              className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer shrink-0 ml-auto"
              title="Rate this movie"
            >
              <Icon icon="solar:star-linear" className="text-xs text-amber-400" />
              <span>Rate</span>
            </button>
          )}
        </div>

      </div>

      {/* 2. CRITICS & EDITORIAL CONSENSUS CALLOUT */}
      {consensusText && (
        <div className="mt-4 pt-3.5 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 text-xs">
          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded shrink-0">
            <Icon icon="solar:chat-round-check-bold" className="text-xs" />
            Consensus
          </span>
          <p className="text-white/80 font-serif italic text-xs leading-relaxed flex-1 line-clamp-2 sm:line-clamp-1">
            "{consensusText}"
          </p>
          <span className="text-white/40 text-[10px] font-medium shrink-0 self-end sm:self-auto">
            — {consensusSource}
          </span>
        </div>
      )}
    </div>
  );
}
