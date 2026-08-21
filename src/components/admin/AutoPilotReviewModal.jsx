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

function generateDefaultCaptions(candidate, series) {
  if (!candidate) return {};
  const name = candidate.name || 'Nollywood Spotlight';
  const handle = candidate.data?.instagram_url
    ? `@${candidate.data.instagram_url.split('/').filter(Boolean).pop()}`
    : `@${name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
  const seriesName = series?.name || 'Nollywood Spotlight';
  const tagList = `#MuviDB #Nollywood #AfricanCinema #${name.replace(/[^a-zA-Z0-9]/g, '')} #${seriesName.replace(/[^a-zA-Z0-9]/g, '')}`;

  let body = '';
  if (candidate.type === 'person') {
    body = `Spotlight on ${name} (${handle})!\n\nFrom standout performances to indelible screen presence, here's celebrating excellence across African cinema.\n\nWhat is your favorite ${name} performance of all time? Drop your thoughts below! 👇\n\n${tagList}`;
  } else {
    body = `Movie Spotlight: ${name}!\n\n${candidate.subtext || 'Discover exceptional African cinema stories.'}\n\nHave you watched this yet? Rate and share your review on MuviDB! 👇\n\n${tagList}`;
  }

  return {
    instagram: body,
    threads: `${name} appreciation post! ✨ ${body.slice(0, 400)}`,
    facebook: `🎬 ${seriesName} | ${name}\n\n${body}`,
    tiktok: `Watch this! Spotlight on ${name} 🌟 Discover more Nollywood on MuviDB. ${tagList}`,
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

  useEffect(() => {
    if (slot && isOpen) {
      const initialCandidate = slot.candidate || null;
      setCandidate(initialCandidate);
      setCustomImageUrl(initialCandidate?.imageUrl || '');
      setScheduledTime(slot.scheduled_time?.slice(0, 5) || '11:00');
      const defaults = generateDefaultCaptions(initialCandidate, slot.social_content_series);
      setCaptions(defaults);
      setIsEditingCaption(false);

      // Load candidates for shuffle
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
      toast.success('Custom graphic image uploaded!');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
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

        {/* Candidate Bar */}
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
                <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-text-muted">
                  {candidate?.category || (candidate?.type === 'person' ? 'Actor' : 'Film')}
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
          {/* Left: Graphic Card Preview */}
          <div className="space-y-3 md:col-span-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-text-muted">
                Graphic Visual Preview
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

            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl border border-border/80 bg-[#0B0B0C] shadow-inner flex flex-col justify-between p-4">
              {/* Graphic Card Styling */}
              <div className="absolute inset-0 z-0">
                {displayImage ? (
                  <img
                    src={displayImage}
                    alt=""
                    className="h-full w-full object-cover opacity-60 filter contrast-110"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-surface-2 to-surface" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              </div>

              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-1.5 rounded bg-black/60 px-2 py-0.5 backdrop-blur-md">
                  <div className="h-2 w-2 rounded-full bg-brand" />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-white">
                    MuviDB
                  </span>
                </div>
                <span className="rounded bg-brand/80 px-2 py-0.5 text-[10px] font-bold uppercase text-white backdrop-blur-md">
                  {series.name || 'Spotlight'}
                </span>
              </div>

              <div className="relative z-10 space-y-1">
                <h4 className="text-lg font-black tracking-tight text-white drop-shadow-md">
                  {candidate?.name || 'Nollywood Spotlight'}
                </h4>
                <p className="text-xs text-white/80 line-clamp-2">
                  {candidate?.subtext || 'Discover more on muvidb.com'}
                </p>
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
                      rows={6}
                      value={captions[activePlatformTab] || ''}
                      onChange={e =>
                        setCaptions(prev => ({
                          ...prev,
                          [activePlatformTab]: e.target.value,
                        }))
                      }
                      className="w-full bg-transparent text-xs text-text-primary outline-none focus:ring-0 font-sans"
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-xs text-text-primary leading-relaxed max-h-44 overflow-y-auto">
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
