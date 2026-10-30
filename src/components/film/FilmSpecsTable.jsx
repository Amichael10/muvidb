import React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { formatPersonName, toSentenceCase, formatLanguage } from '../../utils/format';
import { formatViewCount } from '../../utils/youtube';
import { PLATFORMS, isFilmOnPlatform, getWatchUrl } from '../../lib/platforms';
import { calculateYoutubeBoxOffice } from '../../lib/youtubeBoxOffice';

/**
 * Rotten Tomatoes-inspired "Movie Info / Film Specs" Section.
 * Unifies the Film Synopsis / Storyline and key production metadata
 * (Director, Writers, Producers, Distributor, Box Office, Runtime, Rating)
 * into an authoritative, clean, cohesive section.
 */
export default function FilmSpecsTable({
  film,
  cast = [],
  crew = [],
  synopsis = null,
  onSuggestEdit = null,
  onReport = null,
  onEditBoxOffice = null,
  onOpenBoxOfficeBreakdown = null,
  isAdmin = false,
  className = '',
}) {
  if (!film) return null;

  // Extract key creatives from crew
  const directors = crew.filter((c) => /direct/i.test(c.role || ''));
  const writers = crew.filter((c) => /writ|screenplay|story|author/i.test(c.role || ''));
  const producers = crew.filter(
    (c) => /produc/i.test(c.role || '') && !/associate|assistant|coordinator/i.test(c.role || '')
  );

  // Production and distribution companies
  const prodCompanies = (film.film_companies || []).filter(
    (fc) => !fc.role || fc.role === 'production' || fc.role === 'co_production'
  );
  const distCompanies = (film.film_companies || []).filter(
    (fc) => fc.role === 'distribution' || fc.role === 'international_distribution'
  );

  // Format Box Office
  const domGross = film.box_office_domestic || film.streaming_links?.box_office?.domestic;
  const currency = film.box_office_currency || film.streaming_links?.box_office?.currency || 'NGN';
  const symbol = currency === 'NGN' ? '₦' : `${currency} `;
  let formattedBoxOffice = null;
  if (domGross) {
    formattedBoxOffice =
      domGross >= 1_000_000_000
        ? `${symbol}${(domGross / 1_000_000_000).toFixed(2)} Billion`
        : `${symbol}${(domGross / 1_000_000).toFixed(1)} Million`;
  }

  // A film has genuine YouTube Movie views ONLY if it is an actual YouTube film,
  // excluding trailers from cinema theatrical runs.
  const isCinema = (Number(domGross) || 0) > 0 || film.release_type === 'cinema' || Boolean(film.is_in_cinemas);
  const isYoutubeMovie = film.release_type === 'youtube' || (Boolean(film.youtube_watch_url) && !isCinema);
  const showYoutubeStream = isYoutubeMovie && Boolean(film.view_count && Number(film.view_count) > 0);
  const youtubeBoxOffice = showYoutubeStream
    ? calculateYoutubeBoxOffice({
        viewCount: Number(film.view_count),
        runtimeMinutes: film.runtime_minutes || film.duration,
        language: film.language,
        title: film.title,
      })
    : null;

  // Format Runtime
  const runtimeMins = film.runtime_minutes || film.runtime;
  let formattedRuntime = null;
  if (runtimeMins) {
    const hours = Math.floor(runtimeMins / 60);
    const mins = runtimeMins % 60;
    formattedRuntime = hours > 0 ? `${hours}h ${mins}m (${runtimeMins} min)` : `${runtimeMins} min`;
  }

  // Active Streaming Platforms
  const isRealYoutubeUrl = (url) => typeof url === 'string' && (url.includes('youtube.com') || url.includes('youtu.be'));
  const fullYoutubeUrl = (isRealYoutubeUrl(film.youtube_watch_url) ? film.youtube_watch_url : null) || (isFilmOnPlatform(film, 'youtube') ? getWatchUrl(film, 'youtube') : null);
  const activePlatforms = PLATFORMS.filter((p) => {
    if (p.id === 'cinema') return false;
    if (p.id === 'youtube' && fullYoutubeUrl) return true;
    return isFilmOnPlatform(film, p.id);
  });

  // Specs Rows Array
  const specs = [
    {
      label: 'Rating',
      value: film.nfvcb_rating ? (
        <span className="inline-flex items-center gap-1.5 font-bold">
          <span className="bg-brand/10 border border-brand/30 text-brand px-2 py-0.5 rounded text-xs font-black">
            {film.nfvcb_rating}
          </span>
        </span>
      ) : null,
    },
    {
      label: 'Genre',
      value: film.genres?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {film.genres.map((g) => (
            <Link
              key={g}
              to={`/browse?genre=${encodeURIComponent(g.toLowerCase())}`}
              className="text-text-primary hover:text-brand transition-colors text-xs font-semibold"
            >
              {g}
              <span className="text-text-muted ml-1">·</span>
            </Link>
          ))}
        </div>
      ) : null,
    },
    {
      label: 'Director',
      value: directors.length > 0 ? (
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          {directors.map((d, i) => (
            <span key={d.id || i} className="inline-flex items-center">
              <Link
                to={`/people/${d.slug || d.id}`}
                className="text-text-primary font-bold hover:text-brand hover:underline transition-colors"
              >
                {formatPersonName(d.name)}
              </Link>
              {i < directors.length - 1 ? <span className="text-text-muted ml-1">,</span> : null}
            </span>
          ))}
        </div>
      ) : film.director ? (
        <span className="font-bold text-text-primary">{film.director}</span>
      ) : null,
    },
    {
      label: 'Producer',
      value: producers.length > 0 ? (
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          {producers.slice(0, 5).map((p, i) => (
            <span key={p.id || i} className="inline-flex items-center">
              <Link
                to={`/people/${p.slug || p.id}`}
                className="text-text-primary hover:text-brand hover:underline transition-colors"
              >
                {formatPersonName(p.name)}
              </Link>
              {i < Math.min(producers.length, 5) - 1 ? <span className="text-text-muted ml-1">,</span> : null}
            </span>
          ))}
        </div>
      ) : null,
    },
    {
      label: 'Screenwriter / Writer',
      value: writers.length > 0 ? (
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          {writers.slice(0, 4).map((w, i) => (
            <span key={w.id || i} className="inline-flex items-center">
              <Link
                to={`/people/${w.slug || w.id}`}
                className="text-text-primary hover:text-brand hover:underline transition-colors"
              >
                {formatPersonName(w.name)}
              </Link>
              {i < Math.min(writers.length, 4) - 1 ? <span className="text-text-muted ml-1">,</span> : null}
            </span>
          ))}
        </div>
      ) : null,
    },
    {
      label: 'Release Date (Theaters / Premiere)',
      value: film.release_date ? (
        <span className="text-text-primary">
          {new Date(film.release_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      ) : film.year ? (
        <span className="text-text-primary">{film.year}</span>
      ) : null,
    },
    {
      label: 'Where to Watch',
      value: (activePlatforms.length > 0 || film.is_in_cinemas) ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {film.is_in_cinemas && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-brand/15 border border-brand/30 text-brand text-xs font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
              In Cinemas
            </span>
          )}
          {activePlatforms.map((p) => {
            const url = (p.id === 'youtube' && fullYoutubeUrl) ? fullYoutubeUrl : getWatchUrl(film, p.id);
            const content = (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-2 hover:bg-surface-3 border border-border text-text-primary text-xs font-semibold transition-all hover:border-brand/40">
                {p.logo ? (
                  <img src={p.logo} alt="" className="w-3.5 h-3.5 object-contain" />
                ) : (
                  <Icon icon={p.icon} className="text-xs" style={{ color: p.color }} />
                )}
                <span>{p.name}</span>
                {url && <Icon icon="solar:arrow-right-up-linear" className="text-[10px] text-text-muted" />}
              </span>
            );
            return url ? (
              <a key={p.id} href={url} target="_blank" rel="noopener noreferrer" title={`Watch on ${p.name}`}>
                {content}
              </a>
            ) : (
              <Link key={p.id} to={`/watch/${p.id}`} title={`Browse ${p.name} titles`}>
                {content}
              </Link>
            );
          })}
        </div>
      ) : null,
    },
    {
      label: 'Box Office (Domestic Gross)',
      value: formattedBoxOffice ? (
        <span className="inline-flex items-center gap-2 flex-wrap font-bold text-brand">
          <button
            type="button"
            onClick={onOpenBoxOfficeBreakdown}
            className="inline-flex items-center gap-1.5 hover:text-brand-hover transition-colors cursor-pointer group"
            title="Click to view full box office breakdown"
          >
            <Icon icon="solar:ticket-bold" className="text-sm" />
            <span className="underline decoration-dotted decoration-brand/50 underline-offset-4 group-hover:decoration-brand-hover">
              {formattedBoxOffice}
            </span>
            <Icon icon="solar:arrow-right-up-linear" className="text-xs opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
          </button>
          {/* Where a figure came from is an internal reconciliation detail,
              so it stays on the admin's view of the page only. */}
          {isAdmin && (
            <span className="text-[10px] uppercase font-bold text-text-muted bg-surface-2 px-1.5 py-0.5 rounded border border-border">
              {film.box_office_source || film.streaming_links?.box_office?.source || 'Verified CEAN'}
            </span>
          )}
          {isAdmin && onEditBoxOffice && (
            <button
              type="button"
              onClick={onEditBoxOffice}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-brand/10 hover:bg-brand/20 text-brand border border-brand/30 transition-colors cursor-pointer"
              title="Edit Box Office Figures"
            >
              <Icon icon="solar:pen-bold" className="text-xs" />
              <span>Edit</span>
            </button>
          )}
        </span>
      ) : isAdmin && onEditBoxOffice ? (
        <span className="inline-flex items-center gap-2 text-text-muted">
          <span className="italic">Not recorded yet</span>
          <button
            type="button"
            onClick={onEditBoxOffice}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-brand/10 hover:bg-brand/20 text-brand border border-brand/30 transition-colors cursor-pointer"
          >
            <Icon icon="solar:add-circle-bold" className="text-xs" />
            <span>Add Box Office</span>
          </button>
        </span>
      ) : null,
    },
    {
      label: 'YouTube Box Office',
      value: showYoutubeStream ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/films/${film.slug || film.id}/box-office`}
              className="inline-flex items-center gap-1.5 font-bold text-brand hover:text-brand-hover transition-colors"
              title="View Film YouTube Box Office Breakdown"
            >
              <Icon icon="simple-icons:youtube" className="text-red-500 text-sm" />
              <span>{youtubeBoxOffice?.formattedNgn}</span>
              <span className="text-xs text-text-muted font-normal">({youtubeBoxOffice?.formattedUsd})</span>
              <Icon icon="solar:arrow-right-up-linear" className="text-xs text-text-muted" />
            </Link>
            <span className="text-[10px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded border border-border">
              Est. AdSense Box Office
            </span>
          </div>
          <div className="text-xs text-text-muted flex items-center gap-2 font-mono">
            <span>{Number(film.view_count).toLocaleString()} total streams</span>
            <span>•</span>
            <span className="text-text-secondary">{youtubeBoxOffice?.effectiveRpmUsd}/1K RPM</span>
          </div>
        </div>
      ) : null,
    },
    {
      label: 'Runtime',
      value: formattedRuntime ? <span className="text-text-primary">{formattedRuntime}</span> : null,
    },
    {
      label: 'Distributor',
      value: (film.distributor || distCompanies.length > 0) ? (
        <span className="text-text-primary font-medium">
          {film.distributor || distCompanies.map((c) => c.companies?.name).filter(Boolean).join(', ')}
        </span>
      ) : null,
    },
    {
      label: 'Production Co',
      value: prodCompanies.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {prodCompanies.map((pc, i) => (
            <span key={pc.companies?.id || i} className="inline-flex items-center gap-1 text-text-primary font-medium">
              <Link to={`/companies/${pc.companies?.slug || pc.companies?.id}`} className="hover:text-brand transition-colors">
                {pc.companies?.name}
              </Link>
              {i < prodCompanies.length - 1 ? <span className="text-text-muted">,</span> : null}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-text-muted">Independent Production</span>
      ),
    },
    {
      label: 'Original Language',
      value: film.language
        ? formatLanguage(film.language)
        : (film.languages?.length ? film.languages.map(formatLanguage).join(', ') : 'English'),
    },
    {
      label: 'Country of Origin',
      value: film.countries?.length ? film.countries.join(', ') : 'Nigeria',
    },
  ].filter((s) => s.value != null);

  return (
    <section className={`p-5 sm:p-6 md:p-8 border-b border-border bg-surface-2/5 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 sm:mb-6">
        <div>
          <h2 className="font-heading font-black text-xl sm:text-2xl text-text-primary tracking-tight leading-none">
            Movie Info
          </h2>
          <p className="text-xs text-text-muted mt-1">
            Production credits, box office tracking & industry specifications
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && onEditBoxOffice && (
            <button
              type="button"
              onClick={onEditBoxOffice}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand/10 hover:bg-brand hover:text-white border border-brand/30 text-brand text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
              title="Set or update Box Office revenue"
            >
              <Icon icon="solar:ticket-bold" className="text-sm" />
              <span>Edit Box Office</span>
            </button>
          )}
          {onSuggestEdit && (
            <button
              type="button"
              onClick={onSuggestEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-brand hover:text-white border border-border hover:border-brand text-text-primary text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <Icon icon="solar:pen-2-bold" className="text-brand text-sm group-hover:text-white" />
              <span>Suggest an edit</span>
            </button>
          )}
          {onReport && (
            <button
              type="button"
              onClick={onReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 border border-border text-text-muted text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
              title="Report broken or pirate link"
            >
              <Icon icon="solar:flag-bold" className="text-xs" />
              <span>Report link</span>
            </button>
          )}
        </div>
      </div>

      {/* Storyline / Synopsis */}
      {(synopsis || film.synopsis) && (
        <div className="mb-6 pb-6 border-b border-border/80">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted">
              Storyline & Synopsis
            </h3>
          </div>
          <p className="text-text-secondary text-sm sm:text-[15px] leading-relaxed border-l-2 border-brand pl-4">
            {toSentenceCase(synopsis || film.synopsis)}
          </p>

          {(onSuggestEdit || onReport) && (
            <div className="flex flex-wrap items-center gap-4 mt-4 pl-4">
              {onSuggestEdit && (
                <button
                  type="button"
                  onClick={onSuggestEdit}
                  className="inline-flex items-center gap-1.5 text-text-secondary hover:text-brand text-xs font-bold transition-colors min-h-[36px] cursor-pointer"
                >
                  <Icon icon="solar:pen-2-linear" width="14" />
                  <span>Suggest an edit</span>
                </button>
              )}
              {onReport && (
                <button
                  type="button"
                  onClick={onReport}
                  className="inline-flex items-center gap-1.5 text-text-secondary hover:text-red-500 text-xs font-bold transition-colors min-h-[36px] cursor-pointer"
                >
                  <Icon icon="solar:flag-linear" width="14" />
                  <span>Report a broken / pirate link</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2-Column Responsive Key/Value Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 sm:gap-x-12 gap-y-3 sm:gap-y-3.5 text-xs">
        {specs.map((spec, idx) => (
          <div
            key={idx}
            className="flex flex-col sm:flex-row sm:items-baseline justify-between py-2 border-b border-border/60 gap-1 sm:gap-4"
          >
            <span className="font-bold text-text-muted uppercase tracking-wider text-[11px] shrink-0 min-w-[130px]">
              {spec.label}
            </span>
            <div className="text-left sm:text-right flex-1 break-words">
              {spec.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
