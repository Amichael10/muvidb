import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { authHeaders } from '../../lib/apiAuth';
import { uploadAdminSocialMedia } from '../../lib/imageUpload';

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
  return file?.type?.startsWith('video/') ? 'video' : 'image';
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
  const [reorderingCarousel, setReorderingCarousel] = useState(false);
  const [replaceSlideIndex, setReplaceSlideIndex] = useState(null);
  const [scheduling, setScheduling] = useState(false);
  const [customScheduleDate, setCustomScheduleDate] = useState('');
  const [tiktokSettings, setTikTokSettings] = useState(DEFAULT_TIKTOK_SETTINGS);
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
  const carouselLimit = carouselLimitFor(platforms);

  useEffect(() => {
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
      if (postFormat === 'carousel') {
        if (replaceSlideIndex !== null && files.length !== 1) {
          throw new Error('Choose one file to replace this carousel item');
        }
        const projectedCount = replaceSlideIndex === null
          ? carouselAssets.length + files.length
          : carouselAssets.length;
        if (projectedCount < 2 || projectedCount > carouselLimit) {
          throw new Error(`Choose enough media for 2–${carouselLimit} carousel items on the selected platforms`);
        }
        const containsVideo = files.some(file => mediaTypeForFile(file) === 'video')
          || carouselAssets.some(asset => asset.mediaType === 'video');
        if (containsVideo && platforms.includes('facebook')) {
          throw new Error('Facebook Page carousels support images only. Remove Facebook or use only images.');
        }
        if (containsVideo && platforms.includes('tiktok')) {
          throw new Error('TikTok photo carousels support images only. Remove TikTok or use only images.');
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
          ? [...carouselAssets, ...uploadedAssets]
          : carouselAssets.map((asset, index) => index === replaceSlideIndex ? uploadedAssets[0] : asset);

        const res = await fetch('/api/social?task=attach_carousel_assets', {
          method: 'POST',
          headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentItemId: result.contentItem.id,
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
        toast.success(replaceSlideIndex === null
          ? `${attached.length}-item carousel attached to this draft`
          : `Carousel item ${replaceSlideIndex + 1} replaced`);
        setReplaceSlideIndex(null);
        return;
      }

      const uploadRes = await uploadAdminSocialMedia(files[0], 'social-published-assets');
      if (uploadRes.error) throw new Error(uploadRes.error);
      const url = uploadRes.url;

      const res = await fetch('/api/social?task=attach_custom_asset', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentItemId: result.contentItem.id,
          publicUrl: url,
          format: uploadRes.mediaType === 'video' ? 'video_vertical_9_16' : 'square_1_1',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      toast.success(`${uploadRes.mediaType === 'video' ? 'Video' : 'Custom artwork'} uploaded and attached to this draft!`);
      setResult(curr => ({
        ...curr,
        assets: [
          { id: data.id, publicUrl: url, mediaType: uploadRes.mediaType || 'image', format: uploadRes.mediaType === 'video' ? 'custom_video' : 'custom_design', width: data.width || 1080, height: data.height || 1080 },
          ...(curr?.assets || []),
        ],
        variants: (curr?.variants || []).map(variant => ({ ...variant, selected_asset_id: data.id })),
      }));
      onGenerated?.({ ...result, assets: [{ id: data.id, publicUrl: url, mediaType: uploadRes.mediaType || 'image', format: uploadRes.mediaType === 'video' ? 'custom_video' : 'custom_design', width: data.width || 1080, height: data.height || 1080 }, ...(result.assets || [])] });
    } catch (err) {
      toast.error(err.message || 'Failed to upload custom design');
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
      onGenerated?.(result);
    } catch (err) {
      toast.error(readableNetworkError(err, 'scheduling this post'), { duration: 7000 });
    } finally {
      setScheduling(false);
    }
  };

  const moveCarouselSlide = async (fromIndex, direction) => {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= carouselAssets.length || reorderingCarousel) return;
    const previous = carouselAssets;
    const next = [...carouselAssets];
    [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
    setCarouselAssets(next);
    setReorderingCarousel(true);
    try {
      const res = await fetch('/api/social?task=reorder_carousel_assets', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentItemId: result.contentItem.id,
          assets: next.map(asset => ({
            url: asset.publicUrl,
            mediaType: asset.mediaType,
            altText: asset.altText || '',
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    } catch (err) {
      setCarouselAssets(previous);
      toast.error(err.message || 'Could not change the slide order');
    } finally {
      setReorderingCarousel(false);
    }
  };

  const persistCarouselAssets = async (next, successMessage) => {
    const res = await fetch('/api/social?task=attach_carousel_assets', {
      method: 'POST',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentItemId: result.contentItem.id,
        assets: next.map(asset => ({
          url: asset.publicUrl,
          mediaType: asset.mediaType,
          altText: asset.altText || '',
        })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    setCarouselAssets(next.map((asset, index) => ({ ...asset, position: index })));
    if (successMessage) toast.success(successMessage);
  };

  const removeCarouselSlide = async index => {
    if (carouselAssets.length <= 2) {
      toast.error('A carousel must keep at least 2 items. Replace this item or switch to a single post.');
      return;
    }
    const removed = carouselAssets[index];
    const next = carouselAssets.filter((_, itemIndex) => itemIndex !== index);
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
    const next = carouselAssets.map((asset, itemIndex) => itemIndex === index ? { ...asset, altText } : asset);
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
  const activeCaption = activeVariant
    ? (captionDrafts[activeVariant.id] ?? activeVariant.caption ?? '')
    : '';
  const captionIsDirty = Boolean(activeVariant)
    && activeCaption.trim() !== String(activeVariant.caption || '').trim();
  const activeCaptionLimit = CAPTION_LIMITS[activeVariant?.platform] || 2200;
  const selectedSingleAsset = result?.assets?.find(asset => asset.id === activeVariant?.selected_asset_id)
    || result?.assets?.find(asset => asset.format === 'custom_design')
    || result?.assets?.[0];
  const activeVisualAssets = postFormat === 'carousel' ? carouselAssets : selectedSingleAsset ? [selectedSingleAsset] : [];

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

            <div className="mt-6 space-y-5">
              <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-[minmax(260px,360px)_1fr] md:items-center">
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-surface-2 p-1.5">
                  {[
                    { value: 'single', label: 'Single image', icon: 'solar:gallery-linear' },
                    { value: 'carousel', label: 'Carousel', icon: 'solar:gallery-wide-linear' },
                  ].map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setPostFormat(option.value);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-xs font-bold transition-colors ${
                        postFormat === option.value ? 'bg-brand text-white' : 'text-text-muted hover:bg-surface hover:text-text-primary'
                      }`}
                    >
                      <Icon icon={option.icon} width="16" /> {option.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-text-primary">
                      {postFormat === 'carousel' ? 'Build an image or video carousel' : 'Use an image or MP4 as the complete post'}
                    </p>
                    <p className="mt-1 text-[10px] text-text-muted">
                      {postFormat === 'carousel'
                        ? `Add up to ${carouselLimit} items for the selected channels. Instagram supports 10; Threads supports 20. Facebook and TikTok carousels are image-only.`
                        : 'Your upload replaces the entire generated graphic. MP4 videos are supported up to 50 MB.'}
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,video/mp4"
                    multiple={postFormat === 'carousel' && replaceSlideIndex === null}
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
                    className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-xs font-black text-white hover:bg-brand-hover disabled:opacity-50"
                  >
                    <Icon
                      icon={uploadingCustom ? 'solar:spinner-linear' : 'solar:upload-track-2-linear'}
                      className={uploadingCustom ? 'animate-spin' : ''}
                      width="16"
                    />
                    {uploadingCustom
                      ? postFormat === 'carousel' ? 'Updating carousel…' : 'Uploading media…'
                      : postFormat === 'carousel'
                        ? carouselAssets.length ? 'Add media' : 'Choose 2 or more items'
                        : 'Upload image or video'}
                  </button>
                </div>
              </div>

              {postFormat === 'carousel' && carouselAssets.length > 0 && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs font-bold text-emerald-400">
                  <Icon icon="solar:check-circle-bold" className="mr-1.5 inline" width="15" />
                  {carouselAssets.length}/{carouselLimit} items attached as one swipeable post.
                  {' '}Instagram and Threads publish one caption for the whole carousel; individual item descriptions are used for accessibility where supported.
                </div>
              )}

              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-text-muted">
                  Preview each publishing channel
                </p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {result.variants?.map(variant => {
                    const platform = PLATFORMS.find(entry => entry.value === variant.platform) || PLATFORMS[0];
                    const isActive = variant.platform === activeVariant?.platform;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => setActivePreviewPlatform(variant.platform)}
                        className={`inline-flex min-w-fit items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-black transition-all ${
                          isActive
                            ? 'border-brand bg-brand/10 text-brand ring-1 ring-brand'
                            : 'border-border bg-surface text-text-muted hover:text-text-primary'
                        }`}
                      >
                        <Icon icon={platform.icon} width="17" /> {platform.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-12">
                <section className="space-y-3 lg:col-span-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-text-primary">{activePlatform.label} visual</p>
                      <p className="text-[10px] text-text-muted">This is the image people will see in their feed.</p>
                    </div>
                    <span className="rounded-full border border-border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-text-muted">
                      {postFormat === 'carousel' ? `${activeVisualAssets.length} slides` : selectedSingleAsset?.format === 'custom_design' ? 'Your poster' : 'MuviDB graphic'}
                    </span>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-border bg-black shadow-2xl">
                    <div className={`flex items-center justify-between bg-gradient-to-r ${activePlatform.accent} px-4 py-3 text-white`}>
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/30">
                          <Icon icon={activePlatform.icon} width="17" />
                        </span>
                        <div>
                          <p className="text-xs font-black">MuviDB</p>
                          <p className="text-[9px] text-white/75">Preview on {activePlatform.label}</p>
                        </div>
                      </div>
                      <Icon icon="solar:menu-dots-bold" width="18" />
                    </div>

                    <div className="relative flex min-h-[360px] max-h-[620px] items-center justify-center bg-black">
                      {activeVisualAssets[0] ? (
                        activeVisualAssets[0].mediaType === 'video' ? (
                          <video
                            src={activeVisualAssets[0].publicUrl}
                            controls
                            muted
                            playsInline
                            className="max-h-[620px] w-full object-contain"
                          />
                        ) : (
                          <img
                            src={activeVisualAssets[0].publicUrl}
                            alt={`${activePlatform.label} post preview`}
                            className="max-h-[620px] w-full object-contain"
                          />
                        )
                      ) : (
                        <div className="flex flex-col items-center gap-2 py-20 text-text-muted">
                          <Icon icon="solar:gallery-remove-linear" width="42" />
                          <span className="text-xs">Upload artwork to preview this post</span>
                        </div>
                      )}
                      {postFormat === 'carousel' && activeVisualAssets.length > 1 && (
                        <span className="absolute right-3 top-3 rounded-full bg-black/75 px-2.5 py-1 text-[10px] font-black text-white">
                          1/{activeVisualAssets.length}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-white/10 bg-[#0f0f0f] px-4 py-3 text-white">
                      <div className="flex items-center gap-3">
                        <Icon icon="solar:heart-linear" width="20" />
                        <Icon icon="solar:chat-round-linear" width="20" />
                        <Icon icon="solar:plain-linear" width="20" />
                      </div>
                      <Icon icon="solar:bookmark-linear" width="20" />
                    </div>
                  </div>

                  {postFormat === 'carousel' && carouselAssets.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {carouselAssets.map((asset, index) => (
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
                              <button type="button" aria-label={`Move slide ${index + 1} right`} onClick={() => moveCarouselSlide(index, 1)} disabled={index === carouselAssets.length - 1 || reorderingCarousel} className="rounded-full bg-black/80 p-1 text-white disabled:opacity-30">
                                <Icon icon="solar:arrow-right-linear" width="12" />
                              </button>
                              <button type="button" aria-label={`Replace carousel item ${index + 1}`} onClick={() => { setReplaceSlideIndex(index); setTimeout(() => fileInputRef.current?.click(), 0); }} disabled={uploadingCustom || reorderingCarousel} className="rounded-full bg-black/80 p-1 text-white disabled:opacity-30">
                                <Icon icon="solar:refresh-linear" width="12" />
                              </button>
                              <button type="button" aria-label={`Remove carousel item ${index + 1}`} onClick={() => removeCarouselSlide(index)} disabled={carouselAssets.length <= 2 || uploadingCustom || reorderingCarousel} className="rounded-full bg-red-600/90 p-1 text-white disabled:opacity-30">
                                <Icon icon="solar:trash-bin-trash-linear" width="12" />
                              </button>
                            </div>
                          </div>
                          </div>
                          <div className="p-2">
                            <label className="text-[9px] font-black uppercase tracking-wider text-text-muted">Media description</label>
                            <textarea
                              value={asset.altText || ''}
                              onChange={event => setCarouselAssets(current => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, altText: event.target.value } : entry))}
                              onBlur={event => saveCarouselAltText(index, event.target.value)}
                              maxLength={1000}
                              rows={2}
                              placeholder="Describe this item for accessibility"
                              className="mt-1 w-full resize-y rounded border border-border bg-surface-2 px-2 py-1.5 text-[10px] text-text-primary outline-none focus:border-brand"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="space-y-3 lg:col-span-6">
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
                            <option value="DIRECT_POST">Post directly</option>
                            <option value="MEDIA_UPLOAD">Send to TikTok inbox as draft</option>
                          </select>
                        </label>
                        <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                          Privacy
                          <select value={tiktokSettings.privacy_level} onChange={event => setTikTokSettings(current => ({ ...current, privacy_level: event.target.value }))} disabled={tiktokSettings.post_mode === 'MEDIA_UPLOAD'} className="mt-1 h-9 w-full rounded border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-brand disabled:opacity-50">
                            <option value="PUBLIC_TO_EVERYONE">Public</option>
                            <option value="MUTUAL_FOLLOW_FRIENDS">Mutual followers</option>
                            <option value="FOLLOWER_OF_CREATOR">Creator’s followers</option>
                            <option value="SELF_ONLY">Only me</option>
                          </select>
                        </label>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {[
                          ['disable_comment', 'Disable comments'],
                          ['disable_duet', 'Disable Duet'],
                          ['disable_stitch', 'Disable Stitch'],
                          ['auto_add_music', 'Auto-add music to photos'],
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
