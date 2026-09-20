import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import { fetchPlays, getPlayDateLabel } from '../lib/plays';
import SEO from '../components/SEO';
import ImageWithFallback from '../components/ui/ImageWithFallback';

function PlayCard({ play }) {
  const isRunning = play.status === 'currently_running';
  const isUpcoming = play.status === 'upcoming';

  return (
    <Link
      to={`/plays/${play.slug}`}
      className="group relative bg-surface border border-border hover:border-brand/60 overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-xl hover:shadow-brand/5 flex flex-col justify-between"
    >
      <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] min-h-[220px]">
        {/* Poster Image Container */}
        <div className="relative bg-surface-2 overflow-hidden">
          <ImageWithFallback
            src={play.poster_url || play.banner_url}
            alt={play.title}
            fallbackType="film"
            name={play.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            width={320}
            sizes="140px"
          />
          {/* Status Badge */}
          <span
            className={`absolute left-2 top-2 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border backdrop-blur flex items-center gap-1.5 shadow-md ${
              isRunning
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : isUpcoming
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                  : 'bg-bg/85 text-text-muted border-border'
            }`}
          >
            {isRunning && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>}
            {isRunning ? 'Live On Stage' : isUpcoming ? 'Upcoming' : 'Archived'}
          </span>
        </div>

        {/* Info Column */}
        <div className="p-4 sm:p-5 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                {play.genre || 'Stage Production'}
              </span>
              {play.year && (
                <span className="text-[11px] font-bold text-text-muted border border-border/80 px-2 py-0.5 rounded-md bg-bg/50">
                  {play.year}
                </span>
              )}
            </div>

            <h3 className="text-lg sm:text-xl font-black font-heading tracking-tight text-text-primary group-hover:text-brand transition-colors line-clamp-2">
              {play.title}
            </h3>

            {(play.director || play.playwright) && (
              <p className="text-[11px] text-text-muted mt-1 line-clamp-1 font-medium">
                {play.director ? `Dir. ${play.director}` : `By ${play.playwright}`}
              </p>
            )}

            <p className="mt-2 text-xs text-text-muted line-clamp-2 leading-relaxed">
              {play.synopsis || 'A theatrical production featuring full stage ensemble credits, venue information, and run schedule.'}
            </p>
          </div>

          <div className="pt-4 mt-2 border-t border-border/40 space-y-1.5 text-[11px] text-text-muted">
            <div className="flex items-center gap-2">
              <Icon icon="solar:calendar-minimalistic-bold" className="text-brand text-sm shrink-0" />
              <span className="font-semibold text-text-primary/90 truncate">
                {getPlayDateLabel(play, 'Run dates TBA')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Icon icon="solar:map-point-bold" className="text-brand text-sm shrink-0" />
              <span className="truncate">
                {play.venue ? `${play.venue}${play.city ? ` (${play.city})` : ''}` : (play.city || 'Venue TBA')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function PlaysList() {
  const [plays, setPlays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedCity, setSelectedCity] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      const data = await fetchPlays();
      setPlays(data);
      setLoading(false);
    }
    load();
  }, []);

  const counts = useMemo(() => {
    return plays.reduce(
      (acc, play) => {
        acc.all += 1;
        acc[play.status] = (acc[play.status] || 0) + 1;
        return acc;
      },
      { all: 0, currently_running: 0, upcoming: 0, archived: 0 }
    );
  }, [plays]);

  // Extract popular cities
  const popularCities = useMemo(() => {
    const cityCounts = new Map();
    for (const p of plays) {
      if (!p.city) continue;
      const primaryCity = p.city.split('&')[0].split('/')[0].trim();
      if (primaryCity) {
        cityCounts.set(primaryCity, (cityCounts.get(primaryCity) || 0) + 1);
      }
    }
    const sorted = Array.from(cityCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);
    return ['all', ...sorted];
  }, [plays]);

  // Filter plays
  const filtered = useMemo(() => {
    return plays.filter((play) => {
      const statusMatch = activeTab === 'all' || play.status === activeTab;
      
      const cityMatch =
        selectedCity === 'all' ||
        (play.city && play.city.toLowerCase().includes(selectedCity.toLowerCase())) ||
        (play.venue && play.venue.toLowerCase().includes(selectedCity.toLowerCase()));

      const q = search.trim().toLowerCase();
      const searchMatch =
        !q ||
        [play.title, play.playwright, play.director, play.venue, play.city, play.genre]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));

      return statusMatch && cityMatch && searchMatch;
    });
  }, [plays, activeTab, selectedCity, search]);

  // Segmentation buckets
  const runningPlays = useMemo(() => filtered.filter((p) => p.status === 'currently_running'), [filtered]);
  const upcomingPlays = useMemo(() => filtered.filter((p) => p.status === 'upcoming'), [filtered]);
  const archivedPlays = useMemo(() => filtered.filter((p) => p.status === 'archived'), [filtered]);

  // Featured spotlight: Prioritize running or upcoming plays, fallback to latest play
  const featuredPlay = useMemo(() => {
    return (
      plays.find((p) => p.status === 'currently_running') ||
      plays.find((p) => p.status === 'upcoming') ||
      plays.find((p) => p.poster_url && p.title.toLowerCase().includes('dear kaffy')) ||
      plays.find((p) => p.poster_url && p.title.toLowerCase().includes('fela')) ||
      plays[0]
    );
  }, [plays]);

  return (
    <div className="min-h-screen bg-bg text-text-primary pb-24">
      <SEO
        title="Stage & Theatre Plays Index | MuviDB"
        description="Explore Nigerian and African stage plays, theatrical productions, musicals, and live performances worldwide. Track actor stage credits, upcoming runs, and theatre archives."
      />

      {/* Hero Header */}
      <section className="relative overflow-hidden border-b border-border bg-bg px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
        <div className="max-w-7xl mx-auto py-12 md:py-16 relative z-10">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-12 items-center">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 border border-brand/30 bg-brand/10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.24em] text-brand mb-4">
                <Icon icon="solar:masks-bold" className="text-base" />
                Live Stage & Repertoire
              </div>
              <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-text-primary leading-[1.05]">
                Stage Plays & Musicals
              </h1>
              <p className="mt-4 text-sm sm:text-base text-text-muted leading-relaxed">
                Discover live theatrical performances across Lagos, London, Abuja and beyond. Browse active runs, upcoming productions, iconic stage heritage, and full cast ensembles.
              </p>

              {/* Status Segment Tabs */}
              <div className="mt-7 grid grid-cols-2 sm:grid-cols-4 border border-border bg-surface divide-x divide-y sm:divide-y-0 divide-border rounded-2xl overflow-hidden shadow-lg shadow-black/10">
                {[
                  { id: 'all', label: 'Overview (All)', count: counts.all },
                  { id: 'currently_running', label: 'On Stage', count: counts.currently_running, highlight: 'emerald' },
                  { id: 'upcoming', label: 'Upcoming', count: counts.upcoming, highlight: 'blue' },
                  { id: 'archived', label: 'Archive', count: counts.archived },
                ].map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`px-4 py-3.5 text-left transition-all duration-200 ${
                        isActive ? 'bg-brand text-white' : 'hover:bg-surface-2 text-text-primary'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="block text-2xl font-black font-heading leading-none">
                          {item.count || 0}
                        </span>
                        {item.highlight === 'emerald' && (
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        )}
                        {item.highlight === 'blue' && (
                          <span className="h-2 w-2 rounded-full bg-blue-400"></span>
                        )}
                      </div>
                      <span
                        className={`mt-1 block text-[10px] font-black uppercase tracking-[0.16em] ${
                          isActive ? 'text-white/80' : 'text-text-muted'
                        }`}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Featured Play Spotlight */}
            {featuredPlay && (
              <Link
                to={`/plays/${featuredPlay.slug}`}
                className="group block border border-border hover:border-brand/60 bg-surface overflow-hidden rounded-2xl shadow-2xl shadow-black/30 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="grid grid-cols-[130px_1fr] sm:grid-cols-[170px_1fr] min-h-[230px]">
                  <div className="relative bg-surface-2 overflow-hidden">
                    <ImageWithFallback
                      src={featuredPlay.poster_url || featuredPlay.banner_url}
                      alt={featuredPlay.title}
                      fallbackType="film"
                      name={featuredPlay.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      width={384}
                      sizes="170px"
                    />
                    <span className="absolute left-2 top-2 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-brand text-on-brand shadow-md">
                      Spotlight
                    </span>
                  </div>
                  <div className="p-5 sm:p-6 flex flex-col justify-between min-w-0">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-brand mb-1.5">
                        Featured Production
                      </p>
                      <h2 className="text-xl sm:text-2xl font-black font-heading tracking-tight text-text-primary group-hover:text-brand transition-colors line-clamp-2">
                        {featuredPlay.title}
                      </h2>
                      <p className="mt-2 text-xs text-text-muted leading-relaxed line-clamp-3">
                        {featuredPlay.synopsis || 'Explore production schedule, venue, director, and full stage ensemble.'}
                      </p>
                    </div>
                    <div className="pt-4 flex flex-wrap gap-2 text-[10px] font-bold text-text-muted">
                      <span className="border border-border bg-bg px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                        <Icon icon="solar:calendar-minimalistic-bold" className="text-brand text-xs" />
                        {getPlayDateLabel(featuredPlay, 'Date TBA')}
                      </span>
                      <span className="border border-border bg-bg px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                        <Icon icon="solar:map-point-bold" className="text-brand text-xs" />
                        {featuredPlay.venue || featuredPlay.city || 'Venue TBA'}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Discovery & Search Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
          {/* City / Venue Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <span className="text-xs font-bold text-text-muted mr-1.5 shrink-0 flex items-center gap-1">
              <Icon icon="solar:map-point-bold" className="text-brand" />
              City:
            </span>
            {popularCities.map((c) => {
              const isSelected = selectedCity === c;
              return (
                <button
                  key={c}
                  onClick={() => setSelectedCity(c)}
                  className={`px-3 py-1 rounded-full text-xs font-bold capitalize whitespace-nowrap transition-colors ${
                    isSelected
                      ? 'bg-brand text-white'
                      : 'bg-surface border border-border text-text-muted hover:text-text-primary hover:border-brand/40'
                  }`}
                >
                  {c === 'all' ? 'All Locations' : c}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-80 group">
            <Icon
              icon="solar:magnifer-linear"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search play, venue, playwright..."
              className="w-full h-10 bg-surface border border-border rounded-xl pl-10 pr-4 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-brand transition-colors"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-28">
            <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-surface/50 border border-border rounded-2xl mt-8">
            <Icon icon="solar:masks-line-duotone" className="w-16 h-16 text-text-muted mx-auto mb-3 opacity-50" />
            <h3 className="text-xl font-bold text-text-primary mb-1">No theatrical productions found</h3>
            <p className="text-sm text-text-muted">No stage plays match your search query or location filter.</p>
            {(search || selectedCity !== 'all' || activeTab !== 'all') && (
              <button
                onClick={() => {
                  setSearch('');
                  setSelectedCity('all');
                  setActiveTab('all');
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-brand/10 border border-brand/20 text-brand text-xs font-bold hover:bg-brand hover:text-white transition-colors"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : search.trim() || activeTab !== 'all' ? (
          /* Filtered View: Single active category or search query */
          <div className="pt-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-brand mb-1">
                  {search.trim() ? 'Search Results' : activeTab === 'currently_running' ? 'Active Stage Runs' : activeTab === 'upcoming' ? 'Opening Soon' : 'Classic Archive'}
                </p>
                <h2 className="font-heading text-2xl sm:text-3xl font-black text-text-primary">
                  {filtered.length} {filtered.length === 1 ? 'Production' : 'Productions'} Found
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filtered.map((play) => (
                <PlayCard key={play.id} play={play} />
              ))}
            </div>
          </div>
        ) : (
          /* Segmented Overview View: Segmented sections for quick discovery */
          <div className="space-y-16 pt-8">
            {/* 1. Currently on Stage / Live Runs Section */}
            <section>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-400">
                      Live on Stage
                    </p>
                  </div>
                  <h2 className="font-heading text-2xl sm:text-3xl font-black text-text-primary">
                    Currently Running Productions
                  </h2>
                </div>
                <button
                  onClick={() => setActiveTab('currently_running')}
                  className="text-xs font-bold text-brand hover:text-brand-hover flex items-center gap-1 transition-colors"
                >
                  View all on stage ({counts.currently_running})
                  <Icon icon="solar:arrow-right-linear" />
                </button>
              </div>

              {runningPlays.length === 0 ? (
                <div className="bg-surface/60 border border-border/80 rounded-2xl p-8 text-center">
                  <Icon icon="solar:ticket-bold" className="w-10 h-10 text-text-muted mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-bold text-text-primary">No productions live on stage this week</p>
                  <p className="text-xs text-text-muted mt-1">Check the upcoming productions below for dates and venue announcements.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {runningPlays.map((play) => (
                    <PlayCard key={play.id} play={play} />
                  ))}
                </div>
              )}
            </section>

            {/* 2. Upcoming Productions Section */}
            <section>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon icon="solar:calendar-bold" className="text-blue-400 text-sm" />
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-400">
                      Opening Soon
                    </p>
                  </div>
                  <h2 className="font-heading text-2xl sm:text-3xl font-black text-text-primary">
                    Upcoming Stage Productions
                  </h2>
                </div>
                <button
                  onClick={() => setActiveTab('upcoming')}
                  className="text-xs font-bold text-brand hover:text-brand-hover flex items-center gap-1 transition-colors"
                >
                  View all upcoming ({counts.upcoming})
                  <Icon icon="solar:arrow-right-linear" />
                </button>
              </div>

              {upcomingPlays.length === 0 ? (
                <div className="bg-surface/60 border border-border/80 rounded-2xl p-8 text-center">
                  <Icon icon="solar:calendar-linear" className="w-10 h-10 text-text-muted mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-bold text-text-primary">No upcoming productions scheduled yet</p>
                  <p className="text-xs text-text-muted mt-1">New dates are continuously added as theatre companies announce tours.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {upcomingPlays.map((play) => (
                    <PlayCard key={play.id} play={play} />
                  ))}
                </div>
              )}
            </section>

            {/* 3. Repertoire & Classic Archive Section */}
            <section>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon icon="solar:archive-bold" className="text-brand text-sm" />
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-brand">
                      Theatrical Heritage
                    </p>
                  </div>
                  <h2 className="font-heading text-2xl sm:text-3xl font-black text-text-primary">
                    Stage Archive & Historic Works
                  </h2>
                </div>
                <button
                  onClick={() => setActiveTab('archived')}
                  className="text-xs font-bold text-brand hover:text-brand-hover flex items-center gap-1 transition-colors"
                >
                  Explore full archive ({counts.archived})
                  <Icon icon="solar:arrow-right-linear" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {archivedPlays.slice(0, 9).map((play) => (
                  <PlayCard key={play.id} play={play} />
                ))}
              </div>

              {archivedPlays.length > 9 && (
                <div className="text-center pt-8">
                  <button
                    onClick={() => setActiveTab('archived')}
                    className="px-6 py-3 rounded-xl bg-surface border border-border hover:border-brand text-text-primary font-bold text-xs transition-all hover:shadow-lg inline-flex items-center gap-2"
                  >
                    View All {archivedPlays.length} Archive Productions
                    <Icon icon="solar:arrow-right-linear" />
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
