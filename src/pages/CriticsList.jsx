import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import { fetchCritics } from '../lib/critics';
import SEO from '../components/SEO';

export default function CriticsList() {
  const [critics, setCritics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      const data = await fetchCritics();
      setCritics(data);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = critics.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.publication?.toLowerCase().includes(search.toLowerCase()) ||
    c.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-bg text-text-primary pb-20">
      <SEO 
        title="Verified Film Critics & Journalists | MuviDB"
        description="Discover leading African film critics, culture journalists, and movie reviewers. Explore reviews, ratings, and critical essays on Nollywood cinema."
      />

      {/* Hero Header */}
      <section className="relative overflow-hidden border-b border-border bg-surface/40 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/30 text-brand text-xs font-semibold uppercase tracking-wider mb-4">
            <Icon icon="solar:pen-new-square-bold" className="w-4 h-4" />
            Film Critics & Journalists Directory
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-text-primary mb-4">
            Voices of African Cinema
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mx-auto">
            Discover verified film critics, essayists, and reviewers providing incisive commentary, ratings, and reviews across Nollywood and international festivals.
          </p>

          {/* Search Bar */}
          <div className="mt-8 max-w-md mx-auto relative">
            <Icon icon="solar:magnifer-linear" className="absolute left-4 top-3.5 text-text-muted w-5 h-5" />
            <input
              type="text"
              placeholder="Search critic by name, publication..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-brand transition-colors shadow-lg"
            />
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
            <Icon icon="solar:user-block-line-duotone" className="w-16 h-16 text-text-muted mx-auto mb-3 opacity-50" />
            <h3 className="text-xl font-bold text-text-primary mb-1">No critics found</h3>
            <p className="text-sm text-text-muted">Try tweaking your search term.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((critic) => (
              <Link
                key={critic.id}
                to={`/critics/${critic.slug}`}
                className="group relative bg-surface border border-border hover:border-brand/50 rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:shadow-brand/5 hover:-translate-y-1 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="relative">
                      <img
                        src={critic.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
                        alt={critic.name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-border group-hover:border-brand transition-colors shadow-md"
                      />
                      {critic.is_verified && (
                        <div className="absolute -bottom-1 -right-1 bg-brand text-on-brand rounded-full p-1 shadow-md" title="Verified Film Critic">
                          <Icon icon="solar:verified-check-bold" className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-2 border border-border text-xs text-text-muted font-medium">
                      <Icon icon="solar:notes-bold" className="w-3.5 h-3.5 text-brand" />
                      {critic.review_count} {critic.review_count === 1 ? 'Review' : 'Reviews'}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-text-primary group-hover:text-brand transition-colors">
                    {critic.name}
                  </h2>
                  <p className="text-xs font-semibold text-brand mt-0.5">
                    {critic.publication || 'Film Critic'}
                  </p>
                  <p className="text-xs text-text-muted mt-2 line-clamp-3 leading-relaxed">
                    {critic.bio || 'Film critic and culture journalist contributing to African cinema reviews and analytical essays.'}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-xs text-text-muted group-hover:text-text-primary transition-colors">
                  <span className="font-mono text-brand">{critic.handle || '@critic'}</span>
                  <span className="flex items-center gap-1 font-semibold text-brand group-hover:translate-x-1 transition-transform">
                    View Profile
                    <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
