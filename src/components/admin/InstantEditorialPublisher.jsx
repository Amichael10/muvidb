import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { authHeaders } from '../../lib/apiAuth';

export const INSTANT_EDITORIAL_THEMES = [
  {
    id: 'where_to_watch',
    seriesSlug: 'where_to_watch',
    name: 'Now Streaming (9:16 Reel)',
    shortName: 'Now Streaming',
    badge: '9:16 Reel + Trending Audio',
    icon: 'solar:tv-bold',
    entity: 'film',
    contentType: 'where_to_watch',
    templateSlug: 'where-to-watch-simple-v1',
    isReel: true,
    formatBadge: '9:16 Animated Reel + Music',
    description: 'Auto-renders the 9:16 Now Streaming Reel, matches a trending Afrobeats soundtrack, and generates verified copy.',
  },
  {
    id: 'upcoming_movie',
    seriesSlug: 'new_and_upcoming',
    name: 'New & Upcoming Release (9:16 Reel)',
    shortName: 'New & Upcoming',
    badge: '9:16 Reel + Trending Audio',
    icon: 'solar:bell-bing-bold',
    entity: 'film',
    contentType: 'upcoming_movie',
    templateSlug: 'new-upcoming-simple-v1',
    isReel: true,
    formatBadge: '9:16 Animated Reel + Music',
    description: 'Auto-renders the 9:16 Release Radar Reel, selects a trending Afrobeats track, and crafts release hype copy.',
  },
  {
    id: 'actor_spotlight',
    seriesSlug: 'filmography',
    name: 'Actor Spotlight & Filmography',
    shortName: 'Actor Spotlight',
    badge: '6-Slide 4:5 Carousel',
    icon: 'solar:user-star-bold',
    entity: 'person',
    contentType: 'actor_spotlight',
    templateSlug: 'filmography-simple-v1',
    isReel: false,
    isCarousel: true,
    slides: 6,
    formatBadge: '6-Slide 4:5 Carousel',
    description: 'Multi-slide 4:5 carousel (6 slides): Cover portrait, Creative Mind, 4-poster Filmography grid, Journey, Vanguard, and Celebration.',
  },
  {
    id: 'behind_the_camera',
    seriesSlug: 'behind_the_camera',
    name: 'Behind The Camera (Crew & Directors)',
    shortName: 'Behind The Camera',
    badge: '6-Slide 4:5 Carousel',
    icon: 'solar:clapperboard-edit-bold',
    entity: 'person',
    contentType: 'actor_spotlight',
    templateSlug: 'behind-camera-simple-v1',
    isReel: false,
    isCarousel: true,
    slides: 6,
    formatBadge: '6-Slide 4:5 Carousel',
    description: 'Multi-slide 4:5 carousel (6 slides) celebrating directors, editors, producers, cinematographers, and screenwriters.',
  },
  {
    id: 'critics_say',
    seriesSlug: 'critics_say',
    name: 'What The Critics Say',
    shortName: 'Critics Say',
    badge: '4:5 Review Card',
    icon: 'solar:chat-round-line-bold',
    entity: 'film',
    contentType: 'critics_say',
    templateSlug: 'critics-say-simple-v1',
    isReel: false,
    isCarousel: true,
    formatBadge: '4:5 Critic Feature',
    description: 'Highlights a verified critic review quote, star rating, and reviewer attribution with debate copy.',
  },
  {
    id: 'weekend_watchlist',
    seriesSlug: 'weekend_watchlist',
    name: 'Weekend Watchlist',
    shortName: 'Weekend Watchlist',
    badge: 'Multi-Slide 4:5 Carousel',
    icon: 'solar:film-strip-bold',
    entity: 'watchlist',
    contentType: 'weekend_watchlist',
    templateSlug: 'weekend-watchlist-simple-v1',
    isReel: false,
    isCarousel: true,
    formatBadge: 'Dynamic 4:5 Carousel (2–8 Films)',
    description: 'Pick 2 to 8 films to build the Weekend Watchlist carousel (Cover + film slides + Back cover).',
  },
  {
    id: 'whats_on_stage',
    seriesSlug: 'whats_on_stage',
    name: "What's On Stage & Theatre",
    shortName: "What's On Stage",
    badge: '4:5 Portrait Poster',
    icon: 'solar:masks-bold',
    entity: 'play',
    contentType: 'whats_on_stage',
    templateSlug: 'poster-only',
    isReel: false,
    formatBadge: '4:5 Verified Stage Poster',
    description: 'Live theatre and stage productions posted with their verified portrait poster, venue, dates, and cast handles.',
  },
  {
    id: 'film_conversation',
    seriesSlug: 'film_conversation',
    name: 'Nollywood Debate & Conversation',
    shortName: 'Nollywood Debate',
    badge: '4:5 Debate Graphic',
    icon: 'solar:dialog-bold',
    entity: 'film',
    contentType: 'film_conversation',
    templateSlug: 'film-conversation-simple-v1',
    isReel: false,
    formatBadge: '4:5 Debate Graphic',
    description: 'Provocative Nollywood film discussion card and comment question.',
  },
];

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: 'mdi:instagram' },
  { id: 'threads', label: 'Threads', icon: 'simple-icons:threads' },
  { id: 'facebook', label: 'Facebook', icon: 'mdi:facebook' },
  { id: 'tiktok', label: 'TikTok', icon: 'simple-icons:tiktok' },
];

export default function InstantEditorialPublisher({ onPublished }) {
  const [selectedThemeId, setSelectedThemeId] = useState('where_to_watch');
  const activeTheme = useMemo(
    () => INSTANT_EDITORIAL_THEMES.find(t => t.id === selectedThemeId) || INSTANT_EDITORIAL_THEMES[0],
    [selectedThemeId]
  );

  // Responsive subject candidates (dropdown + search)
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Selected subject(s)
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [watchlistPicks, setWatchlistPicks] = useState([]);
  const [criticReviews, setCriticReviews] = useState([]);
  const [selectedCriticReview, setSelectedCriticReview] = useState(null);

  // Auto-generated Caption & Audio state
  const [loadingAutoFill, setLoadingAutoFill] = useState(false);
  const [caption, setCaption] = useState('');
  const [platformCaptions, setPlatformCaptions] = useState({});
  const [activeCaptionTab, setActiveCaptionTab] = useState('instagram');

  // Audio state (for Now Streaming & New & Upcoming Release Reels)
  const [audioTracks, setAudioTracks] = useState([]);
  const [selectedAudio, setSelectedAudio] = useState(null);
  const [audioMood, setAudioMood] = useState('');
  const [audioSearchQuery, setAudioSearchQuery] = useState('');
  const [searchingAudio, setSearchingAudio] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const audioPlayerRef = useRef(null);

  // Platforms & Publishing
  const [platforms, setPlatforms] = useState(['instagram', 'threads']);
  const [publishingNow, setPublishingNow] = useState(false);
  const [publishResult, setPublishResult] = useState(null);

  // Stop audio preview on unmount
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
    };
  }, []);

  // Filter out TikTok when a carousel theme is chosen
  useEffect(() => {
    if (activeTheme.isCarousel) {
      setPlatforms(prev => prev.filter(p => p !== 'tiktok'));
    }
  }, [activeTheme]);

  // 1. Load ranked candidates whenever theme changes or user searches
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoadingCandidates(true);
      try {
        const headers = await authHeaders();
        let url;
        if (searchQuery.trim().length >= 2) {
          const type =
            activeTheme.entity === 'person'
              ? 'person'
              : activeTheme.entity === 'play'
                ? 'play'
                : 'movie';
          const params = new URLSearchParams({
            task: 'search_candidates',
            q: searchQuery.trim(),
            type,
            limit: '25',
          });
          url = `/api/social?${params}`;
        } else {
          const params = new URLSearchParams({
            task: 'slot_candidates',
            seriesSlug: activeTheme.seriesSlug,
          });
          url = `/api/social?${params}`;
        }
        const res = await fetch(url, { headers });
        const data = await res.json().catch(() => []);
        if (!cancelled) {
          setCandidates(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) setCandidates([]);
      } finally {
        if (!cancelled) setLoadingCandidates(false);
      }
    }, searchQuery.trim() ? 220 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeTheme.id, activeTheme.seriesSlug, activeTheme.entity, searchQuery]);

  // Reset selections when switching theme
  const handleSelectTheme = (themeId) => {
    setSelectedThemeId(themeId);
    setSelectedCandidate(null);
    setWatchlistPicks([]);
    setCriticReviews([]);
    setSelectedCriticReview(null);
    setCaption('');
    setPlatformCaptions({});
    setSelectedAudio(null);
    setAudioTracks([]);
    setSearchQuery('');
    setPublishResult(null);
  };

  // Load critic reviews if theme is What The Critics Say
  useEffect(() => {
    if (activeTheme.id !== 'critics_say' || !selectedCandidate?.id) {
      setCriticReviews([]);
      setSelectedCriticReview(null);
      return;
    }
    supabase
      .from('critic_reviews')
      .select('id,quote,rating,critic_name,critic_title,avatar_url')
      .eq('film_id', selectedCandidate.id)
      .order('rating', { ascending: false })
      .then(({ data }) => {
        const list = data || [];
        setCriticReviews(list);
        if (list[0]) setSelectedCriticReview(list[0]);
      });
  }, [activeTheme.id, selectedCandidate?.id]);

  // 2. Automatically generate caption + auto-match trending audio when subject is selected
  const triggerAutoFill = async (subject, currentPicks) => {
    if (!subject) return;
    setLoadingAutoFill(true);
    setPublishResult(null);

    const isWatchlist = activeTheme.id === 'weekend_watchlist' || activeTheme.entity === 'watchlist' || activeTheme.entity === 'watchlist_3';
    const picks = currentPicks || watchlistPicks;

    try {
      const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };

      const candidateData = isWatchlist && picks.length > 0 ? {
        ...(subject.data || {}),
        watchlistPicks: picks.map(p => ({
          id: p.id,
          name: p.name || p.title,
          title: p.name || p.title,
          year: p.data?.year || p.year,
          watchAvailability: p.data?.watchAvailability || p.data?.platformDisplayName || p.subtext,
          platformDisplayName: p.data?.platformDisplayName || p.subtext,
          synopsis: p.data?.synopsis || p.subtext,
          topCast: p.data?.topCast,
          directors: p.data?.directors,
          youtubeChannelName: p.data?.youtubeChannelName,
        })),
        films: picks,
      } : (subject.data || {});

      // Run AI caption generation and (if Reel theme) Instagram Trending Audio mood match in parallel
      const copyPromise = fetch('/api/social?task=ai_generate_copy', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          candidate: {
            id: subject.id,
            type: activeTheme.entity === 'person' ? 'person' : activeTheme.entity === 'play' ? 'play' : 'movie',
            name: isWatchlist && picks.length > 0 ? picks.map(p => p.name || p.title).join(', ') : (subject.name || subject.title),
            subtext: isWatchlist && picks.length > 0 ? `${picks.length} films curated for Weekend Watchlist` : subject.subtext,
            imageUrl: subject.imageUrl,
            category: activeTheme.name,
            data: candidateData,
          },
          series: {
            slug: activeTheme.seriesSlug,
            name: activeTheme.name,
            category: activeTheme.badge,
          },
          angle: activeTheme.id === 'where_to_watch' ? 'streaming_alert' : 'discovery',
          preferredProvider: 'cohere',
        }),
      }).then(r => r.json().catch(() => ({})));

      const audioPromise = activeTheme.isReel
        ? (() => {
            const params = new URLSearchParams({
              task: 'instagram_audio_recommend',
              title: subject.name || subject.title || '',
              genres: Array.isArray(subject.data?.genres) ? subject.data.genres.join(', ') : '',
              synopsis: subject.data?.synopsis || subject.subtext || '',
              theme: activeTheme.id,
              contentType: activeTheme.contentType,
            });
            return fetch(`/api/social?${params}`, { headers }).then(r => r.json().catch(() => ({})));
          })()
        : Promise.resolve(null);

      const [copyData, audioData] = await Promise.all([copyPromise, audioPromise]);

      if (copyData && (copyData.instagram || copyData.threads || copyData.variations?.length)) {
        const ig = copyData.instagram || copyData.variations?.[0]?.captions?.instagram || '';
        const th = copyData.threads || copyData.variations?.[0]?.captions?.threads || ig;
        const fb = copyData.facebook || copyData.variations?.[0]?.captions?.facebook || ig;
        const tk = copyData.tiktok || copyData.variations?.[0]?.captions?.tiktok || ig;
        setCaption(ig);
        setPlatformCaptions({
          instagram: ig,
          threads: th,
          facebook: fb,
          tiktok: tk,
        });
      } else {
        const fallback = isWatchlist && picks.length > 0
          ? `🍿 Weekend Watchlist (${picks.length} films):\n\n${picks.map((p, i) => `${i + 1}. ${p.name || p.title}${p.subtext ? ` — ${p.subtext}` : ''}`).join('\n')}\n\nExplore full credits and reviews on muvidb.com.`
          : `${subject.name || subject.title}${subject.subtext ? ` — ${subject.subtext}` : ''}\n\nExplore full credits and details on muvidb.com.`;
        setCaption(fallback);
        setPlatformCaptions({ instagram: fallback, threads: fallback, facebook: fallback, tiktok: fallback });
      }

      if (audioData && activeTheme.isReel) {
        const list = [audioData.recommended, ...(audioData.alternatives || [])].filter(Boolean);
        setAudioTracks(list);
        setAudioMood(audioData.mood || '');
        if (audioData.recommended) {
          setSelectedAudio(audioData.recommended);
        }
      }
    } catch (err) {
      toast.error(err.message || 'Could not auto-fill caption and soundtrack');
    } finally {
      setLoadingAutoFill(false);
    }
  };

  const handleChooseCandidate = (item) => {
    const isWatchlist = activeTheme.id === 'weekend_watchlist' || activeTheme.entity === 'watchlist' || activeTheme.entity === 'watchlist_3';
    if (isWatchlist) {
      setWatchlistPicks(prev => {
        const already = prev.some(p => p.id === item.id);
        const next = already ? prev.filter(p => p.id !== item.id) : [...prev, item].slice(0, 8);
        if (next.length >= 2) {
          setSelectedCandidate(next[0]);
          triggerAutoFill(next[0], next);
        } else if (next.length === 1) {
          setSelectedCandidate(next[0]);
        } else {
          setSelectedCandidate(null);
        }
        return next;
      });
      return;
    }
    setDropdownOpen(false);
    setSelectedCandidate(item);
    triggerAutoFill(item);
  };

  const handleRemoveWatchlistPick = (pickId) => {
    setWatchlistPicks(prev => {
      const next = prev.filter(p => p.id !== pickId);
      if (next.length >= 2) {
        setSelectedCandidate(next[0]);
        triggerAutoFill(next[0], next);
      } else if (next.length === 1) {
        setSelectedCandidate(next[0]);
      } else {
        setSelectedCandidate(null);
      }
      return next;
    });
  };

  const handleSearchAudioManual = async () => {
    setSearchingAudio(true);
    try {
      const params = new URLSearchParams({
        task: 'instagram_audio_search',
        audioType: 'music',
      });
      if (audioSearchQuery.trim()) params.set('q', audioSearchQuery.trim());
      const res = await fetch(`/api/social?${params}`, { headers: await authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Audio search failed');
      const tracks = Array.isArray(data.tracks) ? data.tracks : [];
      setAudioTracks(tracks);
      if (tracks[0] && !selectedAudio) setSelectedAudio(tracks[0]);
    } catch (err) {
      toast.error(err.message || 'Audio search failed');
    } finally {
      setSearchingAudio(false);
    }
  };

  const togglePlayPreview = (track) => {
    if (!track?.previewUrl || track.previewUrl.includes('instagram.com/reels/audio')) {
      toast('Direct browser preview is unavailable for this track, but Instagram will attach it on publish.');
      return;
    }
    if (playingAudioId === track.audioId && audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setPlayingAudioId(null);
      return;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    const audio = new Audio(track.previewUrl);
    audio.volume = 0.85;
    audio.onended = () => setPlayingAudioId(null);
    audio.play().catch(() => toast.error('Could not play audio preview'));
    audioPlayerRef.current = audio;
    setPlayingAudioId(track.audioId);
  };

  const togglePlatform = (platformId) => {
    if (activeTheme.isCarousel && platformId === 'tiktok') {
      toast.error(`${activeTheme.shortName} is a multi-slide 4:5 carousel and does not publish to TikTok here.`);
      return;
    }
    setPlatforms(prev =>
      prev.includes(platformId) ? prev.filter(p => p !== platformId) : [...prev, platformId]
    );
  };

  const handleCaptionEdit = (val) => {
    setCaption(val);
    setPlatformCaptions(prev => ({
      ...prev,
      [activeCaptionTab]: val,
    }));
  };

  // 3. ONE-CLICK POST NOW (No schedule, no approval queue — straight to live socials)
  const handlePostNow = async () => {
    const isWatchlist = activeTheme.id === 'weekend_watchlist' || activeTheme.entity === 'watchlist' || activeTheme.entity === 'watchlist_3';
    if (isWatchlist && (watchlistPicks.length < 2 || watchlistPicks.length > 8)) {
      return toast.error('Please pick between 2 and 8 films for Weekend Watchlist.');
    }
    if (!isWatchlist && !selectedCandidate) {
      return toast.error('Please select a movie, person, or stage play first.');
    }
    if (activeTheme.id === 'critics_say' && !selectedCriticReview) {
      return toast.error('Please select a critic review to feature.');
    }
    if (!platforms.length) {
      return toast.error('Select at least one social platform to publish to.');
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setPlayingAudioId(null);
    }

    setPublishingNow(true);
    setPublishResult(null);
    const toastId = toast.loading(
      activeTheme.isReel
        ? `Rendering 9:16 Reel with "${selectedAudio?.title || 'Trending Audio'}" & publishing live to ${platforms.join(', ')}...`
        : activeTheme.isCarousel
          ? `Rendering ${isWatchlist ? (watchlistPicks.length + 2) : (activeTheme.slides || 'multi')}-slide 4:5 carousel & publishing live to ${platforms.join(', ')}...`
          : `Publishing live to ${platforms.join(', ')}...`
    );

    try {
      const payload = {
        contentType: activeTheme.contentType,
        themeId: activeTheme.id,
        seriesSlug: activeTheme.seriesSlug,
        templateSlug: activeTheme.templateSlug,
        sourceEntityId: isWatchlist ? watchlistPicks[0].id : selectedCandidate.id,
        sourceEntityIds: isWatchlist ? watchlistPicks.map(f => f.id) : undefined,
        criticReviewId: activeTheme.id === 'critics_say' ? selectedCriticReview?.id : undefined,
        platforms,
        asReel: activeTheme.isReel,
        caption: platformCaptions[activeCaptionTab] || caption,
        captions: platformCaptions,
        audioStreamUrl: activeTheme.isReel ? selectedAudio?.previewUrl || null : null,
        instagramAudio:
          activeTheme.isReel && selectedAudio
            ? {
                audio_id: selectedAudio.audioId,
                audio_type: selectedAudio.audioType || 'music',
                title: selectedAudio.title,
                artist: selectedAudio.artist,
                artwork_url: selectedAudio.artworkUrl,
                audio_volume: 85,
                video_volume: 15,
              }
            : null,
      };

      const res = await fetch('/api/social?task=instant_publish', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Publish failed (HTTP ${res.status})`);

      toast.success('Published live to selected socials!', { id: toastId, duration: 5000 });
      setPublishResult(data);
      onPublished?.(data);
    } catch (err) {
      toast.error(err.message || 'Instant publish failed', { id: toastId, duration: 7000 });
    } finally {
      setPublishingNow(false);
    }
  };

  const isWatchlist = activeTheme.id === 'weekend_watchlist' || activeTheme.entity === 'watchlist' || activeTheme.entity === 'watchlist_3';
  const subjectReady =
    isWatchlist
      ? watchlistPicks.length >= 2 && watchlistPicks.length <= 8
      : Boolean(selectedCandidate);

  return (
    <div className="rounded-3xl border border-white/10 bg-surface p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-amber-500 text-white shadow-lg shadow-brand/25">
            <Icon icon="solar:bolt-bold" width="24" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight text-white">Instant Editorial Express</h2>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                Zero Approval · Direct Publish
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Pick an editorial theme → choose the movie/person → review auto-filled caption & trending music → click <strong>Post Now</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* STEP 1: Choose Editorial Theme */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-zinc-300">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-black text-white">1</span>
          Choose Editorial Theme
        </label>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {INSTANT_EDITORIAL_THEMES.map(theme => {
            const active = theme.id === selectedThemeId;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => handleSelectTheme(theme.id)}
                className={`group flex flex-col items-start justify-between rounded-2xl border p-3.5 text-left transition-all ${
                  active
                    ? 'border-brand bg-brand/15 shadow-md shadow-brand/10'
                    : 'border-white/10 bg-surface-2/60 hover:border-white/25 hover:bg-surface-2'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-brand text-white' : 'bg-white/5 text-zinc-300'}`}>
                    <Icon icon={theme.icon} width="19" />
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                    theme.isReel
                      ? 'border border-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-200'
                      : theme.isCarousel
                        ? 'border border-amber-400/30 bg-amber-500/15 text-amber-200'
                        : 'border border-white/10 bg-white/5 text-zinc-400'
                  }`}>
                    {theme.badge}
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-xs font-black text-white">{theme.shortName}</p>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-zinc-400">{theme.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 2: Responsive Subject Selector (Dropdown + Search) */}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-zinc-200">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-black text-white">2</span>
            {activeTheme.entity === 'person'
              ? `Select ${activeTheme.id === 'behind_the_camera' ? 'Director / Crew Member' : 'Actor / Star'}`
              : activeTheme.entity === 'play'
                ? 'Select Stage Play / Theatre Production'
                : isWatchlist
                  ? `Select 2 to 8 Films for Weekend Watchlist (${watchlistPicks.length}/8 chosen)`
                  : `Select Movie for ${activeTheme.shortName}`}
          </label>
          <span className="text-[10px] font-bold text-zinc-400">
            Format: <strong className="text-brand">{activeTheme.formatBadge}</strong>
          </span>
        </div>

        {/* Search input + Dropdown */}
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Icon icon="solar:magnifer-linear" width="16" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setDropdownOpen(true)}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setDropdownOpen(true);
                }}
                placeholder={
                  activeTheme.entity === 'person'
                    ? 'Search actor or filmmaker by name, or pick from the recommended dropdown below...'
                    : activeTheme.entity === 'play'
                      ? 'Search stage play, or pick from the dropdown list...'
                      : isWatchlist
                        ? 'Search and add 2 to 8 movies for the Weekend Watchlist...'
                        : 'Search movie title, or pick from the recommended dropdown list...'
                }
                className="h-11 w-full rounded-xl border border-white/15 bg-surface px-10 text-xs font-medium text-white outline-none focus:border-brand"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  <Icon icon="solar:close-circle-bold" width="16" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setDropdownOpen(prev => !prev)}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-surface-2 px-4 text-xs font-black text-white hover:border-brand"
            >
              <Icon icon={dropdownOpen ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'} width="15" />
              {dropdownOpen ? 'Hide List' : `Browse List (${candidates.length})`}
            </button>
          </div>

          {/* Selected pill(s) */}
          {isWatchlist && watchlistPicks.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {watchlistPicks.map((pick, idx) => (
                <div key={pick.id} className="flex items-center gap-2 rounded-xl border border-brand/40 bg-brand/15 px-3 py-1.5 text-xs font-bold text-white">
                  <span className="rounded-full bg-brand px-1.5 py-0.2 text-[10px] font-black">#{idx + 1}</span>
                  <span>{pick.name || pick.title}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveWatchlistPick(pick.id)}
                    className="text-zinc-300 hover:text-white"
                    title="Remove from watchlist"
                  >
                    <Icon icon="solar:close-circle-bold" width="15" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {!isWatchlist && selectedCandidate && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
              <div className="flex items-center gap-3 min-w-0">
                {selectedCandidate.imageUrl ? (
                  <img src={selectedCandidate.imageUrl} alt="" className="h-12 w-10 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="flex h-12 w-10 items-center justify-center rounded-lg bg-white/10 text-white">
                    <Icon icon={activeTheme.icon} width="18" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-black text-white">{selectedCandidate.name}</p>
                    <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-300">
                      Selected
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-zinc-300">{selectedCandidate.subtext || selectedCandidate.whyNow || ''}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDropdownOpen(true)}
                className="rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-[11px] font-bold text-zinc-200 hover:bg-black/50"
              >
                Change
              </button>
            </div>
          )}

          {/* Dropdown Candidate List */}
          {(dropdownOpen || (!selectedCandidate && !watchlistPicks.length && candidates.length > 0)) && (
            <div className="mt-2 max-h-64 overflow-y-auto rounded-2xl border border-white/15 bg-surface-2 p-2 shadow-2xl space-y-1">
              {loadingCandidates ? (
                <div className="flex items-center justify-center gap-2 py-6 text-xs text-zinc-400">
                  <Icon icon="solar:spinner-linear" width="16" className="animate-spin" />
                  Loading candidates for {activeTheme.shortName}...
                </div>
              ) : candidates.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-400">
                  No matches found. Try typing another name above.
                </div>
              ) : (
                candidates.map(item => {
                  const isChosen =
                    isWatchlist
                      ? watchlistPicks.some(p => p.id === item.id)
                      : selectedCandidate?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleChooseCandidate(item)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl p-2.5 text-left transition ${
                        isChosen
                          ? 'border border-brand/50 bg-brand/20'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="h-10 w-8 rounded object-cover shrink-0" />
                        ) : (
                          <div className="flex h-10 w-8 items-center justify-center rounded bg-white/10 text-zinc-400 shrink-0">
                            <Icon icon={activeTheme.icon} width="15" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black text-white">{item.name}</p>
                          <p className="truncate text-[10px] text-zinc-400">
                            {item.whyNow || item.subtext || item.category || ''}
                          </p>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-black ${
                        isChosen
                          ? 'bg-brand text-white'
                          : 'bg-white/10 text-white'
                      }`}>
                        {isChosen ? 'Selected ✓' : 'Select'}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Extra responsive field if What The Critics Say is chosen */}
        {activeTheme.id === 'critics_say' && selectedCandidate && (
          <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
            <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300">
              Select Critic Review Quote
            </label>
            {criticReviews.length === 0 ? (
              <p className="text-xs text-amber-300">No critic reviews stored for this film yet.</p>
            ) : (
              <div className="space-y-1.5">
                {criticReviews.map(rev => (
                  <button
                    key={rev.id}
                    type="button"
                    onClick={() => setSelectedCriticReview(rev)}
                    className={`w-full rounded-xl border p-2.5 text-left text-xs transition ${
                      selectedCriticReview?.id === rev.id
                        ? 'border-brand bg-brand/15 text-white'
                        : 'border-white/10 bg-black/20 text-zinc-300 hover:border-white/25'
                    }`}
                  >
                    <p className="font-bold text-white">
                      {rev.critic_name} {rev.rating ? `(${rev.rating}/5 ★)` : ''}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-300">“{rev.quote}”</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* STEP 3: Responsive Auto-Filled Audio & Caption Editor (Opens automatically once subject is chosen) */}
      {subjectReady && (
        <div className="space-y-5 rounded-2xl border border-brand/30 bg-gradient-to-b from-brand/5 to-black/30 p-5 animate-fadeIn">
          {loadingAutoFill && (
            <div className="flex items-center gap-3 rounded-xl border border-brand/30 bg-brand/10 p-3.5 text-xs font-bold text-amber-200">
              <Icon icon="solar:spinner-linear" width="18" className="animate-spin text-brand" />
              <span>
                Generating editorial caption{activeTheme.isReel ? ' & matching live trending Instagram soundtrack' : ''}...
              </span>
            </div>
          )}

          {/* Responsive Trending Audio Section (ONLY for Now Streaming & New & Upcoming Release Reels) */}
          {activeTheme.isReel && (
            <div className="space-y-3 rounded-2xl border border-fuchsia-400/25 bg-black/35 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-fuchsia-500/20 text-fuchsia-300">
                    <Icon icon="solar:music-note-3-bold" width="17" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-white">
                      Trending Reel Soundtrack {audioMood ? `· Matched Mood: ${audioMood.replace('_', ' ')}` : ''}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      Auto-selected from `@muvidb_`’s live Instagram trending list. Click play to preview or switch tracks below.
                    </p>
                  </div>
                </div>
              </div>

              {/* Selected Track Banner */}
              {selectedAudio && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/15 p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {selectedAudio.artworkUrl ? (
                      <img src={selectedAudio.artworkUrl} alt="" className="h-11 w-11 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-fuchsia-500/20 text-fuchsia-200">
                        <Icon icon="solar:music-note-bold" width="18" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-white">{selectedAudio.title}</p>
                      <p className="truncate text-[10px] text-fuchsia-200">
                        {selectedAudio.artist || 'Instagram Trending'} {selectedAudio.matchReason ? `· ${selectedAudio.matchReason}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => togglePlayPreview(selectedAudio)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[11px] font-black text-black hover:bg-fuchsia-100"
                    >
                      <Icon icon={playingAudioId === selectedAudio.audioId ? 'solar:pause-bold' : 'solar:play-bold'} width="13" />
                      {playingAudioId === selectedAudio.audioId ? 'Pause' : 'Preview'}
                    </button>
                  </div>
                </div>
              )}

              {/* Search or switch to another trending track */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={audioSearchQuery}
                  onChange={e => setAudioSearchQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearchAudioManual();
                    }
                  }}
                  placeholder="Search another song or artist (or leave blank to reload Trending)..."
                  className="h-9 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 text-xs text-white outline-none focus:border-fuchsia-400"
                />
                <button
                  type="button"
                  onClick={handleSearchAudioManual}
                  disabled={searchingAudio}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-bold text-white hover:bg-white/20"
                >
                  <Icon icon={searchingAudio ? 'solar:spinner-linear' : 'solar:magnifer-linear'} width="14" className={searchingAudio ? 'animate-spin' : ''} />
                  {audioSearchQuery.trim() ? 'Search Audio' : 'Trending List'}
                </button>
              </div>

              {audioTracks.length > 1 && (
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 max-h-44 overflow-y-auto pr-1">
                  {audioTracks.map(track => {
                    const isSelected = selectedAudio?.audioId === track.audioId;
                    const isPlaying = playingAudioId === track.audioId;
                    return (
                      <div
                        key={track.audioId}
                        className={`flex items-center justify-between gap-2 rounded-xl border p-2 text-left transition ${
                          isSelected
                            ? 'border-fuchsia-400/60 bg-fuchsia-400/15'
                            : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedAudio(track)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                        >
                          {track.artworkUrl ? (
                            <img src={track.artworkUrl} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
                          ) : (
                            <span className="flex h-8 w-8 items-center justify-center rounded bg-white/10 text-fuchsia-300 shrink-0">
                              <Icon icon="solar:music-note-bold" width="14" />
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[11px] font-bold text-white">{track.title}</span>
                            <span className="block truncate text-[9px] text-zinc-400">{track.artist}</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePlayPreview(track)}
                          className="rounded-lg bg-white/10 p-1.5 text-white hover:bg-white/20"
                          title="Preview audio"
                        >
                          <Icon icon={isPlaying ? 'solar:pause-bold' : 'solar:play-bold'} width="12" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Editable Auto-Generated Caption */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-zinc-200">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-black text-white">3</span>
                Auto-Generated Editorial Caption (Editable)
              </label>
              <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
                {PLATFORMS.filter(p => !(activeTheme.isCarousel && p.id === 'tiktok')).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setActiveCaptionTab(p.id);
                      setCaption(platformCaptions[p.id] || caption);
                    }}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase transition ${
                      activeCaptionTab === p.id ? 'bg-brand text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Icon icon={p.icon} width="12" />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={6}
              value={platformCaptions[activeCaptionTab] ?? caption}
              onChange={e => handleCaptionEdit(e.target.value)}
              placeholder="Editorial caption will auto-populate here..."
              className="w-full rounded-2xl border border-white/15 bg-black/40 p-4 text-xs leading-relaxed text-white outline-none focus:border-brand"
            />
          </div>

          {/* STEP 4: Select Target Socials & POST NOW (No Schedule, No Approval) */}
          <div className="flex flex-col gap-4 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <span className="block text-[10px] font-black uppercase tracking-wider text-zinc-400">
                Publish Immediately To:
              </span>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => {
                  const disabled = activeTheme.isCarousel && p.id === 'tiktok';
                  const checked = platforms.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => togglePlatform(p.id)}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-black transition ${
                        disabled
                          ? 'cursor-not-allowed border-white/5 bg-white/[0.02] text-zinc-600 opacity-50'
                          : checked
                            ? 'border-brand bg-brand/20 text-white shadow-sm'
                            : 'border-white/10 bg-black/30 text-zinc-400 hover:border-white/25 hover:text-white'
                      }`}
                    >
                      <Icon icon={p.icon} width="15" />
                      <span>{p.label}</span>
                      {checked && <Icon icon="solar:check-circle-bold" width="15" className="text-brand" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handlePostNow}
              disabled={publishingNow || loadingAutoFill}
              className="inline-flex h-12 items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-brand via-orange-500 to-amber-500 px-8 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-brand/30 transition hover:brightness-110 disabled:opacity-50"
            >
              <Icon
                icon={publishingNow ? 'solar:spinner-linear' : 'solar:plain-bold'}
                width="18"
                className={publishingNow ? 'animate-spin' : ''}
              />
              <span>{publishingNow ? 'Publishing Live Now...' : 'Post Now to Selected Socials'}</span>
            </button>
          </div>

          {publishResult && (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon icon="solar:check-circle-bold" width="18" className="text-emerald-400" />
                <span>
                  Published directly! Content Item ID: <code>{publishResult.contentItemId}</code>
                </span>
              </div>
              {publishResult.reel?.publicUrl && (
                <a
                  href={publishResult.reel.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-black underline text-emerald-300 hover:text-white"
                >
                  View Rendered 9:16 Reel MP4 ↗
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

