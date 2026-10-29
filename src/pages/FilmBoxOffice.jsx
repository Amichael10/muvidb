import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate, useLoaderData } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import SEO from '../components/SEO';
import { formatFilmTitle, formatPersonName } from '../utils/format';
import { useAuth } from '../context/AuthContext';

function formatNaira(amount) {
  if (!amount || isNaN(amount)) return '—';
  const num = Number(amount);
  if (num >= 1_000_000_000) {
    return `₦${(num / 1_000_000_000).toFixed(2)} Billion`;
  }
  if (num >= 1_000_000) {
    return `₦${(num / 1_000_000).toFixed(1)} Million`;
  }
  return `₦${num.toLocaleString('en-NG')}`;
}

export default function FilmBoxOffice() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const loaderData = useLoaderData();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'admin_limited';

  const [film, setFilm] = useState(loaderData?.film ?? null);
  const [loading, setLoading] = useState(!loaderData?.film);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (loaderData?.film) {
      setFilm(loaderData.film);
      setLoading(false);
      return;
    }

    async function loadFilm() {
      if (!slug) return;
      setLoading(true);
      setError(null);

      try {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
        const col = isUUID ? 'id' : 'slug';

        let { data, error: fetchErr } = await supabase
          .from('films')
          .select(`
            id,
            title,
            slug,
            year,
            release_date,
            runtime_minutes,
            duration,
            nfvcb_rating,
            poster_url,
            backdrop_url,
            box_office_domestic,
            box_office_opening_weekend,
            box_office_currency,
            box_office_source,
            streaming_links,
            film_genres (
              genres (
                name
              )
            )
          `)
          .eq(col, slug)
          .maybeSingle();

        if (fetchErr || !data) {
          // If not found by slug, try searching by id fallback
          const { data: fallbackData } = await supabase
            .from('films')
            .select(`
              id,
              title,
              slug,
              year,
              release_date,
              runtime_minutes,
              duration,
              nfvcb_rating,
              poster_url,
              backdrop_url,
              box_office_domestic,
              box_office_opening_weekend,
              box_office_currency,
              box_office_source,
              streaming_links,
              film_genres (
                genres (
                  name
                )
              )
            `)
            .eq('id', slug)
            .maybeSingle();

          data = fallbackData;
        }

        if (data) {
          // Fetch credits safely via /api/content
          try {
            const res = await fetch(`/api/content?resource=film-credits&filmId=${encodeURIComponent(data.id)}`);
            if (res.ok) {
              const crData = await res.json();
              data.credits = crData.credits || [];
            }
          } catch {}

          if (data.film_genres) {
            data.genres = data.film_genres.map((fg) => fg.genres?.name).filter(Boolean);
          }
          setFilm(data);
        } else {
          setError('Film not found');
        }
      } catch (err) {
        console.error('Error fetching film box office:', err);
        setError('Failed to load box office data');
      } finally {
        setLoading(false);
      }
    }

    loadFilm();
  }, [slug, loaderData]);

  // Extract Box Office Metrics
  const boxOfficeData = film?.streaming_links?.box_office || {};
  const domestic = Number(film?.box_office_domestic || boxOfficeData.domestic || 0);
  const openingWeekend = Number(film?.box_office_opening_weekend || boxOfficeData.opening_weekend || 0);
  const admissions = Number(boxOfficeData.admissions || boxOfficeData.admissions_total || 0);
  const weekendAdmissions = Number(boxOfficeData.admissions_weekend || 0);
  const locations = boxOfficeData.locations;
  const source = film?.box_office_source || boxOfficeData.source || 'Nigerian Film Intelligence / CEAN';
  const weeklyHistory = Array.isArray(boxOfficeData.history) ? boxOfficeData.history : [];
  const reachMetrics = boxOfficeData.reach_metrics;

  const totalWeeklyGross = useMemo(() => {
    return weeklyHistory.reduce((acc, w) => acc + (Number(w.gross) || 0), 0);
  }, [weeklyHistory]);

  const remainingGross = useMemo(() => {
    return domestic > totalWeeklyGross && totalWeeklyGross > 0
      ? domestic - totalWeeklyGross
      : 0;
  }, [domestic, totalWeeklyGross]);

  const directors = useMemo(() => {
    return (film?.credits || [])
      .filter((c) => c.role?.toLowerCase() === 'director')
      .map((c) => c.person)
      .filter(Boolean);
  }, [film]);

  const mainCast = useMemo(() => {
    return (film?.credits || [])
      .filter((c) => !c.role || c.role?.toLowerCase() === 'actor' || c.role?.toLowerCase() === 'cast')
      .slice(0, 5)
      .map((c) => c.person)
      .filter(Boolean);
  }, [film]);

  if (loading) {
    return (
      <div className="w-full min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
        <p className="text-text-muted text-sm font-medium">Loading Box Office Records...</p>
      </div>
    );
  }

  if (error || !film) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <Icon icon="solar:ticket-sale-linear" className="text-5xl text-text-muted mx-auto opacity-40" />
        <h2 className="text-2xl font-bold text-text-primary">Box Office Record Not Found</h2>
        <p className="text-text-muted text-sm">We could not find box office tracking records for this title.</p>
        <Link
          to="/box-office"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-white font-bold text-sm shadow-md hover:opacity-90 transition-opacity"
        >
          <Icon icon="solar:arrow-left-linear" />
          <span>Back to Box Office Tracker</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full bg-bg min-h-screen pb-24 text-text-primary">
      <SEO 
        title={`${film.title} (${film.year || ''}) Box Office Breakdown | MuviDB`}
        description={`Theatrical box office gross, weekly run numbers, admissions, and commercial performance breakdown for ${film.title}.`}
      />

      {/* Breadcrumb / Back Bar */}
      <section className="border-b border-border bg-surface-2/40 py-3.5">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 flex items-center justify-between gap-4">
          <Link
            to={`/films/${film.slug || film.id}`}
            className="inline-flex items-center gap-2 text-xs font-bold text-text-muted hover:text-brand transition-colors group"
          >
            <Icon icon="solar:arrow-left-linear" className="text-sm group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to <strong className="text-text-primary group-hover:text-brand">{film.title}</strong></span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to="/box-office"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:underline"
            >
              <Icon icon="solar:ticket-bold" className="text-sm" />
              <span>Nollywood Tracker</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Film Header Summary */}
      <section className="relative border-b border-border bg-surface/60 py-8 sm:py-10">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <Link
              to={`/films/${film.slug || film.id}`}
              className="shrink-0 w-24 sm:w-28 md:w-32 aspect-[2/3] rounded-xl overflow-hidden border border-border shadow-xl hover:opacity-90 transition-opacity"
            >
              <ImageWithFallback
                src={film.poster_url}
                alt={film.title}
                fallbackType="film"
                className="w-full h-full object-cover"
              />
            </Link>

            <div className="space-y-3 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-wider">
                  Theatrical Box Office
                </span>
                {film.nfvcb_rating && (
                  <span className="px-2 py-0.5 rounded bg-brand/10 border border-brand/30 text-brand text-[10px] font-black">
                    {film.nfvcb_rating}
                  </span>
                )}
                {film.year && (
                  <span className="text-xs font-mono font-bold text-text-muted">
                    {film.year}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black font-heading tracking-tight text-text-primary">
                {formatFilmTitle(film.title)}
              </h1>

              {/* Directors & Genres */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                {directors.length > 0 && (
                  <div>
                    <span className="text-text-muted">Directed by: </span>
                    <span className="text-text-primary font-bold">
                      {directors.map((d) => formatPersonName(d.name)).join(', ')}
                    </span>
                  </div>
                )}
                {film.genres?.length > 0 && (
                  <div>
                    <span className="text-text-muted">Genres: </span>
                    <span className="text-text-primary font-semibold">
                      {film.genres.join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Link Button */}
            <div className="shrink-0 pt-2 sm:pt-0">
              <Link
                to={`/films/${film.slug || film.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-xs font-bold text-text-primary transition-all hover:border-brand/40 shadow-xs"
              >
                <span>View Full Film Details</span>
                <Icon icon="solar:arrow-right-up-linear" className="text-sm text-text-muted" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 py-8 sm:py-10 space-y-10">
        
        {/* KEY BOX OFFICE METRICS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Lifetime Gross */}
          <div className="p-5 rounded-2xl bg-amber-500/[0.07] border border-amber-500/25 shadow-sm space-y-2 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                Lifetime Domestic Gross
              </span>
              <Icon icon="solar:ticket-bold" className="text-amber-400 text-base" />
            </div>
            <div className="text-2xl sm:text-3xl font-black font-heading text-amber-400 tracking-tight">
              {formatNaira(domestic)}
            </div>
            <div className="text-[11px] text-text-muted font-mono">
              ₦{domestic.toLocaleString('en-NG')} NGN
            </div>
          </div>

          {/* Opening Weekend */}
          <div className="p-5 rounded-2xl bg-surface border border-border shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                Opening Weekend
              </span>
              <Icon icon="solar:calendar-bold" className="text-brand text-base opacity-75" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-heading text-text-primary tracking-tight">
              {openingWeekend > 0 ? formatNaira(openingWeekend) : '—'}
            </div>
            <div className="text-[11px] text-text-muted">
              {openingWeekend > 0 ? `₦${openingWeekend.toLocaleString('en-NG')}` : 'Debut tracking not recorded'}
            </div>
          </div>

          {/* Admissions / Tickets */}
          <div className="p-5 rounded-2xl bg-surface border border-border shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                Total Admissions
              </span>
              <Icon icon="solar:users-group-two-rounded-bold" className="text-purple-400 text-base" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-heading text-text-primary tracking-tight">
              {admissions > 0 ? `${admissions.toLocaleString()} tickets` : '—'}
            </div>
            <div className="text-[11px] text-text-muted">
              {weekendAdmissions > 0 
                ? `${weekendAdmissions.toLocaleString()} weekend tickets` 
                : (admissions > 0 ? 'Verified admission tally' : 'Ticket count not published')}
            </div>
          </div>

          {/* Average Ticket or Circuits */}
          <div className="p-5 rounded-2xl bg-surface border border-border shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                {locations ? 'Cinemas / Locations' : (admissions > 0 && domestic > 0 ? 'Avg. Ticket Price' : 'Theatrical Reach')}
              </span>
              <Icon icon="solar:buildings-bold" className="text-blue-400 text-base" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-heading text-text-primary tracking-tight">
              {locations 
                ? `${locations} Locations` 
                : (admissions > 0 && domestic > 0 ? `₦${Math.round(domestic / admissions).toLocaleString()}` : 'National Circuit')}
            </div>
            <div className="text-[11px] text-text-muted">
              {locations ? 'Reported screen circuits' : 'Nigerian Cinema Exhibition'}
            </div>
          </div>
        </div>

        {/* WEEKLY BREAKDOWN TABLE */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-0.5 bg-amber-400 rounded-full inline-block" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                  Weekly Run Tracking
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold font-heading text-text-primary tracking-tight mt-1">
                Theatrical Run Breakdown
              </h2>
            </div>
            <p className="text-xs text-text-muted">
              Comprehensive week-by-week theatrical figures and cumulative gross progression.
            </p>
          </div>

          <div className="rounded-2xl border border-border overflow-hidden bg-surface shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-text-muted font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 pl-4 sm:pl-6 pr-3">Week / Period</th>
                    <th className="py-3.5 px-3">Date</th>
                    <th className="py-3.5 px-3 text-right">Weekly Gross</th>
                    <th className="py-3.5 px-3 text-right">Cumulative Gross</th>
                    <th className="py-3.5 px-3 text-right">Admissions</th>
                    <th className="py-3.5 pr-4 sm:pr-6 pl-3 text-right">Circuits / Screens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {weeklyHistory.length > 0 ? (
                    weeklyHistory.map((item, idx) => {
                      const weekGross = Number(item.gross || 0);
                      const cumulative = Number(item.cumulative || item.total || 0);
                      const weekAdmissions = item.admissions || item.tickets;
                      const dateStr = item.date || item.week_date || '';

                      return (
                        <tr key={idx} className="hover:bg-surface-2/40 transition-colors">
                          <td className="py-3.5 pl-4 sm:pl-6 pr-3 font-bold text-text-primary">
                            {item.label || item.week ? `Week ${item.label || item.week}` : `Week ${idx + 1}`}
                          </td>
                          <td className="py-3.5 px-3 text-text-muted font-mono">
                            {dateStr || ''}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-bold text-amber-400">
                            {weekGross > 0 ? `₦${weekGross.toLocaleString('en-NG')}` : '—'}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-bold text-text-primary">
                            {cumulative > 0 ? `₦${cumulative.toLocaleString('en-NG')}` : '—'}
                          </td>
                          <td className="py-3.5 px-3 text-right text-text-secondary">
                            {weekAdmissions ? `${Number(weekAdmissions).toLocaleString()} tickets` : '—'}
                          </td>
                          <td className="py-3.5 pr-4 sm:pr-6 pl-3 text-right text-text-muted">
                            {item.locations || item.screens || item.cinemas || '—'}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-text-muted">
                        <Icon icon="solar:info-circle-linear" className="text-2xl mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-semibold text-text-primary">No weekly log breakdowns itemized</p>
                        <p className="text-xs text-text-muted mt-0.5">Total lifetime gross is verified from national cinema reporting.</p>
                      </td>
                    </tr>
                  )}

                  {/* "OTHERS" UNACCOUNTED GROSS ROW */}
                  {remainingGross > 0 && (
                    <tr className="bg-amber-500/[0.04] font-medium border-t-2 border-amber-500/20">
                      <td className="py-3.5 pl-4 sm:pl-6 pr-3 font-bold text-amber-400 flex items-center gap-1.5">
                        <Icon icon="solar:layers-bold" className="text-sm" />
                        <span>Others</span>
                      </td>
                      <td className="py-3.5 px-3 text-text-muted text-[11px]">
                        Extended run &amp; regional circuits
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-amber-400">
                        ₦{remainingGross.toLocaleString('en-NG')}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-amber-400">
                        ₦{domestic.toLocaleString('en-NG')}
                      </td>
                      <td className="py-3.5 px-3 text-right text-text-muted">
                        Unitemized
                      </td>
                      <td className="py-3.5 pr-4 sm:pr-6 pl-3 text-right text-text-muted">
                        Remaining Theatrical
                      </td>
                    </tr>
                  )}

                  {/* TOTAL LIFETIME ROW */}
                  <tr className="bg-surface-2/80 font-black text-text-primary border-t border-border">
                    <td className="py-4 pl-4 sm:pl-6 pr-3 uppercase tracking-wider text-xs">
                      Total Domestic Gross
                    </td>
                    <td className="py-4 px-3 text-text-muted">
                      Full Release
                    </td>
                    <td className="py-4 px-3 text-right font-mono text-base text-amber-400">
                      ₦{domestic.toLocaleString('en-NG')}
                    </td>
                    <td className="py-4 px-3 text-right font-mono text-base text-amber-400">
                      ₦{domestic.toLocaleString('en-NG')}
                    </td>
                    <td className="py-4 px-3 text-right text-text-primary">
                      {admissions > 0 ? `${admissions.toLocaleString()} tickets` : '—'}
                    </td>
                    <td className="py-4 pr-4 sm:pr-6 pl-3 text-right text-text-muted">
                      All Circuits
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ADMIN-ONLY SOURCE CITATION RECORD */}
        {isAdmin && (
          <div className="p-4 rounded-xl bg-surface-2 border border-border/80 flex items-start gap-3">
            <Icon icon="solar:shield-check-bold" className="text-emerald-400 text-lg shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Admin Internal Record
                </span>
                <span className="text-xs font-bold text-text-primary">Verified Attribution</span>
              </div>
              <p className="text-xs text-text-muted font-mono leading-relaxed">
                Source: {source}
              </p>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
