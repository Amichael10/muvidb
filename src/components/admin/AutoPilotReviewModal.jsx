import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { authHeaders } from '../../lib/apiAuth';
import { uploadAdminImage } from '../../lib/imageUpload';
import FigmaSocialCardPreview from './FigmaSocialCardPreview.jsx';

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', icon: 'mdi:instagram', color: '#E1306C', maxLen: 2200 },
  { value: 'threads', label: 'Threads', icon: 'simple-icons:threads', color: '#FFFFFF', maxLen: 500 },
  { value: 'facebook', label: 'Facebook', icon: 'mdi:facebook', color: '#1877F2', maxLen: 2000 },
  { value: 'tiktok', label: 'TikTok', icon: 'simple-icons:tiktok', color: '#25F4EE', maxLen: 2200 },
];

const ANGLES = [
  { value: 'streaming_alert', label: '🍿 Streaming Alert', desc: 'Title + Platform + Availability first' },
  { value: 'discovery', label: '🔎 Discovery', desc: 'Teach audience an unknown credit/fact' },
  { value: 'dynamic_story', label: '⚡ Dynamic Story', desc: 'Narrative development progression' },
  { value: 'high_drama', label: '🔥 High Drama', desc: 'Real stakes & plot conflict' },
  { value: 'critic_debate', label: '🎬 Critic Debate', desc: 'Review perspectives & consensus' },
  { value: 'character_question', label: '🎭 Character Question', desc: 'Thematic character dilemma' },
  { value: 'behind_the_film', label: '🎥 Behind the Film', desc: 'Director/cinematographer craft' },
  { value: 'credit_connection', label: '🔗 Credit Connection', desc: 'Connecting films through credits' },
  { value: 'audience_debate', label: '🗣️ Audience Debate', desc: 'Opinion question with context' },
  { value: 'fun_relatable', label: '😂 Fun & Relatable', desc: 'Authentic premise banter' },
];

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
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('11:00');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [approving, setApproving] = useState(false);

  // Manual Candidate Search & Swap State
  const [manualSearchOpen, setManualSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // AI Copywriting & 3 Variations State
  const [aiGenerating, setAiGenerating] = useState(false);
  const [selectedAngle, setSelectedAngle] = useState('streaming_alert');
  const [variations, setVariations] = useState([]);
  const [selectedVariationKey, setSelectedVariationKey] = useState('A');
  const [captions, setCaptions] = useState({ instagram: '', threads: '', facebook: '', tiktok: '' });
  const [aiEngine, setAiEngine] = useState('');

  const requestAICopy = async (cand, angle = selectedAngle) => {
    if (!cand || !cand.name) return;
    setAiGenerating(true);
    try {
      const res = await fetch('/api/social?task=ai_generate_copy', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate: cand,
          series: slot.social_content_series,
          angle,
          preferredProvider: 'cohere',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && Array.isArray(data.variations) && data.variations.length > 0) {
        setVariations(data.variations);
        setSelectedVariationKey('A');
        setCaptions(data.variations[0].captions || {});
        setAiEngine(data.engine || 'cohere');
        toast.success(`✨ 3 MuviDB variations generated!`);
      } else if (data.instagram) {
        setCaptions({
          instagram: data.instagram || '',
          threads: data.threads || '',
          facebook: data.facebook || '',
          tiktok: data.tiktok || '',
        });
        setAiEngine(data.engine || 'cohere');
      }
    } catch (err) {
      console.warn('AI Copy request failed:', err);
    } finally {
      setAiGenerating(false);
    }
  };

  // Live candidate search
  useEffect(() => {
    if (!manualSearchOpen || !searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/social?task=search_candidates&q=${encodeURIComponent(searchQuery.trim())}`, {
          headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        });
        const data = await res.json().catch(() => []);
        setSearchResults(Array.isArray(data) ? data : []);
      } catch (err) {
        console.warn('Failed to search candidates:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, manualSearchOpen]);

  useEffect(() => {
    if (slot && isOpen) {
      const initialCandidate = slot.candidate || null;
      setCandidate(initialCandidate);
      setCustomImageUrl(initialCandidate?.imageUrl || '');
      setScheduledDate(slot.scheduled_date || new Date().toISOString().split('T')[0]);
      setScheduledTime(slot.scheduled_time?.slice(0, 5) || '11:00');
      setIsEditingCaption(false);
      setManualSearchOpen(false);
      setSearchQuery('');
      setSearchResults([]);

      // Select default angle based on series
      const slug = slot.social_content_series?.slug || '';
      let initialAngle = 'streaming_alert';
      if (slug.includes('critic')) initialAngle = 'critic_debate';
      else if (slug.includes('upcoming') || slug.includes('announcement')) initialAngle = 'dynamic_story';
      else if (slug.includes('behind')) initialAngle = 'behind_the_film';
      else if (slug.includes('filmography') || initialCandidate?.type === 'person') initialAngle = 'discovery';
      else if (slug.includes('debate') || slug.includes('conversation')) initialAngle = 'audience_debate';
      else if (slug.includes('stage')) initialAngle = 'discovery';

      setSelectedAngle(initialAngle);

      // Fetch AI variations
      if (initialCandidate) {
        requestAICopy(initialCandidate, initialAngle);
      }

      // Load candidate pool for shuffle
      setLoadingCandidates(true);
      const loadCandidatePool = async () => {
        try {
          const res = await fetch(`/api/social?task=slot_candidates&seriesSlug=${slug || 'filmography'}`, {
            headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
          });
          const data = await res.json().catch(() => []);
          if (!res.ok) throw new Error(data?.error || 'Candidate list could not be loaded');
          if (Array.isArray(data) && data.length) {
            setCandidatePool(data);
            const foundIdx = data.findIndex(c => c.id === initialCandidate?.id);
            const activeIdx = foundIdx >= 0 ? foundIdx : 0;
            setPoolIndex(activeIdx);
            if (!initialCandidate && data[activeIdx]) {
              const autoCandidate = data[activeIdx];
              setCandidate(autoCandidate);
              setCustomImageUrl(autoCandidate.imageUrl || '');
              requestAICopy(autoCandidate, initialAngle);
            }
          } else {
            setCandidatePool([]);
          }
        } catch (err) {
          setCandidatePool([]);
          toast.error(err.message || 'Candidate list could not be loaded');
        } finally {
          setLoadingCandidates(false);
        }
      };
      loadCandidatePool();
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
    toast.success(`Swapped to ${nextCandidate.name}!`);
    requestAICopy(nextCandidate, selectedAngle);
  };

  const handleAngleChange = (newAngle) => {
    setSelectedAngle(newAngle);
    requestAICopy(candidate, newAngle);
  };

  const handleSelectVariation = (varKey) => {
    setSelectedVariationKey(varKey);
    const target = variations.find(v => v.key === varKey);
    if (target && target.captions) {
      setCaptions(target.captions);
      toast(`Switched to Option ${varKey} (${target.label})`);
    }
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

  const handleDownloadRenderedCard = async () => {
    if (!candidate) return;
    const toastId = toast.loading('Rendering high-res Figma card (1080×1350)…');
    try {
      const res = await fetch('/api/social?task=render_preview', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate, format: 'portrait_4_5' }),
      });
      if (!res.ok) throw new Error('Failed to render graphic asset');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(candidate.name || 'muvidb').replace(/[^a-zA-Z0-9]/g, '_')}_figma_card.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Downloaded Figma 1080×1350 card!', { id: toastId });
    } catch (err) {
      toast.error('Failed to export rendered card', { id: toastId });
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
    if (isArchivedPlay) {
      toast.error('This live stage production has ended/archived. Social posts cannot be scheduled for past theatre events.');
      return;
    }
    if (!selectedPlatforms.length) {
      toast.error('Please select at least one publishing channel.');
      return;
    }

    setApproving(true);
    try {
      const finalDate = scheduledDate || slot.scheduled_date;
      const finalTime = `${scheduledTime}:00`;

      // If scheduled date or time was edited, update slot record
      if (finalDate !== slot.scheduled_date || scheduledTime !== slot.scheduled_time?.slice(0, 5)) {
        await fetch('/api/social?task=update_slot_date', {
          method: 'POST',
          headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slotId: slot.id,
            scheduledDate: finalDate,
            scheduledTime: finalTime,
          }),
        }).catch(() => {});
      }

      const res = await fetch('/api/social?task=approve_slot', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: slot.id,
          candidateId: candidate.id,
          candidateType: candidate.type || (series.slug === 'filmography' ? 'person' : 'movie'),
          scheduledDate: finalDate,
          scheduledTime: finalTime,
          platforms: selectedPlatforms,
          customCaptions: captions,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      toast.success(`🚀 Approved & Scheduled for ${finalDate} (${scheduledTime})!`);
      onApproved(data);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to approve and schedule slot');
    } finally {
      setApproving(false);
    }
  };

  const handleSelectSearchedCandidate = (selectedItem) => {
    setCandidate(selectedItem);
    setCustomImageUrl(selectedItem.imageUrl || '');
    setManualSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    toast.success(`Swapped candidate to ${selectedItem.name}!`);
    requestAICopy(selectedItem, selectedAngle);
  };

  const displayImage = customImageUrl || candidate?.imageUrl;
  const seriesSlug = (series?.slug || '').toLowerCase();
  const isPerson = candidate?.type === 'person' ||
    series?.category === 'people' ||
    series?.category === 'craft' ||
    seriesSlug.includes('spotlight') ||
    seriesSlug.includes('actor') ||
    seriesSlug.includes('talent') ||
    seriesSlug.includes('filmography') ||
    seriesSlug.includes('face') ||
    seriesSlug.includes('camera');
  const isPlay = candidate?.type === 'play' || seriesSlug.includes('stage');
  const data = candidate?.data || {};
  const isArchivedPlay = isPlay && (data.status === 'archived' || data.derivedStatus === 'archived');
  const currentCaption = captions[activePlatformTab] || '';
  const currentPlatformLimit = PLATFORMS.find(p => p.value === activePlatformTab)?.maxLen || 2200;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <div className="relative flex max-h-[96vh] w-full max-w-5xl flex-col rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden">
        {/* Archived Play Warning Banner */}
        {isArchivedPlay && (
          <div className="flex items-center gap-2.5 bg-amber-500/15 border-b border-amber-500/30 px-6 py-2 text-xs font-medium text-amber-300">
            <Icon icon="solar:danger-triangle-bold" width="18" className="shrink-0 text-amber-400" />
            <span>
              <strong>Past Theatre Run (Archived):</strong> This stage production has already passed. Social Studio will not schedule or publish posts for ended theatre events.
            </span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-3.5 bg-surface-2/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand uppercase tracking-wider">
                {series.name || 'Editorial Series'}
              </span>
              <span className="font-mono text-xs text-text-muted">
                {formattedDate}
              </span>
            </div>
            <h3 className="mt-0.5 text-lg font-black tracking-tight text-text-primary">
              Auto-Pilot Review & Publication
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-surface px-6 py-2.5">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2">
              {displayImage ? (
                <img src={displayImage} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-text-muted">
                  <Icon icon="solar:user-linear" width="18" />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-text-primary text-sm">
                  {candidate?.name || 'Auto-Selected Candidate'}
                </span>
                <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand uppercase">
                  {candidate?.category || (isPerson ? 'Talent' : 'Film')}
                </span>
              </div>
              <p className="text-xs text-text-muted line-clamp-1">
                {candidate?.subtext || 'Verified via MuviDB structured filmography'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setManualSearchOpen(prev => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                manualSearchOpen
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-border bg-surface-2 text-text-primary hover:border-brand hover:text-brand'
              }`}
            >
              <Icon icon="solar:magnifer-linear" width="14" />
              Search & Select Manually
            </button>
            <button
              type="button"
              onClick={handleShuffleCandidate}
              disabled={loadingCandidates || aiGenerating}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-bold text-text-primary hover:border-brand hover:text-brand transition-all disabled:opacity-50"
            >
              <Icon icon="solar:shuffle-linear" width="14" />
              Shuffle ({poolIndex + 1}/{Math.max(candidatePool.length, 1)})
            </button>
          </div>
        </div>

        {/* Manual Search Flyout / Dropdown */}
        {manualSearchOpen && (
          <div className="border-b border-border bg-surface-2/80 p-4 backdrop-blur-md">
            <div className="relative">
              <Icon
                icon="solar:magnifer-linear"
                width="16"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="text"
                autoFocus
                placeholder="Search any actor, director, or film across MuviDB (e.g. Stan Nze, Bimbo Ademoye, Jagun Jagun)…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface pl-9 pr-10 py-2 text-xs font-medium text-text-primary placeholder:text-text-muted outline-none focus:border-brand"
              />
              {isSearching && (
                <Icon
                  icon="solar:spinner-linear"
                  width="16"
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-brand"
                />
              )}
            </div>

            {/* Results Grid / List */}
            {searchResults.length > 0 && (
              <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-border bg-surface p-2 space-y-1.5">
                {searchResults.map(item => (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    onClick={() => handleSelectSearchedCandidate(item)}
                    className="flex w-full items-center justify-between rounded-lg p-2 text-left hover:bg-surface-2 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border bg-surface-2">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-text-muted">
                            <Icon icon={item.type === 'person' ? 'solar:user-bold' : 'solar:clapperboard-bold'} width="16" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-text-primary group-hover:text-brand">
                            {item.name}
                          </span>
                          <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[9px] font-bold text-brand uppercase">
                            {item.category || (item.type === 'person' ? 'Talent' : 'Film')}
                          </span>
                        </div>
                        <span className="text-[11px] text-text-muted line-clamp-1">
                          {item.subtext || item.country || 'Nollywood'}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-brand opacity-0 group-hover:opacity-100 transition-opacity">
                      Select →
                    </span>
                  </button>
                ))}
              </div>
            )}

            {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && (
              <p className="mt-2 text-center text-xs text-text-muted py-2">
                No actors or movies found matching "{searchQuery}".
              </p>
            )}
          </div>
        )}

        {/* Content Body: 2 Columns */}
        <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 md:grid-cols-12">
          {/* Left: Graphic Poster Preview */}
          <div className="space-y-3 md:col-span-6 flex flex-col justify-center">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-text-muted">
                Graphic Card Preview (1:1)
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadRenderedCard}
                  className="text-[11px] font-bold text-brand hover:underline flex items-center gap-1"
                >
                  <Icon icon="solar:download-square-linear" width="13" />
                  Export PNG
                </button>
                <label className="cursor-pointer text-[11px] font-bold text-text-muted hover:text-text-primary hover:underline">
                  {uploadingImage ? 'Uploading…' : '🖼️ Replace Image'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border shadow-2xl bg-surface-2">
              <FigmaSocialCardPreview
                candidate={candidate}
                series={series}
                displayImage={displayImage}
              />
            </div>
          </div>

          {/* Right: AI Editorial Copywriting & Schedule Controls */}
          <div className="space-y-4 md:col-span-6 flex flex-col justify-between">
            <div className="space-y-3.5">
              {/* Publishing Channels */}
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-text-muted">
                  PUBLISHING CHANNELS
                </span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {PLATFORMS.map(p => {
                    const isSelected = selectedPlatforms.includes(p.value);
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => togglePlatform(p.value)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                          isSelected
                            ? 'border-brand bg-brand/10 text-brand shadow-sm'
                            : 'border-border bg-surface-2 text-text-muted hover:text-text-primary'
                        }`}
                      >
                        <Icon icon={p.icon} width="14" />
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Editorial Angle Selector & AI Generator */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-text-muted">
                    EDITORIAL ANGLE
                  </span>
                  <button
                    type="button"
                    onClick={() => requestAICopy(candidate, selectedAngle)}
                    disabled={aiGenerating || !candidate}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1 text-xs font-bold text-white hover:bg-brand-hover transition-all disabled:opacity-50 shadow-sm"
                  >
                    <Icon
                      icon={aiGenerating ? 'solar:spinner-linear' : 'solar:magic-stick-3-bold'}
                      className={aiGenerating ? 'animate-spin' : ''}
                      width="14"
                    />
                    {aiGenerating ? 'Generating…' : 'Generate 3 Variations'}
                  </button>
                </div>

                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {ANGLES.map(a => (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() => handleAngleChange(a.value)}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                        selectedAngle === a.value
                          ? 'border-brand bg-brand/15 text-brand shadow-sm'
                          : 'border-border bg-surface-2 text-text-muted hover:border-border/80 hover:text-text-primary'
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3 Variations Selector (If available) */}
              {variations.length > 0 && (
                <div className="rounded-xl border border-border bg-surface-2/60 p-2.5">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-text-muted">
                    <span>Select Copywriting Variation</span>
                    <span className="text-brand font-mono text-[9px]">Engine: {aiEngine || 'cohere'}</span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    {variations.map(v => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => handleSelectVariation(v.key)}
                        className={`rounded-lg border p-2 text-left transition-all ${
                          selectedVariationKey === v.key
                            ? 'border-brand bg-brand/15 shadow-sm'
                            : 'border-border bg-surface hover:border-border/80'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-black text-text-primary">
                          <span>Option {v.key}</span>
                          {selectedVariationKey === v.key && (
                            <Icon icon="solar:check-circle-bold" className="text-brand" width="14" />
                          )}
                        </div>
                        <span className="text-[10px] font-medium text-text-muted line-clamp-1 mt-0.5">
                          {v.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Captions Tabs & Preview */}
              <div>
                <div className="flex items-center justify-between border-b border-border pb-1">
                  <div className="flex gap-2">
                    {PLATFORMS.filter(p => selectedPlatforms.includes(p.value)).map(p => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setActivePlatformTab(p.value)}
                        className={`border-b-2 px-2 py-1 text-xs font-bold transition-all ${
                          activePlatformTab === p.value
                            ? 'border-brand text-brand'
                            : 'border-transparent text-text-muted hover:text-text-primary'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-text-muted">
                      {currentCaption.length}/{currentPlatformLimit}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingCaption(prev => !prev)}
                      className="text-[11px] font-bold text-brand hover:underline flex items-center gap-1"
                    >
                      <Icon icon="solar:pen-linear" width="12" />
                      {isEditingCaption ? 'Done Editing' : 'Edit Text'}
                    </button>
                  </div>
                </div>

                <div className="mt-2 rounded-lg border border-border bg-surface-2 p-3 relative min-h-[130px]">
                  {aiGenerating && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-surface/90 backdrop-blur-sm space-y-2">
                      <Icon icon="solar:magic-stick-bold" className="animate-bounce text-brand" width="22" />
                      <span className="text-xs font-bold text-text-primary">
                        Writing 3 MuviDB variations with AI…
                      </span>
                    </div>
                  )}

                  {isEditingCaption ? (
                    <textarea
                      rows={5}
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
                    <p className="whitespace-pre-wrap text-xs text-text-primary leading-relaxed max-h-40 overflow-y-auto font-sans">
                      {currentCaption || 'No copy generated for this channel.'}
                    </p>
                  )}
                </div>
              </div>

              {/* Scheduled Date & Time Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 bg-surface-2 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:calendar-date-bold" className="text-brand" width="16" />
                  <span className="text-xs font-bold text-text-primary">Schedule Publication:</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={e => setScheduledDate(e.target.value)}
                    className="rounded border border-border bg-surface px-2.5 py-1 text-xs font-mono text-text-primary outline-none focus:border-brand"
                  />
                  <span className="text-xs text-text-muted">at</span>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={e => setScheduledTime(e.target.value)}
                    className="rounded border border-border bg-surface px-2.5 py-1 text-xs font-mono text-text-primary outline-none focus:border-brand"
                  />
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenManualComposer) {
                    onOpenManualComposer({
                      slotId: slot.id,
                      scheduledDate: scheduledDate || slot.scheduled_date,
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
                  disabled={approving || aiGenerating || isArchivedPlay}
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
