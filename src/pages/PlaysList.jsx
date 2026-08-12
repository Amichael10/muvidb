import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import { fetchPlays, getPlayDateLabel } from '../lib/plays';
import SEO from '../components/SEO';
import ImageWithFallback from '../components/ui/ImageWithFallback';

export default function PlaysList() {
  const [plays, setPlays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      const data = await fetchPlays();
      setPlays(data);
      setLoading(false);
    }
    load();
  }, []);

  const counts = plays.reduce((acc, play) => {
    acc.all += 1;
    acc[play.status] = (acc[play.status] || 0) + 1;
    return acc;
  }, { all: 0, currently_running: 0, upcoming: 0, archived: 0 });

  const filtered = plays.filter(play => {
    const statusMatch = activeTab === 'all' || play.status === activeTab;
    const q = search.trim().toLowerCase();
    const searchMatch = !q || [play.title, play.playwright, play.director, play.venue, play.city, play.genre]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(q));
    return statusMatch && searchMatch;
  });

  const featuredPlay = filtered[0] || plays[0];

  return (
    <div className="min-h-screen bg-bg text-text-primary pb-20">
      <SEO
        title="Stage & Theatre Plays Index | MuviDB"
        description="Explore Nigerian and African stage plays, theatrical productions, musicals, and live performances worldwide. Track actor stage credits and venues."
      />

      <section className="relative overflow-hidden border-b border-border bg-bg px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
        <div className="max-w-7xl mx-auto py-14 md:py-20 relative z-10">
          <div className="grid lg:grid-cols-[1.08fr_0.92fr] gap-10 lg:gap-14 items-end">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 border border-brand/30 bg-brand/10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.24em] text-brand mb-5">
                <Icon icon="solar:masks-bold" className="text-base" />
                Theatre Archive
              </div>
              <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter text-text-primary leading-none">
                Stage Plays & Musicals
              </h1>
              <p className="mt-5 text-sm sm:text-base text-text-muted max-w-2xl leading-relaxed">
                A living index of Nigerian and African theatre: current runs, touring productions, classic stage work, venues, dates, and linked cast credits.
              </p>

              <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 border border-border bg-surface divide-x divide-y sm:divide-y-0 divide-border max-w-2xl rounded-2xl overflow-hidden shadow-lg shadow-black/10">
                {[
                  { id: 'all', label: 'All', count: counts.all },
                  { id: 'currently_running', label: 'Running', count: counts.currently_running },
                  { id: 'upcoming', label: 'Upcoming', count: counts.upcoming },
                  { id: 'archived', label: 'Archive', count: counts.archived },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`px-4 py-4 text-left transition-colors ${activeTab === item.id ? 'bg-brand text-white' : 'hover:bg-surface-2 text-text-primary'}`}
                  >
                    <span className="block text-2xl font-black font-heading leading-none">{item.count || 0}</span>
                    <span className={`mt-1 block text-[9px] font-black uppercase tracking-[0.2em] ${activeTab === item.id ? 'text-white/75' : 'text-text-muted'}`}>
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {featuredPlay && (
              <Link to={`/plays/${featuredPlay.slug}`} className="group block border border-border bg-surface overflow-hidden rounded-2xl shadow-2xl shadow-black/25">
                <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[160px_1fr] min-h-[220px]">
                  <div className="relative bg-surface-2 overflow-hidden">
                    <ImageWithFallback
                      src={featuredPlay.poster_url || featuredPlay.banner_url}
                      alt={featuredPlay.title}
                      fallbackType="film"
                      name={featuredPlay.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      width={384}
                      sizes="160px"
                    />
                  </div>
                  <div className="p-5 sm:p-6 flex flex-col justify-between min-w-0">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.24em] text-brand mb-3">
                        Featured production
                      </p>
                      <h2 className="text-2xl sm:text-3xl font-black font-heading tracking-tight text-text-primary group-hover:text-brand transition-colors line-clamp-2">
                        {featuredPlay.title}
                      </h2>
                      <p className="mt-3 text-xs text-text-muted leading-relaxed line-clamp-3">
                        {featuredPlay.synopsis || 'Production details, dates, venues, and stage credits.'}
                      </p>
                    </div>
                    <div className="pt-5 flex flex-wrap gap-2 text-[10px] font-bold text-text-muted">
                      <span className="border border-border bg-bg px-2.5 py-1 rounded-lg">{getPlayDateLabel(featuredPlay, 'Date TBA')}</span>
                      <span className="border border-border bg-bg px-2.5 py-1 rounded-lg">{featuredPlay.venue || featuredPlay.city || 'Venue TBA'}</span>
                    </div>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-5">
          <div>
            <p className="text-brand text-[10px] font-black uppercase tracking-[0.24em] mb-2">Browse productions</p>
            <h2 className="font-heading text-3xl font-black tracking-tighter text-text-primary">
              {filtered.length} {filtered.length === 1 ? 'play' : 'plays'} found
            </h2>
          </div>
          <label className="relative w-full md:w-96 group">
            <Icon icon="solar:magnifer-linear" className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title, venue, city, playwright..."
              className="w-full h-12 bg-surface border border-border rounded-xl pl-11 pr-4 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-brand transition-colors"
            />
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-surface/50 border border-border rounded-2xl">
            <Icon icon="solar:masks-line-duotone" className="w-16 h-16 text-text-muted mx-auto mb-3 opacity-50" />
            <h3 className="text-xl font-bold text-text-primary mb-1">No plays found</h3>
            <p className="text-sm text-text-muted">No stage productions match this search or filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((play) => (
              <Link
                key={play.id}
                to={`/plays/${play.slug}`}
                className="group relative bg-surface border border-border hover:border-brand/60 overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-xl hover:shadow-brand/5"
              >
                <div className="grid grid-cols-[116px_1fr] sm:grid-cols-[140px_1fr] min-h-[220px]">
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
                    <span className={`absolute left-2 top-2 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border backdrop-blur ${
                      play.status === 'currently_running'
                        ? 'bg-green-500/20 text-green-300 border-green-500/40'
                        : play.status === 'upcoming'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          : 'bg-bg/75 text-text-muted border-border'
                    }`}>
                      {play.status === 'currently_running' ? 'Running' : play.status === 'upcoming' ? 'Upcoming' : 'Archive'}
                    </span>
                  </div>
                  <div className="p-4 sm:p-5 min-w-0 flex flex-col justify-between">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-brand mb-2">
                        {play.genre || 'Stage Play'}
                      </p>
                      <h2 className="text-xl font-black font-heading tracking-tight text-text-primary group-hover:text-brand transition-colors line-clamp-2">
                        {play.title}
                      </h2>
                      <p className="mt-2 text-xs text-text-muted line-clamp-3 leading-relaxed">
                        {play.synopsis || 'A theatrical production with dates, venue, and stage credit information.'}
                      </p>
                    </div>
                    <div className="pt-4 space-y-2 text-[10px] text-text-muted">
                      <div className="flex items-start gap-2">
                        <Icon icon="solar:calendar-minimalistic-bold" className="text-brand text-sm shrink-0 mt-0.5" />
                        <span className="font-bold leading-relaxed">{getPlayDateLabel(play, 'Date TBA')}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Icon icon="solar:map-point-bold" className="text-brand text-sm shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{play.venue || play.city || 'Venue TBA'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
