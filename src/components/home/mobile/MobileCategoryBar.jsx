import React from 'react';

const CATEGORIES = [
  { id: 'all', label: '🔥 For You', targetId: 'mobile-section-hero' },
  { id: 'cinemas', label: '🎬 In Cinemas', targetId: 'mobile-section-cinemas' },
  { id: 'streaming', label: '📺 Streaming', targetId: 'mobile-section-streaming' },
  { id: 'theatre', label: '🎭 Stage Plays', targetId: 'mobile-section-theatre' },
  { id: 'top10', label: '🏆 Top 10', targetId: 'mobile-section-top10' },
  { id: 'youtube', label: '▶ Free on YouTube', targetId: 'mobile-section-youtube' },
];

export default function MobileCategoryBar({ activeCategory = 'all', onSelectCategory }) {
  const handleCategoryClick = (cat) => {
    if (onSelectCategory) {
      onSelectCategory(cat.id);
    }
    if (cat.targetId) {
      const el = document.getElementById(cat.targetId);
      if (el) {
        const yOffset = -110; // offset for sticky top navbar + category bar
        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }
  };

  return (
    <nav
      aria-label="Mobile Browse Categories"
      className="sticky top-14 z-30 w-full bg-[#0B0D10]/95 backdrop-blur-md border-b border-white/5 py-2 px-3 shadow-md shadow-black/40"
    >
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-0.5">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat)}
              className={`shrink-0 flex items-center justify-center px-3.5 py-2 rounded-full text-xs font-bold transition-all duration-200 min-h-[40px] select-none ${
                isActive
                  ? 'bg-brand text-white shadow-md shadow-brand/25 scale-[1.02]'
                  : 'bg-surface/80 text-text-secondary border border-border/50 hover:text-text-primary hover:border-brand/30 active:scale-95'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
