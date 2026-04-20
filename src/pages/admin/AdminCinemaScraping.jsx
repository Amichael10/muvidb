/**
 * /admin/cinema-scraping
 *
 * Control panel for the cinema showtime scraper. Lists every cinema with
 * scrape status and lets the admin:
 *   • Toggle scrape_enabled per cinema
 *   • See last-fetched time, failure count, last error
 *   • Reset failure counter (un-quarantine cinemas past MAX_FAILURES)
 *   • Trigger a manual "sync now" call to /api/cron/refresh-showtimes
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const ADAPTER_LABELS = {
  reach_cinema: 'Reach Cinema (Viva/Ozone/KADA)',
  veezi:        'Veezi (Silverbird)',
  cinesync:     'Cinesync (Filmhouse) ⚠️',
  bluepictures: 'Blue Pictures',
  firecrawl:    'Firecrawl (Genesis/fallback)',
};

function fmtWhen(iso) {
  if (!iso) return 'never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function HealthDot({ cinema }) {
  const { scrape_enabled, showtimes_last_fetched_at, scrape_failure_count, scrape_last_error } = cinema;
  if (!scrape_enabled) return <span className="inline-block w-2 h-2 rounded-full bg-gray-500" title="Disabled" />;
  if ((scrape_failure_count ?? 0) >= 5) return <span className="inline-block w-2 h-2 rounded-full bg-red-500" title="Quarantined" />;
  if (scrape_last_error) return <span className="inline-block w-2 h-2 rounded-full bg-yellow-500" title={scrape_last_error} />;
  if (!showtimes_last_fetched_at) return <span className="inline-block w-2 h-2 rounded-full bg-blue-400" title="Never fetched" />;
  const stale = Date.now() - new Date(showtimes_last_fetched_at).getTime() > 48 * 3600 * 1000;
  return <span className={`inline-block w-2 h-2 rounded-full ${stale ? 'bg-orange-400' : 'bg-green-500'}`} title={stale ? 'Stale' : 'Healthy'} />;
}

export default function AdminCinemaScraping() {
  const [cinemas, setCinemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [filter, setFilter] = useState('enabled'); // 'enabled' | 'disabled' | 'all'
  const [search, setSearch] = useState('');

  const fetchCinemas = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('cinemas')
      .select('id, name, chain, city, scrape_enabled, scrape_adapter, scrape_config, showtimes_last_fetched_at, scrape_failure_count, scrape_last_error')
      .order('chain', { ascending: true, nullsFirst: false })
      .order('name');
    setCinemas(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { document.title = 'Admin | Cinema Scraping'; }, []);
  useEffect(() => { fetchCinemas(); }, [fetchCinemas]);

  const toggle = async (cinema) => {
    const { error } = await supabase
      .from('cinemas')
      .update({ scrape_enabled: !cinema.scrape_enabled })
      .eq('id', cinema.id);
    if (error) return alert(error.message);
    fetchCinemas();
  };

  const resetFailures = async (id) => {
    const { error } = await supabase
      .from('cinemas')
      .update({ scrape_failure_count: 0, scrape_last_error: null })
      .eq('id', id);
    if (error) return alert(error.message);
    fetchCinemas();
  };

  const syncNow = async () => {
    if (!confirm('Trigger a manual showtime sync? This hits the Vercel endpoint.')) return;
    setSyncing(true); setSyncResult(null);
    try {
      const r = await fetch('/api/cron/refresh-showtimes', {
        method: 'POST',
        headers: { 'x-cron-secret': 'lumi-cron-pkenrm-2026', 'Content-Type': 'application/json' },
        body: '{}',
      });
      const json = await r.json();
      setSyncResult(json);
    } catch (e) {
      setSyncResult({ error: e.message });
    } finally {
      setSyncing(false);
      fetchCinemas();
    }
  };

  const filtered = cinemas.filter(c => {
    if (filter === 'enabled'  && !c.scrape_enabled) return false;
    if (filter === 'disabled' &&  c.scrape_enabled) return false;
    if (search && !`${c.name} ${c.chain ?? ''} ${c.city ?? ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = cinemas.reduce((s, c) => {
    if (c.scrape_enabled)                     s.enabled++;
    if ((c.scrape_failure_count ?? 0) >= 5)   s.quarantined++;
    if (c.scrape_enabled && !c.showtimes_last_fetched_at) s.never++;
    return s;
  }, { enabled: 0, quarantined: 0, never: 0 });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Cinema Scraping</h2>
          <p className="text-text-muted mt-1">Control showtime scraping per cinema. Cron runs 1×/day at 7am WAT.</p>
        </div>
        <button
          onClick={syncNow}
          disabled={syncing}
          className="px-4 py-2 bg-[#D4A017] text-[#0A0F1E] rounded-xl text-sm font-semibold hover:bg-[#D4A017]/90 disabled:opacity-50">
          {syncing ? 'Syncing…' : '↻ Sync now'}
        </button>
      </div>

      {/* Sync result banner */}
      {syncResult && (
        <div className={`rounded-xl p-4 text-sm ${syncResult.error ? 'bg-red-900/20 border border-red-900/40 text-red-400' : 'bg-green-900/20 border border-green-900/40 text-green-400'}`}>
          {syncResult.error
            ? <p>Sync failed: {syncResult.error}</p>
            : (
              <div>
                <p className="font-semibold">Sync complete in {syncResult.total_ms}ms</p>
                <p className="opacity-80 mt-1">
                  {syncResult.successes}/{syncResult.cinemas_processed} cinemas succeeded ·&nbsp;
                  {syncResult.total_showtimes_written} showtimes written ·&nbsp;
                  {syncResult.total_unmatched_titles} unmatched titles for triage
                </p>
              </div>
            )
          }
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Enabled',      val: stats.enabled,      color: 'text-green-400' },
          { label: 'Quarantined',  val: stats.quarantined,  color: 'text-red-400' },
          { label: 'Never fetched',val: stats.never,        color: 'text-blue-400' },
          { label: 'Total',        val: cinemas.length,     color: 'text-gold' },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-border rounded-xl p-4">
            <p className="text-text-muted text-xs uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex bg-surface border border-border rounded-xl overflow-hidden">
          {['enabled', 'disabled', 'all'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm ${filter === f ? 'bg-[#D4A017] text-[#0A0F1E]' : 'text-text-muted hover:text-text-primary'}`}>
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search cinemas…"
          className="flex-1 min-w-[200px] bg-surface border border-border rounded-xl px-4 py-2 text-sm text-text-primary placeholder-text-muted focus:border-gold focus:outline-none"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center text-text-muted py-20">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-text-muted py-20">
          <p className="text-3xl mb-2">🎭</p>
          <p>No cinemas match.</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#0A0F1E] text-xs uppercase text-text-muted">
              <tr>
                <th className="text-left px-4 py-3"></th>
                <th className="text-left px-4 py-3">Cinema</th>
                <th className="text-left px-4 py-3">Adapter</th>
                <th className="text-left px-4 py-3">Last Fetched</th>
                <th className="text-center px-4 py-3">Failures</th>
                <th className="text-left px-4 py-3">Last Error</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-t border-border hover:bg-[#0A0F1E]/50">
                  <td className="px-4 py-3 align-top"><HealthDot cinema={c} /></td>
                  <td className="px-4 py-3">
                    <p className="text-text-primary font-medium">{c.name}</p>
                    <p className="text-text-muted text-xs mt-0.5">{c.chain ?? '—'} · {c.city ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">
                    {c.scrape_adapter
                      ? ADAPTER_LABELS[c.scrape_adapter] ?? c.scrape_adapter
                      : <span className="text-text-muted">— none —</span>}
                    {c.scrape_config?.externalCinemaId && (
                      <div className="text-[10px] mt-0.5 opacity-60">{c.scrape_config.externalCinemaId}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">{fmtWhen(c.showtimes_last_fetched_at)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium ${(c.scrape_failure_count ?? 0) >= 5 ? 'text-red-400' : 'text-text-muted'}`}>
                      {c.scrape_failure_count ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-red-400/80 max-w-[260px] truncate" title={c.scrape_last_error ?? ''}>
                    {c.scrape_last_error ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      {(c.scrape_failure_count ?? 0) >= 5 && (
                        <button onClick={() => resetFailures(c.id)}
                          className="px-2 py-1 text-xs bg-yellow-900/40 text-yellow-400 hover:bg-yellow-900/60 rounded-lg">
                          Reset
                        </button>
                      )}
                      <button onClick={() => toggle(c)}
                        className={`px-3 py-1.5 text-xs rounded-lg ${c.scrape_enabled
                          ? 'bg-green-900/40 text-green-400 hover:bg-green-900/60'
                          : 'bg-[#252D45] text-text-muted hover:text-text-primary'}`}>
                        {c.scrape_enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
