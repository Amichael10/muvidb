import { useState, useMemo, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { authHeaders } from '../../lib/apiAuth';
import { uploadAdminSocialMedia } from '../../lib/imageUpload';
import { supabase } from '../../lib/supabase';
import FilmSearchCombobox from './FilmSearchCombobox';

const PLATFORM_CONFIGS = [
  {
    id: 'instagram',
    label: 'Instagram',
    icon: 'mdi:instagram',
    color: '#E1306C',
    bgLight: 'bg-[#E1306C]/10',
    border: 'border-[#E1306C]/40',
    limit: 2200,
    hashtagsLimit: 12,
    subtext: 'Feed, Reels & Stories',
  },
  {
    id: 'threads',
    label: 'Threads',
    icon: 'ri:threads-fill',
    color: '#FFFFFF',
    bgLight: 'bg-white/10',
    border: 'border-white/30',
    limit: 500,
    hashtagsLimit: 3,
    subtext: 'Conversational posts',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    icon: 'ri:tiktok-fill',
    color: '#00F2FE',
    bgLight: 'bg-[#00F2FE]/10',
    border: 'border-[#00F2FE]/40',
    limit: 2200,
    hashtagsLimit: 8,
    subtext: 'Short-form video',
  },
  {
    id: 'x',
    label: 'X (Twitter)',
    icon: 'ri:twitter-x-fill',
    color: '#1DA1F2',
    bgLight: 'bg-[#1DA1F2]/10',
    border: 'border-[#1DA1F2]/40',
    limit: 280,
    hashtagsLimit: 2,
    subtext: 'Brevity & live debate',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    icon: 'ic:baseline-facebook',
    color: '#1877F2',
    bgLight: 'bg-[#1877F2]/10',
    border: 'border-[#1877F2]/40',
    limit: 2000,
    hashtagsLimit: 4,
    subtext: 'Page community',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    icon: 'mdi:youtube',
    color: '#FF0000',
    bgLight: 'bg-[#FF0000]/10',
    border: 'border-[#FF0000]/40',
    limit: 5000,
    hashtagsLimit: 15,
    subtext: 'Shorts & Community',
  },
];

const FORMAT_OPTIONS = [
  { id: 'post', label: 'Text Post', icon: 'solar:text-square-linear' },
  { id: 'image', label: 'Single Photo', icon: 'solar:gallery-linear' },
  { id: 'carousel', label: 'Photo Carousel', icon: 'solar:gallery-wide-linear' },
  { id: 'video', label: 'Video / Clip', icon: 'solar:clapperboard-play-linear' },
];

const ASPECT_RATIOS = [
  { id: 'portrait_4_5', label: '4:5 Portrait', sub: 'Instagram / Feed' },
  { id: 'vertical_9_16', label: '9:16 Vertical', sub: 'Reels / TikTok / Shorts' },
  { id: 'square_1_1', label: '1:1 Square', sub: 'Universal Feed' },
  { id: 'landscape_16_9', label: '16:9 Landscape', sub: 'YouTube / Widescreen' },
];

function normalizeInitialData(data) {
  if (!data) return null;

  const id = data.id || null;
  const title = data.title || '';

  const rawVariants = Array.isArray(data.social_platform_variants)
    ? data.social_platform_variants
    : Array.isArray(data.variants)
      ? data.variants
      : [];

  // Platforms
  let platforms = [];
  if (Array.isArray(data.platforms) && data.platforms.length) {
    platforms = data.platforms;
  } else if (rawVariants.length) {
    platforms = rawVariants
      .filter(v => v.status !== 'cancelled')
      .map(v => v.platform)
      .filter(Boolean);
    if (!platforms.length) {
      platforms = rawVariants.map(v => v.platform).filter(Boolean);
    }
  }
  if (!platforms.length) {
    platforms = ['instagram', 'threads', 'tiktok', 'facebook', 'x'];
  }

  // Captions
  const platformCaptions = { ...(data.platformCaptions || {}) };
  let universalCaption = data.universalCaption || data.caption || '';

  rawVariants.forEach(v => {
    if (v.platform && v.caption) {
      platformCaptions[v.platform] = v.caption;
      if (!universalCaption) universalCaption = v.caption;
    }
  });

  const uniqueCaptions = new Set(Object.values(platformCaptions).filter(Boolean));
  const isCustomizingPerPlatform = uniqueCaptions.size > 1;

  // Media
  let mediaAssets = [];
  if (Array.isArray(data.mediaAssets) && data.mediaAssets.length) {
    mediaAssets = data.mediaAssets;
  } else {
    const rawAssets = Array.isArray(data.social_assets)
      ? data.social_assets
      : Array.isArray(data.assets)
        ? data.assets
        : [];

    if (rawAssets.length) {
      mediaAssets = rawAssets.map((a, idx) => {
        const publicUrl = a.public_url || a.publicUrl || '';
        const isVideo = a.mime_type?.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(publicUrl);
        return {
          id: a.id || `asset_${idx}`,
          publicUrl,
          storagePath: a.storage_path || a.storagePath || '',
          mimeType: a.mime_type || (isVideo ? 'video/mp4' : 'image/jpeg'),
          width: a.width || 1080,
          height: a.height || 1080,
          format: a.format || (isVideo ? 'video_vertical_9_16' : 'portrait_4_5'),
          fileSizeBytes: a.file_size_bytes || 0,
        };
      }).filter(a => Boolean(a.publicUrl));
    }

    if (!mediaAssets.length) {
      for (const v of rawVariants) {
        const carouselUrls = v.platform_options?.carousel_asset_urls;
        if (Array.isArray(carouselUrls) && carouselUrls.length) {
          mediaAssets = carouselUrls.map((url, idx) => ({
            id: `carousel_${idx}`,
            publicUrl: url,
            mimeType: /\.(mp4|webm|mov)$/i.test(url) ? 'video/mp4' : 'image/jpeg',
            width: 1080,
            height: 1080,
            format: 'carousel',
          }));
          break;
        }
      }
    }
  }

  // Format
  let format = data.format || data.content_type;
  if (!['post', 'image', 'carousel', 'video'].includes(format)) {
    if (mediaAssets.some(m => m.mimeType?.startsWith('video/') || m.format?.includes('video'))) {
      format = 'video';
    } else if (mediaAssets.length > 1) {
      format = 'carousel';
    } else if (mediaAssets.length === 1) {
      format = 'image';
    } else {
      format = 'post';
    }
  }

  // Aspect ratio
  let aspectRatio = data.aspectRatio || 'portrait_4_5';
  if (mediaAssets[0]?.format) {
    const f = mediaAssets[0].format;
    if (f.includes('9_16')) aspectRatio = 'vertical_9_16';
    else if (f.includes('1_1')) aspectRatio = 'square_1_1';
    else if (f.includes('16_9')) aspectRatio = 'landscape_16_9';
    else if (f.includes('4_5')) aspectRatio = 'portrait_4_5';
  }

  // Schedule string for input[type="datetime-local"]
  const rawSched = data.scheduledFor || data.scheduled_for || rawVariants.find(v => v.scheduled_for)?.scheduled_for;
  let scheduledFor = '';
  if (rawSched) {
    try {
      const d = new Date(rawSched);
      if (!isNaN(d.getTime())) {
        const pad = n => String(n).padStart(2, '0');
        scheduledFor = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
    } catch {
      scheduledFor = '';
    }
  }

  const coverUrl =
    data.coverUrl ||
    data.videoCoverUrl ||
    data.cover_url ||
    rawVariants.find(v => v.platform_options?.cover_url || v.platform_options?.cover_image_url)?.platform_options?.cover_url ||
    rawVariants.find(v => v.platform_options?.thumbnail_url)?.platform_options?.thumbnail_url ||
    (Array.isArray(data.social_assets) ? data.social_assets.find(a => a.render_metadata?.cover_url)?.render_metadata?.cover_url : '') ||
    '';

  return {
    id,
    title,
    universalCaption,
    platformCaptions,
    isCustomizingPerPlatform,
    selectedPlatforms: platforms,
    mediaAssets,
    postFormat: format,
    aspectRatio,
    scheduledFor,
    status: data.status || 'draft',
    coverUrl,
  };
}

export default function UniversalSocialComposer({
  connections = {},
  initialData = null,
  onPostCreated = () => {},
  onCancel = null,
}) {
  const parsed = useMemo(() => normalizeInitialData(initialData), [initialData]);

  // State
  const [selectedPlatforms, setSelectedPlatforms] = useState(() => 
    parsed?.selectedPlatforms || ['instagram', 'threads', 'tiktok', 'facebook', 'x']
  );
  const [postFormat, setPostFormat] = useState(() => parsed?.postFormat || 'post');
  const [aspectRatio, setAspectRatio] = useState(() => parsed?.aspectRatio || 'portrait_4_5');
  const [title, setTitle] = useState(() => parsed?.title || '');
  const [universalCaption, setUniversalCaption] = useState(() => parsed?.universalCaption || '');
  
  // Per-platform customization
  const [isCustomizingPerPlatform, setIsCustomizingPerPlatform] = useState(() => Boolean(parsed?.isCustomizingPerPlatform));
  const [platformCaptions, setPlatformCaptions] = useState(() => parsed?.platformCaptions || {});
  const [activeCustomPlatform, setActiveCustomPlatform] = useState('instagram');

  // Media
  const [mediaAssets, setMediaAssets] = useState(() => parsed?.mediaAssets || []);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const fileInputRef = useRef(null);

  // Video Cover / Thumbnail
  const [videoCoverUrl, setVideoCoverUrl] = useState(() => parsed?.coverUrl || '');
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef(null);
  const videoPlayerRef = useRef(null);

  // Scheduling
  const [scheduledFor, setScheduledFor] = useState(() => parsed?.scheduledFor || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live device preview platform
  const [previewPlatform, setPreviewPlatform] = useState('instagram');

  // AI assistant loading
  const [generatingAI, setGeneratingAI] = useState(false);

  // Movie anchor for Ensemble AI Tagging
  const [selectedMovieForCaption, setSelectedMovieForCaption] = useState(null);
  const [isGeneratingEnsembleCaption, setIsGeneratingEnsembleCaption] = useState(false);
  const [ensembleInfo, setEnsembleInfo] = useState(null);

  // Reactive sync if initialData changes while mounted
  useEffect(() => {
    if (parsed) {
      setSelectedPlatforms(parsed.selectedPlatforms);
      setPostFormat(parsed.postFormat);
      setAspectRatio(parsed.aspectRatio);
      setTitle(parsed.title);
      setUniversalCaption(parsed.universalCaption);
      setIsCustomizingPerPlatform(Boolean(parsed.isCustomizingPerPlatform));
      setPlatformCaptions(parsed.platformCaptions);
      setMediaAssets(parsed.mediaAssets);
      setScheduledFor(parsed.scheduledFor);
      setVideoCoverUrl(parsed.coverUrl || '');
    }
  }, [parsed]);

  // Sync preview platform if current preview platform gets deselected
  useEffect(() => {
    if (selectedPlatforms.length > 0 && !selectedPlatforms.includes(previewPlatform)) {
      setPreviewPlatform(selectedPlatforms[0]);
    }
  }, [selectedPlatforms, previewPlatform]);

  const togglePlatform = (platformId) => {
    setSelectedPlatforms(prev => {
      if (prev.includes(platformId)) {
        if (prev.length === 1) {
          toast.error('Select at least one destination platform');
          return prev;
        }
        return prev.filter(p => p !== platformId);
      }
      return [...prev, platformId];
    });
  };

  const selectAllPlatforms = () => {
    setSelectedPlatforms(PLATFORM_CONFIGS.map(p => p.id));
  };

  const clearAllPlatforms = () => {
    setSelectedPlatforms(['instagram']);
  };

  // Caption getters
  const getCaptionForPlatform = (platformId) => {
    if (isCustomizingPerPlatform && platformCaptions[platformId] !== undefined) {
      return platformCaptions[platformId];
    }
    return universalCaption;
  };

  const setCaptionForPlatform = (platformId, text) => {
    setPlatformCaptions(prev => ({
      ...prev,
      [platformId]: text,
    }));
  };

  const resetPlatformCaptionToMaster = (platformId) => {
    setPlatformCaptions(prev => {
      const next = { ...prev };
      delete next[platformId];
      return next;
    });
    toast.success(`Reset ${platformId} caption to master`);
  };

  // Handle uploading a custom image cover for video
  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    try {
      const res = await uploadAdminSocialMedia(file);
      if (res.error) throw new Error(res.error);
      setVideoCoverUrl(res.url);
      toast.success('Video cover image set!');
    } catch (err) {
      toast.error(err.message || 'Failed to upload cover image');
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  // Handle capturing current paused frame from video
  const handleCaptureVideoFrame = () => {
    const vid = videoPlayerRef.current || document.querySelector('video[data-composer-video="true"]');
    if (!vid) {
      toast.error('Video player not ready');
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = vid.videoWidth || 1080;
      canvas.height = vid.videoHeight || 1920;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error('Could not capture frame');
          return;
        }
        const file = new File([blob], `cover_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setUploadingCover(true);
        try {
          const res = await uploadAdminSocialMedia(file);
          if (res.error) throw new Error(res.error);
          setVideoCoverUrl(res.url);
          toast.success('Captured current frame as video cover!');
        } catch (err) {
          toast.error(err.message || 'Failed to save cover frame');
        } finally {
          setUploadingCover(false);
        }
      }, 'image/jpeg', 0.92);
    } catch (err) {
      toast.error('Failed to capture video frame: ' + (err.message || ''));
    }
  };

  // Media upload handler
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    setUploadProgress('Uploading media...');

    try {
      const uploaded = [];
      for (const file of files) {
        const isVideo = file.type.startsWith('video/');
        const res = await uploadAdminSocialMedia(file);
        if (res.error) throw new Error(res.error);

        uploaded.push({
          publicUrl: res.url,
          mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
          format: isVideo ? (aspectRatio.includes('9_16') ? 'video_vertical_9_16' : aspectRatio) : aspectRatio,
          fileSizeBytes: file.size,
          width: isVideo ? 1080 : 1080,
          height: isVideo ? 1920 : 1350,
        });
      }

      setMediaAssets(prev => [...prev, ...uploaded]);
      if (uploaded.some(m => m.mimeType.startsWith('video/'))) {
        setPostFormat('video');
      } else if (mediaAssets.length + uploaded.length > 1) {
        setPostFormat('carousel');
      } else {
        setPostFormat('image');
      }
      toast.success(`${uploaded.length} file(s) attached!`);
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeMedia = (index) => {
    setMediaAssets(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) setPostFormat('post');
      else if (next.length === 1 && !next[0].mimeType?.startsWith('video/')) setPostFormat('image');
      return next;
    });
  };

  // AI adaptation across all selected platforms
  const handleGenerateAIVariations = async () => {
    if (!universalCaption.trim()) {
      toast.error('Write a master caption first so AI can adapt it for each platform.');
      return;
    }

    setGeneratingAI(true);
    try {
      const res = await fetch('/api/social?task=ai_generate_copy', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate: { name: title || 'African Cinema & Nollywood', subtext: universalCaption },
          series: 'universal_post',
          angle: 'streaming_alert',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'AI generation failed');

      const baseCopy = data.caption || universalCaption;
      const variations = {};

      const xCandidate = baseCopy.replace(/#\w+/g, '').trim();
      variations.x = xCandidate.length > 270 ? xCandidate.slice(0, 267) + '...' : xCandidate;
      variations.threads = baseCopy.slice(0, 480);
      variations.instagram = baseCopy + '\n\n#Nollywood #AfricanCinema #MuviDB #FilmCommunity';
      variations.tiktok = `🎬 Must Watch! ${baseCopy.slice(0, 300)}\n\n#filmtok #nollywood #muvidb`;
      variations.facebook = baseCopy;
      variations.youtube = `${title ? title + '\n\n' : ''}${baseCopy}\n\nDiscover more on https://muvidb.com`;

      setPlatformCaptions(variations);
      setIsCustomizingPerPlatform(true);
      toast.success('✨ Tailored captions generated for all selected platforms!');
    } catch (err) {
      const variations = {};
      const clean = universalCaption.replace(/#\w+/g, '').trim();

      variations.x = clean.length > 270 ? clean.slice(0, 267) + '...' : clean;
      variations.threads = universalCaption.slice(0, 490);
      variations.instagram = universalCaption + '\n\n#Nollywood #AfricanCinema #MuviDB';
      variations.tiktok = `🔥 ${universalCaption.slice(0, 350)}\n\n#filmtok #nollywood #africanmovies`;
      variations.facebook = universalCaption;
      variations.youtube = universalCaption;

      setPlatformCaptions(variations);
      setIsCustomizingPerPlatform(true);
      toast.success('✨ Adapted captions for each platform!');
    } finally {
      setGeneratingAI(false);
    }
  };

  // Select a film to query its full ensemble cast and verified Instagram handles
  const handleSelectMovieForEnsemble = async (filmId, filmObj) => {
    if (!filmId) {
      setSelectedMovieForCaption(null);
      setEnsembleInfo(null);
      return;
    }
    try {
      const { data: fullFilm, error } = await supabase
        .from('films')
        .select(`
          id, title, year, synopsis, genres, youtube_watch_url, youtube_channel_name,
          credits (
            role,
            character_name,
            billing_order,
            people (
              id,
              name,
              instagram_url,
              twitter_url
            )
          )
        `)
        .eq('id', filmId)
        .maybeSingle();

      if (error || !fullFilm) {
        toast.error('Could not load movie credits');
        return;
      }

      setSelectedMovieForCaption(fullFilm);

      const credits = Array.isArray(fullFilm.credits) ? fullFilm.credits : [];
      const castCredits = credits.filter(c => {
        const r = (c.role || '').toLowerCase();
        return r.includes('actor') || r.includes('cast') || r.includes('lead') || r.includes('supporting');
      });
      const withInstagram = credits.filter(c => c.people?.instagram_url);

      setEnsembleInfo({
        totalCredits: credits.length,
        castCount: castCredits.length,
        withInstagramCount: withInstagram.length,
        credits,
      });

      if (!title) {
        setTitle(`${fullFilm.title}${fullFilm.year ? ` (${fullFilm.year})` : ''}`);
      }
    } catch (err) {
      console.error('Error fetching film for ensemble caption:', err);
      toast.error('Failed to load film credits');
    }
  };

  // Generate AI caption tagging the ensemble cast and crew with @Instagram usernames
  const handleGenerateEnsembleCaption = async () => {
    if (!selectedMovieForCaption) {
      toast.error('Select a movie first');
      return;
    }
    setIsGeneratingEnsembleCaption(true);
    try {
      const film = selectedMovieForCaption;
      const credits = ensembleInfo?.credits || film.credits || [];

      const cleanHandle = (raw) => {
        if (!raw || typeof raw !== 'string') return '';
        let h = raw.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '');
        h = h.split('/')[0].split('?')[0].replace(/[@#]/g, '').trim();
        return h && /^[a-zA-Z0-9._]+$/.test(h) ? `@${h}` : '';
      };

      const topCast = credits
        .filter(c => {
          const r = (c.role || '').toLowerCase();
          return r === 'actor' || r === 'lead' || r === 'supporting' || r.includes('cast');
        })
        .map(c => ({
          name: c.people?.name || 'Cast Member',
          character: c.character_name || '',
          handle: cleanHandle(c.people?.instagram_url),
          instagramHandle: cleanHandle(c.people?.instagram_url),
        }));

      const directors = credits
        .filter(c => (c.role || '').toLowerCase() === 'director')
        .map(c => ({
          name: c.people?.name || 'Director',
          handle: cleanHandle(c.people?.instagram_url),
          instagramHandle: cleanHandle(c.people?.instagram_url),
        }));

      const creditedPeople = credits
        .filter(c => c.people?.name)
        .map(c => ({
          name: c.people?.name,
          role: c.role,
          character: c.character_name,
          handle: cleanHandle(c.people?.instagram_url),
          instagramHandle: cleanHandle(c.people?.instagram_url),
        }));

      const res = await fetch('/api/social?task=ai_generate_copy', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate: {
            id: film.id,
            type: 'movie',
            name: film.title,
            subtext: film.synopsis,
            data: {
              title: film.title,
              year: film.year,
              synopsis: film.synopsis,
              directors,
              topCast,
              creditedPeople,
              youtubeChannelName: film.youtube_channel_name,
            },
          },
          angle: 'dynamic_story',
          preferredProvider: 'gemini',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to generate ensemble caption');

      const generatedInstagram = data.instagram || data.variations?.[0]?.captions?.instagram;
      if (generatedInstagram) {
        setUniversalCaption(generatedInstagram);

        const primary = data.variations?.[0]?.captions || data;
        const newPlatformCaptions = {};
        if (primary.threads) newPlatformCaptions.threads = primary.threads;
        if (primary.tiktok) newPlatformCaptions.tiktok = primary.tiktok;
        if (primary.facebook) newPlatformCaptions.facebook = primary.facebook;
        if (primary.instagram) newPlatformCaptions.instagram = primary.instagram;
        if (primary.threads) newPlatformCaptions.x = primary.threads.slice(0, 275);
        setPlatformCaptions(prev => ({ ...prev, ...newPlatformCaptions }));

        const handleCount = creditedPeople.filter(p => p.handle).length;
        toast.success(`✨ Generated caption with ${handleCount} ensemble @handles tagged!`);
      } else {
        throw new Error('No caption returned from AI generator');
      }
    } catch (err) {
      console.error('Ensemble caption generation error:', err);
      toast.error(err.message || 'Could not generate ensemble caption');
    } finally {
      setIsGeneratingEnsembleCaption(false);
    }
  };

  // Quick schedule presets
  const applySchedulePreset = (offsetMinutes, timeStr = null) => {
    const d = new Date();
    if (timeStr) {
      d.setDate(d.getDate() + 1); // Tomorrow
      const [h, m] = timeStr.split(':').map(Number);
      d.setHours(h, m, 0, 0);
    } else {
      d.setMinutes(d.getMinutes() + offsetMinutes);
    }

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    setScheduledFor(`${year}-${month}-${day}T${hours}:${mins}`);
  };

  // Submit action: Draft, Schedule, or Publish Now
  const handleSubmit = async (actionType) => {
    if (!universalCaption.trim() && !mediaAssets.length) {
      toast.error('Please enter a caption or attach media');
      return;
    }
    if (!selectedPlatforms.length) {
      toast.error('Please select at least one platform');
      return;
    }

    let finalSchedule = null;
    let finalStatus = 'draft';

    if (actionType === 'publish_now') {
      finalSchedule = new Date().toISOString();
      finalStatus = 'publish_now';
    } else if (actionType === 'schedule') {
      if (!scheduledFor) {
        toast.error('Choose a date and time to schedule this post');
        return;
      }
      finalSchedule = new Date(scheduledFor).toISOString();
      finalStatus = 'scheduled';
    }

    setIsSubmitting(true);
    const isEditing = Boolean(parsed?.id);
    const toastId = toast.loading(
      actionType === 'publish_now'
        ? 'Publishing immediately to selected platforms...'
        : actionType === 'schedule'
          ? (isEditing ? 'Updating schedule...' : 'Scheduling multi-platform post...')
          : (isEditing ? 'Saving changes...' : 'Saving draft...')
    );

    try {
      const formattedMediaAssets = mediaAssets.map((asset, i) => {
        if (i === 0 && (postFormat === 'video' || asset.mimeType?.startsWith('video/'))) {
          return {
            ...asset,
            coverUrl: videoCoverUrl || undefined,
          };
        }
        return asset;
      });

      const payload = {
        contentItemId: parsed?.id || undefined,
        title: title || universalCaption.slice(0, 40) || 'Social Post',
        format: postFormat,
        platforms: selectedPlatforms,
        universalCaption,
        platformCaptions: isCustomizingPerPlatform ? platformCaptions : {},
        mediaAssets: formattedMediaAssets,
        coverUrl: videoCoverUrl || undefined,
        videoCoverUrl: videoCoverUrl || undefined,
        scheduledFor: finalSchedule,
        status: finalStatus,
        sourceEntityId: selectedMovieForCaption?.id || undefined,
        sourceType: selectedMovieForCaption ? 'film' : undefined,
        sourceSnapshot: selectedMovieForCaption ? {
          filmId: selectedMovieForCaption.id,
          title: selectedMovieForCaption.title,
          year: selectedMovieForCaption.year,
        } : undefined,
      };

      const res = await fetch('/api/social?task=create_post', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      toast.success(
        actionType === 'publish_now'
          ? (data.processed ? `🚀 Post published to ${data.processed} channel(s)!` : '🚀 Publish triggered!')
          : actionType === 'schedule'
            ? '📅 Post scheduled successfully!'
            : (isEditing ? '💾 Changes saved!' : '💾 Draft saved!'),
        { id: toastId }
      );

      onPostCreated(data);
    } catch (err) {
      toast.error(err.message || 'Failed to save post', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const activePreviewConfig = PLATFORM_CONFIGS.find(p => p.id === previewPlatform) || PLATFORM_CONFIGS[0];
  const activePreviewCaption = getCaptionForPlatform(previewPlatform);

  return (
    <div className="w-full mx-auto max-w-7xl px-4 py-6 space-y-8">
      {/* Top Studio Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              {parsed?.id ? 'Editing Scheduled / Queue Post' : 'Platform-Agnostic Social Studio'}
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            {parsed?.id ? (title || 'Edit Post') : 'Universal Publisher'}
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            {parsed?.id
              ? 'Modify post content, channels, attachments, or schedule, then save or publish.'
              : 'Compose once, preview natively, and distribute seamlessly to Instagram, Threads, TikTok, X, Facebook, and YouTube.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold text-text-secondary hover:text-white bg-surface-2 hover:bg-surface-3 rounded-lg border border-border/50 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={() => handleSubmit('draft')}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-bold text-white bg-surface-3 hover:bg-surface-4 rounded-lg border border-border hover:border-text-muted transition-colors flex items-center gap-1.5"
          >
            <Icon icon="solar:folder-with-files-linear" width="15" />
            <span>{parsed?.id ? 'Save Changes' : 'Save Draft'}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('publish_now')}
            disabled={isSubmitting}
            className="px-5 py-2 text-xs font-black text-white bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 rounded-lg shadow-lg shadow-orange-500/20 transition-all flex items-center gap-1.5"
          >
            <Icon icon="solar:bolt-bold" width="16" />
            <span>Publish Now</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Composer Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Target Platforms Card */}
          <div className="bg-surface-1 rounded-2xl border border-border/60 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Icon icon="solar:share-circle-bold" className="text-primary" width="18" />
                  Target Platforms
                </h3>
                <p className="text-xs text-text-muted">Choose where this post will be distributed</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={selectAllPlatforms}
                  className="text-primary hover:underline font-semibold"
                >
                  Select All
                </button>
                <span className="text-border">|</span>
                <button
                  type="button"
                  onClick={clearAllPlatforms}
                  className="text-text-muted hover:text-white"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {PLATFORM_CONFIGS.map(platform => {
                const isSelected = selectedPlatforms.includes(platform.id);
                const isConnected = Boolean(connections?.platforms?.[platform.id] || connections?.[platform.id]);

                return (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => togglePlatform(platform.id)}
                    className={`relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? `bg-surface-2 ${platform.border} ring-1 ring-primary/40 shadow-sm`
                        : 'bg-surface-2/40 border-border/30 opacity-60 hover:opacity-100 hover:border-border/60'
                    }`}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                      style={{ backgroundColor: isSelected ? platform.color : '#333' }}
                    >
                      <Icon icon={platform.icon} width="20" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white truncate">{platform.label}</span>
                        {isSelected && (
                          <Icon icon="solar:check-circle-bold" className="text-emerald-400 shrink-0" width="13" />
                        )}
                      </div>
                      <span className="text-[10px] text-text-muted block truncate">{platform.subtext}</span>
                    </div>

                    <span
                      title={isConnected ? 'Account Connected' : 'Mock Mode / Unlinked'}
                      className={`absolute top-2 right-2 h-1.5 w-1.5 rounded-full ${
                        isConnected ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Content Format & Media Card */}
          <div className="bg-surface-1 rounded-2xl border border-border/60 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Icon icon="solar:album-bold" className="text-primary" width="18" />
                  Media & Format
                </h3>
                <p className="text-xs text-text-muted">Select post format and attach visual assets</p>
              </div>

              {/* Format selector chips */}
              <div className="flex bg-surface-2 rounded-lg p-0.5 border border-border/50">
                {FORMAT_OPTIONS.map(fmt => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setPostFormat(fmt.id)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                      postFormat === fmt.id
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-text-muted hover:text-white'
                    }`}
                  >
                    <Icon icon={fmt.icon} width="14" />
                    <span className="hidden sm:inline">{fmt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Aspect ratio selector when media is enabled */}
            {postFormat !== 'post' && (
              <div className="flex items-center gap-2 pt-1 border-t border-border/20">
                <span className="text-xs text-text-muted font-medium">Aspect Ratio:</span>
                <div className="flex flex-wrap gap-1.5">
                  {ASPECT_RATIOS.map(ratio => (
                    <button
                      key={ratio.id}
                      type="button"
                      onClick={() => setAspectRatio(ratio.id)}
                      className={`px-2 py-0.5 text-[11px] rounded-md border transition-all ${
                        aspectRatio === ratio.id
                          ? 'bg-surface-3 border-primary text-white font-bold'
                          : 'bg-surface-2 border-border/40 text-text-muted hover:text-white'
                      }`}
                    >
                      {ratio.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Media Upload Area */}
            {postFormat !== 'post' && (
              <div className="space-y-3">
                {mediaAssets.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {mediaAssets.map((asset, idx) => (
                      <div key={idx} className="group relative aspect-square rounded-xl overflow-hidden border border-border/60 bg-black">
                        {asset.mimeType?.startsWith('video/') ? (
                          <video
                            ref={idx === 0 ? videoPlayerRef : null}
                            data-composer-video="true"
                            src={asset.publicUrl}
                            poster={videoCoverUrl || undefined}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                            controls
                          />
                        ) : (
                          <img
                            src={asset.publicUrl}
                            alt={`Upload ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => removeMedia(idx)}
                          className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/70 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-md"
                        >
                          <Icon icon="solar:trash-bin-trash-bold" width="13" />
                        </button>
                        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/70 text-white">
                          #{idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <label className="flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-primary/60 bg-surface-2/40 hover:bg-surface-2/80 rounded-xl p-6 cursor-pointer transition-all text-center group">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple={postFormat === 'carousel'}
                    accept={postFormat === 'video' ? 'video/mp4,video/webm,video/quicktime' : 'image/png,image/jpeg,image/webp,video/mp4'}
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                  <div className="h-10 w-10 rounded-full bg-surface-3 flex items-center justify-center text-text-muted group-hover:text-primary mb-2 transition-colors">
                    {uploading ? (
                      <Icon icon="solar:spinner-line-duotone" className="animate-spin text-primary" width="22" />
                    ) : (
                      <Icon icon="solar:upload-track-2-bold" width="22" />
                    )}
                  </div>
                  <span className="text-xs font-bold text-white group-hover:text-primary transition-colors">
                    {uploading ? uploadProgress || 'Uploading...' : 'Click or drop files to upload'}
                  </span>
                  <span className="text-[11px] text-text-muted mt-0.5">
                    Supports high-res PNG, JPG, WebP, MP4, WebM (up to 500 MB)
                  </span>
                </label>

                {/* Video Cover / Poster Frame Selector */}
                {(postFormat === 'video' || mediaAssets.some(m => m.mimeType?.startsWith('video/'))) && (
                  <div className="bg-surface-2/70 border border-border/70 rounded-xl p-4 space-y-3">
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleCoverUpload}
                      className="hidden"
                      disabled={uploadingCover}
                    />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon icon="solar:picture-in-picture-bold" className="text-primary" width="18" />
                        <span className="text-xs font-bold text-white">Video Cover / Poster Image</span>
                      </div>
                      {videoCoverUrl ? (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Icon icon="solar:check-circle-bold" width="12" />
                          Custom Cover Active
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                          Auto-generated by platform
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-text-muted">
                      This cover image is published to Instagram Reels, Facebook Video, TikTok, and YouTube as the custom thumbnail/cover poster.
                    </p>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      {/* Cover Thumbnail Preview */}
                      <div className="relative w-24 h-32 rounded-lg overflow-hidden border border-border bg-black shrink-0 flex items-center justify-center group shadow-md">
                        {videoCoverUrl ? (
                          <>
                            <img src={videoCoverUrl} alt="Video cover preview" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setVideoCoverUrl('')}
                              title="Remove cover"
                              className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/80 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Icon icon="solar:trash-bin-trash-bold" width="11" />
                            </button>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-text-muted p-2 text-center">
                            <Icon icon="solar:gallery-wide-linear" width="22" className="opacity-40 mb-1" />
                            <span className="text-[9px] leading-tight">No custom cover</span>
                          </div>
                        )}
                      </div>

                      {/* Cover actions */}
                      <div className="space-y-2.5 flex-1 w-full">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => coverInputRef.current?.click()}
                            disabled={uploadingCover}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-3 hover:bg-surface-4 text-white border border-border/60 hover:border-text-muted flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            {uploadingCover ? (
                              <Icon icon="solar:spinner-line-duotone" className="animate-spin text-primary" width="14" />
                            ) : (
                              <Icon icon="solar:upload-track-2-bold" width="14" />
                            )}
                            <span>Upload Cover Photo</span>
                          </button>

                          {mediaAssets.some(m => m.mimeType?.startsWith('video/')) && (
                            <button
                              type="button"
                              onClick={handleCaptureVideoFrame}
                              disabled={uploadingCover}
                              title="Pause the video at the frame you like, then click here"
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-3 hover:bg-surface-4 text-white border border-border/60 hover:border-text-muted flex items-center gap-1.5 transition-colors disabled:opacity-50"
                            >
                              <Icon icon="solar:camera-bold" width="14" />
                              <span>Capture Paused Frame</span>
                            </button>
                          )}

                          {videoCoverUrl && (
                            <button
                              type="button"
                              onClick={() => setVideoCoverUrl('')}
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                            >
                              Remove Cover
                            </button>
                          )}
                        </div>

                        {/* URL input */}
                        <div className="flex items-center gap-2">
                          <input
                            type="url"
                            value={videoCoverUrl}
                            onChange={(e) => setVideoCoverUrl(e.target.value.trim())}
                            placeholder="Or enter public cover image URL..."
                            className="flex-1 bg-surface-1 border border-border/50 focus:border-primary/60 rounded-lg px-2.5 py-1 text-xs text-white placeholder-text-muted/60 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Universal Caption & Platform Tailoring Card */}
          <div className="bg-surface-1 rounded-2xl border border-border/60 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Icon icon="solar:pen-bold" className="text-primary" width="18" />
                  Post Copy & Captions
                </h3>
                <p className="text-xs text-text-muted">Master caption with real-time character meters</p>
              </div>

              <button
                type="button"
                onClick={handleGenerateAIVariations}
                disabled={generatingAI || !universalCaption.trim()}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-500/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {generatingAI ? (
                  <Icon icon="solar:spinner-line-duotone" className="animate-spin" width="14" />
                ) : (
                  <Icon icon="solar:magic-stick-3-bold" width="14" />
                )}
                <span>AI Adapt Per Platform</span>
              </button>
            </div>

            {/* Movie Anchor for Ensemble Cast Tagging & AI Caption Generation */}
            <div className="rounded-xl border border-white/10 bg-surface-2/70 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <Icon icon="solar:clapperboard-play-linear" className="text-primary" width="14" />
                  Link Movie for AI Ensemble & Cast @Handles (Optional)
                </span>
                {selectedMovieForCaption && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMovieForCaption(null);
                      setEnsembleInfo(null);
                    }}
                    className="text-[11px] font-bold text-red-400 hover:text-red-300 transition-colors"
                  >
                    Clear Film
                  </button>
                )}
              </div>

              <FilmSearchCombobox
                value={selectedMovieForCaption?.id || ''}
                onChange={handleSelectMovieForEnsemble}
                placeholder="Search film by title to load cast & crew @Instagram usernames…"
              />

              {selectedMovieForCaption && (
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-white/10">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-white">
                      {selectedMovieForCaption.title} {selectedMovieForCaption.year ? `(${selectedMovieForCaption.year})` : ''}
                    </span>
                    {ensembleInfo && (
                      <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
                        👥 {ensembleInfo.totalCredits} credits ({ensembleInfo.withInstagramCount} @handles)
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateEnsembleCaption}
                    disabled={isGeneratingEnsembleCaption}
                    className="px-3.5 py-1.5 text-xs font-black rounded-lg bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white shadow-md shadow-pink-500/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {isGeneratingEnsembleCaption ? (
                      <>
                        <Icon icon="solar:spinner-line-duotone" className="animate-spin" width="14" />
                        <span>Generating Caption with Cast @Tags…</span>
                      </>
                    ) : (
                      <>
                        <Icon icon="solar:magic-stick-3-bold" width="14" />
                        <span>✨ Generate Caption with Ensemble @Handles</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            <div>
              <input
                type="text"
                placeholder="Internal Post Title / Hook (optional)"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-surface-2 rounded-lg border border-border/50 text-white placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div className="space-y-2">
              <textarea
                rows={5}
                placeholder="Write your universal caption here... Mention cast, synopsis, release details, or debate hooks."
                value={universalCaption}
                onChange={e => setUniversalCaption(e.target.value)}
                className="w-full p-3.5 text-sm bg-surface-2 rounded-xl border border-border/50 text-white placeholder-text-muted focus:outline-none focus:border-primary transition-colors resize-y leading-relaxed font-sans"
              />

              {/* Character Limit Meters for each selected platform */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {selectedPlatforms.map(platformId => {
                  const config = PLATFORM_CONFIGS.find(p => p.id === platformId);
                  if (!config) return null;
                  const currentText = getCaptionForPlatform(platformId);
                  const length = currentText.length;
                  const max = config.limit;
                  const isOver = length > max;
                  const isNear = length > max * 0.85;

                  return (
                    <div
                      key={platformId}
                      className={`p-2 rounded-lg border bg-surface-2/60 text-xs flex items-center justify-between ${
                        isOver
                          ? 'border-red-500/60 text-red-400'
                          : isNear
                            ? 'border-amber-500/50 text-amber-300'
                            : 'border-border/30 text-text-muted'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Icon icon={config.icon} width="14" style={{ color: config.color }} />
                        <span className="truncate text-[11px] font-semibold">{config.label}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold shrink-0">
                        {length}/{max}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Per-Platform Customization Accordion */}
            <div className="pt-2 border-t border-border/30">
              <button
                type="button"
                onClick={() => setIsCustomizingPerPlatform(prev => !prev)}
                className="w-full flex items-center justify-between py-2 text-xs font-bold text-text-secondary hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon icon="solar:settings-minimalistic-bold" className="text-primary" width="16" />
                  <span>Customize Captions Individually Per Platform</span>
                  {isCustomizingPerPlatform && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/20 text-primary font-bold">
                      Active
                    </span>
                  )}
                </div>
                <Icon
                  icon={isCustomizingPerPlatform ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
                  width="14"
                />
              </button>

              {isCustomizingPerPlatform && (
                <div className="mt-3 space-y-3 bg-surface-2/40 p-4 rounded-xl border border-border/40">
                  <div className="flex flex-wrap gap-1.5 border-b border-border/30 pb-2.5">
                    {selectedPlatforms.map(platformId => {
                      const cfg = PLATFORM_CONFIGS.find(p => p.id === platformId);
                      const isCustomized = platformCaptions[platformId] !== undefined;
                      return (
                        <button
                          key={platformId}
                          type="button"
                          onClick={() => setActiveCustomPlatform(platformId)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 ${
                            activeCustomPlatform === platformId
                              ? 'bg-surface-3 text-white border-primary shadow-sm'
                              : 'bg-surface-2 text-text-muted border-border/30 hover:text-white'
                          }`}
                        >
                          <Icon icon={cfg?.icon || 'solar:share-linear'} width="14" style={{ color: cfg?.color }} />
                          <span>{cfg?.label}</span>
                          {isCustomized && (
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Custom Copy for</span>
                        <span className="text-primary">{PLATFORM_CONFIGS.find(p => p.id === activeCustomPlatform)?.label}</span>
                      </span>
                      {platformCaptions[activeCustomPlatform] !== undefined && (
                        <button
                          type="button"
                          onClick={() => resetPlatformCaptionToMaster(activeCustomPlatform)}
                          className="text-[11px] text-text-muted hover:text-red-400 transition-colors"
                        >
                          Revert to Master
                        </button>
                      )}
                    </div>

                    <textarea
                      rows={4}
                      value={getCaptionForPlatform(activeCustomPlatform)}
                      onChange={e => setCaptionForPlatform(activeCustomPlatform, e.target.value)}
                      className="w-full p-3 text-xs bg-surface-2 rounded-lg border border-border/50 text-white placeholder-text-muted focus:outline-none focus:border-primary transition-colors resize-y leading-relaxed font-sans"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4. Scheduling Bar Card */}
          <div className="bg-surface-1 rounded-2xl border border-border/60 p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Icon icon="solar:calendar-bold" className="text-primary" width="18" />
                Schedule Publishing
              </h3>
              <p className="text-xs text-text-muted">Choose an automated publication time</p>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applySchedulePreset(60)}
                  className="px-2.5 py-1 text-xs bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-white rounded-lg border border-border/40 transition-colors"
                >
                  ⚡ In 1 Hour
                </button>
                <button
                  type="button"
                  onClick={() => applySchedulePreset(null, '09:00')}
                  className="px-2.5 py-1 text-xs bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-white rounded-lg border border-border/40 transition-colors"
                >
                  🌅 Tomorrow 9:00 AM
                </button>
                <button
                  type="button"
                  onClick={() => applySchedulePreset(null, '12:00')}
                  className="px-2.5 py-1 text-xs bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-white rounded-lg border border-border/40 transition-colors"
                >
                  ☀️ Tomorrow 12:00 PM
                </button>
                <button
                  type="button"
                  onClick={() => applySchedulePreset(null, '15:30')}
                  className="px-2.5 py-1 text-xs bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-white rounded-lg border border-border/40 transition-colors"
                >
                  ☕ Tomorrow 3:30 PM
                </button>
                <button
                  type="button"
                  onClick={() => applySchedulePreset(null, '18:00')}
                  className="px-2.5 py-1 text-xs bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-white rounded-lg border border-border/40 transition-colors"
                >
                  🌆 Tomorrow 6:00 PM
                </button>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={e => setScheduledFor(e.target.value)}
                  className="px-3.5 py-2 text-xs bg-surface-2 rounded-lg border border-border/50 text-white focus:outline-none focus:border-primary transition-colors"
                />
                {scheduledFor && (
                  <button
                    type="button"
                    onClick={() => setScheduledFor('')}
                    className="text-xs text-text-muted hover:text-red-400 transition-colors"
                  >
                    Clear schedule
                  </button>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-text-muted">
                Publishing to <strong className="text-white">{selectedPlatforms.length}</strong> platforms
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleSubmit('schedule')}
                  disabled={isSubmitting || !scheduledFor}
                  className="flex-1 sm:flex-initial px-5 py-2.5 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <Icon icon="solar:calendar-mark-bold" width="16" />
                  <span>{parsed?.id ? 'Update Schedule' : 'Schedule Post'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit('publish_now')}
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-initial px-5 py-2.5 text-xs font-black text-white bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 rounded-xl shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-1.5"
                >
                  <Icon icon="solar:bolt-bold" width="16" />
                  Publish Now
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Native Device Mockup (5 cols) */}
        <div className="lg:col-span-5 space-y-4 sticky top-6">
          <div className="bg-surface-1 rounded-2xl border border-border/60 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-border/30 pb-3">
              <div className="flex items-center gap-1.5">
                <Icon icon="solar:smartphone-bold" className="text-primary" width="18" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">Live Phone Preview</span>
              </div>

              <div className="flex items-center gap-1">
                {selectedPlatforms.map(platformId => {
                  const cfg = PLATFORM_CONFIGS.find(p => p.id === platformId);
                  const isActive = previewPlatform === platformId;
                  return (
                    <button
                      key={platformId}
                      type="button"
                      onClick={() => setPreviewPlatform(platformId)}
                      title={`Preview on ${cfg?.label}`}
                      className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-white text-black shadow-md scale-105'
                          : 'bg-surface-2 text-text-muted hover:text-white'
                      }`}
                    >
                      <Icon icon={cfg?.icon || 'solar:share-linear'} width="15" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Simulated Mobile Device Frame */}
            <div className="mx-auto max-w-[340px] rounded-[36px] bg-[#0c0d0e] border-4 border-[#222] shadow-2xl overflow-hidden text-white font-sans">
              <div className="h-5 bg-black flex items-center justify-center">
                <div className="h-3 w-20 bg-[#222] rounded-full" />
              </div>

              <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-[#222] bg-[#111]">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-[10px] font-black">
                    M
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-black tracking-tight">muvidb_</span>
                      <Icon icon="solar:verified-check-bold" className="text-sky-400" width="12" />
                    </div>
                    <span className="text-[9px] text-[#888] block">
                      {activePreviewConfig?.label} Feed
                    </span>
                  </div>
                </div>
                <Icon icon="solar:menu-dots-bold" className="text-[#888]" width="16" />
              </div>

              <div className="relative bg-black min-h-[220px] max-h-[380px] flex items-center justify-center overflow-hidden">
                {mediaAssets.length > 0 ? (
                  mediaAssets[0].mimeType?.startsWith('video/') ? (
                    <video
                      src={mediaAssets[0].publicUrl}
                      poster={videoCoverUrl || undefined}
                      className="w-full h-full object-cover"
                      controls
                      playsInline
                    />
                  ) : (
                    <img
                      src={mediaAssets[0].publicUrl}
                      alt="Preview"
                      className="w-full h-full object-cover max-h-[340px]"
                    />
                  )
                ) : (
                  <div className="p-8 text-center space-y-2">
                    <Icon icon={activePreviewConfig.icon} width="36" className="mx-auto opacity-30" style={{ color: activePreviewConfig.color }} />
                    <p className="text-xs text-[#666] italic">Text-only post layout</p>
                  </div>
                )}

                {previewPlatform === 'tiktok' && (
                  <div className="absolute right-2 bottom-8 flex flex-col items-center gap-3 text-white">
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full bg-black/50 flex items-center justify-center">
                        <Icon icon="solar:heart-bold" className="text-red-500" width="18" />
                      </div>
                      <span className="text-[9px] mt-0.5">24.5K</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full bg-black/50 flex items-center justify-center">
                        <Icon icon="solar:chat-round-line-bold" width="18" />
                      </div>
                      <span className="text-[9px] mt-0.5">812</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full bg-black/50 flex items-center justify-center">
                        <Icon icon="solar:bookmark-bold" width="18" />
                      </div>
                      <span className="text-[9px] mt-0.5">1.2K</span>
                    </div>
                  </div>
                )}
              </div>

              {previewPlatform !== 'tiktok' && (
                <div className="px-3.5 py-2 flex items-center justify-between text-[#aaa] border-b border-[#222]">
                  <div className="flex items-center gap-3">
                    <Icon icon="solar:heart-linear" width="18" className="hover:text-red-500 cursor-pointer" />
                    <Icon icon="solar:chat-round-line-linear" width="18" />
                    <Icon icon={previewPlatform === 'x' ? 'ri:repeat-line' : 'solar:share-linear'} width="18" />
                  </div>
                  <Icon icon="solar:bookmark-linear" width="18" />
                </div>
              )}

              <div className="p-3.5 space-y-1.5 bg-[#0f1011] text-xs">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-bold text-white text-xs">muvidb_</span>
                  <p className="text-[#ccc] text-xs leading-relaxed line-clamp-4 whitespace-pre-wrap break-words">
                    {activePreviewCaption || <span className="text-[#555] italic">Your caption preview will appear here...</span>}
                  </p>
                </div>

                <div className="text-[10px] text-[#666] pt-1">
                  Just now • via MuviDB Social Studio
                </div>
              </div>

              <div className="h-4 bg-black flex items-center justify-center">
                <div className="h-1 w-24 bg-[#333] rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
