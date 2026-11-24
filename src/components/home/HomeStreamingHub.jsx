import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import FilmCard from '../film/FilmCard';
import { PLATFORMS } from '../../lib/platforms';
import { filterAndSortFreshStreaming } from '../../lib/ranking';

const STREAMING_TAB_ORDER = [
  'all',
  'youtube',
  'netflix',
  'prime_video',
  'kava',
  'ebonylife',
  'circuits',
  'docuth',
  'nollistream',
  'homitv',
  'filmporte',
];

export default function HomeStreamingHub({
  streamingByPlatform = {},
  youtubeFeed = [],
  cinemaFilmIds = new Set(),
  isLoading = false,
  watchlistIds = new Set(),
  onToggleWatchlist,
}) {
  const [activeTab, setActiveTab] = useState('all');
  const [showAllMobile, setShowAllMobile] = useState(false);

  // Build available tabs (always keep All, YouTube, Netflix, Prime; include local platforms when populated)
  const tabs = useMemo(() => {
    const coreAlways = new Set(['all', 'youtube', 'netflix', 'prime_video', 'kava', 'ebonylife', 'circuits']);
    return STREAMING_TAB_ORDER.map((id) => {
      if (id === 'all') {
        return {
          id: 'all',
          name: 'All Streaming',
          icon: 'solar:play-stream-bold',
          color: '#FF5A1F',
          logo: null,
        };
      }
      const p = PLATFORMS.find((item) => item.id === id);
      if (!p) return null;
      return {
        ...p,
        name: id === 'youtube' ? 'Free on YouTube' : p.name,
      };
    }).filter((tab) => {
      if (!tab) return false;
      if (coreAlways.has(tab.id)) return true;
      return (streamingByPlatform[tab.id] || []).length > 0;
    });
  }, [streamingByPlatform]);

  // Unified conflict-free list: strictly fresh titles, excludes films currently in cinemas
  const activeFilms = useMemo(() => {
    if (activeTab === 'youtube') {
      return filterAndSortFreshStreaming(
        youtubeFeed.filter((f) => !cinemaFilmIds.has(f.id)),
        { minFallback: 6 }
      ).slice(0, 12);
    }

    if (activeTab === 'all') {
      // Interleave fresh top titles across platforms so Netflix, Prime, YouTube, and local platforms all shine
      const seen = new Set(cinemaFilmIds);
      const buckets = [
        filterAndSortFreshStreaming(streamingByPlatform.netflix || [], { minFallback: 2 }).map((f) => ({ ...f, _platform: 'netflix' })),
        filterAndSortFreshStreaming(streamingByPlatform.prime_video || [], { minFallback: 2 }).map((f) => ({ ...f, _platform: 'prime_video' })),
        filterAndSortFreshStreaming(youtubeFeed, { minFallback: 4 }).map((f) => ({ ...f, _platform: 'youtube' })),
        filterAndSortFreshStreaming(streamingByPlatform.kava || [], { minFallback: 2 }).map((f) => ({ ...f, _platform: 'kava' })),
        filterAndSortFreshStreaming(streamingByPlatform.ebonylife || [], { minFallback: 2 }).map((f) => ({ ...f, _platform: 'ebonylife' })),
        filterAndSortFreshStreaming(streamingByPlatform.circuits || [], { minFallback: 2 }).map((f) => ({ ...f, _platform: 'circuits' })),
        filterAndSortFreshStreaming(streamingByPlatform.docuth || [], { minFallback: 2 }).map((f) => ({ ...f, _platform: 'docuth' })),
      ].filter((b) => b.length > 0);

      const merged = [];
      let round = 0;
      while (merged.length < 12 && round < 10) {
        let added = false;
        for (const bucket of buckets) {
          const candidate = bucket[round];
          if (candidate && !seen.has(candidate.id) && !candidate.coming_soon && !candidate.series_id) {
            seen.add(candidate.id);
            merged.push(candidate);
            added = true;
            if (merged.length >= 12) break;
          }
        }
        if (!added) break;
        round += 1;
      }
      return merged;
    }

    return filterAndSortFreshStreaming(
      (streamingByPlatform[activeTab] || []).filter((f) => !cinemaFilmIds.has(f.id) && !f.series_id),
      { minFallback: 4 }
    ).slice(0, 12);
  }, [activeTab, streamingByPlatform, youtubeFeed, cinemaFilmIds]);

  const activeTabMeta = tabs.find((t) => t.id === activeTab);
  const seeAllHref = activeTab === 'all' ? '/browse' : `/watch/${activeTab}`;
  const seeAllLabel =
    activeTab === 'all' ? 'Browse Full Catalogue' : `All on ${activeTabMeta?.name || 'Platform'}`;

  return (
    <section className="py-10 md:py-12 border-b border-hairline bg-surface/35">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand">
                Where to Watch Tonight
              </p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[9px] font-black uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Fresh Releases Only
              </span>
            </div>
            <h2 className="font-heading font-bold text-2xl sm:text-3xl text-text-primary tracking-tight">
              Streaming &amp; Free on YouTube
            </h2>
          </div>

          <Link
            to={seeAllHref}
            className="group inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline whitespace-nowrap"
          >
            <span>{seeAllLabel}</span>
            <Icon
              icon="solar:alt-arrow-right-linear"
              className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>

        {/* Platform Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setShowAllMobile(false);
                }}
                className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-brand border-brand text-white shadow-sm'
                    : 'bg-surface border-border/80 text-text-secondary hover:border-brand/50 hover:text-text-primary'
                }`}
              >
                {tab.logo ? (
                  <img src={tab.logo} alt="" className="w-3.5 h-3.5 object-contain" />
                ) : (
                  <Icon
                    icon={tab.icon}
                    className="text-sm"
                    style={{ color: isActive ? '#ffffff' : tab.color }}
                  />
                )}
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>

        {/* Unified Decision Cards (Mobile App Swipe Carousel & Desktop Grid) */}
        {isLoading && activeFilms.length === 0 ? (
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 sm:gap-5 pb-3 -mx-4 px-4 scrollbar-none sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 sm:mx-0 sm:px-0 sm:overflow-visible">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-2 animate-pulse w-[52vw] sm:w-auto shrink-0 snap-start">
                <div className="aspect-[2/3] w-full rounded-xl bg-surface-2" />
                <div className="h-3.5 w-3/4 rounded bg-surface-2" />
                <div className="h-3 w-1/2 rounded bg-surface-2" />
              </div>
            ))}
          </div>
        ) : activeFilms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-surface p-10 text-center space-y-2">
            <p className="text-sm font-semibold text-text-primary">
              No titles currently listed under {activeTabMeta?.name}.
            </p>
            <Link to="/browse" className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline">
              Explore all streaming titles
              <Icon icon="solar:alt-arrow-right-linear" />
            </Link>
          </div>
        ) : (
          <>
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 sm:gap-5 pb-3 -mx-4 px-4 scrollbar-none sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 sm:mx-0 sm:px-0 sm:overflow-visible">
              {activeFilms.map((film) => (
                <div
                  key={film.id}
                  className="w-[52vw] sm:w-auto shrink-0 snap-start select-none"
                >
                  <FilmCard
                    film={film}
                    fullWidth
                    contextMode="streaming"
                    platformId={activeTab === 'all' ? film._platform || null : activeTab}
                    isWatchlisted={watchlistIds.has(film.id)}
                    onAction={onToggleWatchlist}
                  />
                </div>
              ))}
            </div>

            {!showAllMobile && activeFilms.length > 6 && (
              <div className="sm:hidden pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setShowAllMobile(true)}
                  className="w-full py-2.5 rounded-xl border border-border bg-surface text-xs font-bold text-text-primary hover:border-brand transition-colors"
                >
                  Show {activeFilms.length - 6} More Titles
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
