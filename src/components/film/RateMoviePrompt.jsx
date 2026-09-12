import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../../context/AuthContext';

/**
 * Rotten Tomatoes-style "What did you think? / Rate it" interactive callout.
 * Lets users quickly log star ratings and jump directly to audience reviews.
 */
export default function RateMoviePrompt({
  filmTitle,
  userReaction,
  likesCount = 0,
  dislikesCount = 0,
  onReaction,
  onWriteReviewClick,
  className = '',
}) {
  const { user } = useAuth();
  const [hoverStar, setHoverStar] = useState(0);
  const [selectedStar, setSelectedStar] = useState(0);

  const handleStarClick = (num) => {
    setSelectedStar(num);
    if (onReaction) {
      if (num >= 3) {
        onReaction('like');
      } else {
        onReaction('dislike');
      }
    }
    if (onWriteReviewClick) {
      onWriteReviewClick(num);
    }
  };

  return (
    <section className={`p-6 sm:p-8 rounded-2xl bg-surface border border-border/80 shadow-md relative overflow-hidden transition-all duration-300 ${className}`}>
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
        
        {/* Left: Heading & Prompt */}
        <div className="text-center md:text-left space-y-1">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-widest text-brand">
              Audience Reaction
            </span>
          </div>
          <h3 className="font-heading font-bold text-xl sm:text-2xl text-text-primary tracking-tight">
            What did you think of {filmTitle}?
          </h3>
          <p className="text-xs text-text-muted font-medium">
            Your rating shapes the community Popcorn score and helps Nollywood fans discover great films.
          </p>
        </div>

        {/* Right: Star Rater & Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0">
          
          {/* 5-Star Interactive Rater */}
          <div
            className="flex items-center gap-1.5 bg-surface-2/80 px-4 py-2.5 rounded-xl border border-border"
            onMouseLeave={() => setHoverStar(0)}
          >
            {[1, 2, 3, 4, 5].map((star) => {
              const active = hoverStar ? star <= hoverStar : star <= selectedStar;
              return (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverStar(star)}
                  onClick={() => handleStarClick(star)}
                  className="p-1 text-2xl transition-transform hover:scale-125 active:scale-95 focus:outline-none cursor-pointer"
                  title={`Rate ${star} star${star > 1 ? 's' : ''}`}
                >
                  <Icon
                    icon={active ? 'solar:star-bold' : 'solar:star-linear'}
                    className={active ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'text-text-muted/40 hover:text-amber-400/70'}
                  />
                </button>
              );
            })}
          </div>

          {/* Direct Write Review Button */}
          <button
            type="button"
            onClick={() => onWriteReviewClick && onWriteReviewClick()}
            className="inline-flex items-center gap-2 bg-brand hover:bg-brand-hover text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-lg shadow-brand/20 active:scale-95 cursor-pointer min-h-[44px]"
          >
            <Icon icon="solar:pen-2-bold" className="text-sm" />
            <span>Write a Review</span>
          </button>
        </div>
      </div>
    </section>
  );
}
