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
  const [scheduledTime, setScheduledTime] = useState('11:00');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [approving, setApproving] = useState(false);

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

  useEffect(() => {
    if (slot && isOpen) {
      const initialCandidate = slot.candidate || null;
      setCandidate(initialCandidate);
      setCustomImageUrl(initialCandidate?.imageUrl || '');
      setScheduledTime(slot.scheduled_time?.slice(0, 5) || '11:00');
      setIsEditingCaption(false);

      // Select default angle based on series
      const slug = slot.social_content_series?.slug || '';
      let initialAngle = 'streaming_alert';
      if (slug.includes('critic')) initialAngle = 'critic_debate';
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
      fetch(`/api/social?task=slot_candidates&seriesSlug=${slug || 'filmography'}`, {
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
  const isPlay = candidate?.type === 'play' || series?.slug?.includes('stage');
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
        <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto p-5 md:grid-cols-12">
          {/* Left: Graphic Poster Preview */}
          <div className="space-y-2.5 md:col-span-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-text-muted">
                Graphic Card Preview (4:5)
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadRenderedCard}
                  className="text-[11px] font-bold text-brand hover:underline flex items-center gap-1"
                >
                  <Icon icon="solar:download-square-linear" width="13" />
                  Export Figma PNG
                </button>
                <label className="cursor-pointer text-[11px] font-bold text-text-muted hover:text-text-primary hover:underline">
                  {uploadingImage ? 'Uploading…' : '🖼️ Replace'}
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

            {/* Figma Social Design Card (Matching Figma Ensembla Design System) */}
            <FigmaSocialCardPreview
              candidate={candidate}
              series={series}
              displayImage={displayImage}
            />
          </div>

          {/* Right: AI Angles, 3 Variations, Channels & Copy */}
          <div className="space-y-3.5 md:col-span-7 flex flex-col justify-between">
            <div className="space-y-3">
              {/* Target Channels */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-text-muted mb-1.5">
                  Publishing Channels
                </label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map(p => {
                    const active = selectedPlatforms.includes(p.value);
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => togglePlatform(p.value)}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all ${
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

              {/* 10 AI Angles Toolbar */}
              <div className="rounded-xl border border-border/80 bg-surface-2/60 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black uppercase tracking-wider text-text-primary">
                      Editorial Angle
                    </span>
                    {aiEngine && (
                      <span className="rounded bg-surface px-1.5 py-0.5 text-[9px] font-mono text-text-muted">
                        {aiEngine}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => requestAICopy(candidate, selectedAngle)}
                    disabled={aiGenerating}
                    className="inline-flex items-center gap-1.5 rounded-md bg-brand px-2.5 py-1 text-[11px] font-black text-white hover:bg-brand-hover transition-all disabled:opacity-50"
                  >
                    <Icon
                      icon={aiGenerating ? 'solar:spinner-linear' : 'solar:magic-stick-bold'}
                      className={aiGenerating ? 'animate-spin' : ''}
                      width="13"
                    />
                    {aiGenerating ? 'Writing 3 Options…' : 'Generate 3 Variations'}
                  </button>
                </div>

                {/* 10 Angle Badges */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {ANGLES.map(a => (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() => handleAngleChange(a.value)}
                      disabled={aiGenerating}
                      title={a.desc}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition-all ${
                        selectedAngle === a.value
                          ? 'bg-brand text-white shadow-sm ring-1 ring-brand'
                          : 'bg-surface border border-border text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3 Variations Selector (Option A / B / C) */}
              {variations.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-brand/30 bg-brand/5 p-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-brand pl-1">
                    Variations:
                  </span>
                  <div className="flex flex-1 gap-1.5">
                    {variations.map(v => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => handleSelectVariation(v.key)}
                        className={`flex-1 rounded-md px-2 py-1 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          selectedVariationKey === v.key
                            ? 'bg-brand text-white shadow-sm'
                            : 'bg-surface border border-border/80 text-text-muted hover:text-text-primary'
                        }`}
                      >
                        <span>Option {v.key}</span>
                        <span className="text-[10px] font-normal opacity-80">({v.label})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Platform Tabs & Copy Editor */}
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
                    <span className={`text-[10px] font-mono ${currentCaption.length > currentPlatformLimit ? 'text-red-500 font-bold' : 'text-text-muted'}`}>
                      {currentCaption.length}/{currentPlatformLimit}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingCaption(!isEditingCaption)}
                      className="text-xs font-bold text-brand hover:underline"
                    >
                      {isEditingCaption ? 'Done Editing' : '✏️ Edit Text'}
                    </button>
                  </div>
                </div>

                <div className="mt-2 rounded-lg border border-border bg-surface-2 p-3 relative min-h-[140px]">
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
                      rows={6}
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
                    <p className="whitespace-pre-wrap text-xs text-text-primary leading-relaxed max-h-44 overflow-y-auto font-sans">
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
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
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
