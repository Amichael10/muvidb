import React, { useState } from 'react';
import MobileCategoryBar from './MobileCategoryBar';
import MobileHero from './MobileHero';
import MobileCinemaStrip from './MobileCinemaStrip';
import MobilePosterGrid from './MobilePosterGrid';
import MobileStreamingHub from './MobileStreamingHub';
import MobileTopPodium from './MobileTopPodium';
import MobilePlayTicket from './MobilePlayTicket';
import GenreRail from '../../film/GenreRail';
import CriticsLoungeSection from '../../film/CriticsLoungeSection';

export default function MobileHomeFeed({
  featuredFilms = [],
  isHeroLoading = false,
  inCinemas = [],
  isCinemaLoading = false,
  newReleases = [],
  newToStream = {},
  youtubeFeed = [],
  upcomingPlays = [],
  isTheatreLoading = false,
  top10Films = [],
  comingSoon = [],
  isLoadingPriority = false,
}) {
  const [activeCategory, setActiveCategory] = useState('all');

  return (
    <div className="w-full pb-24 md:hidden">
      {/* 1. Sticky Discovery Bar */}
      <MobileCategoryBar
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
      />

      {/* 2. Compact Cinema Hero */}
      <MobileHero
        featuredFilms={featuredFilms}
        isLoading={isHeroLoading}
      />

      {/* 3. Cinema Quick-Strip */}
      <MobileCinemaStrip
        inCinemas={inCinemas}
        isLoading={isCinemaLoading}
      />

      {/* 4. Trending Nollywood Releases (2-Column Vertical Discovery Grid) */}
      <MobilePosterGrid
        title="Trending Releases"
        subtitle="Fresh additions & theatrical hits"
        films={newReleases.length > 0 ? newReleases : inCinemas}
        isLoading={isLoadingPriority}
        linkTo="/browse?sort=newest"
        initialCount={6}
      />

      {/* 5. 1-Tap Streaming Slate */}
      <MobileStreamingHub
        newToStream={newToStream}
        youtubeFeed={youtubeFeed}
        isLoading={isLoadingPriority}
      />

      {/* 6. The Podium: Top 3 This Week */}
      <MobileTopPodium
        top10Films={top10Films}
        isLoading={false}
      />

      {/* 7. Live Stage Plays */}
      <MobilePlayTicket
        upcomingPlays={upcomingPlays}
        isLoading={isTheatreLoading}
      />

      {/* 8. Critics' Lounge Section */}
      <div className="w-full border-t border-white/5 py-4">
        <CriticsLoungeSection />
      </div>

      {/* 9. Free on YouTube Grid */}
      {youtubeFeed.length > 0 && (
        <div id="mobile-section-youtube">
          <MobilePosterGrid
            title="Free on YouTube"
            subtitle="Full movies streaming free with no subscription"
            films={youtubeFeed}
            isLoading={false}
            linkTo="/watch/youtube"
            initialCount={6}
          />
        </div>
      )}

      {/* 10. Coming Soon Grid */}
      {comingSoon.length > 0 && (
        <MobilePosterGrid
          title="Coming Soon"
          subtitle="Anticipated African stories arriving soon"
          films={comingSoon}
          isLoading={false}
          linkTo="/browse?sort=upcoming"
          initialCount={6}
        />
      )}

      {/* 11. Genre Explorer */}
      <div className="w-full border-t border-white/5 py-6 px-4">
        <GenreRail variant="poster-grid" />
      </div>
    </div>
  );
}
