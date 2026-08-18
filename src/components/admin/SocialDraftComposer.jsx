import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { authHeaders } from '../../lib/apiAuth';
import { uploadAdminImage } from '../../lib/imageUpload';

export const EDITORIAL_THEMES = [
  {
    id: 'actor_spotlight',
    seriesSlug: 'filmography',
    name: 'Actor Spotlight & Filmography',
    category: 'Talent & Stars',
    badge: 'Monday Theme',
    icon: 'solar:user-star-linear',
    entity: 'person',
    description: 'Career highlights, standout filmography, direct social handles, and favorite role questions.',
    placeholder: 'Search actor by name (e.g. Odunlade Adekola, Bimbo Ademoye, Lateef Adedimeji)…',
    templateSlug: 'actor-spotlight-v1',
    contentType: 'actor_spotlight',
    suggestions: ['Odunlade Adekola', 'Bimbo Ademoye', 'Lateef Adedimeji', 'Funke Akindele', 'Kunle Remi', 'Ibrahim Chatta'],
  },
  {
    id: 'critics_say',
    seriesSlug: 'critics_say',
    name: 'What The Critics Say',
    category: 'Reviews & Ratings',
    badge: 'Tuesday Theme',
    icon: 'solar:chat-round-line-linear',
    entity: 'film',
    description: 'Critical consensus, top reviewer takes, star ratings, and "Do you agree?" debate prompts.',
    placeholder: 'Search reviewed movie (e.g. Jagun Jagun, Lisabi, Breaded Life, Breath of Life)…',
    templateSlug: 'upcoming-movie-v1',
    contentType: 'upcoming_movie',
    suggestions: ['Jagun Jagun', 'Lisabi', 'Breaded Life', 'Breath of Life', 'Afamefuna'],
  },
  {
    id: 'where_to_watch',
    seriesSlug: 'where_to_watch',
    name: 'Where To Watch (Streaming Spotlight)',
    category: 'Streaming & VOD',
    badge: 'Wednesday Theme',
    icon: 'solar:tv-linear',
    entity: 'film',
    description: 'Streaming platform callout (Netflix, Prime Video, YouTube, Showmax) with cast tags & watchlist CTAs.',
    placeholder: 'Search streaming film (e.g. A Tribe Called Judah, Anikulapo, The Black Book)…',
    templateSlug: 'upcoming-movie-v1',
    contentType: 'upcoming_movie',
    suggestions: ['A Tribe Called Judah', 'Anikulapo', 'The Black Book', 'House of Ga\'a', 'Momiwa'],
  },
  {
    id: 'behind_the_camera',
    seriesSlug: 'behind_the_camera',
    name: 'Behind The Camera (Crew & Directors)',
    category: 'Filmmaking & Craft',
    badge: 'Thursday Theme',
    icon: 'solar:clapperboard-edit-linear',
    entity: 'person',
    description: 'Highlight visionary directors, producers, cinematographers, writers, and their notable projects.',
    placeholder: 'Search director or crew (e.g. Kunle Afolayan, Kemi Adetiba, CJ Obasi, Jade Osiberu)…',
    templateSlug: 'actor-spotlight-v1',
    contentType: 'actor_spotlight',
    suggestions: ['Kunle Afolayan', 'Kemi Adetiba', 'Jade Osiberu', 'CJ Obasi', 'Toka McBaror'],
  },
  {
    id: 'weekend_watchlist',
    seriesSlug: 'weekend_watchlist',
    name: 'Weekend Watchlist & Cinema Releases',
    category: 'Cinemas & Watchlist',
    badge: 'Friday Theme',
    icon: 'solar:film-strip-linear',
    entity: 'film',
    description: 'In-cinema showtimes, upcoming theatrical runs, poster reveals, and "Are you seated?" hype copy.',
    placeholder: 'Search cinema movie (e.g. Alahun, Everybody Loves Jenifa, Farmer\'s Bride)…',
    templateSlug: 'upcoming-movie-v1',
    contentType: 'upcoming_movie',
    suggestions: ['Alahun', 'Everybody Loves Jenifa', 'Farmer\'s Bride', 'Ajosepo'],
  },
  {
    id: 'whats_on_stage',
    seriesSlug: 'whats_on_stage',
    name: "What's On Stage & Theatre",
    category: 'Live Theatre & Plays',
    badge: 'Saturday Theme',
    icon: 'solar:masks-linear',
    entity: 'person',
    description: 'Live theatre productions, stage performers, venue callouts, and play appreciation.',
    placeholder: 'Search stage performer or theatre actor (e.g. Joke Silva, Taiwo Ajai-Lycett, Femi Adebayo)…',
    templateSlug: 'actor-spotlight-v1',
    contentType: 'actor_spotlight',
    suggestions: ['Joke Silva', 'Taiwo Ajai-Lycett', 'Femi Adebayo', 'Bimbo Manuel'],
  },
  {
    id: 'film_conversation',
    seriesSlug: 'film_conversation',
    name: 'Nollywood Debate & Conversation',
    category: 'Community & Debates',
    badge: 'Sunday Theme',
    icon: 'solar:dialog-linear',
    entity: 'film',
    description: 'Engaging Nollywood film discussion questions, character debates, and comment provocations.',
    placeholder: 'Search film for debate (e.g. The Wedding Party, King of Boys, Battle on Buka Street)…',
    templateSlug: 'upcoming-movie-v1',
    contentType: 'upcoming_movie',
    suggestions: ['King of Boys', 'The Wedding Party', 'Battle on Buka Street', 'Blood Sisters'],
  },
  {
    id: 'birthday_spotlight',
    seriesSlug: 'birthday_spotlight',
    name: 'Birthday Spotlight',
    category: 'Celebrations',
    badge: 'Special Feature',
    icon: 'solar:cake-linear',
    entity: 'person',
    description: 'Birthday wishes, star career homage, and fan congratulation prompts.',
    placeholder: 'Search celebrity celebrant by name…',
    templateSlug: 'birthday-spotlight-v1',
    contentType: 'birthday_spotlight',
    suggestions: ['Richard Mofe-Damijo', 'Genevieve Nnaji', 'Mercy Johnson', 'Ramsey Nouah'],
  },
];

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', icon: 'mdi:instagram' },
  { value: 'threads', label: 'Threads', icon: 'simple-icons:threads' },
  { value: 'facebook', label: 'Facebook', icon: 'mdi:facebook' },
  { value: 'tiktok', label: 'TikTok', icon: 'simple-icons:tiktok' },
];

export default function SocialDraftComposer({
  disabled,
  onGenerated,
  selectedThemeId = 'actor_spotlight',
  slotContext = null,
  onClearSlot = null,
}) {
  const [themeId, setThemeId] = useState(selectedThemeId);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [platforms, setPlatforms] = useState(['instagram', 'threads']);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [uploadingCustom, setUploadingCustom] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [customScheduleDate, setCustomScheduleDate] = useState('');
  const fileInputRef = useRef(null);
  const searchToken = useRef(0);

  // Sync external theme changes (such as clicking from the 30-Day calendar)
  useEffect(() => {
    if (selectedThemeId) {
      setThemeId(selectedThemeId);
    }
  }, [selectedThemeId]);

  useEffect(() => {
    if (slotContext?.scheduledDate) {
      setCustomScheduleDate(`${slotContext.scheduledDate}T18:00`);
    }
  }, [slotContext]);

  const activeTheme = useMemo(() => EDITORIAL_THEMES.find(t => t.id === themeId) || EDITORIAL_THEMES[0], [themeId]);

  useEffect(() => {
    setSelected(null);
    setResults([]);
    setQuery('');
    setResult(null);
  }, [themeId]);

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
          activeTheme.entity === 'person'
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
  }, [query, activeTheme, selected]);

  const togglePlatform = value => {
    setPlatforms(current =>
      current.includes(value) ? current.filter(entry => entry !== value) : [...current, value],
    );
  };

  const handleSuggestionClick = (name) => {
    setQuery(name);
  };

  const generate = async () => {
    if (!selected) return toast.error('Please pick a subject first');
    if (!platforms.length) return toast.error('Select at least one platform');

    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch('/api/social?task=generate_draft', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: activeTheme.contentType,
          sourceEntityId: selected.id,
          templateSlug: activeTheme.templateSlug,
          platforms,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setResult(data);
      toast.success(`Draft generated with ${data.variants?.length || 0} variant(s)!`);
      onGenerated?.(data);
    } catch (err) {
      toast.error(err.message || 'Draft generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleCustomImageUpload = async event => {
    const file = event.target.files?.[0];
    if (!file || !result?.contentItem?.id) return;
    setUploadingCustom(true);
    try {
      const uploadRes = await uploadAdminImage(file, 'film-images');
      if (uploadRes.error) throw new Error(uploadRes.error);
      const url = uploadRes.url;

      const res = await fetch('/api/social?task=attach_custom_asset', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentItemId: result.contentItem.id,
          publicUrl: url,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      toast.success('Custom artwork uploaded and attached to this draft!');
      setResult(curr => ({
        ...curr,
        assets: [
          { id: data.id, publicUrl: url, format: 'custom_design', width: data.width || 1080, height: data.height || 1080 },
          ...(curr?.assets || []),
        ],
      }));
      onGenerated?.(result);
    } catch (err) {
      toast.error(err.message || 'Failed to upload custom design');
    } finally {
      setUploadingCustom(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSchedule = async (preset, customValue) => {
    if (!result?.contentItem?.id) return;
    let targetDate = new Date();
    if (preset === 'today_6pm') {
      targetDate.setHours(18, 0, 0, 0);
      if (targetDate.getTime() < Date.now()) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
    } else if (preset === 'tomorrow_10am') {
      targetDate.setDate(targetDate.getDate() + 1);
      targetDate.setHours(10, 0, 0, 0);
    } else if (preset === 'tomorrow_6pm') {
      targetDate.setDate(targetDate.getDate() + 1);
      targetDate.setHours(18, 0, 0, 0);
    } else if (preset === 'custom' || preset === 'slot') {
      if (!customValue) return toast.error('Pick a date and time first');
      targetDate = new Date(customValue);
    }

    setScheduling(true);
    try {
      const res = await fetch('/api/social?task=schedule', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentItemId: result.contentItem.id,
          scheduledFor: targetDate.toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      toast.success(`Post scheduled for ${targetDate.toLocaleString()}!`);
      onGenerated?.(result);
    } catch (err) {
      toast.error(err.message || 'Scheduling failed');
    } finally {
      setScheduling(false);
    }
  };

  const label = entry => (activeTheme.entity === 'person' ? entry.name : `${entry.title}${entry.year ? ` (${entry.year})` : ''}`);

  return (
    <div className="space-y-6">
      {/* Active 30-Day Plan Slot Banner */}
      {slotContext && (
        <div className="flex items-center justify-between rounded-lg border border-brand/40 bg-brand/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
              <Icon icon="solar:calendar-date-bold" width="22" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-brand px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                  30-Day Plan Slot
                </span>
                <span className="text-xs font-mono font-bold text-text-primary">
                  {slotContext.scheduledDate} ({slotContext.dayName})
                </span>
              </div>
              <p className="mt-0.5 text-xs text-text-muted">
                Generating post for <span className="font-bold text-text-primary">{slotContext.seriesName}</span>
              </p>
            </div>
          </div>
          {onClearSlot && (
            <button
              type="button"
              onClick={onClearSlot}
              className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-bold text-text-muted hover:text-text-primary"
            >
              Clear Slot Mode
            </button>
          )}
        </div>
      )}

      {/* Main Composer Box */}
      <div className="rounded-lg border border-border bg-surface p-6">
        {/* Step 1: Select Content Theme */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 text-xs font-black text-brand">
                1
              </span>
              <h2 className="text-sm font-black uppercase tracking-widest text-text-primary">
                Select Content Theme
              </h2>
            </div>
            <span className="text-xs text-text-muted">7-Day Rolling Strategy</span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {EDITORIAL_THEMES.map(t => {
              const isSelected = themeId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setThemeId(t.id)}
                  className={`flex flex-col justify-between rounded-lg border p-4 text-left transition-all ${
                    isSelected
                      ? 'border-brand bg-brand/10 shadow-sm ring-1 ring-brand'
                      : 'border-border bg-surface-2 hover:border-brand/40 hover:bg-surface-2/80'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isSelected ? 'bg-brand text-white' : 'bg-surface text-brand'}`}>
                        <Icon icon={t.icon} width="18" />
                      </div>
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${isSelected ? 'bg-brand text-white' : 'bg-surface text-text-muted'}`}>
                        {t.badge}
                      </span>
                    </div>

                    <h3 className="mt-3 text-xs font-black text-text-primary">
                      {t.name}
                    </h3>
                    <p className="mt-1 text-[10px] text-text-muted line-clamp-2">
                      {t.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Choose Entity / Subject */}
        <div className="mt-6 border-t border-border pt-6">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 text-xs font-black text-brand">
              2
            </span>
            <h2 className="text-sm font-black uppercase tracking-widest text-text-primary">
              Choose Subject ({activeTheme.entity === 'person' ? 'Actor / Talent' : 'Movie / Film'})
            </h2>
          </div>

          {selected ? (
            <div className="mt-3 flex items-center justify-between gap-4 rounded-lg border border-brand/40 bg-brand/5 p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-2 border border-border overflow-hidden">
                  <Icon icon={activeTheme.entity === 'person' ? 'solar:user-linear' : 'solar:clapperboard-linear'} className="text-text-muted" width="22" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-text-primary">{label(selected)}</h4>
                  <p className="font-mono text-[10px] text-text-muted">{selected.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-bold text-text-muted hover:text-text-primary"
              >
                Change Subject
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <div className="relative">
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={activeTheme.placeholder}
                  className="h-11 w-full rounded-lg border border-border bg-surface-2 pl-4 pr-10 text-sm text-text-primary outline-none focus:border-brand"
                />
                {searching && (
                  <Icon
                    icon="solar:spinner-linear"
                    className="absolute right-3.5 top-3.5 animate-spin text-text-muted"
                    width="18"
                  />
                )}
                {results.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-xl">
                    {results.map(entry => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => {
                          setSelected(entry);
                          setResults([]);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-text-primary hover:bg-surface-2 border-b border-border/50 last:border-0"
                      >
                        <img
                          src={entry.photo_url || entry.poster_url || ''}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded object-cover border border-border bg-surface-2"
                          onError={e => {
                            e.currentTarget.style.visibility = 'hidden';
                          }}
                        />
                        <div className="min-w-0">
                          <span className="font-bold truncate block">{label(entry)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Suggestion Pills */}
              {activeTheme.suggestions?.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                    Quick Suggestions:
                  </span>
                  {activeTheme.suggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSuggestionClick(s)}
                      className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-[11px] font-bold text-text-muted hover:border-brand hover:text-brand transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 3: Platform Selection */}
        <div className="mt-6 border-t border-border pt-6">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 text-xs font-black text-brand">
              3
            </span>
            <h2 className="text-sm font-black uppercase tracking-widest text-text-primary">
              Target Publishing Platforms
            </h2>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {PLATFORMS.map(platform => (
              <button
                key={platform.value}
                type="button"
                onClick={() => togglePlatform(platform.value)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-bold transition-all ${
                  platforms.includes(platform.value)
                    ? 'border-brand bg-brand/10 text-brand ring-1 ring-brand'
                    : 'border-border bg-surface-2 text-text-muted hover:text-text-primary'
                }`}
              >
                <Icon icon={platform.icon} width="16" />
                {platform.label}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Action Button */}
        <div className="mt-6 border-t border-border pt-6">
          <button
            type="button"
            onClick={generate}
            disabled={disabled || generating || !selected || !platforms.length}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-6 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon
              icon={generating ? 'solar:spinner-linear' : 'solar:magic-stick-3-linear'}
              className={generating ? 'animate-spin' : ''}
              width="18"
            />
            {generating ? 'Generating High-Impact Copy & Assets…' : 'Generate Social Draft'}
          </button>
        </div>

        {/* GENERATED DRAFT WORKSPACE */}
        {result && (
          <div className="mt-8 rounded-lg border border-brand/30 bg-surface-2 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon icon="solar:check-circle-bold" className="text-emerald-400" width="20" />
                <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">
                  Draft Created: {result.contentItem?.title}
                </h3>
              </div>
              <span className="rounded bg-brand/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand">
                Ready For Review & Scheduling
              </span>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left Column: Visual Artwork & Custom Replacement */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">
                    Post Visual & Artwork
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    ref={fileInputRef}
                    onChange={handleCustomImageUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingCustom}
                    className="inline-flex items-center gap-1.5 rounded-md bg-brand px-2.5 py-1 text-xs font-bold text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
                  >
                    <Icon
                      icon={uploadingCustom ? 'solar:spinner-linear' : 'solar:upload-track-2-linear'}
                      className={uploadingCustom ? 'animate-spin' : ''}
                      width="14"
                    />
                    {uploadingCustom ? 'Uploading…' : 'Upload Custom Artwork'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-3">
                  {result.assets?.map(asset => (
                    <div
                      key={asset.id}
                      className="group relative w-full overflow-hidden rounded-lg border border-border bg-surface"
                    >
                      <a href={asset.publicUrl} target="_blank" rel="noreferrer" className="block">
                        <img
                          src={asset.publicUrl}
                          alt={asset.format}
                          className="h-56 w-full object-cover transition-opacity group-hover:opacity-90"
                        />
                      </a>
                      <div className="p-2.5 flex items-center justify-between bg-surface">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                            asset.format === 'custom_design'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-surface-2 text-text-muted'
                          }`}
                        >
                          {asset.format === 'custom_design' ? 'Custom Artwork' : asset.format}
                        </span>
                        <span className="text-[10px] font-mono text-text-muted">
                          {asset.width}×{asset.height}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Platform Variants & Viral Copy */}
              <div className="lg:col-span-7 space-y-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">
                  Platform Captions & Tagged Stars
                </span>

                <div className="space-y-3">
                  {result.variants?.map(variant => (
                    <div key={variant.id} className="rounded-lg border border-border bg-surface p-4">
                      <div className="flex items-center justify-between border-b border-border pb-2">
                        <div className="flex items-center gap-1.5">
                          <Icon icon={`simple-icons:${variant.platform}`} className="text-brand" width="14" />
                          <span className="text-xs font-black uppercase tracking-wider text-text-primary">
                            {variant.platform}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const full = `${variant.caption}\n\n${(variant.hashtags || []).map(t => `#${t}`).join(' ')}`;
                            navigator.clipboard.writeText(full);
                            toast.success('Copied caption to clipboard!');
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-text-muted hover:text-brand"
                        >
                          <Icon icon="solar:copy-linear" width="13" /> Copy Text
                        </button>
                      </div>

                      <p className="mt-3 whitespace-pre-wrap font-sans text-xs text-text-primary leading-relaxed">
                        {variant.caption}
                      </p>

                      {variant.hashtags?.length > 0 && (
                        <p className="mt-3 text-xs font-bold text-brand">
                          {variant.hashtags.map(tag => `#${tag}`).join(' ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Scheduling Controls */}
            <div className="mt-6 rounded-lg border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:calendar-mark-linear" className="text-brand" width="18" />
                  <h4 className="text-xs font-black uppercase tracking-widest text-text-primary">
                    1-Click Auto-Schedule
                  </h4>
                </div>
                {slotContext && (
                  <span className="text-xs font-bold text-emerald-400">
                    Target Date: {slotContext.scheduledDate}
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {slotContext?.scheduledDate && (
                  <button
                    type="button"
                    onClick={() => handleSchedule('slot', `${slotContext.scheduledDate}T18:00`)}
                    disabled={scheduling}
                    className="rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    📅 Schedule for Slot Date ({slotContext.scheduledDate})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSchedule('today_6pm')}
                  disabled={scheduling}
                  className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-bold text-text-primary hover:border-brand hover:text-brand disabled:opacity-50"
                >
                  🕒 Today 6:00 PM
                </button>
                <button
                  type="button"
                  onClick={() => handleSchedule('tomorrow_10am')}
                  disabled={scheduling}
                  className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-bold text-text-primary hover:border-brand hover:text-brand disabled:opacity-50"
                >
                  🕒 Tomorrow 10:00 AM
                </button>
                <button
                  type="button"
                  onClick={() => handleSchedule('tomorrow_6pm')}
                  disabled={scheduling}
                  className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-bold text-text-primary hover:border-brand hover:text-brand disabled:opacity-50"
                >
                  🕒 Tomorrow 6:00 PM
                </button>

                <div className="flex items-center gap-2 ml-auto">
                  <input
                    type="datetime-local"
                    value={customScheduleDate}
                    onChange={e => setCustomScheduleDate(e.target.value)}
                    className="h-8 rounded-md border border-border bg-surface-2 px-2 text-xs text-text-primary outline-none focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={() => handleSchedule('custom', customScheduleDate)}
                    disabled={scheduling || !customScheduleDate}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-bold text-white hover:bg-brand-hover disabled:opacity-50"
                  >
                    <Icon icon={scheduling ? 'solar:spinner-linear' : 'solar:calendar-add-linear'} className={scheduling ? 'animate-spin' : ''} width="14" />
                    Schedule Date
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
