import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { authHeaders } from '../../lib/apiAuth';
import { uploadAdminImage } from '../../lib/imageUpload';

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', icon: 'mdi:instagram', color: '#E1306C' },
  { value: 'threads', label: 'Threads', icon: 'simple-icons:threads', color: '#FFFFFF' },
  { value: 'facebook', label: 'Facebook', icon: 'mdi:facebook', color: '#1877F2' },
  { value: 'tiktok', label: 'TikTok', icon: 'simple-icons:tiktok', color: '#25F4EE' },
];

function buildPartyjollofHook(synopsis, tagline, title) {
  const parts = [];
  if (tagline && tagline.trim() && !tagline.toLowerCase().includes('untitled')) {
    parts.push(`✨ "${tagline.trim()}"`);
  }
  if (synopsis && synopsis.trim()) {
    let clean = synopsis.trim()
      .replace(new RegExp(`^${(title || '').replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*(\\([^)]*\\))?\\s*(is a [^.]+film that\\s*)?(follows|revolves around|tells the story of|centers on|chronicles)\\s+`, 'i'), '')
      .replace(/^(This movie|This film|The story)\s+(follows|revolves around|tells the story of|centers on|is about)\s+/i, '')
      .trim();

    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    const sentences = clean.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);

    if (sentences.length >= 2) {
      parts.push(sentences[0]);
      parts.push(sentences[1]);
    } else if (sentences.length === 1) {
      parts.push(sentences[0]);
    }
  }
  return parts;
}

function formatPlatformAnchor(data) {
  if (!data) return '';
  const links = data.streaming_links || {};
  const relDate = data.release_date
    ? new Date(data.release_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : '';

  if (data.release_type === 'prime_video' || links.prime_video || links.prime) {
    return relDate ? `Only on Prime Video ${relDate} 🍿` : `Streaming on Prime Video 🍿`;
  }
  if (data.release_type === 'netflix' || links.netflix) {
    return relDate ? `Only on Netflix ${relDate} 🍿` : `Streaming on Netflix 🍿`;
  }
  if (data.is_in_cinemas) {
    return relDate ? `In Cinemas Nationwide ${relDate} 🎟️` : `In Cinemas Nationwide 🎟️`;
  }
  if (data.release_type === 'youtube' || data.youtube_watch_url || links.youtube) {
    return `Watch Now on YouTube 📺`;
  }
  if (data.platformDisplayName) {
    return `Streaming on ${data.platformDisplayName} 📺`;
  }
  if (relDate) {
    return `Coming Soon • ${relDate} ⏳`;
  }
  return '';
}

function formatCastBlock(topCast = []) {
  if (!topCast || !topCast.length) return '';
  const lines = topCast.slice(0, 5).map(c => {
    if (c.handle) return c.handle;
    const clean = (c.name || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
    return `@${clean}`;
  });
  return `Starring:\n${lines.join('\n')}`;
}

function formatDirectorLine(directors = []) {
  if (!directors || !directors.length) return '';
  const d = directors[0];
  const tag = d.handle || `@${(d.name || '').toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
  return `Directed by ${tag}`;
}

function buildMovieCaption(candidate, series, platform) {
  const data = candidate.data || {};
  const title = candidate.name;
  const directorOrStar = data.directors?.[0]?.name ? `${data.directors[0].name}'s` : '';
  const headline = directorOrStar
    ? `New Poster for ${directorOrStar} "${title}" 🎬`
    : `New Poster for "${title}" 🎬`;

  const anchor = formatPlatformAnchor(data);
  const hookLines = buildPartyjollofHook(data.synopsis, data.tagline, title);
  const castBlock = formatCastBlock(data.topCast);
  const dirLine = formatDirectorLine(data.directors);
  const cta = 'Are you seated for this one? Drop a 🍿 if this is on your watchlist! 👇';

  const titleTag = title.replace(/[^a-zA-Z0-9]/g, '');
  const platformTag = (data.platform || data.release_type || '').replace(/[^a-zA-Z0-9]/g, '');
  const tags = ['#nollywoodmovies', '#muvidb', '#africanmovies'];
  if (platformTag) tags.push(`#${platformTag.toLowerCase()}`);
  if (titleTag) tags.push(`#${titleTag}`);

  if (platform === 'threads') {
    const threadSections = [headline, anchor, hookLines[0] || '', castBlock, tags.slice(0, 3).join(' ')].filter(Boolean);
    return threadSections.join('\n\n').slice(0, 480);
  }

  if (platform === 'tiktok') {
    return `${headline}\n${anchor}\n\n${hookLines[0] || ''}\n\n${tags.join(' ')}`;
  }

  const sections = [headline, anchor, ...hookLines, castBlock, dirLine, cta, tags.join(' ')].filter(Boolean);
  return sections.join('\n\n');
}

function buildActorCaption(candidate, series, platform) {
  const data = candidate.data || {};
  const name = candidate.name;
  const handle = data.handle || `@${name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
  const headline = `Actor Spotlight: ${name} (${handle}) 🌟`;
  const isRising = data.isRisingStar;

  const hook = isRising
    ? `From scene-stealing performances to incredible screen presence, ${handle} continues to prove why they are one of Nollywood's most exciting talents to watch.`
    : `Celebrating the range, talent, and unforgettable screen presence of ${name} across African cinema.`;

  const knownFor = (data.knownFor || [])
    .slice(0, 3)
    .map(k => `🎬 ${k.title}${k.year ? ` (${k.year})` : ''}${k.character ? ` — as ${k.character}` : ''}`)
    .join('\n');
  const creditBlock = knownFor ? `Known for:\n${knownFor}` : '';
  const bioLine = data.bio ? data.bio.slice(0, 160) + '…' : '';
  const cta = `What is your favorite ${name} performance of all time? Drop your top picks below! 👇`;
  const tags = `#nollywoodactors #muvidb #actorspotlight #nollywood #africanfilmmakers #${name.replace(/[^a-zA-Z0-9]/g, '')}`;

  if (platform === 'threads') {
    return [headline, hook, creditBlock, tags].filter(Boolean).join('\n\n').slice(0, 480);
  }

  const sections = [headline, hook, creditBlock, bioLine, cta, tags].filter(Boolean);
  return sections.join('\n\n');
}

function buildCriticCaption(candidate, series, platform) {
  const data = candidate.data || {};
  const title = candidate.name;
  const quote = data.criticReview?.quote || data.quote;
  const criticName = data.criticReview?.criticName || data.criticName || 'Top Nollywood Critics';
  const pub = data.criticReview?.publication || data.publication || 'Film Review';
  const rating = data.criticReview?.rating || (data.liked_percent ? `${(data.liked_percent / 10).toFixed(1)}/10` : '8.5/10');

  const headline = `What The Critics Say: "${title}" (${data.year || 'Feature'}) 🎬`;
  const quoteLine = quote ? `“${quote}”\n— ${criticName} (${pub})` : `⭐ Critic Score: ${rating} on MuviDB`;
  const anchor = formatPlatformAnchor(data);
  const hookLines = buildPartyjollofHook(data.synopsis, data.tagline, title);
  const castBlock = formatCastBlock(data.topCast);
  const cta = `Did the critics get this one right, or is it overrated? Drop your review below! 👇`;
  const tags = `#whatthecriticssay #muvidb #nollywoodreviews #filmcriticism #africanmovies #${title.replace(/[^a-zA-Z0-9]/g, '')}`;

  if (platform === 'threads') {
    return [headline, quoteLine, anchor, tags].filter(Boolean).join('\n\n').slice(0, 480);
  }

  const sections = [headline, quoteLine, anchor, ...hookLines, castBlock, cta, tags].filter(Boolean);
  return sections.join('\n\n');
}

function buildCrewCaption(candidate, series, platform) {
  const data = candidate.data || {};
  const name = candidate.name;
  const handle = data.handle || `@${name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
  const dept = data.department || 'Filmmaker';

  const headline = `Behind the Lens: ${name} (${handle}) 🎥\n${dept.toUpperCase()}`;
  const hook = `The creative visionary shaping the visuals, story, and craft behind some of African cinema's most acclaimed frames.`;
  const knownFor = (data.knownFor || []).slice(0, 3).map(k => `📽️ ${k.title}${k.year ? ` (${k.year})` : ''}`).join('\n');
  const creditBlock = knownFor ? `Key Filmography:\n${knownFor}` : '';
  const cta = `Celebrating the master storytellers behind the camera. Drop some love for ${handle} below! 👇`;
  const tags = `#behindthecamera #nollywoodcrew #${dept.replace(/[^a-zA-Z0-9]/g, '')} #muvidb #africanfilmmakers #${name.replace(/[^a-zA-Z0-9]/g, '')}`;

  if (platform === 'threads') {
    return [headline, hook, creditBlock, tags].filter(Boolean).join('\n\n').slice(0, 480);
  }

  const sections = [headline, hook, creditBlock, cta, tags].filter(Boolean);
  return sections.join('\n\n');
}

function generateDefaultCaptions(candidate, series) {
  if (!candidate) return {};
  const seriesSlug = series?.slug || '';
  const isPerson = candidate.type === 'person';
  const isCritic = seriesSlug.includes('critic') || candidate.category?.includes('Critic');
  const isCrew = seriesSlug.includes('behind') || candidate.data?.isCrew;

  const platforms = ['instagram', 'threads', 'facebook', 'tiktok'];
  const res = {};

  for (const p of platforms) {
    if (isCritic) {
      res[p] = buildCriticCaption(candidate, series, p);
    } else if (isCrew) {
      res[p] = buildCrewCaption(candidate, series, p);
    } else if (isPerson) {
      res[p] = buildActorCaption(candidate, series, p);
    } else {
      res[p] = buildMovieCaption(candidate, series, p);
    }
  }

  return res;
}

export default function AutoPilotReviewModal({
  isOpen,
  slot,
  onClose,
  onApproved,
  onOpenManualComposer,
}) {
  const [candidate, setCandidate] = useState(null);
  const [candidatePool, setCandidatePool] = useState([]);
  const [poolIndex, setPoolIndex] = useState(0);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState(['instagram', 'threads', 'facebook', 'tiktok']);
  const [activePlatformTab, setActivePlatformTab] = useState('instagram');
  const [captions, setCaptions] = useState({});
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('11:00');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (slot && isOpen) {
      const initialCandidate = slot.candidate || null;
      setCandidate(initialCandidate);
      setCustomImageUrl(initialCandidate?.imageUrl || '');
      setScheduledTime(slot.scheduled_time?.slice(0, 5) || '11:00');
      const defaults = generateDefaultCaptions(initialCandidate, slot.social_content_series);
      setCaptions(defaults);
      setIsEditingCaption(false);

      const slug = slot.social_content_series?.slug || 'filmography';
      setLoadingCandidates(true);
      fetch(`/api/social?task=slot_candidates&seriesSlug=${slug}`, {
        headers: { 'Content-Type': 'application/json' },
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length) {
            setCandidatePool(data);
            const foundIdx = data.findIndex(c => c.id === initialCandidate?.id);
            setPoolIndex(foundIdx >= 0 ? foundIdx : 0);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingCandidates(false));
    }
  }, [slot, isOpen]);

  if (!isOpen || !slot) return null;

  const series = slot.social_content_series || {};
  const dateObj = new Date(slot.scheduled_date);
  const formattedDate = dateObj.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const handleShuffleCandidate = () => {
    if (!candidatePool.length) {
      toast('No alternative candidates found for this series.');
      return;
    }
    const nextIdx = (poolIndex + 1) % candidatePool.length;
    setPoolIndex(nextIdx);
    const nextCandidate = candidatePool[nextIdx];
    setCandidate(nextCandidate);
    setCustomImageUrl(nextCandidate.imageUrl || '');
    setCaptions(generateDefaultCaptions(nextCandidate, series));
    toast.success(`Swapped to ${nextCandidate.name}!`);
  };

  const handleImageUpload = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const { publicUrl } = await uploadAdminImage(file, 'social');
      setCustomImageUrl(publicUrl);
      toast.success('Custom graphic artwork uploaded!');
    } catch (err) {
      toast.error(err.message || 'Image upload failed');
    } finally {
      setUploadingImage(false);
    }
  };

  const togglePlatform = p => {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const handleApproveAndSchedule = async () => {
    if (!candidate) {
      toast.error('Please select a subject or movie for this slot.');
      return;
    }
    if (!selectedPlatforms.length) {
      toast.error('Please select at least one publishing channel.');
      return;
    }

    setApproving(true);
    try {
      const res = await fetch('/api/social?task=approve_slot', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: slot.id,
          candidateId: candidate.id,
          candidateType: candidate.type || (series.slug === 'filmography' ? 'person' : 'movie'),
          scheduledDate: slot.scheduled_date,
          scheduledTime: `${scheduledTime}:00`,
          platforms: selectedPlatforms,
          customCaptions: captions,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      toast.success(`🚀 Approved & Scheduled for ${formattedDate} (${scheduledTime})!`);
      onApproved(data);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to approve and schedule slot');
    } finally {
      setApproving(false);
    }
  };

  const displayImage = customImageUrl || candidate?.imageUrl;
  const isPerson = candidate?.type === 'person';
  const data = candidate?.data || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-surface-2/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand uppercase tracking-wider">
                {series.name || 'Editorial Series'}
              </span>
              <span className="font-mono text-xs text-text-muted">
                {formattedDate}
              </span>
            </div>
            <h3 className="mt-1 text-lg font-black tracking-tight text-text-primary">
              Auto-Pilot Review & Instant Approval
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-muted hover:bg-surface hover:text-text-primary"
          >
            <Icon icon="solar:close-circle-linear" width="22" />
          </button>
        </div>

        {/* Candidate Selector Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-surface px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2">
              {displayImage ? (
                <img src={displayImage} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-text-muted">
                  <Icon icon="solar:user-linear" width="20" />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-text-primary text-sm">
                  {candidate?.name || 'Auto-Selected Candidate'}
                </span>
                <span className="rounded bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand uppercase">
                  {candidate?.category || (isPerson ? 'Actor' : 'Film')}
                </span>
              </div>
              <p className="text-xs text-text-muted line-clamp-1">
                {candidate?.subtext || 'Matched via Nollywood editorial guidelines'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShuffleCandidate}
              disabled={loadingCandidates}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-bold text-text-primary hover:border-brand hover:text-brand"
            >
              <Icon icon="solar:shuffle-linear" width="14" />
              Shuffle Candidate ({poolIndex + 1}/{Math.max(candidatePool.length, 1)})
            </button>
          </div>
        </div>

        {/* Content Body: 2 Columns */}
        <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 md:grid-cols-12">
          {/* Left: High-End Graphic Card Preview */}
          <div className="space-y-3 md:col-span-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-text-muted">
                Graphic Poster Preview (4:5)
              </span>
              <label className="cursor-pointer text-[11px] font-bold text-brand hover:underline">
                {uploadingImage ? 'Uploading…' : '🖼️ Replace Photo'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  className="hidden"
                />
              </label>
            </div>

            {/* Poster Card Shell */}
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl border border-white/10 bg-[#0B0C10] shadow-2xl flex flex-col justify-between p-5 select-none font-sans">
              {/* Cinematic Background Layer */}
              <div className="absolute inset-0 z-0">
                {displayImage ? (
                  <img
                    src={displayImage}
                    alt=""
                    className="h-full w-full object-cover opacity-50 filter contrast-125 brightness-75 scale-105"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-[#1A1C23] to-[#0A0B0E]" />
                )}
                {/* Vignette Gradients */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#090A0D] via-[#090A0D]/50 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-b from-[#090A0D]/80 via-transparent to-[#090A0D]" />
              </div>

              {/* Top Header Lockup */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#FF5A1F] text-white shadow-lg shadow-[#FF5A1F]/30">
                    <Icon icon="solar:film-strip-bold" width="14" />
                  </div>
                  <span className="font-extrabold text-sm tracking-tight text-white font-mono">
                    MuviDB
                  </span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-[#FF5A1F]/40 bg-black/70 px-2.5 py-0.5 backdrop-blur-md">
                  <span className="font-bold text-[9px] uppercase tracking-widest text-[#FF5A1F]">
                    {(series.name || 'Spotlight').toUpperCase()}
                  </span>
                  <span className="text-[9px] font-bold text-white/50">01</span>
                </div>
              </div>

              {/* Subject Content Presentation */}
              <div className="relative z-10 mt-auto space-y-2 pt-12">
                {/* Kicker tag */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#FF5A1F]">
                    {candidate?.category || (isPerson ? 'NOLLYWOOD TALENT' : 'FEATURE RELEASE')}
                  </span>
                  <span className="text-[10px] text-white/40">•</span>
                  <span className="text-[10px] font-bold text-white/70">
                    {data.year || (data.country || 'Nollywood')}
                  </span>
                </div>

                {/* Main Headline */}
                <h4 className="text-xl font-black uppercase tracking-tight text-white leading-tight drop-shadow-md line-clamp-2">
                  {candidate?.name || 'Nollywood Cinema'}
                </h4>

                {/* Subtitle / Department / Platform */}
                <p className="text-[11px] font-medium text-white/80 line-clamp-2 leading-snug">
                  {data.tagline || data.subtext || (data.bio ? data.bio.slice(0, 90) + '…' : 'Discover full credits on MuviDB')}
                </p>

                {/* Cast Chips */}
                {data.topCast && data.topCast.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 pt-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-white/60">Starring:</span>
                    {data.topCast.slice(0, 3).map((c, i) => (
                      <span
                        key={i}
                        className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-white/90 backdrop-blur-sm"
                      >
                        {c.handle || c.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer Watermark */}
                <div className="flex items-center justify-between border-t border-white/15 pt-2 text-[9px] font-mono text-white/60">
                  <span>muvidb.com</span>
                  <span className="uppercase tracking-widest text-[#FF5A1F]">EVERY FILM. EVERY CREDIT.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Channels & Multi-Platform Copy */}
          <div className="space-y-4 md:col-span-7 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Target Platforms Bar */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-text-muted mb-2">
                  Target Channels
                </label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map(p => {
                    const active = selectedPlatforms.includes(p.value);
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => togglePlatform(p.value)}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                          active
                            ? 'border-brand bg-brand/10 text-brand'
                            : 'border-border bg-surface-2 text-text-muted hover:text-text-primary'
                        }`}
                      >
                        <Icon icon={p.icon} width="14" style={{ color: active ? undefined : p.color }} />
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Copy Editor Tabs */}
              <div>
                <div className="flex items-center justify-between border-b border-border pb-1">
                  <div className="flex gap-2">
                    {PLATFORMS.filter(p => selectedPlatforms.includes(p.value)).map(p => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setActivePlatformTab(p.value)}
                        className={`border-b-2 px-2 py-1 text-xs font-bold transition-colors ${
                          activePlatformTab === p.value
                            ? 'border-brand text-brand'
                            : 'border-transparent text-text-muted hover:text-text-primary'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsEditingCaption(!isEditingCaption)}
                    className="text-xs font-bold text-brand hover:underline"
                  >
                    {isEditingCaption ? 'Done Editing' : '✏️ Edit Copy'}
                  </button>
                </div>

                <div className="mt-2 rounded-lg border border-border bg-surface-2 p-3">
                  {isEditingCaption ? (
                    <textarea
                      rows={8}
                      value={captions[activePlatformTab] || ''}
                      onChange={e =>
                        setCaptions(prev => ({
                          ...prev,
                          [activePlatformTab]: e.target.value,
                        }))
                      }
                      className="w-full bg-transparent text-xs text-text-primary outline-none focus:ring-0 font-sans leading-relaxed"
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-xs text-text-primary leading-relaxed max-h-52 overflow-y-auto font-sans">
                      {captions[activePlatformTab] || 'No copy generated for this channel.'}
                    </p>
                  )}
                </div>
              </div>

              {/* Scheduled Time */}
              <div className="flex items-center justify-between rounded-lg border border-border/80 bg-surface-2 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:clock-circle-linear" className="text-brand" width="18" />
                  <span className="text-xs font-bold text-text-primary">Publishing Schedule:</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted font-mono">{slot.scheduled_date} at</span>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={e => setScheduledTime(e.target.value)}
                    className="rounded border border-border bg-surface px-2 py-1 text-xs font-mono text-text-primary outline-none focus:border-brand"
                  />
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenManualComposer) {
                    onOpenManualComposer({
                      slotId: slot.id,
                      scheduledDate: slot.scheduled_date,
                      dayName: formattedDate,
                      seriesSlug: series.slug,
                    });
                  }
                }}
                className="text-xs font-bold text-text-muted hover:text-text-primary"
              >
                Open in Full Custom Composer →
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-bold text-text-muted hover:bg-surface-2 hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApproveAndSchedule}
                  disabled={approving}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2 text-xs font-black text-white transition-all hover:bg-brand-hover hover:shadow-lg hover:shadow-brand/20 disabled:opacity-50"
                >
                  <Icon
                    icon={approving ? 'solar:spinner-linear' : 'solar:rocket-bold'}
                    className={approving ? 'animate-spin' : ''}
                    width="16"
                  />
                  {approving ? 'Scheduling Post…' : '🚀 1-Click Approve & Schedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
