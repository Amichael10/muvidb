import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { authHeaders } from '../../lib/apiAuth';
import { uploadAdminImage } from '../../lib/imageUpload';

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', icon: 'mdi:instagram', color: '#E1306C', maxLen: 2200 },
  { value: 'threads', label: 'Threads', icon: 'simple-icons:threads', color: '#FFFFFF', maxLen: 500 },
  { value: 'facebook', label: 'Facebook', icon: 'mdi:facebook', color: '#1877F2', maxLen: 2000 },
  { value: 'tiktok', label: 'TikTok', icon: 'simple-icons:tiktok', color: '#25F4EE', maxLen: 2200 },
];

const TONES = [
  { value: 'default', label: '⚡ Dynamic Story', icon: 'solar:bolt-bold' },
  { value: 'dramatic', label: '🔥 High Drama', icon: 'solar:flame-bold' },
  { value: 'debate', label: '🎬 Critic Debate', icon: 'solar:dialog-bold' },
  { value: 'streaming', label: '🍿 Streaming Alert', icon: 'solar:tv-bold' },
  { value: 'funny', label: '😂 Fun & Relatable', icon: 'solar:emoji-funny-circle-bold' },
];

/**
 * Fast local fallback caption generator
 */
function generateFallbackCaptions(candidate, series) {
  if (!candidate) return {};
  const name = candidate.name || 'Nollywood Spotlight';
  const data = candidate.data || {};
  const isPerson = candidate.type === 'person';
  const isCritic = series?.slug?.includes('critic');

  const castList = (data.topCast || []).slice(0, 4).map(c => c.handle || `@${(c.name || '').toLowerCase().replace(/[^a-z0-9_]/g, '_')}`);
  const castStr = castList.length ? `\n\nStarring:\n${castList.join('\n')}` : '';

  if (isPerson) {
    return {
      instagram: `Actor Spotlight: ${name} 🌟\n\nFrom standout performances to incredible screen presence, celebrating exceptional talent in African cinema.${castStr}\n\nWhat is your favorite ${name} performance of all time? Drop your picks below! 👇\n\n#Nollywood #MuviDB #ActorSpotlight #${name.replace(/[^a-zA-Z0-9]/g, '')}`,
      threads: `Spotlight on ${name}! ✨ What is your favorite performance of theirs? Drop your thoughts below! #Nollywood #MuviDB`,
      facebook: `🌟 Spotlight on ${name}\n\nCelebrating the range and unforgettable screen presence across Nigerian cinema. Discover full filmography on MuviDB!`,
      tiktok: `Spotlight on ${name}! 🌟 What's your favorite movie? #Nollywood #MuviDB`,
    };
  }

  const hook = data.synopsis ? data.synopsis.slice(0, 160) + '…' : candidate.subtext || 'Discover exceptional African cinema stories.';
  return {
    instagram: `${name} (${data.year || 'Feature'}) 🎬\n\n${hook}${castStr}\n\nAre you seated for this one? Drop a 🍿 if this is on your watchlist! 👇\n\n#Nollywood #MuviDB #AfricanCinema #${name.replace(/[^a-zA-Z0-9]/g, '')}`,
    threads: `${name}: ${hook.slice(0, 200)}\n\nHave you watched this yet? Join the discussion on MuviDB! 👇 #Nollywood`,
    facebook: `🎬 Feature Spotlight: ${name} (${data.year || 'Feature'})\n\n${hook}\n\nExplore full cast, crew, and verified reviews on MuviDB!`,
    tiktok: `Watch this! ${name} 🎬 Discover full cast on MuviDB! #Nollywood #AfricanCinema`,
  };
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

  // AI Copywriting State
  const [aiGenerating, setAiGenerating] = useState(false);
  const [selectedTone, setSelectedTone] = useState('default');
  const [aiEngine, setAiEngine] = useState('');

  const requestAICopy = async (cand, tone = selectedTone) => {
    if (!cand || !cand.name) return;
    setAiGenerating(true);
    try {
      const res = await fetch('/api/social?task=ai_generate_copy', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate: cand,
          series: slot.social_content_series,
          tone,
          preferredProvider: 'cohere',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setCaptions({
          instagram: data.instagram || '',
          threads: data.threads || '',
          facebook: data.facebook || '',
          tiktok: data.tiktok || '',
        });
        setAiEngine(data.engine || 'cohere');
        toast.success(`✨ Fresh copy generated with Cohere AI!`);
      } else {
        console.warn('AI Copy failed:', data.error);
      }
    } catch (err) {
      console.warn('AI Copy request error:', err);
    } finally {
      setAiGenerating(false);
    }
  };

  useEffect(() => {
    if (slot && isOpen) {
      const initialCandidate = slot.candidate || null;
      setCandidate(initialCandidate);
      setCustomImageUrl(initialCandidate?.imageUrl || '');
      setScheduledTime(slot.scheduled_time?.slice(0, 5) || '11:00');
      
      // Set instant fallback copy first
      const defaults = generateFallbackCaptions(initialCandidate, slot.social_content_series);
      setCaptions(defaults);
      setIsEditingCaption(false);
      setSelectedTone('default');

      // Request intelligent AI copy from Cohere immediately
      if (initialCandidate) {
        requestAICopy(initialCandidate, 'default');
      }

      // Load candidate pool for 1-click shuffle
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
    setCaptions(generateFallbackCaptions(nextCandidate, series));
    toast.success(`Swapped to ${nextCandidate.name}!`);
    // Automatically generate AI copy for the new candidate
    requestAICopy(nextCandidate, selectedTone);
  };

  const handleToneChange = (newTone) => {
    setSelectedTone(newTone);
    requestAICopy(candidate, newTone);
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
  const currentCaption = captions[activePlatformTab] || '';
  const currentPlatformLimit = PLATFORMS.find(p => p.value === activePlatformTab)?.maxLen || 2200;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <div className="relative flex max-h-[94vh] w-full max-w-4xl flex-col rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden">
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
              disabled={loadingCandidates || aiGenerating}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-bold text-text-primary hover:border-brand hover:text-brand transition-all disabled:opacity-50"
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

          {/* Right: AI Copywriting & Multi-Platform Channels */}
          <div className="space-y-4 md:col-span-7 flex flex-col justify-between">
            <div className="space-y-3">
              {/* Target Platforms Bar */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-text-muted mb-1.5">
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

              {/* AI Copywriting Toolbar */}
              <div className="rounded-xl border border-brand/20 bg-brand/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white text-[10px]">
                      ✨
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider text-text-primary">
                      AI Copywriter (Cohere)
                    </span>
                    {aiEngine && (
                      <span className="rounded bg-surface px-1.5 py-0.5 text-[9px] font-mono text-text-muted">
                        {aiEngine}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => requestAICopy(candidate, selectedTone)}
                    disabled={aiGenerating}
                    className="inline-flex items-center gap-1.5 rounded-md bg-brand px-2.5 py-1 text-[11px] font-black text-white hover:bg-brand-hover transition-all disabled:opacity-50"
                  >
                    <Icon
                      icon={aiGenerating ? 'solar:spinner-linear' : 'solar:magic-stick-bold'}
                      className={aiGenerating ? 'animate-spin' : ''}
                      width="13"
                    />
                    {aiGenerating ? 'Writing Copy…' : 'Regenerate Copy'}
                  </button>
                </div>

                {/* Tone Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-bold text-text-muted">Angle:</span>
                  {TONES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => handleToneChange(t.value)}
                      disabled={aiGenerating}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition-all ${
                        selectedTone === t.value
                          ? 'bg-brand text-white shadow-sm'
                          : 'bg-surface border border-border text-text-muted hover:text-text-primary'
                      }`}
                    >
                      <Icon icon={t.icon} width="11" />
                      {t.label}
                    </button>
                  ))}
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

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-text-muted">
                      {currentCaption.length}/{currentPlatformLimit}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingCaption(!isEditingCaption)}
                      className="text-xs font-bold text-brand hover:underline"
                    >
                      {isEditingCaption ? 'Done Editing' : '✏️ Edit Copy'}
                    </button>
                  </div>
                </div>

                <div className="mt-2 rounded-lg border border-border bg-surface-2 p-3 relative min-h-[140px]">
                  {aiGenerating && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-surface/90 backdrop-blur-sm space-y-2">
                      <Icon icon="solar:magic-stick-bold" className="animate-bounce text-brand" width="24" />
                      <span className="text-xs font-bold text-text-primary">
                        Writing smart copy with Cohere AI…
                      </span>
                    </div>
                  )}

                  {isEditingCaption ? (
                    <textarea
                      rows={7}
                      value={currentCaption}
                      onChange={e =>
                        setCaptions(prev => ({
                          ...prev,
                          [activePlatformTab]: e.target.value,
                        }))
                      }
                      className="w-full bg-transparent text-xs text-text-primary outline-none focus:ring-0 font-sans leading-relaxed resize-none"
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-xs text-text-primary leading-relaxed max-h-48 overflow-y-auto font-sans">
                      {currentCaption || 'No copy generated for this channel.'}
                    </p>
                  )}
                </div>
              </div>

              {/* Scheduled Time */}
              <div className="flex items-center justify-between rounded-lg border border-border/80 bg-surface-2 px-4 py-2">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:clock-circle-linear" className="text-brand" width="16" />
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
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
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
                  disabled={approving || aiGenerating}
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
