import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { authHeaders } from '../../lib/apiAuth';
import { uploadAdminSocialMedia } from '../../lib/imageUpload';
import SocialCanvasViewport from './SocialCanvasViewport';
import SocialVideoClipModal from './SocialVideoClipModal';

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
  { value: 'instagram', label: 'Instagram', icon: 'mdi:instagram', accent: 'from-fuchsia-500 via-red-500 to-amber-400' },
  { value: 'threads', label: 'Threads', icon: 'simple-icons:threads', accent: 'from-neutral-700 to-black' },
  { value: 'facebook', label: 'Facebook', icon: 'mdi:facebook', accent: 'from-blue-600 to-blue-800' },
  { value: 'tiktok', label: 'TikTok', icon: 'simple-icons:tiktok', accent: 'from-cyan-400 via-black to-pink-500' },
];

export const PLATFORM_SPECS = {
  instagram: {
    label: 'Instagram',
    optimalRatio: '4:5 (Feed) or 9:16 (Reels)',
    carouselSupport: 'Up to 10 items (Mixed images & videos)',
    videoSupport: 'Reels (9:16) up to 90s, Feed video up to 15 min',
    tips: 'Use 4:5 for standard feed posts, 9:16 for Reels.',
    icon: 'mdi:instagram',
  },
  threads: {
    label: 'Threads',
    optimalRatio: '1:1, 4:5, 9:16 (Any ratio)',
    carouselSupport: 'Up to 20 items (Mixed images & videos)',
    videoSupport: 'MP4 / WebM / MOV up to 5 min',
    tips: 'Supports up to 20 items in a single swipeable carousel.',
    icon: 'simple-icons:threads',
  },
  facebook: {
    label: 'Facebook',
    optimalRatio: '1:1 (Square) or 16:9 (Landscape)',
    carouselSupport: 'Up to 10 images (Photo-only carousels)',
    videoSupport: 'Single video post (MP4/WebM)',
    tips: 'Facebook carousels support photos only. Video posts are single video.',
    icon: 'mdi:facebook',
  },
  tiktok: {
    label: 'TikTok',
    optimalRatio: '9:16 (Vertical Video recommended)',
    carouselSupport: 'Up to 35 photos (Image-only photo mode)',
    videoSupport: 'Single 9:16 vertical video up to 10 min',
    tips: '9:16 vertical video performs best. Music can be auto-added.',
    icon: 'simple-icons:tiktok',
  },
};

const CAPTION_LIMITS = {
  instagram: 2200,
  threads: 500,
  facebook: 2000,
  tiktok: 2200,
};

const DEFAULT_TIKTOK_SETTINGS = {
  privacy_level: 'PUBLIC_TO_EVERYONE',
  post_mode: 'DIRECT_POST',
  disable_comment: false,
  disable_duet: false,
  disable_stitch: false,
  auto_add_music: true,
  brand_content_toggle: false,
  brand_organic_toggle: false,
  is_aigc: false,
  photo_cover_index: 0,
  video_cover_timestamp_ms: 1000,
};

function carouselLimitFor(platforms) {
  if (platforms.includes('instagram') || platforms.includes('facebook')) return 10;
  if (platforms.includes('threads')) return 20;
  if (platforms.includes('tiktok')) return 35;
  return 10;
}

function mediaTypeForFile(file) {
  return file?.type?.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file?.name || '') ? 'video' : 'image';
}

function readableNetworkError(error, action) {
  if (error instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(String(error?.message || ''))) {
    return `MuviDB could not reach the server while ${action}. Check your connection, then try again. Your draft is still saved.`;
  }
  return error?.message || `Could not finish ${action}. Your draft is still saved.`;
}

export default function SocialDraftComposer({
  disabled,
  onGenerated,
  initialDraft = null,
  onClearDraft = null,
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
  const [captionDrafts, setCaptionDrafts] = useState({});
  const [savingCaptionId, setSavingCaptionId] = useState(null);
  const [activePreviewPlatform, setActivePreviewPlatform] = useState('instagram');
  const [postFormat, setPostFormat] = useState('single');
  const [carouselAssets, setCarouselAssets] = useState([]);
  const [uploadingCustom, setUploadingCustom] = useState(false);
  const [uploadScope, setUploadScope] = useState('active'); // 'active' (target current channel) | 'all' (all selected channels)
  const [reorderingCarousel, setReorderingCarousel] = useState(false);
  const [replaceSlideIndex, setReplaceSlideIndex] = useState(null);
  const [scheduling, setScheduling] = useState(false);
  const [customScheduleDate, setCustomScheduleDate] = useState('');
  const [tiktokSettings, setTikTokSettings] = useState(DEFAULT_TIKTOK_SETTINGS);
  const [step1Open, setStep1Open] = useState(true);
  const [step2Open, setStep2Open] = useState(true);
  const [step3Open, setStep3Open] = useState(true);
  const [viewLayout, setViewLayout] = useState('split'); // 'split' | 'canvas_focus' | 'caption_focus'
  const [videoStudioOpen, setVideoStudioOpen] = useState(false);
  const [canvasAspectRatio, setCanvasAspectRatio] = useState('9:16');
  const [newTagInput, setNewTagInput] = useState('');
  const fileInputRef = useRef(null);
  const searchToken = useRef(0);

  const handleAttachRenderedVideo = async (renderedAsset) => {
    if (!renderedAsset?.public_url && !renderedAsset?.url && !renderedAsset?.publicUrl) return false;
    const videoUrl = renderedAsset.public_url || renderedAsset.url || renderedAsset.publicUrl;
    const ratio = renderedAsset.aspectRatio || '9:16';
    const platformTargets = {
      '1:1': ['instagram', 'facebook', 'threads'],
      '4:5': ['instagram', 'facebook'],
      '9:16': ['instagram', 'facebook', 'tiktok'],
      '16:9': ['facebook', 'threads'],
    };
    const targetPlatforms = platformTargets[ratio] || ['instagram', 'tiktok'];
    const dimensions = {
      '1:1': { width: 1080, height: 1080, format: 'square_1_1' },
      '4:5': { width: 1080, height: 1350, format: 'portrait_4_5' },
      '9:16': { width: 1080, height: 1920, format: 'video_vertical_9_16' },
      '16:9': { width: 1920, height: 1080, format: 'landscape_16_9' },
    };
    const targetDimensions = dimensions[ratio] || dimensions['9:16'];
    const contentItemId = result?.contentItem?.id;
    const matchingVariants = (result?.variants || []).filter(variant => targetPlatforms.includes(variant.platform));

    if (!contentItemId || !matchingVariants.length) {
      toast.error('Generate the social draft and select a compatible platform before attaching the clip.');
      return false;
    }

    let attachments = [];
    try {
      attachments = await Promise.all(matchingVariants.map(async variant => {
        const response = await fetch('/api/social?task=attach_custom_asset', {
          method: 'POST',
          headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentItemId,
            variantId: variant.id,
            publicUrl: videoUrl,
            format: targetDimensions.format,
            width: targetDimensions.width,
            height: targetDimensions.height,
            driveFileId: renderedAsset.driveFileId || renderedAsset.drive_file_id,
            aspectRatio: ratio,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Could not attach the clip to ${variant.platform}`);
        return { variantId: variant.id, assetId: data.id };
      }));
    } catch (error) {
      toast.error(error.message || 'The clip was rendered but could not be attached to the draft.');
      return false;
    }
    const attachedAssetIds = new Map(attachments.map(entry => [entry.variantId, entry.assetId]));

    const newAsset = {
      id: `rendered_video_${Date.now()}`,
      publicUrl: videoUrl,
      public_url: videoUrl,
      mediaType: 'video',
      format: 'custom_video',
      width: targetDimensions.width,
      height: targetDimensions.height,
      aspectRatio: ratio,
      driveFileId: renderedAsset.driveFileId || renderedAsset.drive_file_id,
      drive_file_id: renderedAsset.driveFileId || renderedAsset.drive_file_id,
    };

    setResult(prev => {
      if (!prev) return prev;
      const updatedAssets = [newAsset, ...(prev.assets || []).filter(a => a.mediaType !== 'video')];
      const updatedVariants = (prev.variants || []).map(v => {
        if (!targetPlatforms.includes(v.platform)) return v;

        return {
          ...v,
          selected_asset_id: attachedAssetIds.get(v.id) || v.selected_asset_id,
          media_urls: [videoUrl],
          drive_file_id: renderedAsset.driveFileId || renderedAsset.drive_file_id || v.drive_file_id,
          platform_options: {
            ...(v.platform_options || {}),
            video_url: videoUrl,
            asset_url: videoUrl,
            drive_file_id: renderedAsset.driveFileId || renderedAsset.drive_file_id,
            aspect_ratio: ratio,
            asset_format: targetDimensions.format,
            post_format: 'single',
          },
        };
      });
      return {
        ...prev,
        assets: updatedAssets,
        variants: updatedVariants,
      };
    });

    setCanvasAspectRatio(ratio);
    const platformNames = matchingVariants.map(variant => variant.platform).join(', ');
    toast.success(`🎬 ${ratio} clip attached to ${platformNames}!`);
    return true;
  };

  const handleCanvasCutVideo = async (cutData) => {
    setVideoStudioOpen(true);
  };

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
  const carouselLimit = carouselLimitFor(platforms);

  // Load draft when opened for editing from the Queue / Calendar
  useEffect(() => {
    if (!initialDraft) return;
    const variants = initialDraft.social_platform_variants || initialDraft.variants || [];
    const rawAssets = initialDraft.social_assets || initialDraft.assets || [];
    const normalizedAssets = rawAssets.map(a => ({
      id: a.id,
      publicUrl: a.public_url || a.publicUrl,
      format: a.format,
      mediaType: a.format?.includes('video') || a.media_type === 'video' ? 'video' : 'image',
      width: a.width || 1080,
      height: a.height || 1080,
    }));

    const activeVariantsList = variants.map(v => ({
      ...v,
      platform_options: v.platform_options || {},
      hashtags: v.hashtags || [],
    }));

    const composerResult = {
      contentItem: initialDraft,
      variants: activeVariantsList,
      assets: normalizedAssets,
    };

    setResult(composerResult);
    setCaptionDrafts(Object.fromEntries(activeVariantsList.map(v => [v.id, v.caption || ''])));

    const firstVariant = activeVariantsList[0];
    if (firstVariant) {
      setActivePreviewPlatform(firstVariant.platform);
      const format = firstVariant.platform_options?.post_format || 'single';
      setPostFormat(format);
      setCarouselAssets(firstVariant.platform_options?.carousel_assets || []);
    }

    setPlatforms(activeVariantsList.map(v => v.platform));
    setStep1Open(false);
    setStep2Open(false);
    setStep3Open(true);
  }, [initialDraft]);

  // 1. Cross-tab real-time listener from OpenCut Studio
  useEffect(() => {
    const handleStudioMessage = (event) => {
      if (event.data?.type === 'OPEN_CUT_RENDER_COMPLETE') {
        const { draftId, variantId, publicUrl, assetId, width, height, format } = event.data;

        const isVideo = Boolean(publicUrl && (
          /\.(mp4|mov|webm|m4v)(\?.*)?$/i.test(publicUrl) ||
          publicUrl.startsWith('blob:') ||
          format?.includes('video') ||
          format?.includes('render') ||
          format?.includes('custom') ||
          format?.includes('9:16') ||
          format?.includes('1:1')
        ));
        const newAsset = {
          id: assetId || publicUrl,
          publicUrl,
          mediaType: isVideo ? 'video' : 'image',
          format: format || 'custom_render',
          width: width || 1080,
          height: height || 1080,
        };

        setResult(curr => {
          if (!curr) return curr;
          const updatedAssets = [newAsset, ...(curr.assets || []).filter(a => a.id !== newAsset.id && a.publicUrl !== publicUrl)];
          const updatedVariants = (curr.variants || []).map(v => {
            if (!variantId || v.id === variantId) {
              return {
                ...v,
                selected_asset_id: newAsset.id,
                selected_asset: newAsset,
              };
            }
            return v;
          });
          return { ...curr, assets: updatedAssets, variants: updatedVariants };
        });

        toast.success('✨ Rendered asset from Studio attached to draft!');
      }
    };

    window.addEventListener('message', handleStudioMessage);
    return () => window.removeEventListener('message', handleStudioMessage);
  }, []);

  // 2. Persist working state into sessionStorage so returning via URL or tab refresh restores everything
  useEffect(() => {
    if (result && result.contentItem) {
      try {
        const stateToSave = {
          result,
          captionDrafts,
          platforms,
          activePreviewPlatform,
          postFormat,
          carouselAssets,
          tiktokSettings,
          customScheduleDate,
          selected,
          themeId,
        };
        sessionStorage.setItem('muvidb_social_composer_cache', JSON.stringify(stateToSave));
      } catch {
        // quota or privacy mode
      }
    }
  }, [result, captionDrafts, platforms, activePreviewPlatform, postFormat, carouselAssets, tiktokSettings, customScheduleDate, selected, themeId]);

  // 3. Restore cached working draft if available on initial mount without initialDraft prop
  useEffect(() => {
    if (!initialDraft) {
      try {
        const cached = sessionStorage.getItem('muvidb_social_composer_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.result?.contentItem) {
            setResult(parsed.result);
            if (parsed.captionDrafts) setCaptionDrafts(parsed.captionDrafts);
            if (parsed.platforms) setPlatforms(parsed.platforms);
            if (parsed.activePreviewPlatform) setActivePreviewPlatform(parsed.activePreviewPlatform);
            if (parsed.postFormat) setPostFormat(parsed.postFormat);
            if (parsed.carouselAssets) setCarouselAssets(parsed.carouselAssets);
            if (parsed.tiktokSettings) setTikTokSettings(parsed.tiktokSettings);
            if (parsed.customScheduleDate) setCustomScheduleDate(parsed.customScheduleDate);
            if (parsed.selected) setSelected(parsed.selected);
            if (parsed.themeId) setThemeId(parsed.themeId);
            setStep1Open(false);
            setStep2Open(false);
            setStep3Open(true);
          }
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const handleOpenInStudio = (mediaUrl = null, customRatio = null) => {
    if (customRatio) setCanvasAspectRatio(customRatio);
    setVideoStudioOpen(true);
    toast('🎬 YouTube & Video Clip Studio ready! Set timecodes, preview loop, and import directly to canvas.', { icon: '🎬' });
  };

  const handleImportVideoToCanvas = (clipData) => {
    if (!clipData || !clipData.url) return;
    const newAsset = {
      id: `clip-${Date.now()}`,
      publicUrl: clipData.url,
      public_url: clipData.url,
      mediaType: 'video',
      format: clipData.isRenderedMp4 ? 'custom_video' : (clipData.mode === 'clip' ? 'video_clip' : 'full_video'),
      title: clipData.title || 'Video Clip',
      startTime: clipData.startTime || 0,
      endTime: clipData.endTime || clipData.duration || 0,
      duration: clipData.duration || 0,
      width: clipData.aspectRatio === '9:16' ? 1080 : 1920,
      height: clipData.aspectRatio === '9:16' ? 1920 : 1080,
    };

    setResult(curr => {
      if (!curr) {
        return {
          assets: [newAsset],
          variants: (platforms || ['tiktok', 'instagram']).map(p => ({
            platform: p,
            selected_asset_id: newAsset.id,
            selected_asset: newAsset,
            platform_options: {
              video_url: clipData.url,
              asset_url: clipData.url,
              post_format: 'single',
            },
          })),
        };
      }
      const updatedAssets = [newAsset, ...(curr.assets || []).filter(a => a.id !== newAsset.id)];
      const updatedVariants = (curr.variants || []).map(v => {
        if (!activePreviewPlatform || v.platform === activePreviewPlatform) {
          return {
            ...v,
            selected_asset_id: newAsset.id,
            selected_asset: newAsset,
            platform_options: {
              ...(v.platform_options || {}),
              video_url: clipData.url,
              asset_url: clipData.url,
              post_format: 'single',
            },
          };
        }
        return v;
      });
      return { ...curr, assets: updatedAssets, variants: updatedVariants };
    });

    if (clipData.aspectRatio) {
      setCanvasAspectRatio(clipData.aspectRatio);
    }
    setPostFormat('single');
    toast.success(`🎬 Attached video clip (${clipData.formattedStart || '00:00'} - ${clipData.formattedEnd || ''}) to draft!`);
  };

  const handleResetComposer = () => {
    try {
      sessionStorage.removeItem('muvidb_social_composer_cache');
    } catch {}
    setResult(null);
    setSelected(null);
    setResults([]);
    setQuery('');
    setCaptionDrafts({});
    setPostFormat('single');
    setCarouselAssets([]);
    setStep1Open(true);
    setStep2Open(true);
    setStep3Open(true);
    onClearDraft?.();
    onClearSlot?.();
    toast.success('Composer reset. Ready for a new post.');
  };

  useEffect(() => {
    if (initialDraft) return; // preserve draft if editing
    setSelected(null);
    setResults([]);
    setQuery('');
    setResult(null);
    setCaptionDrafts({});
    setPostFormat('single');
    setCarouselAssets([]);
  }, [themeId]);

  useEffect(() => {
    if (result?.variants?.length && !result.variants.some(variant => variant.platform === activePreviewPlatform)) {
      setActivePreviewPlatform(result.variants[0].platform);
    }
  }, [result, activePreviewPlatform]);

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
    setCarouselAssets([]);
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

      const normalized = {
        ...data,
        variants: (data.variants || []).map(variant => ({
          ...variant,
          hashtags: Array.isArray(variant.hashtags) ? variant.hashtags.slice(0, 3) : [],
        })),
      };
      setResult(normalized);
      const tiktokVariant = normalized.variants.find(variant => variant.platform === 'tiktok');
      setTikTokSettings({
        ...DEFAULT_TIKTOK_SETTINGS,
        ...(tiktokVariant?.platform_options?.tiktok || {}),
      });
      setCaptionDrafts(Object.fromEntries(normalized.variants.map(variant => [variant.id, variant.caption || ''])));
      setActivePreviewPlatform(normalized.variants?.[0]?.platform || platforms[0] || 'instagram');
      toast.success(`Draft generated with ${normalized.variants?.length || 0} variant(s)!`);
      onGenerated?.(normalized);
    } catch (err) {
      toast.error(err.message || 'Draft generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleCustomImageUpload = async event => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !result?.contentItem?.id) {
      setReplaceSlideIndex(null);
      return;
    }
    setUploadingCustom(true);
    try {
      const isCarouselMode = activeVariantPostFormat === 'carousel';
      const currentList = activeVariantCarouselAssets;
      if (isCarouselMode) {
        if (replaceSlideIndex !== null && files.length !== 1) {
          throw new Error('Choose one file to replace this carousel item');
        }
        const projectedCount = replaceSlideIndex === null
          ? currentList.length + files.length
          : currentList.length;
        if (projectedCount > carouselLimit) {
          throw new Error(`Platform limit reached (max ${carouselLimit} items)`);
        }

        const uploadedAssets = [];
        for (const file of files) {
          const uploadRes = await uploadAdminSocialMedia(file, 'social-published-assets');
          if (uploadRes.error) throw new Error(`${file.name}: ${uploadRes.error}`);
          uploadedAssets.push({
            id: uploadRes.url,
            publicUrl: uploadRes.url,
            mediaType: uploadRes.mediaType || mediaTypeForFile(file),
            altText: '',
          });
        }

        const nextAssets = replaceSlideIndex === null
          ? [...currentList, ...uploadedAssets]
          : currentList.map((asset, index) => index === replaceSlideIndex ? uploadedAssets[0] : asset);

        const targetVariantId = uploadScope === 'active' ? activeVariant?.id : undefined;
        const res = await fetch('/api/social?task=attach_carousel_assets', {
          method: 'POST',
          headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentItemId: result.contentItem.id,
            variantId: targetVariantId,
            assets: nextAssets.map(asset => ({
              url: asset.publicUrl,
              mediaType: asset.mediaType,
              altText: asset.altText || '',
            })),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

        const attached = (data.assets || []).map((asset, index) => ({
          id: asset.id,
          publicUrl: asset.publicUrl || asset.public_url,
          mediaType: asset.mediaType || 'image',
          altText: asset.altText || '',
          format: asset.mediaType === 'video' ? 'carousel_video' : 'carousel_image',
          width: asset.width || 1080,
          height: asset.height || 1080,
          position: index,
        }));
        setCarouselAssets(attached);

        const newMediaAssets = uploadedAssets.map(u => ({
          id: u.publicUrl,
          publicUrl: u.publicUrl,
          mediaType: u.mediaType,
          format: u.mediaType === 'video' ? 'custom_video' : 'custom_design',
        }));

        setResult(curr => ({
          ...curr,
          assets: [...newMediaAssets, ...(curr?.assets || [])],
          variants: (curr?.variants || []).map(variant => (
            (!targetVariantId || variant.id === targetVariantId)
              ? {
                  ...variant,
                  platform_options: {
                    ...(variant.platform_options || {}),
                    post_format: 'carousel',
                    carousel_assets: attached,
                    carousel_asset_urls: attached.map(a => a.publicUrl),
                  },
                }
              : variant
          )),
        }));

        toast.success(replaceSlideIndex === null
          ? `${attached.length}-item carousel updated for ${targetVariantId ? activePlatform.label : 'all channels'}`
          : `Carousel item ${replaceSlideIndex + 1} replaced`);
        setReplaceSlideIndex(null);
        return;
      }

      const uploadRes = await uploadAdminSocialMedia(files[0], 'social-published-assets');
      if (uploadRes.error) throw new Error(uploadRes.error);
      const url = uploadRes.url;

      const targetVariantId = uploadScope === 'active' ? activeVariant?.id : undefined;
      const res = await fetch('/api/social?task=attach_custom_asset', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentItemId: result.contentItem.id,
          variantId: targetVariantId,
          publicUrl: url,
          format: uploadRes.mediaType === 'video' ? 'video_vertical_9_16' : 'square_1_1',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      toast.success(`${uploadRes.mediaType === 'video' ? 'Video' : 'Custom artwork'} uploaded for ${targetVariantId ? activePlatform.label : 'all channels'}!`);
      const newCustomAsset = { id: data.id, publicUrl: url, mediaType: uploadRes.mediaType || 'image', format: uploadRes.mediaType === 'video' ? 'custom_video' : 'custom_design', width: data.width || 1080, height: data.height || 1080 };
      setResult(curr => ({
        ...curr,
        assets: [
          newCustomAsset,
          ...(curr?.assets || []),
        ],
        variants: (curr?.variants || []).map(variant => (
          (!targetVariantId || variant.id === targetVariantId)
            ? {
                ...variant,
                selected_asset_id: data.id,
                platform_options: {
                  ...(variant.platform_options || {}),
                  post_format: 'single',
                  carousel_assets: [],
                  carousel_asset_urls: [],
                },
              }
            : variant
        )),
      }));
      onGenerated?.({ ...result, assets: [newCustomAsset, ...(result.assets || [])] });
    } catch (err) {
      toast.error(err.message || 'Failed to upload custom media');
    } finally {
      setUploadingCustom(false);
      setReplaceSlideIndex(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const persistCaption = async (variant, caption, { notify = true } = {}) => {
    if (!variant?.id) return;
    const cleanCaption = String(caption || '').trim();
    if (!cleanCaption) throw new Error('Caption cannot be empty');

    const limit = CAPTION_LIMITS[variant.platform] || 2200;
    if (cleanCaption.length > limit) {
      throw new Error(`${variant.platform} captions cannot exceed ${limit} characters`);
    }

    setSavingCaptionId(variant.id);
    try {
      const res = await fetch('/api/social?task=update_variant_caption', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId: variant.id, caption: cleanCaption }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setResult(current => ({
        ...current,
        variants: (current?.variants || []).map(entry => (
          entry.id === variant.id ? { ...entry, caption: cleanCaption } : entry
        )),
      }));
      setCaptionDrafts(current => ({ ...current, [variant.id]: cleanCaption }));
      if (notify) toast.success(`${variant.platform} caption saved`);
    } finally {
      setSavingCaptionId(null);
    }
  };

  const savePendingCaptions = async () => {
    const changed = (result?.variants || []).filter(variant => (
      (captionDrafts[variant.id] ?? variant.caption ?? '').trim() !== String(variant.caption || '').trim()
    ));
    for (const variant of changed) {
      await persistCaption(variant, captionDrafts[variant.id], { notify: false });
    }
  };

  const persistTikTokSettings = async () => {
    const variant = result?.variants?.find(entry => entry.platform === 'tiktok');
    if (!variant) return;
    const res = await fetch('/api/social?task=update_variant_options', {
      method: 'POST',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ variantId: variant.id, options: { tiktok: tiktokSettings } }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `TikTok settings could not be saved (HTTP ${res.status})`);
    setResult(current => ({
      ...current,
      variants: (current?.variants || []).map(entry => entry.id === variant.id
        ? { ...entry, platform_options: data.platformOptions }
        : entry),
    }));
  };

  const handleSchedule = async (preset, customValue) => {
    if (!result?.contentItem?.id) return;
    if (postFormat === 'carousel' && carouselAssets.length < 2) {
      return toast.error('Add at least 2 media items before scheduling this carousel');
    }
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
      await savePendingCaptions();
      await persistTikTokSettings();
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
      onGenerated?.(result, { action: 'scheduled' });
    } catch (err) {
      toast.error(readableNetworkError(err, 'scheduling this post'), { duration: 7000 });
    } finally {
      setScheduling(false);
    }
  };

  const persistCarouselAssets = async (next, successMessage) => {
    const targetVariantId = uploadScope === 'active' ? activeVariant?.id : undefined;
    const res = await fetch('/api/social?task=attach_carousel_assets', {
      method: 'POST',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentItemId: result.contentItem.id,
        variantId: targetVariantId,
        assets: next.map(asset => ({
          url: asset.publicUrl,
          mediaType: asset.mediaType,
          altText: asset.altText || '',
        })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    const normalized = next.map((asset, index) => ({ ...asset, position: index }));
    setCarouselAssets(normalized);

    setResult(curr => ({
      ...curr,
      variants: (curr?.variants || []).map(variant => (
        (!targetVariantId || variant.id === targetVariantId)
          ? {
              ...variant,
              platform_options: {
                ...(variant.platform_options || {}),
                post_format: 'carousel',
                carousel_assets: normalized,
                carousel_asset_urls: normalized.map(a => a.publicUrl),
              },
            }
          : variant
      )),
    }));

    if (successMessage) toast.success(successMessage);
  };

  const moveCarouselSlide = async (fromIndex, direction) => {
    const list = activeVariantCarouselAssets.length > 0 ? activeVariantCarouselAssets : carouselAssets;
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= list.length || reorderingCarousel) return;
    const previous = list;
    const next = [...list];
    [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
    setCarouselAssets(next);
    setReorderingCarousel(true);
    try {
      await persistCarouselAssets(next);
    } catch (err) {
      setCarouselAssets(previous);
      toast.error(err.message || 'Could not change the slide order');
    } finally {
      setReorderingCarousel(false);
    }
  };

  const removeCarouselSlide = async index => {
    const list = activeVariantCarouselAssets.length > 0 ? activeVariantCarouselAssets : carouselAssets;
    if (list.length <= 2) {
      toast.error('A carousel must keep at least 2 items. Switch to Single post or add another item first.');
      return;
    }
    const removed = list[index];
    const next = list.filter((_, itemIndex) => itemIndex !== index);
    setReorderingCarousel(true);
    try {
      await persistCarouselAssets(next, `${removed.mediaType === 'video' ? 'Video' : 'Image'} removed from carousel`);
    } catch (err) {
      toast.error(err.message || 'Could not remove this carousel item');
    } finally {
      setReorderingCarousel(false);
    }
  };

  const saveCarouselAltText = async (index, altText) => {
    const list = activeVariantCarouselAssets.length > 0 ? activeVariantCarouselAssets : carouselAssets;
    const next = list.map((asset, itemIndex) => itemIndex === index ? { ...asset, altText } : asset);
    setCarouselAssets(next);
    try {
      await persistCarouselAssets(next);
    } catch (err) {
      toast.error(err.message || 'Could not save the media description');
    }
  };

  const label = entry => (activeTheme.entity === 'person' ? entry.name : `${entry.title}${entry.year ? ` (${entry.year})` : ''}`);
  const activeVariant = result?.variants?.find(variant => variant.platform === activePreviewPlatform) || result?.variants?.[0];
  const activePlatform = PLATFORMS.find(platform => platform.value === activeVariant?.platform) || PLATFORMS[0];
  const activeSpec = PLATFORM_SPECS[activeVariant?.platform] || PLATFORM_SPECS.instagram;
  const activeCaption = activeVariant
    ? (captionDrafts[activeVariant.id] ?? activeVariant.caption ?? '')
    : '';
  const captionIsDirty = Boolean(activeVariant)
    && activeCaption.trim() !== String(activeVariant.caption || '').trim();
  const activeCaptionLimit = CAPTION_LIMITS[activeVariant?.platform] || 2200;
  const selectedSingleAsset = result?.assets?.find(asset => asset.id === activeVariant?.selected_asset_id)
    || result?.assets?.find(asset => asset.format === 'custom_design')
    || result?.assets?.[0];

  const activeVariantPostFormat = activeVariant?.platform_options?.post_format
    || (Array.isArray(activeVariant?.platform_options?.carousel_assets) && activeVariant.platform_options.carousel_assets.length > 1 ? 'carousel' : postFormat);

  const activeVariantCarouselAssets = Array.isArray(activeVariant?.platform_options?.carousel_assets) && activeVariant.platform_options.carousel_assets.length > 0
    ? activeVariant.platform_options.carousel_assets
    : (activeVariantPostFormat === 'carousel' ? carouselAssets : []);

  const activeVisualAssets = activeVariantPostFormat === 'carousel' && activeVariantCarouselAssets.length > 0
    ? activeVariantCarouselAssets
    : selectedSingleAsset ? [selectedSingleAsset] : [];

  // Automatically sync post format and aspect ratio with active platform variant's settings
  useEffect(() => {
    if (!activeVariant) return;
    const vFormat = activeVariant?.platform_options?.post_format
      || (Array.isArray(activeVariant?.platform_options?.carousel_assets) && activeVariant.platform_options.carousel_assets.length > 1 ? 'carousel' : 'single');
    setPostFormat(vFormat);
    if (Array.isArray(activeVariant?.platform_options?.carousel_assets) && activeVariant.platform_options.carousel_assets.length > 0) {
      setCarouselAssets(activeVariant.platform_options.carousel_assets);
    }

    const currentAsset = result?.assets?.find(a => a.id === activeVariant.selected_asset_id);
    const format = activeVariant.platform_options?.asset_format || currentAsset?.format;
    if (format === 'portrait_4_5') {
      setCanvasAspectRatio('4:5');
    } else if (format === 'vertical_9_16' || format === 'video_vertical_9_16' || format === 'custom_video') {
      setCanvasAspectRatio('9:16');
    } else if (format === 'landscape_16_9') {
      setCanvasAspectRatio('16:9');
    } else if (format === 'square_1_1') {
      setCanvasAspectRatio('1:1');
    } else {
      if (activeVariant.platform === 'tiktok') setCanvasAspectRatio('9:16');
      else if (activeVariant.platform === 'instagram') setCanvasAspectRatio('4:5');
      else setCanvasAspectRatio('1:1');
    }
  }, [activeVariant?.id, activeVariant?.platform, activeVariant?.selected_asset_id, activeVariant?.platform_options?.post_format]);

  const handleSetPostFormat = async (targetFormat) => {
    setPostFormat(targetFormat);
    if (!activeVariant?.id) return;
    const targetVariantId = uploadScope === 'active' ? activeVariant.id : undefined;

    let initialCarousel = activeVariantCarouselAssets;
    let selectedAssetId = activeVariant.selected_asset_id;

    if (targetFormat === 'carousel') {
      if (initialCarousel.length < 2) {
        const available = result?.assets || [];
        if (available.length >= 2) {
          initialCarousel = available.slice(0, 2).map((a, i) => ({
            id: a.id || a.publicUrl,
            publicUrl: a.publicUrl,
            mediaType: a.mediaType || (a.format === 'custom_video' || a.format === 'video_vertical_9_16' ? 'video' : 'image'),
            altText: '',
            position: i,
          }));
        } else if (available.length === 1) {
          initialCarousel = [{
            id: available[0].id || available[0].publicUrl,
            publicUrl: available[0].publicUrl,
            mediaType: available[0].mediaType || (available[0].format === 'custom_video' || available[0].format === 'video_vertical_9_16' ? 'video' : 'image'),
            altText: '',
            position: 0,
          }];
        }
      }
      setCarouselAssets(initialCarousel);
    } else {
      // Switching to single: pick first slide as the single asset
      const firstSlide = activeVariantCarouselAssets[0];
      const match = (result?.assets || []).find(a => a.publicUrl === firstSlide?.publicUrl || a.id === firstSlide?.id) || result?.assets?.[0];
      if (match) selectedAssetId = match.id;
    }

    setResult(curr => ({
      ...curr,
      variants: (curr?.variants || []).map(v => (!targetVariantId || v.id === targetVariantId)
        ? {
            ...v,
            selected_asset_id: selectedAssetId,
            platform_options: {
              ...(v.platform_options || {}),
              post_format: targetFormat,
              ...(targetFormat === 'carousel'
                ? {
                    carousel_assets: initialCarousel,
                    carousel_asset_urls: initialCarousel.map(a => a.publicUrl),
                  }
                : {}),
            },
          }
        : v),
    }));

    try {
      await fetch('/api/social?task=update_variant_options', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: activeVariant.id,
          options: {
            ...(activeVariant.platform_options || {}),
            post_format: targetFormat,
            ...(targetFormat === 'carousel'
              ? {
                  carousel_assets: initialCarousel,
                  carousel_asset_urls: initialCarousel.map(a => a.publicUrl),
                }
              : {}),
          },
        }),
      });

      if (targetFormat === 'carousel' && initialCarousel.length >= 2) {
        await persistCarouselAssets(initialCarousel);
      } else if (targetFormat === 'single') {
        await fetch('/api/social?task=update_variant_asset', {
          method: 'POST',
          headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            variantId: activeVariant.id,
            selectedAssetId,
          }),
        });
      }

      toast.success(`${uploadScope === 'active' ? activePlatform.label : 'All channels'} format set to ${targetFormat === 'carousel' ? 'Carousel' : 'Single post'}`);
    } catch (err) {
      console.warn('Failed to update variant post format:', err.message);
    }
  };

  const handleAspectRatioSelect = async (ratioId) => {
    setCanvasAspectRatio(ratioId);
    if (!activeVariant?.id) return;

    const formatMap = {
      '1:1': 'square_1_1',
      '4:5': 'portrait_4_5',
      '9:16': 'vertical_9_16',
      '16:9': 'landscape_16_9',
    };
    const targetFormat = formatMap[ratioId];

    // Check if the current variant or draft is using a custom uploaded video or image
    const currentAsset = (result?.assets || []).find(a => a.id === activeVariant.selected_asset_id);
    const isCustomUpload = currentAsset?.format === 'custom_video'
      || currentAsset?.format === 'custom_design'
      || currentAsset?.format === 'video_vertical_9_16'
      || currentAsset?.mediaType === 'video';

    // If custom media, preserve the uploaded asset; otherwise use matching template format
    let selectedAssetId = activeVariant.selected_asset_id;
    if (!isCustomUpload) {
      const matchingAsset = (result?.assets || []).find(a => a.format === targetFormat);
      if (matchingAsset) selectedAssetId = matchingAsset.id;
    }

    setResult(curr => ({
      ...curr,
      variants: (curr?.variants || []).map(v => v.id === activeVariant.id
        ? {
            ...v,
            selected_asset_id: selectedAssetId,
            platform_options: {
              ...(v.platform_options || {}),
              asset_format: targetFormat,
              canvas_ratio: ratioId,
            },
          }
        : v),
    }));

    try {
      await fetch('/api/social?task=update_variant_asset', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: activeVariant.id,
          selectedAssetId,
          format: targetFormat,
        }),
      });
      toast.success(`${activePlatform.label} format set to ${ratioId}`);
    } catch (err) {
      console.warn('Failed to update aspect ratio on variant:', err.message);
    }
  };

  const handleSelectAssetForActivePlatform = async (asset) => {
    if (!activeVariant?.id) return;
    const targetVariantId = uploadScope === 'active' ? activeVariant.id : undefined;

    if (activeVariantPostFormat === 'carousel') {
      const currentList = activeVariantCarouselAssets;
      const existingIndex = currentList.findIndex(a => a.id === asset.id || a.publicUrl === asset.publicUrl);
      if (existingIndex >= 0) {
        if (currentList.length <= 2) {
          toast.error('A carousel needs at least 2 items. Switch to Single post or add another item first.');
          return;
        }
        await removeCarouselSlide(existingIndex);
      } else {
        if (currentList.length >= carouselLimit) {
          toast.error(`Platform limit reached (max ${carouselLimit} items)`);
          return;
        }
        const newSlide = {
          id: asset.id || asset.publicUrl,
          publicUrl: asset.publicUrl,
          mediaType: asset.mediaType || (asset.format === 'custom_video' || asset.format === 'video_vertical_9_16' ? 'video' : 'image'),
          altText: '',
          position: currentList.length,
        };
        const nextList = [...currentList, newSlide];
        await persistCarouselAssets(nextList, `Added to ${activePlatform.label} carousel (Slide ${nextList.length})`);
      }
      return;
    }

    // Single post mode:
    setResult(curr => ({
      ...curr,
      variants: (curr?.variants || []).map(v => (!targetVariantId || v.id === targetVariantId)
        ? {
            ...v,
            selected_asset_id: asset.id,
            platform_options: {
              ...(v.platform_options || {}),
              asset_format: asset.format || 'square_1_1',
              post_format: 'single',
            },
          }
        : v),
    }));

    try {
      await fetch('/api/social?task=update_variant_asset', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: activeVariant.id,
          selectedAssetId: asset.id,
          format: asset.format || 'square_1_1',
        }),
      });
      toast.success(`Assigned ${asset.mediaType === 'video' ? 'video' : 'artwork'} to ${uploadScope === 'active' ? activePlatform.label : 'all channels'}`);
    } catch (err) {
      console.warn('Failed to assign asset:', err.message);
    }
  };

  const activeMentions = activeVariant?.mentions || activeVariant?.platform_options?.mentions || [];

  const handleAddTag = async (tagText) => {
    let clean = String(tagText || newTagInput || '').trim();
    if (!clean) return;
    if (!clean.startsWith('@')) clean = '@' + clean;
    clean = clean.replace(/[^a-zA-Z0-9_@.]/g, '');
    if (!clean || clean === '@') return;
    if (activeMentions.includes(clean)) {
      setNewTagInput('');
      return;
    }
    const nextMentions = [...activeMentions, clean];
    setNewTagInput('');

    setResult(curr => ({
      ...curr,
      variants: (curr?.variants || []).map(v => v.id === activeVariant.id
        ? {
            ...v,
            mentions: nextMentions,
            platform_options: { ...(v.platform_options || {}), mentions: nextMentions },
          }
        : v),
    }));

    try {
      await fetch('/api/social?task=update_variant_options', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: activeVariant.id,
          options: { ...(activeVariant.platform_options || {}), mentions: nextMentions },
        }),
      });
      toast.success(`Tagged ${clean}`);
    } catch (err) {
      console.warn('Could not save tags:', err.message);
    }
  };

  const handleRemoveTag = async (tagToRemove) => {
    const nextMentions = activeMentions.filter(t => t !== tagToRemove);
    setResult(curr => ({
      ...curr,
      variants: (curr?.variants || []).map(v => v.id === activeVariant.id
        ? {
            ...v,
            mentions: nextMentions,
            platform_options: { ...(v.platform_options || {}), mentions: nextMentions },
          }
        : v),
    }));

    try {
      await fetch('/api/social?task=update_variant_options', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: activeVariant.id,
          options: { ...(activeVariant.platform_options || {}), mentions: nextMentions },
        }),
      });
    } catch (err) {
      console.warn('Could not remove tag:', err.message);
    }
  };

  const handleInsertTagToCaption = (tag) => {
    const current = activeCaption;
    const updated = current.includes(tag) ? current : `${current} ${tag}`.trim();
    setCaptionDrafts(curr => ({ ...curr, [activeVariant.id]: updated }));
    toast.success(`Added ${tag} to caption`);
  };

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
        {/* Step 1: Select Content Theme (Collapsible) */}
        <div>
          <button
            type="button"
            onClick={() => setStep1Open(prev => !prev)}
            className="flex w-full items-center justify-between text-left group"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 text-xs font-black text-brand">
                1
              </span>
              <h2 className="text-sm font-black uppercase tracking-widest text-text-primary group-hover:text-brand transition-colors">
                Select Content Theme
              </h2>
              {!step1Open && (
                <span className="ml-2 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand">
                  {activeTheme.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">7-Day Rolling Strategy</span>
              <Icon
                icon={step1Open ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
                className="text-text-muted group-hover:text-text-primary transition-transform"
                width="16"
              />
            </div>
          </button>

          {step1Open && (
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
          )}
        </div>

        {/* Step 2: Choose Entity / Subject (Collapsible) */}
        <div className="mt-6 border-t border-border pt-6">
          <button
            type="button"
            onClick={() => setStep2Open(prev => !prev)}
            className="flex w-full items-center justify-between text-left group"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 text-xs font-black text-brand">
                2
              </span>
              <h2 className="text-sm font-black uppercase tracking-widest text-text-primary group-hover:text-brand transition-colors">
                Choose Subject ({activeTheme.entity === 'person' ? 'Actor / Talent' : 'Movie / Film'})
              </h2>
              {!step2Open && selected && (
                <span className="ml-2 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand">
                  {label(selected)}
                </span>
              )}
            </div>
            <Icon
              icon={step2Open ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
              className="text-text-muted group-hover:text-text-primary transition-transform"
              width="16"
            />
          </button>

          {step2Open && (
            <>
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
            </>
          )}
        </div>

        {/* Step 3: Platform Selection (Collapsible) */}
        <div className="mt-6 border-t border-border pt-6">
          <button
            type="button"
            onClick={() => setStep3Open(prev => !prev)}
            className="flex w-full items-center justify-between text-left group"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 text-xs font-black text-brand">
                3
              </span>
              <h2 className="text-sm font-black uppercase tracking-widest text-text-primary group-hover:text-brand transition-colors">
                Target Publishing Platforms
              </h2>
              {!step3Open && (
                <span className="ml-2 text-xs font-bold text-text-muted">
                  {platforms.join(', ').toUpperCase()}
                </span>
              )}
            </div>
            <Icon
              icon={step3Open ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
              className="text-text-muted group-hover:text-text-primary transition-transform"
              width="16"
            />
          </button>

          {step3Open && (
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
          )}
        </div>

        {/* Generate Action Button */}
        <div className="mt-6 border-t border-border pt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={generate}
            disabled={disabled || generating || !selected || !platforms.length}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-6 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50 shadow-md"
          >
            <Icon
              icon={generating ? 'solar:spinner-linear' : 'solar:magic-stick-3-linear'}
              className={generating ? 'animate-spin' : ''}
              width="18"
            />
            {generating ? 'Generating High-Impact Copy & Assets…' : 'Generate Social Draft'}
          </button>

          {/* YouTube / Video Clip Studio Direct Launcher */}
          <button
            type="button"
            onClick={() => setVideoStudioOpen(true)}
            disabled={!result}
            title={!result ? 'Generate the social draft first so the rendered clip has somewhere to attach' : 'Open the YouTube and video clip studio'}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-red-500/30 bg-red-600/10 px-5 text-xs font-black uppercase tracking-wider text-red-500 hover:bg-red-600/20 transition-all disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon icon="solar:clapperboard-play-bold" width="18" />
            <span>YouTube / Video Clip Studio</span>
          </button>
        </div>

        {/* GENERATED DRAFT WORKSPACE */}
        {result && (
          <div className="mt-8 rounded-lg border border-brand/30 bg-surface-2 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-4">
              <div className="flex items-center gap-2.5">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${initialDraft ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                  <Icon icon={initialDraft ? 'solar:pen-new-square-bold' : 'solar:check-circle-bold'} width="18" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">
                      {initialDraft ? 'Editing Scheduled Post' : 'Draft Created'}: {result.contentItem?.title}
                    </h3>
                    <span className={`rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                      initialDraft ? 'bg-amber-500/15 text-amber-400' : 'bg-brand/15 text-brand'
                    }`}>
                      {initialDraft ? (result.contentItem?.status || 'Draft') : 'Ready for Scheduling'}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    {initialDraft
                      ? 'Full Studio editing mode: change visuals, format ratios, video clips, and copy.'
                      : 'Polish your visual canvas and edit platform copy before scheduling.'}
                  </p>
                </div>
              </div>

              {/* Action buttons: Reset or Return to Queue */}
              <div className="flex items-center gap-2">
                {initialDraft && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearDraft?.();
                      onGenerated?.(result, { action: 'scheduled' });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-bold text-text-muted hover:text-text-primary hover:border-brand transition-all"
                  >
                    <Icon icon="solar:arrow-left-linear" width="14" />
                    <span>Back to Queue</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleResetComposer}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-bold text-text-muted hover:text-brand hover:border-brand/50 transition-all shadow-2xs"
                  title="Clear composer and start a fresh post"
                >
                  <Icon icon="solar:restart-linear" width="14" />
                  <span>+ Create Fresh Post</span>
                </button>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-[minmax(260px,360px)_1fr] md:items-center">
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-surface-2 p-1.5">
                  {[
                    { value: 'single', label: 'Single post (image / video)', icon: 'solar:gallery-linear' },
                    { value: 'carousel', label: 'Carousel (images + videos)', icon: 'solar:gallery-wide-linear' },
                  ].map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        handleSetPostFormat(option.value);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-xs font-bold transition-colors ${
                        activeVariantPostFormat === option.value ? 'bg-brand text-white shadow-sm' : 'text-text-muted hover:bg-surface hover:text-text-primary'
                      }`}
                    >
                      <Icon icon={option.icon} width="16" /> {option.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-text-primary">
                      {activeVariantPostFormat === 'carousel' ? 'Build a carousel of images, video + images, or multiple videos' : 'Use an image or video (MP4/WebM) as the complete post'}
                    </p>
                    <p className="mt-1 text-[10px] text-text-muted">
                      {activeVariantPostFormat === 'carousel'
                        ? `Add up to ${carouselLimit} items (mix videos and images freely). Instagram supports 10 items; Threads supports 20 items.`
                        : 'Your upload replaces the entire generated graphic. MP4 and WebM videos are supported up to 50 MB.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 py-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">Target:</span>
                      <select
                        value={uploadScope}
                        onChange={e => setUploadScope(e.target.value)}
                        className="bg-transparent text-xs font-bold text-text-primary outline-none cursor-pointer"
                      >
                        <option value="active">Only {activePlatform.label}</option>
                        <option value="all">All Selected Channels</option>
                      </select>
                    </div>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                      multiple={activeVariantPostFormat === 'carousel' && replaceSlideIndex === null}
                      ref={fileInputRef}
                      onChange={handleCustomImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setReplaceSlideIndex(null);
                        setTimeout(() => fileInputRef.current?.click(), 0);
                      }}
                      disabled={uploadingCustom}
                      className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-xs font-black text-white hover:bg-brand-hover disabled:opacity-50 shadow-sm"
                    >
                      <Icon
                        icon={uploadingCustom ? 'solar:spinner-linear' : 'solar:upload-track-2-linear'}
                        className={uploadingCustom ? 'animate-spin' : ''}
                        width="16"
                      />
                      {uploadingCustom
                        ? activeVariantPostFormat === 'carousel' ? 'Updating carousel…' : 'Uploading media…'
                        : activeVariantPostFormat === 'carousel'
                          ? activeVariantCarouselAssets.length ? 'Add media' : 'Choose 2 or more items'
                          : 'Upload image or video'}
                    </button>
                  </div>
                </div>
              </div>

              {activeVariantPostFormat === 'carousel' && activeVariantCarouselAssets.length > 0 && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs font-bold text-emerald-400">
                  <Icon icon="solar:check-circle-bold" className="mr-1.5 inline" width="15" />
                  {activeVariantCarouselAssets.length}/{carouselLimit} items attached for {activePlatform.label} as a swipeable post.
                  {' '}Mix videos and images freely. Caption applies to the full post.
                </div>
              )}

              {/* Viewport Layout Mode Switcher & Channel Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-text-muted">
                    Preview each publishing channel
                  </p>
                  <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1">
                    {result.variants?.map(variant => {
                      const platform = PLATFORMS.find(entry => entry.value === variant.platform) || PLATFORMS[0];
                      const isActive = variant.platform === activeVariant?.platform;
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => setActivePreviewPlatform(variant.platform)}
                          className={`inline-flex min-w-fit items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-black transition-all ${
                            isActive
                              ? 'border-brand bg-brand/10 text-brand ring-1 ring-brand'
                              : 'border-border bg-surface text-text-muted hover:text-text-primary'
                          }`}
                        >
                          <Icon icon={platform.icon} width="16" /> {platform.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* View Space Layout Switcher (CapCut-Style Workspace Mode) */}
                <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
                  {[
                    { id: 'split', label: 'Split View', icon: 'solar:sidebar-minimalistic-linear' },
                    { id: 'canvas_focus', label: 'Canvas Focus', icon: 'solar:maximize-square-2-linear' },
                    { id: 'caption_focus', label: 'Caption Focus', icon: 'solar:document-text-linear' },
                  ].map(mode => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setViewLayout(mode.id)}
                      title={mode.label}
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition-all ${
                        viewLayout === mode.id
                          ? 'bg-brand text-white shadow-sm'
                          : 'text-text-muted hover:bg-surface-2 hover:text-text-primary'
                      }`}
                    >
                      <Icon icon={mode.icon} width="14" />
                      <span className="hidden sm:inline">{mode.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Platform Guidelines & Aspect Ratio Assistant */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-brand">
                    <Icon icon={activeSpec.icon} width="22" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-text-primary">{activeSpec.label} Specifics</span>
                      <span className="rounded bg-brand/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand">
                        Optimal: {activeSpec.optimalRatio}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      {postFormat === 'carousel' ? activeSpec.carouselSupport : activeSpec.videoSupport} · <span className="text-text-secondary">{activeSpec.tips}</span>
                    </p>
                  </div>
                </div>

                {/* Per-Platform Aspect Ratio Selector */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-text-muted mr-1">Aspect Ratio:</span>
                  {[
                    { id: '1:1', label: '1:1', desc: 'Square' },
                    { id: '4:5', label: '4:5', desc: 'Portrait' },
                    { id: '9:16', label: '9:16', desc: 'Vertical' },
                    { id: '16:9', label: '16:9', desc: 'Landscape' },
                  ].map(ratio => (
                    <button
                      key={ratio.id}
                      type="button"
                      onClick={() => handleAspectRatioSelect(ratio.id)}
                      title={ratio.desc}
                      className={`rounded-md px-2.5 py-1 text-xs font-black transition-all ${
                        canvasAspectRatio === ratio.id
                          ? 'bg-brand text-white shadow-sm ring-1 ring-brand'
                          : 'border border-border bg-surface-2 text-text-muted hover:border-brand/40 hover:text-text-primary'
                      }`}
                    >
                      {ratio.label}
                    </button>
                  ))}

                  <span className="h-4 w-px bg-border mx-1 hidden sm:block" />

                  {/* 1-Click Round-Trip Open in Studio Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenInStudio()}
                    className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1 text-xs font-black text-white shadow-xs transition-all hover:scale-105 hover:from-emerald-500 hover:to-teal-500"
                    title="Open in OpenCut Studio to crop, resize, and add watermark with instant round-trip save"
                  >
                    <Icon icon="solar:magic-stick-3-bold" width="14" />
                    <span>🎨 Open in Studio</span>
                  </button>
                </div>
              </div>

              {/* Instagram Carousel Aspect Ratio Compatibility Helper Banner */}
              {activePlatform.id === 'instagram' && activeVariantPostFormat === 'carousel' && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">⚠️</span>
                    <div>
                      <p className="font-bold text-amber-100">Instagram Carousel Aspect Ratio Rule</p>
                      <p className="text-[11px] text-amber-200/80">
                        Instagram requires all carousel items to share identical aspect ratios (e.g. 1:1 Square or 4:5 Portrait). Mixed landscape + portrait files will be rejected by Meta.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenInStudio(null, '1:1')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1 text-xs font-black text-black shadow-xs hover:bg-amber-400 transition"
                  >
                    <Icon icon="solar:crop-minimalistic-bold" width="14" />
                    <span>Crop to 1:1 in Studio</span>
                  </button>
                </div>
              )}

              {/* Dynamic Viewport Grid */}
              <div className={`grid gap-6 ${
                viewLayout === 'canvas_focus'
                  ? 'grid-cols-1'
                  : viewLayout === 'caption_focus'
                    ? 'grid-cols-1'
                    : 'lg:grid-cols-12'
              }`}>
                {/* Visual Canvas Column */}
                {viewLayout !== 'caption_focus' && (
                  <section className={`space-y-3 ${viewLayout === 'canvas_focus' ? 'w-full' : 'lg:col-span-6'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider text-text-primary">{activePlatform.label} Visual Canvas</p>
                        <p className="text-[10px] text-text-muted">Framed in {canvasAspectRatio} ratio for {activePlatform.label}.</p>
                      </div>
                      <span className="rounded-full border border-border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-text-muted">
                        {postFormat === 'carousel' ? `${activeVisualAssets.length} slides` : selectedSingleAsset?.format === 'custom_design' ? 'Your poster' : 'MuviDB graphic'}
                      </span>
                    </div>

                    {/* Media Library Selector Strip for Active Platform */}
                    {result.assets?.length > 1 && (
                      <div className="rounded-xl border border-border bg-surface p-3 space-y-2 shadow-xs">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5">
                            <Icon icon="solar:gallery-favourite-bold" className="text-brand" width="16" />
                            <span className="text-[11px] font-black uppercase tracking-wider text-text-primary">
                              Available Media for this Draft ({result.assets.length} items)
                            </span>
                          </div>
                          <span className="text-[10px] text-text-muted">
                            {activeVariantPostFormat === 'carousel'
                              ? <span>Click items to <strong className="text-brand">add/remove slides</strong> for {activePlatform.label}</span>
                              : <span>Click an item to <strong className="text-brand">use as active post</strong> for {activePlatform.label}</span>}
                          </span>
                        </div>

                        <div className="flex gap-2 overflow-x-auto pb-1 pt-1">
                          {result.assets.map((asset, idx) => {
                            const isSingleSelected = activeVariant?.selected_asset_id === asset.id || (!activeVariant?.selected_asset_id && idx === 0);
                            const carouselIndex = activeVariantCarouselAssets.findIndex(
                              a => a.id === asset.id || a.publicUrl === asset.publicUrl
                            );
                            const isInCarousel = carouselIndex >= 0;
                            const isVid = asset.mediaType === 'video' || asset.format === 'custom_video' || asset.format === 'video_vertical_9_16';

                            const isHighlighted = activeVariantPostFormat === 'carousel' ? isInCarousel : isSingleSelected;

                            return (
                              <button
                                key={asset.id || idx}
                                type="button"
                                onClick={() => handleSelectAssetForActivePlatform(asset)}
                                title={activeVariantPostFormat === 'carousel'
                                  ? (isInCarousel ? `Remove Slide ${carouselIndex + 1} from ${activePlatform.label} carousel` : `Add to ${activePlatform.label} carousel`)
                                  : `Use this ${isVid ? 'video' : 'image'} for ${activePlatform.label}`}
                                className={`relative group shrink-0 rounded-lg overflow-hidden border-2 transition-all text-left ${
                                  isHighlighted
                                    ? 'border-brand ring-2 ring-brand/30 shadow-md scale-[1.02]'
                                    : 'border-border bg-black hover:border-brand/50 opacity-60 hover:opacity-100'
                                }`}
                                style={{ width: '88px', height: '88px' }}
                              >
                                {isVid ? (
                                  <video src={asset.publicUrl} muted className="h-full w-full object-cover" />
                                ) : (
                                  <img src={asset.publicUrl} alt="Asset thumbnail" className="h-full w-full object-cover" />
                                )}

                                {/* Asset Format Badge */}
                                <span className="absolute top-1 left-1 rounded bg-black/80 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">
                                  {isVid ? 'Video' : asset.format?.replace(/_/g, ' ') || 'Image'}
                                </span>

                                {/* Selection Badge */}
                                {activeVariantPostFormat === 'carousel' ? (
                                  isInCarousel ? (
                                    <div className="absolute inset-x-0 bottom-0 bg-brand text-white text-[8px] font-black text-center py-0.5 flex items-center justify-center gap-0.5">
                                      <Icon icon="solar:check-circle-bold" width="10" />
                                      <span>Slide {carouselIndex + 1}</span>
                                    </div>
                                  ) : (
                                    <div className="absolute inset-x-0 bottom-0 bg-black/80 text-text-muted group-hover:text-white group-hover:bg-brand/90 text-[8px] font-black text-center py-0.5 flex items-center justify-center gap-0.5 transition-colors">
                                      <Icon icon="solar:add-circle-linear" width="10" />
                                      <span>+ Add Slide</span>
                                    </div>
                                  )
                                ) : (
                                  isSingleSelected && (
                                    <div className="absolute inset-x-0 bottom-0 bg-brand text-white text-[8px] font-black text-center py-0.5 flex items-center justify-center gap-0.5">
                                      <Icon icon="solar:check-circle-bold" width="10" />
                                      <span>Active</span>
                                    </div>
                                  )
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* CapCut-Style Social Canvas Viewport */}
                    <SocialCanvasViewport
                      mediaUrl={activeVisualAssets[0]?.publicUrl}
                      mediaType={activeVisualAssets[0]?.mediaType || (activeVisualAssets[0]?.format === 'custom_video' ? 'video' : 'image')}
                      aspectRatio={canvasAspectRatio}
                      onAspectRatioChange={handleAspectRatioSelect}
                      platformLabel={activePlatform.label}
                      platformIcon={activePlatform.icon}
                      platformAccent={activePlatform.accent}
                      allowVideoCut={true}
                      onCutVideo={handleCanvasCutVideo}
                      onOpenVideoStudio={() => setVideoStudioOpen(true)}
                    >
                      {activeVisualAssets[0] ? (
                        activeVisualAssets[0].mediaType === 'video' ? (
                          activeVisualAssets[0].publicUrl?.includes('youtube.com') || activeVisualAssets[0].publicUrl?.includes('youtu.be') ? (
                            <iframe
                              key={activeVisualAssets[0].publicUrl}
                              src={
                                activeVisualAssets[0].publicUrl.includes('youtube.com/embed/')
                                  ? activeVisualAssets[0].publicUrl
                                  : (() => {
                                      try {
                                        const parsed = new URL(activeVisualAssets[0].publicUrl);
                                        let vid = '';
                                        if (activeVisualAssets[0].publicUrl.includes('youtu.be/')) {
                                          vid = parsed.pathname.slice(1).split('?')[0];
                                        } else if (activeVisualAssets[0].publicUrl.includes('shorts/')) {
                                          vid = parsed.pathname.split('shorts/')[1]?.split('?')[0];
                                        } else {
                                          vid = parsed.searchParams.get('v') || '';
                                        }
                                        if (vid) {
                                          const start = parsed.searchParams.get('start');
                                          const end = parsed.searchParams.get('end');
                                          let embed = `https://www.youtube.com/embed/${vid}?autoplay=1&enablejsapi=1`;
                                          if (start) embed += `&start=${start}`;
                                          if (end) embed += `&end=${end}`;
                                          return embed;
                                        }
                                      } catch {}
                                      return activeVisualAssets[0].publicUrl;
                                    })()
                              }
                              title="Video Canvas Preview"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              className="h-full w-full border-0 object-cover"
                            />
                          ) : (
                            <video
                              key={activeVisualAssets[0].publicUrl}
                              src={activeVisualAssets[0].publicUrl}
                              controls
                              playsInline
                              preload="auto"
                              className="h-full w-full object-contain"
                            />
                          )
                        ) : (
                          <img
                            src={activeVisualAssets[0].publicUrl}
                            alt={`${activePlatform.label} post preview`}
                            className="h-full w-full object-contain"
                          />
                        )
                      ) : (
                        <div className="flex flex-col items-center gap-2 py-20 text-text-muted">
                          <Icon icon="solar:gallery-remove-linear" width="42" />
                          <span className="text-xs">Upload artwork or fetch YouTube video to preview</span>
                        </div>
                      )}
                    </SocialCanvasViewport>

                    {activeVariantPostFormat === 'carousel' && activeVariantCarouselAssets.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-2">
                        {activeVariantCarouselAssets.map((asset, index) => (
                          <div key={asset.id} className="overflow-hidden rounded-lg border border-border bg-surface">
                            <div className="relative bg-black">
                              {asset.mediaType === 'video' ? (
                                <video src={asset.publicUrl} muted playsInline className="aspect-square w-full object-cover" />
                              ) : (
                                <img src={asset.publicUrl} alt={asset.altText || `Carousel item ${index + 1}`} className="aspect-square w-full object-cover" />
                              )}
                              <span className="absolute bottom-1.5 left-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[8px] font-black uppercase text-white">
                                {asset.mediaType || 'image'}
                              </span>
                            <div className="absolute inset-x-1.5 top-1.5 flex items-center justify-between">
                              <span className="rounded-full bg-black/80 px-2 py-1 text-[9px] font-black text-white">{index + 1}</span>
                              <div className="flex gap-1">
                                <button type="button" aria-label={`Move slide ${index + 1} left`} onClick={() => moveCarouselSlide(index, -1)} disabled={index === 0 || reorderingCarousel} className="rounded-full bg-black/80 p-1 text-white disabled:opacity-30">
                                  <Icon icon="solar:arrow-left-linear" width="12" />
                                </button>
                                <button type="button" aria-label={`Move slide ${index + 1} right`} onClick={() => moveCarouselSlide(index, 1)} disabled={index === activeVariantCarouselAssets.length - 1 || reorderingCarousel} className="rounded-full bg-black/80 p-1 text-white disabled:opacity-30">
                                  <Icon icon="solar:arrow-right-linear" width="12" />
                                </button>
                                <button type="button" aria-label={`Replace carousel item ${index + 1}`} onClick={() => { setReplaceSlideIndex(index); setTimeout(() => fileInputRef.current?.click(), 0); }} disabled={uploadingCustom || reorderingCarousel} className="rounded-full bg-black/80 p-1 text-white disabled:opacity-30">
                                  <Icon icon="solar:refresh-linear" width="12" />
                                </button>
                                <button type="button" aria-label={`Remove carousel item ${index + 1}`} onClick={() => removeCarouselSlide(index)} disabled={activeVariantCarouselAssets.length <= 2 || uploadingCustom || reorderingCarousel} className="rounded-full bg-red-600/90 p-1 text-white disabled:opacity-30">
                                  <Icon icon="solar:trash-bin-trash-linear" width="12" />
                                </button>
                              </div>
                            </div>
                            </div>
                            <div className="p-2">
                              <label className="text-[9px] font-black uppercase tracking-wider text-text-muted">Media description</label>
                              <textarea
                                value={asset.altText || ''}
                                onChange={event => {
                                  const text = event.target.value;
                                  setCarouselAssets(current => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, altText: text } : entry));
                                }}
                                onBlur={event => saveCarouselAltText(index, event.target.value)}
                                maxLength={1000}
                                rows={2}
                                placeholder="Describe this item for accessibility"
                                className="mt-1 w-full resize-y rounded border border-border bg-surface-2 px-2 py-1.5 text-[10px] text-text-primary outline-none focus:border-brand"
                              />
                            </div>
                          </div>
                        ))}

                        {/* Prominent "+" Add More Media Card */}
                        {activeVariantCarouselAssets.length < carouselLimit && (
                          <button
                            type="button"
                            onClick={() => {
                              setReplaceSlideIndex(null);
                              setTimeout(() => fileInputRef.current?.click(), 0);
                            }}
                            disabled={uploadingCustom || reorderingCarousel}
                            className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-surface-2/70 p-4 text-text-muted hover:border-brand hover:bg-brand/5 hover:text-brand transition-all aspect-square min-h-[160px] group shadow-xs"
                          >
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface group-hover:bg-brand group-hover:text-white border border-border transition-all shadow-sm">
                              <Icon icon={uploadingCustom ? 'solar:spinner-linear' : 'solar:add-circle-bold'} className={uploadingCustom ? 'animate-spin' : ''} width="24" />
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-wider">
                              {uploadingCustom ? 'Adding…' : 'Add Media'}
                            </span>
                            <span className="text-[9px] text-text-muted">
                              Image or Video ({activeVariantCarouselAssets.length}/{carouselLimit})
                            </span>
                          </button>
                        )}
                      </div>
                    )}
                  </section>
                )}

                {/* Caption & Settings Column */}
                {viewLayout !== 'canvas_focus' && (
                  <section className={`space-y-3 ${viewLayout === 'caption_focus' ? 'w-full' : 'lg:col-span-6'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-text-primary">{activePlatform.label} caption</p>
                      <p className="text-[10px] text-text-muted">Edit the generated copy here. Each platform keeps its own caption.</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await persistCaption(activeVariant, activeCaption);
                          } catch (err) {
                            toast.error(err.message || 'Could not save caption');
                          }
                        }}
                        disabled={!captionIsDirty || savingCaptionId === activeVariant?.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[11px] font-bold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Icon icon={savingCaptionId === activeVariant?.id ? 'solar:spinner-linear' : 'solar:diskette-linear'} className={savingCaptionId === activeVariant?.id ? 'animate-spin' : ''} width="14" />
                        {savingCaptionId === activeVariant?.id ? 'Saving…' : 'Save changes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const full = `${activeCaption}\n\n${(activeVariant?.hashtags || []).slice(0, 3).map(tag => `#${tag}`).join(' ')}`;
                          navigator.clipboard.writeText(full.trim());
                          toast.success(`${activePlatform.label} caption copied`);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[11px] font-bold text-text-muted hover:border-brand hover:text-brand"
                      >
                        <Icon icon="solar:copy-linear" width="14" /> Copy
                      </button>
                    </div>
                  </div>

                  <div className="min-h-[420px] rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-center gap-2 border-b border-border pb-3">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${activePlatform.accent} text-white`}>
                        <Icon icon={activePlatform.icon} width="18" />
                      </span>
                      <div>
                        <p className="text-xs font-black text-text-primary">MuviDB on {activePlatform.label}</p>
                        <p className={`text-[10px] ${activeCaption.length > activeCaptionLimit ? 'text-red-500' : 'text-text-muted'}`}>
                          {activeCaption.length}/{activeCaptionLimit} characters
                        </p>
                      </div>
                    </div>
                    <textarea
                      value={activeCaption}
                      onChange={event => setCaptionDrafts(current => ({
                        ...current,
                        [activeVariant.id]: event.target.value,
                      }))}
                      maxLength={activeCaptionLimit}
                      rows={15}
                      aria-label={`Edit ${activePlatform.label} caption`}
                      className="mt-4 min-h-[300px] w-full resize-y rounded-xl border border-border bg-surface-2 p-4 text-sm leading-relaxed text-text-primary outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand"
                      placeholder="Write the caption for this platform…"
                    />
                    {activeVariant?.hashtags?.length > 0 && (
                      <p className="mt-4 text-sm font-bold leading-relaxed text-brand">
                        {activeVariant.hashtags.slice(0, 3).map(tag => `#${tag}`).join(' ')}
                      </p>
                    )}
                  </div>

                  {/* Tagged Accounts & Collaborators (@mentions) */}
                  <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
                          <Icon icon="solar:user-speak-bold" width="16" />
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider text-text-primary">
                            Tagged Accounts & Collaborators
                          </p>
                          <p className="text-[10px] text-text-muted">
                            Tag profiles, actors, or brand partners on {activePlatform.label}
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-mono font-bold text-text-muted">
                        {activeMentions.length} tagged
                      </span>
                    </div>

                    {/* Tag Pills */}
                    {activeMentions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {activeMentions.map(tag => (
                          <div
                            key={tag}
                            className="group flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 pl-2.5 pr-1 py-1 text-xs font-bold text-brand shadow-xs"
                          >
                            <span>{tag}</span>
                            <button
                              type="button"
                              onClick={() => handleInsertTagToCaption(tag)}
                              title="Add to caption"
                              className="rounded-full p-0.5 hover:bg-brand/20 text-brand text-[10px]"
                            >
                              <Icon icon="solar:add-circle-linear" width="13" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(tag)}
                              title="Remove tag"
                              className="rounded-full p-0.5 hover:bg-red-500/20 text-text-muted hover:text-red-400"
                            >
                              <Icon icon="solar:close-circle-bold" width="13" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Tag Input */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={newTagInput}
                          onChange={e => setNewTagInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddTag();
                            }
                          }}
                          placeholder={`Add account handle, e.g. @frameshot, @muvidb_`}
                          className="h-9 w-full rounded-lg border border-border bg-surface-2 pl-3 pr-8 text-xs text-text-primary outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                        {newTagInput && (
                          <button
                            type="button"
                            onClick={() => setNewTagInput('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                          >
                            <Icon icon="solar:close-circle-bold" width="14" />
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddTag()}
                        disabled={!newTagInput.trim()}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-surface-2 px-3 text-xs font-bold text-text-primary hover:bg-brand hover:text-white border border-border hover:border-brand transition-all disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <Icon icon="solar:add-square-linear" width="15" />
                        <span>Tag</span>
                      </button>
                    </div>

                    {/* Quick Suggestion Pills */}
                    <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto text-[10px] text-text-muted">
                      <span className="shrink-0 font-semibold">Quick tag:</span>
                      {['@muvidb_', '@frameshot', selected?.name ? `@${selected.name.toLowerCase().replace(/[^a-z0-9]/g, '')}` : null].filter(Boolean).map(sug => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => handleAddTag(sug)}
                          className="shrink-0 rounded-md border border-border bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-text-primary hover:border-brand hover:text-brand transition-colors"
                        >
                          +{sug}
                        </button>
                      ))}
                    </div>
                  </div>

                  {activeVariant?.platform === 'tiktok' && (
                    <div className="rounded-2xl border border-cyan-400/25 bg-cyan-400/5 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider text-text-primary">TikTok publishing controls</p>
                          <p className="mt-1 text-[10px] leading-relaxed text-text-muted">
                            TikTok validates these against the connected creator’s current permissions when publishing.
                          </p>
                        </div>
                        <Icon icon="simple-icons:tiktok" className="text-cyan-300" width="18" />
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                          Delivery mode
                          <select value={tiktokSettings.post_mode} onChange={event => setTikTokSettings(current => ({ ...current, post_mode: event.target.value }))} className="mt-1 h-9 w-full rounded border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-brand">
                            <option value="DIRECT_POST">Post directly (with full caption & tags)</option>
                            <option value="MEDIA_UPLOAD">Send to TikTok inbox as draft (video only, no caption)</option>
                          </select>
                        </label>
                        <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                          Privacy
                          <select value={tiktokSettings.privacy_level} onChange={event => setTikTokSettings(current => ({ ...current, privacy_level: event.target.value }))} disabled={tiktokSettings.post_mode === 'MEDIA_UPLOAD'} className="mt-1 h-9 w-full rounded border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-brand disabled:opacity-50">
                            <option value="PUBLIC_TO_EVERYONE">Public (Visible to everyone)</option>
                            <option value="SELF_ONLY">Only me (Private on profile with full caption)</option>
                            <option value="MUTUAL_FOLLOW_FRIENDS">Mutual followers</option>
                            <option value="FOLLOWER_OF_CREATOR">Creator’s followers</option>
                          </select>
                        </label>
                      </div>
                      {tiktokSettings.post_mode === 'MEDIA_UPLOAD' && (
                        <p className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-[10px] text-amber-200">
                          ⚠️ <span className="font-bold text-amber-300">TikTok Inbox Limitation:</span> TikTok’s Inbox API only transfers raw video files without captions. To have your full caption and tags automatically attached, select <strong>Post directly</strong> (select <em>Only me</em> if you wish to review before making it public).
                        </p>
                      )}

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {[
                          ['disable_comment', 'Disable comments'],
                          ['disable_duet', 'Disable Duet'],
                          ['disable_stitch', 'Disable Stitch'],
                          ['auto_add_music', 'Auto-add trending music'],
                          ['brand_content_toggle', 'Paid partnership'],
                          ['brand_organic_toggle', 'Promotes our own brand'],
                          ['is_aigc', 'AI-generated content'],
                        ].map(([key, label]) => (
                          <label key={key} className="flex items-center gap-2 rounded border border-border bg-surface px-2.5 py-2 text-[11px] font-bold text-text-primary">
                            <input type="checkbox" checked={Boolean(tiktokSettings[key])} onChange={event => setTikTokSettings(current => ({ ...current, [key]: event.target.checked }))} className="accent-brand" />
                            {label}
                          </label>
                        ))}
                      </div>

                      <div className="mt-2.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2.5 text-[10px] text-cyan-200">
                        <span className="font-black uppercase tracking-wider text-cyan-300 mr-1">🎵 Auto-Add Music Note:</span>
                        When enabled, TikTok automatically selects and overlays a copyright-cleared trending commercial sound suited for your post category. (The official TikTok API does not provide third-party apps with a song search picker due to music licensing).
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                          Photo cover item
                          <input type="number" min="1" max={Math.max(1, carouselAssets.length || 1)} value={Number(tiktokSettings.photo_cover_index || 0) + 1} onChange={event => setTikTokSettings(current => ({ ...current, photo_cover_index: Math.max(0, Number(event.target.value || 1) - 1) }))} className="mt-1 h-9 w-full rounded border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-brand" />
                        </label>
                        <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                          Video cover time (ms)
                          <input type="number" min="0" step="100" value={tiktokSettings.video_cover_timestamp_ms} onChange={event => setTikTokSettings(current => ({ ...current, video_cover_timestamp_ms: Math.max(0, Number(event.target.value || 0)) }))} className="mt-1 h-9 w-full rounded border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-brand" />
                        </label>
                      </div>

                      <p className="mt-3 text-[10px] leading-relaxed text-amber-300">
                        Direct public posting requires TikTok approval/audit and a verified media URL domain. Until TikTok approves the app, it may restrict posts to private visibility.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-border bg-surface p-3">
                      <p className="text-[9px] font-black uppercase tracking-wider text-text-muted">Format</p>
                      <p className="mt-1 text-xs font-bold text-text-primary">{postFormat === 'carousel' ? 'Carousel' : 'Single image'}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-surface p-3">
                      <p className="text-[9px] font-black uppercase tracking-wider text-text-muted">Visual</p>
                      <p className="mt-1 text-xs font-bold text-text-primary">{selectedSingleAsset?.format === 'custom_design' ? 'Custom poster' : 'Generated'}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-surface p-3">
                      <p className="text-[9px] font-black uppercase tracking-wider text-text-muted">Channel</p>
                      <p className="mt-1 text-xs font-bold text-text-primary">{activePlatform.label}</p>
                    </div>
                  </div>
                </section>
              )}
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

      {/* YouTube / Video Clip Studio Modal */}
      <SocialVideoClipModal
        isOpen={videoStudioOpen}
        onClose={() => setVideoStudioOpen(false)}
        initialVideoUrl={activeVisualAssets[0]?.publicUrl || (selected?.trailer_youtube_id ? `https://www.youtube.com/watch?v=${selected.trailer_youtube_id}` : (selected?.trailer_external_url || ''))}
        initialTitle={selected?.title || selected?.name || ''}
        onImportToCanvas={handleImportVideoToCanvas}
        onAttachRenderedVideo={handleAttachRenderedVideo}
      />
    </div>
  );
}
