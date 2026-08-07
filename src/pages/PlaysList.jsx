import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import { fetchPlays } from '../lib/plays';
import SEO from '../components/SEO';

export default function PlaysList() {
  const [plays, setPlays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'currently_running', 'upcoming', 'archived'

  useEffect(() => {
    async function load() {
      const data = await fetchPlays();
      setPlays(data);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = plays.filter(p => {
    if (activeTab === 'all') return true;
    return p.status === activeTab;
  });

  return (
    <div className="min-h-screen bg-bg text-text-primary pb-20">
      <SEO 
        title="Stage & Theatre Plays Index | MuviDB"
        description="Explore Nigerian and African stage plays, theatrical productions, musicals, and live performances worldwide. Track actor stage credits and venues."
      />

      {/* Hero Header */}
      <section className="relative overflow-hidden border-b border-border bg-surface/40 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-brand/10 border border-brand/30 text-brand text-xs font-semibold uppercase tracking-wider mb-4">
            <Icon icon="solar:masks-bold" className="w-4 h-4" />
            African Theatre & Performing Arts Archive
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-text-primary mb-4">
            Stage Plays & Musicals
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mx-auto">
            From Lagos to London’s West End, discover iconic theatrical productions, legendary playwrights, and the stage performances that define true acting craft.
          </p>

          {/* Category Filter Tabs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {[
              { id: 'all', label: 'All Productions' },
              { id: 'currently_running', label: 'Currently Running' },
              { id: 'upcoming', label: 'Upcoming Shows' },
              { id: 'archived', label: 'Classic Stage Archive' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-brand text-on-brand shadow-md'
                    : 'bg-surface border border-border text-text-muted hover:text-text-primary hover:border-brand/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-surface/50 rounded-2xl border border-border">
            <Icon icon="solar:masks-line-duotone" className="w-16 h-16 text-text-muted mx-auto mb-3 opacity-50" />
            <h3 className="text-xl font-bold text-text-primary mb-1">No plays found</h3>
            <p className="text-sm text-text-muted">No stage productions match this filter tab.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((play) => (
              <Link
                key={play.id}
                to={`/plays/${play.slug}`}
                className="group relative bg-surface border border-border hover:border-brand/50 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-brand/5 flex flex-col"
              >
                {/* Poster / Image Banner */}
                <div className="relative h-48 w-full bg-surface-2 overflow-hidden">
                  <img
                    src={play.poster_url || play.banner_url || 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&q=80&w=600'}
                    alt={play.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
                  
                  {/* Status Badge */}
                  <span className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-md ${
                    play.status === 'currently_running'
                      ? 'bg-green-500/20 text-green-500 border-green-500/40'
                      : play.status === 'upcoming'
                      ? 'bg-blue-500/20 text-blue-500 border-blue-500/40'
                      : 'bg-surface/80 text-text-muted border-border'
                  }`}>
                    {play.status === 'currently_running' ? 'Running' : play.status === 'upcoming' ? 'Upcoming' : 'Archive'}
                  </span>
                </div>

                {/* Body Details */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-semibold text-brand uppercase tracking-wider">
                      {play.genre || 'Stage Play'} • {play.year || 'N/A'}
                    </span>

                    <h2 className="text-xl font-bold text-text-primary group-hover:text-brand transition-colors mt-1 mb-2">
                      {play.title}
                    </h2>

                    <p className="text-xs text-text-muted line-clamp-3 leading-relaxed mb-4">
                      {play.synopsis || 'An iconic theatrical performance staged across prominent African and international venues.'}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-border/60 flex items-center justify-between text-xs text-text-muted">
                    <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                      <Icon icon="solar:map-point-bold" className="w-4 h-4 text-brand flex-shrink-0" />
                      <span className="truncate">{play.venue || play.city || 'Lagos'}</span>
                    </div>

                    <span className="flex items-center gap-1 font-semibold text-brand group-hover:translate-x-1 transition-transform flex-shrink-0">
                      View Cast & Play
                      <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4" />
                    </span>
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
