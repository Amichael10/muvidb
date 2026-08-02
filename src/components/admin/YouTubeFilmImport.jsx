import { useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { fetchVideoDetailsForImport } from '../../utils/youtube';

/**
 * Paste a YouTube URL → pull title, description, play link, runtime and
 * every available thumbnail resolution into the admin film form.
 *
 * The admin still reviews and edits before saving; this only pre-fills.
 */
export default function YouTubeFilmImport({ onApply, disabled = false }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [posterUrl, setPosterUrl] = useState('');
  const [backdropUrl, setBackdropUrl] = useState('');

  const reset = () => {
    setPreview(null);
    setPosterUrl('');
    setBackdropUrl('');
  };

  const handleFetch = async (e) => {
    e?.preventDefault?.();
    if (!url.trim()) {
      toast.error('Paste a YouTube link first');
      return;
    }

    setLoading(true);
    reset();
    try {
      const result = await fetchVideoDetailsForImport(url.trim());
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setPreview(result.data);
      setPosterUrl(result.data.defaults.posterUrl || '');
      setBackdropUrl(result.data.defaults.backdropUrl || '');
      toast.success('Pulled from YouTube — pick images, then apply');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!preview) return;

    onApply({
      title: preview.title,
      synopsis: preview.description,
      youtube_watch_url: preview.watchUrl,
      source_video_id: preview.videoId,
      release_type: 'youtube',
      status: 'released',
      poster_url: posterUrl || preview.defaults.posterUrl || '',
      backdrop_url: backdropUrl || preview.defaults.backdropUrl || '',
      runtime_minutes: preview.runtimeMinutes || '',
      year: preview.year || new Date().getFullYear(),
      release_date: preview.releaseDate || '',
    });

    toast.success('Fields filled — edit anything, then save the film');
  };

  return (
    <div className="rounded-xl border border-red-500/25 bg-red-500/[0.04] p-5 space-y-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-500">
          <Icon icon="mdi:youtube" width="20" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-text-primary tracking-tight">
            Import from YouTube
          </h4>
          <p className="mt-0.5 text-[11px] leading-relaxed text-text-muted">
            Paste a watch link. We pull the title, description, play URL, runtime and every
            thumbnail resolution YouTube actually serves — you choose poster and backdrop,
            then apply into the form below.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleFetch();
            }
          }}
          disabled={disabled || loading}
          placeholder="https://www.youtube.com/watch?v=… or youtu.be/…"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-text-primary outline-none transition-all placeholder:text-text-muted/60 focus:border-brand focus:ring-4 focus:ring-brand/5 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleFetch}
          disabled={disabled || loading || !url.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Fetching
            </>
          ) : (
            <>
              <Icon icon="solar:download-minimalistic-bold" width="16" />
              Fetch
            </>
          )}
        </button>
      </div>

      {preview && (
        <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                {preview.channelTitle}
                {preview.durationFormatted ? ` · ${preview.durationFormatted}` : ''}
                {preview.year ? ` · ${preview.year}` : ''}
              </p>
              <p className="mt-1 text-sm font-bold text-text-primary leading-snug">
                {preview.title}
              </p>
              {preview.description && (
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-text-muted whitespace-pre-wrap">
                  {preview.description}
                </p>
              )}
            </div>
            <a
              href={preview.watchUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-[11px] font-bold text-red-500 hover:underline"
            >
              Open on YouTube →
            </a>
          </div>

          {preview.thumbnails.length > 0 && (
            <div className="space-y-3 border-t border-border pt-4">
              <ThumbPicker
                label="Poster"
                value={posterUrl}
                options={preview.thumbnails}
                onChange={setPosterUrl}
              />
              <ThumbPicker
                label="Backdrop"
                value={backdropUrl}
                options={preview.thumbnails}
                onChange={setBackdropUrl}
                preferWide
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-all hover:brightness-110 active:scale-95"
            >
              <Icon icon="solar:check-circle-bold" width="16" />
              Apply to form
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-border px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-text-muted transition-all hover:border-border hover:text-text-primary"
            >
              Clear preview
            </button>
            <p className="ml-auto text-[10px] text-text-muted">
              Overwrites title, synopsis, play link, images and runtime if set.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ThumbPicker({ label, value, options, onChange, preferWide = false }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
          {label}
          {preferWide && (
            <span className="ml-1.5 font-semibold normal-case tracking-normal text-text-muted/70">
              — higher resolution preferred
            </span>
          )}
        </p>
        {value && (
          <span className="text-[10px] font-bold text-brand">
            {options.find((o) => o.url === value)?.label || 'Selected'}
          </span>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {options.map((opt) => {
          const selected = value === opt.url;
          return (
            <button
              key={`${label}-${opt.key}-${opt.url}`}
              type="button"
              onClick={() => onChange(opt.url)}
              className={`group relative shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                selected
                  ? 'border-brand ring-2 ring-brand/20'
                  : 'border-border hover:border-brand/40'
              }`}
              title={`${opt.label}${opt.width ? ` · ${opt.width}×${opt.height}` : ''}`}
            >
              <img
                src={opt.url}
                alt={opt.label}
                className="h-16 w-28 object-cover bg-surface-2"
                loading="lazy"
              />
              <span
                className={`absolute inset-x-0 bottom-0 px-1.5 py-0.5 text-[9px] font-bold ${
                  selected ? 'bg-brand text-white' : 'bg-black/60 text-white'
                }`}
              >
                {opt.label}
                {opt.width ? ` · ${opt.width}×${opt.height}` : ''}
              </span>
              {selected && (
                <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white shadow">
                  <Icon icon="solar:check-bold" width="12" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
