import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Icon } from '@iconify/react';
import { supabase } from '../lib/supabase';
import FilmCard from '../components/film/FilmCard';
import SkeletonCard from '../components/ui/SkeletonCard';
import { getPlatform, platformFilter } from '../lib/platforms';

// Reusable "Watch on [Platform]" browse page — owns the "where to watch Nollywood
// on <platform>" search intent. Mirrors Browse's grid/filter UX but pinned to one platform.
export default function WatchPlatform() {
  const { platform: platformId } = useParams();
  const platform = getPlatform(platformId);

  const [films, setFilms] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [yearMin, setYearMin] = useState(0);
  const [newThisMonth, setNewThisMonth] = useState(false);

  useEffect(() => {
    if (!platform) return;
    document.title = `Where to Watch Nollywood on ${platform.name} | MuviDB`;
    fetchFilms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformId]);

  const fetchFilms = async () => {
    setLoading(true);
    try {
      // Filter at the DB level so we get ALL of the platform's titles (the catalogue
      // is 19k+; a recency window would miss most of a platform's films).
      // NB: we intentionally DON'T ask for `count: 'exact'` here — the streaming_links
      // JSON filter is unindexed, and adding an exact count roughly tripled the query
      // time (~3.1s vs ~1.2s) which tipped it over the statement timeout under load,
      // throwing and leaving the page blank. The count is fetched separately below as
      // a non-blocking best-effort so it can never blank the grid.
      const runQuery = async (attempt = 0) => {
        const res = await supabase
          .from('films')
          .select(`
            id, title, slug, poster_url, backdrop_url, year, language,
            runtime_minutes, view_count, average_rating, audience_rating,
            tmdb_rating, nfvcb_rating, countries, content_type, youtube_watch_url,
            release_type, streaming_links, source, is_in_cinemas, created_at,
            film_genres(genres(name))
          `)
          .or(platformFilter(platformId))
          .order('created_at', { ascending: false })
          .limit(1000);
        if (res.error && attempt < 2 && res.error.code === '57014') {
          await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
          return runQuery(attempt + 1);
        }
        return res;
      };

      const { data, error } = await runQuery();
      if (error) throw error;

      const mapped = (data || []).map((f) => ({
        ...f,
        genres: f.film_genres?.map((fg) => fg.genres?.name).filter(Boolean) || [],
      }));

      setFilms(mapped);
      setTotalCount(mapped.length); // provisional; refined by the count query below

      // Best-effort exact total for the header — separate + non-blocking so a slow
      // or timed-out count never affects the film grid.
      (async () => {
        const countOne = async (attempt = 0) => {
          const { count, error: cErr } = await supabase
            .from('films')
            .select('id', { count: 'exact', head: true })
            .or(platformFilter(platformId));
          if (cErr && attempt < 2 && cErr.code === '57014') {
            await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
            return countOne(attempt + 1);
          }
          return cErr ? null : count;
        };
        const total = await countOne();
        if (typeof total === 'number') setTotalCount(total);
      })();
    } catch (err) {
      console.error('Error fetching platform films:', err);
    } finally {
      setLoading(false);
    }
  };

  const genres = useMemo(() => {
    const set = new Set();
    films.forEach((f) => f.genres.forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [films]);

  const filtered = useMemo(() => {
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 31);
    return films.filter((f) => {
      if (selectedGenre && !f.genres.includes(selectedGenre)) return false;
      if (yearMin && (f.year || 0) < yearMin) return false;
      if (newThisMonth && (!f.created_at || new Date(f.created_at) < monthAgo)) return false;
      return true;
    });
  }, [films, selectedGenre, yearMin, newThisMonth]);

  if (!platform) return <Navigate to="/browse" replace />;

  return (
    <div className="min-h-screen bg-bg">
      <Helmet>
        <title>{`Where to Watch Nollywood on ${platform.name} | MuviDB`}</title>
        <meta
          name="description"
          content={`Browse every Nollywood title available on ${platform.name}. ${totalCount} films and counting on MuviDB — the home of Nollywood.`}
        />
        <link rel="canonical" href={`https://muvidb.com/watch/${platform.id}`} />
      </Helmet>

      {/* Header */}
      <div className="bg-surface-2/10 border-b border-border relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 py-16 pt-32 border-x border-border relative z-10">
          <Link to="/" className="text-text-muted text-[10px] font-bold uppercase tracking-widest hover:text-brand transition-colors flex items-center gap-1.5 mb-6 w-fit">
            <Icon icon="solar:alt-arrow-left-linear" className="w-3.5 h-3.5" /> Where to Watch
          </Link>
          <div className="flex items-center gap-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center border border-white/10 shrink-0"
              style={{ background: `${platform.color}22`, color: platform.color }}
            >
              <Icon icon={platform.icon} className="text-3xl" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl md:text-5xl font-heading font-bold text-text-primary tracking-tighter">
                Watch on {platform.name}
              </h1>
              <p className="text-text-muted text-sm">
                {loading ? 'Loading titles…' : `${totalCount} Nollywood ${totalCount === 1 ? 'title' : 'titles'} available`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto border-x border-border min-h-screen">
        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-3 p-6 md:p-8 border-b border-border bg-surface-2/5">
          <button
            onClick={() => setNewThisMonth((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest border transition-all ${
              newThisMonth ? 'bg-brand border-brand text-white' : 'bg-surface border-border text-text-muted hover:border-brand/50'
            }`}
          >
            <Icon icon="solar:fire-bold" className="text-sm" /> New this month
          </button>

          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="bg-surface border border-border text-text-primary rounded-full px-4 py-2 text-[11px] font-bold tracking-wider outline-none focus:border-brand transition-all"
          >
            <option value="">All genres</option>
            {genres.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          <select
            value={yearMin}
            onChange={(e) => setYearMin(parseInt(e.target.value, 10))}
            className="bg-surface border border-border text-text-primary rounded-full px-4 py-2 text-[11px] font-bold tracking-wider outline-none focus:border-brand transition-all"
          >
            <option value={0}>Any year</option>
            <option value={2024}>2024 +</option>
            <option value={2020}>2020 +</option>
            <option value={2015}>2015 +</option>
            <option value={2010}>2010 +</option>
          </select>

          {(selectedGenre || yearMin || newThisMonth) && (
            <button
              onClick={() => { setSelectedGenre(''); setYearMin(0); setNewThisMonth(false); }}
              className="text-[10px] font-bold text-brand hover:underline uppercase tracking-widest ml-1"
            >
              Clear
            </button>
          )}
        </div>

        {/* Grid */}
        <div className="p-8 md:p-12">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex justify-center"><SkeletonCard size="md" /></div>
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {filtered.map((film) => (
                <div key={film.id} className="flex justify-center"><FilmCard film={film} /></div>
              ))}
            </div>
          ) : (
            <div className="bg-surface-2/10 border-2 border-dashed border-border rounded-xl p-24 text-center">
              <p className="text-text-muted text-xs font-bold mb-6">
                No {platform.name} titles match these filters yet.
              </p>
              <Link to="/browse" className="bg-brand text-white text-[10px] font-bold px-8 py-3 rounded-lg uppercase tracking-widest hover:shadow-brand/20 transition-all">
                Browse all films
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
