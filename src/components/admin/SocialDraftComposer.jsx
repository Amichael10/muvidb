import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { authHeaders } from '../../lib/apiAuth';

const CONTENT_TYPES = [
  {
    value: 'actor_spotlight',
    label: 'Actor Spotlight',
    templateSlug: 'actor-spotlight-v1',
    entity: 'person',
    placeholder: 'Search people by name…',
  },
  {
    value: 'upcoming_movie',
    label: 'Upcoming Movie',
    templateSlug: 'upcoming-movie-v1',
    entity: 'film',
    placeholder: 'Search films by title…',
  },
];

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', icon: 'mdi:instagram' },
  { value: 'facebook', label: 'Facebook', icon: 'mdi:facebook' },
  { value: 'threads', label: 'Threads', icon: 'simple-icons:threads' },
  { value: 'tiktok', label: 'TikTok', icon: 'simple-icons:tiktok' },
];

export default function SocialDraftComposer({ disabled, onGenerated }) {
  const [contentType, setContentType] = useState('actor_spotlight');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [platforms, setPlatforms] = useState(['instagram', 'threads']);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);

  const config = useMemo(() => CONTENT_TYPES.find(entry => entry.value === contentType), [contentType]);
  // Guards against an earlier, slower search overwriting a newer one.
  const searchToken = useRef(0);

  useEffect(() => {
    setSelected(null);
    setResults([]);
    setQuery('');
    setResult(null);
  }, [contentType]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2 || selected) {
      setResults([]);
      return undefined;
    }

    const token = ++searchToken.current;
    setSearching(true);

    const timer = setTimeout(async () => {
      try {
        const { data, error } =
          config.entity === 'person'
            ? await supabase.from('people').select('id,name,photo_url').ilike('name', `%${term}%`).limit(8)
            : await supabase.from('films').select('id,title,year,poster_url').ilike('title', `%${term}%`).limit(8);

        if (error) throw error;
        if (token !== searchToken.current) return;
        setResults(data || []);
      } catch (err) {
        if (token === searchToken.current) toast.error(err.message || 'Search failed');
      } finally {
        if (token === searchToken.current) setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, config, selected]);

  const togglePlatform = value => {
    setPlatforms(current =>
      current.includes(value) ? current.filter(entry => entry !== value) : [...current, value],
    );
  };

  const generate = async () => {
    if (!selected) return toast.error('Pick a source first');
    if (!platforms.length) return toast.error('Select at least one platform');

    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch('/api/social?task=generate_draft', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType,
          sourceEntityId: selected.id,
          templateSlug: config.templateSlug,
          platforms,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setResult(data);
      toast.success(`Draft created with ${data.variants?.length || 0} variant(s)`);
      onGenerated?.(data);
    } catch (err) {
      toast.error(err.message || 'Draft generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const label = entry => (config.entity === 'person' ? entry.name : `${entry.title}${entry.year ? ` (${entry.year})` : ''}`);

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <Icon icon="solar:magic-stick-3-linear" className="text-brand" width="20" />
        <h2 className="text-sm font-black uppercase tracking-widest text-text-primary">Generate Draft</h2>
      </div>

      {disabled && (
        <p className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-text-muted">
          Enable <span className="font-mono">SOCIAL_STUDIO_ENABLED</span> to generate drafts.
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Content Type</label>
          <div className="mt-2 flex gap-2">
            {CONTENT_TYPES.map(entry => (
              <button
                key={entry.value}
                type="button"
                onClick={() => setContentType(entry.value)}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                  contentType === entry.value
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-border bg-surface-2 text-text-muted hover:text-text-primary'
                }`}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Platforms</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {PLATFORMS.map(platform => (
              <button
                key={platform.value}
                type="button"
                onClick={() => togglePlatform(platform.value)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                  platforms.includes(platform.value)
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-border bg-surface-2 text-text-muted hover:text-text-primary'
                }`}
              >
                <Icon icon={platform.icon} width="14" />
                {platform.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Source</label>

        {selected ? (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-text-primary">{label(selected)}</p>
              <p className="truncate font-mono text-[10px] text-text-muted">{selected.id}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="shrink-0 rounded-md border border-border px-2 py-1 text-[10px] font-bold text-text-muted hover:text-text-primary"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="relative mt-2">
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={config.placeholder}
              className="h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-text-primary outline-none focus:border-brand"
            />
            {searching && (
              <Icon
                icon="solar:spinner-linear"
                className="absolute right-3 top-3 animate-spin text-text-muted"
                width="16"
              />
            )}
            {results.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
                {results.map(entry => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => {
                      setSelected(entry);
                      setResults([]);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
                  >
                    <img
                      src={entry.photo_url || entry.poster_url || ''}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded object-cover"
                      onError={event => {
                        event.currentTarget.style.visibility = 'hidden';
                      }}
                    />
                    <span className="truncate">{label(entry)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={generate}
        disabled={disabled || generating || !selected || !platforms.length}
        className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-xs font-bold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon
          icon={generating ? 'solar:spinner-linear' : 'solar:magic-stick-3-linear'}
          className={generating ? 'animate-spin' : ''}
          width="16"
        />
        Generate Draft
      </button>

      {result && (
        <div className="mt-5 space-y-3 border-t border-border pt-5">
          {result.assets?.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">
                Rendered Assets
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                {result.assets.map(asset => (
                  <a
                    key={asset.id}
                    href={asset.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group w-32 shrink-0"
                    title={`${asset.format} — ${asset.width}×${asset.height}`}
                  >
                    <img
                      src={asset.publicUrl}
                      alt={asset.format}
                      className="w-full rounded-md border border-border bg-surface-2 object-contain transition-opacity group-hover:opacity-80"
                    />
                    <p className="mt-1 truncate text-[10px] font-bold text-text-muted">
                      {asset.format} · {asset.width}×{asset.height}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {result.warnings?.length > 0 && (
            <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Review Warnings</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-text-muted">
                {result.warnings.map(warning => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {result.variants?.map(variant => (
            <div key={variant.id} className="rounded-lg border border-border bg-surface-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-brand">{variant.platform}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{variant.status}</span>
              </div>
              {variant.title && <p className="mt-2 text-sm font-bold text-text-primary">{variant.title}</p>}
              <p className="mt-1 whitespace-pre-wrap text-xs text-text-muted">{variant.caption}</p>
              {variant.hashtags?.length > 0 && (
                <p className="mt-2 text-xs font-bold text-brand">{variant.hashtags.map(tag => `#${tag}`).join(' ')}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
