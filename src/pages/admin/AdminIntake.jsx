import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { authHeaders } from '../../lib/apiAuth';
import { supabase } from '../../lib/supabase';
import { extractCreditsWithLocalOCR, extractRawTextWithLocalOCR } from '../../utils/localCreditOcr';

const DESTINATIONS = [
  { id: 'film', label: 'Film / Movie', icon: 'solar:clapperboard-play-linear' },
  { id: 'play', label: 'Stage Play', icon: 'solar:mask-hamsa-linear' },
  { id: 'critic_review', label: 'Critic Review', icon: 'solar:chat-round-bold-linear' },
  { id: 'social_post', label: 'Social Draft', icon: 'solar:magic-stick-3-linear' },
];

const STANDARD_GENRES = [
  'Drama', 'Comedy', 'Thriller', 'Action', 'Romance', 'Horror', 'Crime',
  'Family', 'Epic', 'Mystery', 'Sci-Fi', 'Documentary', 'Animation'
];

const PLAY_GENRES = [
  'Drama', 'Musical', 'Tragedy', 'Comedy', 'Historical', 'Satire', 'Folklore', 'Dance Drama'
];

export default function AdminIntake() {
  // Input & state
  const [url, setUrl] = useState('');
  const [manualCaption, setManualCaption] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  // Extracted data
  const [postData, setPostData] = useState(null);
  const [selectedSlideIdx, setSelectedSlideIdx] = useState(0);

  // Active destination tab
  const [activeTab, setActiveTab] = useState('film');

  // OCR state
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrEngine, setOcrEngine] = useState('ai'); // 'ai' | 'local'
  const [ocrResult, setOcrResult] = useState(null);
  const [showOcrPanel, setShowOcrPanel] = useState(false);

  // Forms
  const [filmForm, setFilmForm] = useState({
    title: '',
    year: new Date().getFullYear(),
    release_date: '',
    synopsis: '',
    genres: ['Drama'],
    runtime_minutes: '',
    director: '',
    cast: [],
    platform: 'Cinema',
    content_type: 'movie',
    poster_url: '',
    backdrop_url: '',
    trailer_external_url: '',
    status: 'upcoming',
  });

  const [playForm, setPlayForm] = useState({
    title: '',
    year: new Date().getFullYear(),
    venue: 'Terra Kulture, Victoria Island',
    city: 'Lagos',
    country: 'Nigeria',
    run_start_date: '',
    run_end_date: '',
    performance_time: '3:00 PM & 7:00 PM',
    playwright: '',
    director: '',
    producer: '',
    genre: 'Drama',
    synopsis: '',
    status: 'upcoming',
    poster_url: '',
    banner_url: '',
    source_url: '',
  });

  const [reviewForm, setReviewForm] = useState({
    targetType: 'film', // 'film' | 'play'
    film_title: '',
    film_id: '',
    play_id: '',
    critic_name: '',
    publication: '',
    quote: '',
    rating: 8,
    rating_scale: 10,
    review_url: '',
    is_anonymous: false,
    is_featured: true,
  });

  const [socialForm, setSocialForm] = useState({
    headline: '',
    instagram_caption: '',
    facebook_caption: '',
    threads_post: '',
    imageUrl: '',
  });

  // Publishing state
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState(null);

  // Instagram scout session state
  const [igSessionStatus, setIgSessionStatus] = useState(null);
  const [isCheckingIgSession, setIsCheckingIgSession] = useState(false);

  const checkIgSession = async () => {
    setIsCheckingIgSession(true);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/social?task=instagram_session_status', { headers });
      if (res.ok) {
        const data = await res.json();
        setIgSessionStatus(data);
      }
    } catch (err) {
      console.warn('Could not check IG session:', err);
    } finally {
      setIsCheckingIgSession(false);
    }
  };

  useEffect(() => {
    checkIgSession();
  }, []);

  // Live person lookup for director / cast
  const [personSearchQuery, setPersonSearchQuery] = useState('');
  const [personSearchResults, setPersonSearchResults] = useState([]);
  const [isSearchingPeople, setIsSearchingPeople] = useState(false);
  const [activePersonField, setActivePersonField] = useState(null); // 'director' | 'cast_add'

  // Match existing film lookup for review
  const [filmSearchQuery, setFilmSearchQuery] = useState('');
  const [filmSearchResults, setFilmSearchResults] = useState([]);
  const [isSearchingFilms, setIsSearchingFilms] = useState(false);

  // Reset all
  const handleReset = () => {
    setUrl('');
    setManualCaption('');
    setPostData(null);
    setSelectedSlideIdx(0);
    setOcrResult(null);
    setShowOcrPanel(false);
    setPublishResult(null);
    setFilmForm({
      title: '',
      year: new Date().getFullYear(),
      release_date: '',
      synopsis: '',
      genres: ['Drama'],
      runtime_minutes: '',
      director: '',
      cast: [],
      platform: 'Cinema',
      content_type: 'movie',
      poster_url: '',
      backdrop_url: '',
      trailer_external_url: '',
      status: 'upcoming',
    });
    setPlayForm({
      title: '',
      year: new Date().getFullYear(),
      venue: 'Terra Kulture, Victoria Island',
      city: 'Lagos',
      country: 'Nigeria',
      run_start_date: '',
      run_end_date: '',
      performance_time: '3:00 PM & 7:00 PM',
      playwright: '',
      director: '',
      producer: '',
      genre: 'Drama',
      synopsis: '',
      status: 'upcoming',
      poster_url: '',
      banner_url: '',
      source_url: '',
    });
    setReviewForm({
      targetType: 'film',
      film_title: '',
      film_id: '',
      play_id: '',
      critic_name: '',
      publication: '',
      quote: '',
      rating: 8,
      rating_scale: 10,
      review_url: '',
      is_anonymous: false,
      is_featured: true,
    });
  };

  // Fetch post media & caption
  const handleFetchPost = async () => {
    if (!url.trim() && !manualCaption.trim()) {
      toast.error('Please enter a post URL or paste a caption.');
      return;
    }

    setIsFetching(true);
    setPublishResult(null);

    try {
      const headers = await authHeaders();
      const res = await fetch('/api/social?task=social_intake_extract', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          url: url.trim(),
          caption: manualCaption.trim() || undefined,
          runOcr: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to extract post details.');

      setPostData(data);
      setSelectedSlideIdx(0);

      // Populate film form
      const filmSug = data.suggestions?.film || {};
      const primaryPoster = data.media?.find(m => m.type === 'image' && m.isPrimary)?.url || data.media?.find(m => m.type === 'image')?.url || '';
      const secondaryBackdrop = data.media?.filter(m => m.type === 'image')?.[1]?.url || '';

      setFilmForm({
        title: filmSug.title || '',
        year: filmSug.year || new Date().getFullYear(),
        release_date: filmSug.release_date || '',
        synopsis: filmSug.synopsis || data.caption || '',
        genres: filmSug.genres?.length ? filmSug.genres : ['Drama'],
        runtime_minutes: filmSug.runtime_minutes || '',
        director: filmSug.director || '',
        cast: Array.isArray(filmSug.cast) ? filmSug.cast : [],
        platform: filmSug.platform || 'Cinema',
        content_type: filmSug.content_type || 'movie',
        poster_url: primaryPoster,
        backdrop_url: secondaryBackdrop,
        trailer_external_url: /youtu(?:\.be|be\.com)/i.test(url) ? url : '',
        status: 'upcoming',
      });

      // Populate stage play form
      const playSug = data.suggestions?.play || {};
      setPlayForm({
        title: playSug.title || filmSug.title || '',
        year: playSug.year || new Date().getFullYear(),
        venue: playSug.venue || 'Terra Kulture, Victoria Island',
        city: playSug.city || 'Lagos',
        country: playSug.country || 'Nigeria',
        run_start_date: playSug.run_start_date || '',
        run_end_date: playSug.run_end_date || '',
        performance_time: playSug.performance_time || '3:00 PM & 7:00 PM',
        playwright: playSug.playwright || '',
        director: playSug.director || filmSug.director || '',
        producer: playSug.producer || '',
        genre: playSug.genre || 'Drama',
        synopsis: playSug.synopsis || data.caption || '',
        status: playSug.status || 'upcoming',
        poster_url: primaryPoster,
        banner_url: secondaryBackdrop,
        source_url: url || '',
      });

      // Populate review form
      const revSug = data.suggestions?.review || {};
      setReviewForm(prev => ({
        ...prev,
        film_title: revSug.film_title || filmSug.title || '',
        critic_name: revSug.critic_name || data.authorName || '',
        publication: revSug.publication || data.authorUsername || '',
        quote: revSug.quote || (data.caption ? data.caption.slice(0, 300) : ''),
        rating: revSug.rating ?? 8,
        rating_scale: revSug.rating_scale || 10,
        review_url: url || '',
      }));

      // Populate social form
      const socSug = data.suggestions?.social || {};
      setSocialForm({
        headline: socSug.headline || filmSug.title || '',
        instagram_caption: socSug.instagram_caption || data.caption || '',
        facebook_caption: socSug.facebook_caption || data.caption || '',
        threads_post: socSug.threads_post || (data.caption ? data.caption.slice(0, 480) : ''),
        imageUrl: primaryPoster,
      });

      toast.success(`Fetched post with ${data.media?.length || 0} media assets and ${data.mentions?.length || 0} resolved mentions!`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Error extracting post details.');
    } finally {
      setIsFetching(false);
    }
  };

  // Run OCR on current selected slide
  const handleRunOcrOnSlide = async (slideUrl) => {
    const targetUrl = slideUrl || postData?.media?.[selectedSlideIdx]?.url;
    if (!targetUrl) {
      toast.error('No slide image available to scan.');
      return;
    }

    setIsOcrProcessing(true);
    setShowOcrPanel(true);

    try {
      if (ocrEngine === 'local') {
        // Run client-side Tesseract.js
        toast.loading('Running Free Local OCR in browser…', { id: 'ocr-run' });
        const credits = await extractCreditsWithLocalOCR(targetUrl, 'cast');
        const rawText = await extractRawTextWithLocalOCR(targetUrl);
        const result = {
          rawText: rawText || 'Extracted via Local OCR',
          cast: credits.map(c => ({ name: c.name, character_name: c.role_or_character })),
          crew: [],
        };
        setOcrResult(result);
        toast.success(`Local OCR complete! Found ${credits.length} cast names.`, { id: 'ocr-run' });
      } else {
        // Run Server AI Vision OCR
        toast.loading('Scanning poster with AI Vision…', { id: 'ocr-run' });
        const headers = await authHeaders();
        const res = await fetch('/api/social?task=social_intake_ocr', {
          method: 'POST',
          headers,
          body: JSON.stringify({ imageUrl: targetUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Vision OCR failed.');

        setOcrResult(data);
        toast.success(`AI Vision OCR complete! Extracted ${data.cast?.length || 0} cast and ${data.crew?.length || 0} crew members.`, { id: 'ocr-run' });
      }
    } catch (err) {
      console.error('OCR Error:', err);
      toast.error(err.message || 'OCR extraction failed.', { id: 'ocr-run' });
    } finally {
      setIsOcrProcessing(false);
    }
  };

  // Merge OCR cast into the film cast
  const handleApplyOcrToCast = () => {
    if (!ocrResult?.cast?.length) {
      toast.error('No cast items found in OCR result.');
      return;
    }

    const currentCast = [...(filmForm.cast || [])];
    const existingNames = new Set(currentCast.map(c => (typeof c === 'string' ? c : c.name).toLowerCase().trim()));

    let addedCount = 0;
    for (const item of ocrResult.cast) {
      if (!item.name || !item.name.trim()) continue;
      const lower = item.name.toLowerCase().trim();
      if (!existingNames.has(lower)) {
        currentCast.push({
          name: item.name.trim(),
          character_name: item.character_name ? item.character_name.trim() : null,
        });
        existingNames.add(lower);
        addedCount++;
      }
    }

    // Also check crew for Director
    const directorEntry = ocrResult.crew?.find(c => /director/i.test(c.role));
    if (directorEntry?.name && !filmForm.director) {
      setFilmForm(prev => ({ ...prev, director: directorEntry.name.trim() }));
    }

    setFilmForm(prev => ({ ...prev, cast: currentCast }));
    toast.success(`Merged ${addedCount} new cast members from OCR billing block!`);
  };

  // Add mention directly to cast
  const handleAddMentionToCast = (mention) => {
    const nameToAdd = mention.resolvedName || mention.handle.replace(/^@+/, '');
    const currentCast = [...(filmForm.cast || [])];
    const exists = currentCast.some(c => (typeof c === 'string' ? c : c.name).toLowerCase() === nameToAdd.toLowerCase());

    if (exists) {
      toast.error(`${nameToAdd} is already in the cast list.`);
      return;
    }

    currentCast.push({ name: nameToAdd, character_name: null });
    setFilmForm(prev => ({ ...prev, cast: currentCast }));
    toast.success(`Added ${nameToAdd} to Cast!`);
  };

  // Set mention as director
  const handleSetMentionAsDirector = (mention) => {
    const name = mention.resolvedName || mention.handle.replace(/^@+/, '');
    setFilmForm(prev => ({ ...prev, director: name }));
    setPlayForm(prev => ({ ...prev, director: name }));
    toast.success(`Set ${name} as Director!`);
  };

  // Set mention as playwright
  const handleSetMentionAsPlaywright = (mention) => {
    const name = mention.resolvedName || mention.handle.replace(/^@+/, '');
    setPlayForm(prev => ({ ...prev, playwright: name }));
    toast.success(`Set ${name} as Playwright!`);
  };

  // Add manual cast row
  const handleAddManualCastRow = () => {
    setFilmForm(prev => ({
      ...prev,
      cast: [...(prev.cast || []), { name: '', character_name: '' }],
    }));
  };

  // Remove cast row
  const handleRemoveCastRow = (index) => {
    setFilmForm(prev => ({
      ...prev,
      cast: prev.cast.filter((_, idx) => idx !== index),
    }));
  };

  // Update cast row
  const handleUpdateCastRow = (index, field, value) => {
    setFilmForm(prev => ({
      ...prev,
      cast: prev.cast.map((item, idx) => idx === index ? { ...item, [field]: value } : item),
    }));
  };

  // Toggle Genre
  const handleToggleGenre = (g) => {
    setFilmForm(prev => {
      const exists = prev.genres.includes(g);
      const next = exists ? prev.genres.filter(x => x !== g) : [...prev.genres, g];
      return { ...prev, genres: next.length ? next : [g] };
    });
  };

  // File upload handler
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result;
        if (dataUrl) {
          setPostData(prev => {
            const currentMedia = prev?.media ? [...prev.media] : [];
            currentMedia.push({ url: dataUrl, type: 'image', isPrimary: currentMedia.length === 0 });
            return {
              ...(prev || { success: true, platform: 'manual', sourceUrl: '', caption: '', media: [], mentions: [] }),
              media: currentMedia,
            };
          });
          if (!filmForm.poster_url) setFilmForm(prev => ({ ...prev, poster_url: dataUrl }));
          if (!playForm.poster_url) setPlayForm(prev => ({ ...prev, poster_url: dataUrl }));
          toast.success(`Uploaded ${file.name}`);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Instant Publish / Create handler
  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishResult(null);

    try {
      const headers = await authHeaders();
      let payload = {};

      if (activeTab === 'film') {
        if (!filmForm.title.trim()) throw new Error('Film Title is required.');
        if (!filmForm.synopsis.trim() || filmForm.synopsis.trim().length < 20) {
          throw new Error('Please provide a synopsis of at least 20 characters.');
        }
        payload = { ...filmForm };
      } else if (activeTab === 'play') {
        if (!playForm.title.trim()) throw new Error('Stage Play Title is required.');
        payload = { ...playForm };
      } else if (activeTab === 'critic_review') {
        if (!reviewForm.quote.trim()) throw new Error('Review quote is required.');
        if (!reviewForm.film_title.trim() && !reviewForm.film_id && !reviewForm.play_id) {
          throw new Error('Please match or enter a film/play title for this review.');
        }
        payload = { ...reviewForm };
      } else if (activeTab === 'social_post') {
        payload = {
          ...socialForm,
          source_url: url || postData?.sourceUrl || '',
          captions: {
            instagram: socialForm.instagram_caption,
            facebook: socialForm.facebook_caption,
            threads: socialForm.threads_post,
          },
        };
      }

      const res = await fetch('/api/social?task=social_intake_publish', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          entityType: activeTab,
          payload,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Publishing failed.');

      setPublishResult(data);
      const label = activeTab === 'film' ? 'Film created' : activeTab === 'play' ? 'Stage Play created' : activeTab === 'critic_review' ? 'Review published' : 'Social Draft created';
      toast.success(`✓ ${label} successfully!`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to publish intake entity.');
    } finally {
      setIsPublishing(false);
    }
  };

  const currentMedia = postData?.media || [];
  const activeSlide = currentMedia[selectedSlideIdx] || currentMedia[0];

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-4 sm:px-6">
      <SEO title="Admin Social Intake | MuviDB" description="Ingest social media posts into Films, Stage Plays, and Reviews." />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Icon icon="solar:import-linear" width="20" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-text-primary tracking-tight">
              Social Intake & Instant Creator
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-text-muted">
            Fetch Instagram, Facebook & Threads posts or carousels. Resolve @handles to real Nollywood stars, run OCR on flyers, and publish in 1 click.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* IG Session Status Badge */}
          {igSessionStatus && (
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                igSessionStatus.hasSession
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-border bg-surface-2/70 text-text-muted hover:border-amber-500/40'
              }`}
              title={
                igSessionStatus.hasSession
                  ? `Instagram Scout Session Active (Source: ${igSessionStatus.source}). Bypasses login gates & rate limits.`
                  : "Instagram Session: Anonymous (oEmbed fallbacks). To enable zero-limit authenticated scraping, run 'npm run ig:login' or set IG_COOKIE in .env."
              }
            >
              {igSessionStatus.hasSession ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <Icon icon="ri:instagram-line" className="text-emerald-400" />
                  <span>IG Scout: Active</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-400/80"></span>
                  <Icon icon="ri:instagram-line" className="text-text-muted" />
                  <span>IG: Anonymous</span>
                  <button
                    type="button"
                    onClick={checkIgSession}
                    disabled={isCheckingIgSession}
                    className="ml-1 text-text-muted hover:text-text-primary p-0.5 rounded transition-colors"
                    title="Refresh IG session status"
                  >
                    <Icon icon="solar:refresh-linear" className={isCheckingIgSession ? 'animate-spin' : ''} width="12" />
                  </button>
                </>
              )}
            </div>
          )}

          {postData && (
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-border text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
            >
              <Icon icon="solar:refresh-linear" />
              Reset All
            </button>
          )}
          <Link
            to="/admin/social"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-brand/30 bg-brand/5 text-brand hover:bg-brand/10 transition-colors"
          >
            <Icon icon="solar:magic-stick-3-linear" />
            Open Social Studio
          </Link>
        </div>
      </div>

      {/* ── STEP 1: URL Input & Fetcher ── */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-black uppercase tracking-wider text-text-muted flex items-center gap-2">
            <Icon icon="solar:link-circle-linear" className="text-brand" width="16" />
            Post URL (Instagram, Facebook, Threads, YouTube)
          </label>
          <div className="flex items-center gap-2 text-text-muted text-xs">
            <Icon icon="ri:instagram-line" width="16" className="text-pink-500" />
            <Icon icon="ri:facebook-fill" width="16" className="text-blue-500" />
            <Icon icon="ri:threads-fill" width="16" className="text-white" />
            <Icon icon="ri:youtube-fill" width="16" className="text-red-500" />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFetchPost()}
            placeholder="https://www.instagram.com/p/DBxyz/ or Facebook/Threads link..."
            className="flex-1 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-text-primary placeholder:text-text-muted/50 outline-none focus:border-brand transition-colors font-mono"
          />
          <button
            onClick={handleFetchPost}
            disabled={isFetching || (!url.trim() && !manualCaption.trim())}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand text-white font-black text-sm hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all shadow-lg shadow-brand/20 shrink-0"
          >
            {isFetching ? (
              <>
                <Icon icon="solar:spinner-linear" className="animate-spin" width="18" />
                <span>Extracting with AI…</span>
              </>
            ) : (
              <>
                <Icon icon="solar:magnifer-linear" width="18" />
                <span>Fetch Post</span>
              </>
            )}
          </button>
        </div>

        {/* Dynamic Scout Session Advice for Instagram Links */}
        {url.includes('instagram.com') && (
          <div className="flex items-center gap-2 text-[11px] text-text-muted bg-surface-2/60 px-3.5 py-2 rounded-xl border border-border/50">
            <Icon
              icon="ri:instagram-line"
              className={igSessionStatus?.hasSession ? 'text-emerald-400 shrink-0' : 'text-pink-500 shrink-0'}
              width="14"
            />
            {igSessionStatus?.hasSession ? (
              <span className="text-emerald-400 font-medium">
                Instagram scout session active ({igSessionStatus.source === 'env' ? 'Environment variable' : 'scratch/ig_session.json'}): full carousel & HD stream extraction enabled without login walls.
              </span>
            ) : (
              <span>
                Anonymous mode: using public oEmbed and embed fallback scraping. For 100% carousel reliability without login redirects, run <code className="text-brand font-mono font-bold">npm run ig:login</code> or set <code className="text-brand font-mono font-bold">IG_COOKIE</code> in .env.
              </span>
            )}
          </div>
        )}

        {/* Manual caption / upload collapsible */}
        <div className="border-t border-border/40 pt-3">
          <button
            type="button"
            onClick={() => setShowManualInput(!showManualInput)}
            className="text-xs font-bold text-text-muted hover:text-text-primary flex items-center gap-1.5 transition-colors"
          >
            <Icon icon={showManualInput ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} />
            {showManualInput ? 'Hide manual text & upload tools' : 'Paste caption or upload flyers manually instead'}
          </button>

          {showManualInput && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 pt-2 animate-fadeIn">
              <div>
                <label className="text-[10px] font-black uppercase text-text-muted block mb-1">
                  Manual Post Caption / Announcement Text
                </label>
                <textarea
                  value={manualCaption}
                  onChange={(e) => setManualCaption(e.target.value)}
                  rows={4}
                  placeholder="Paste Instagram/Facebook caption here (with @mentions, release dates, cinema tags)..."
                  className="w-full rounded-xl border border-border bg-surface-2 p-3 text-xs text-text-primary outline-none focus:border-brand transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-text-muted block mb-1">
                  Upload Flyer / Poster Screenshots
                </label>
                <div className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-brand/60 transition-colors bg-surface-2/40">
                  <input
                    type="file"
                    id="flyer-upload"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <label htmlFor="flyer-upload" className="cursor-pointer block">
                    <Icon icon="solar:gallery-wide-linear" className="mx-auto text-text-muted mb-1" width="28" />
                    <p className="text-xs font-bold text-text-primary">Click to select poster images</p>
                    <p className="text-[10px] text-text-muted mt-0.5">PNG, JPG, WebP supported</p>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── STEP 2: Extracted Carousel & Media Gallery ── */}
      {currentMedia.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/50 pb-3">
            <div className="flex items-center gap-2">
              <Icon icon="solar:gallery-linear" className="text-brand" width="18" />
              <h2 className="text-sm font-black uppercase tracking-wider text-text-primary">
                Extracted Media Slides ({currentMedia.length})
              </h2>
            </div>
            <p className="text-xs text-text-muted">
              Slide {selectedSlideIdx + 1} of {currentMedia.length} selected
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            {/* Horizontal / Grid Thumbnail Strip */}
            <div className="flex lg:flex-col gap-3 overflow-x-auto pb-2 lg:pb-0 max-h-[460px] scrollbar-thin">
              {currentMedia.map((media, idx) => {
                const isSelected = selectedSlideIdx === idx;
                const isPoster = filmForm.poster_url === media.url || playForm.poster_url === media.url;
                const isBackdrop = filmForm.backdrop_url === media.url || playForm.banner_url === media.url;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedSlideIdx(idx)}
                    className={`relative shrink-0 rounded-xl overflow-hidden border-2 text-left transition-all p-1 bg-surface-2 ${
                      isSelected ? 'border-brand ring-2 ring-brand/20 shadow-md' : 'border-border hover:border-brand/40'
                    }`}
                  >
                    <div className="relative aspect-[4/5] w-24 lg:w-full bg-black/20 rounded-lg overflow-hidden">
                      {media.type === 'video' ? (
                        <div className="h-full w-full flex items-center justify-center bg-black/40 text-white">
                          <Icon icon="solar:videocamera-record-bold" width="28" />
                        </div>
                      ) : (
                        <img src={media.url} alt="" className="h-full w-full object-cover" />
                      )}

                      <span className="absolute bottom-1.5 left-1.5 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] font-black text-white">
                        Slide {idx + 1}
                      </span>

                      {isPoster && (
                        <span className="absolute top-1.5 left-1.5 bg-brand text-white px-1.5 py-0.5 rounded text-[8px] font-black uppercase shadow">
                          Poster
                        </span>
                      )}
                      {isBackdrop && (
                        <span className="absolute top-1.5 right-1.5 bg-purple-600 text-white px-1.5 py-0.5 rounded text-[8px] font-black uppercase shadow">
                          Backdrop
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Slide Preview & Slide Quick Actions */}
            {activeSlide && (
              <div className="flex flex-col sm:flex-row gap-5 items-start bg-surface-2/40 rounded-xl p-4 border border-border/40">
                <div className="w-full sm:w-56 shrink-0 rounded-xl overflow-hidden border border-border bg-black/40 shadow-md aspect-[4/5] relative">
                  {activeSlide.type === 'video' ? (
                    <video src={activeSlide.url} controls className="w-full h-full object-contain" />
                  ) : (
                    <img src={activeSlide.url} alt="Slide preview" className="w-full h-full object-contain" />
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-brand">
                      Active Slide {selectedSlideIdx + 1} of {currentMedia.length}
                    </span>
                    <h3 className="text-sm font-bold text-text-primary mt-0.5">
                      Assign Artwork & Perform OCR
                    </h3>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">
                      Use this slide as the primary portrait poster, backdrop banner, or scan its billing block text.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setFilmForm(prev => ({ ...prev, poster_url: activeSlide.url }));
                        setPlayForm(prev => ({ ...prev, poster_url: activeSlide.url }));
                        setSocialForm(prev => ({ ...prev, imageUrl: activeSlide.url }));
                        toast.success(`Slide ${selectedSlideIdx + 1} set as Poster!`);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand text-white text-xs font-bold shadow-sm hover:brightness-110 active:scale-95 transition-all"
                    >
                      <Icon icon="solar:star-bold" />
                      Set as Poster
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFilmForm(prev => ({ ...prev, backdrop_url: activeSlide.url }));
                        setPlayForm(prev => ({ ...prev, banner_url: activeSlide.url }));
                        toast.success(`Slide ${selectedSlideIdx + 1} set as Backdrop!`);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400 text-xs font-bold hover:bg-purple-500/20 active:scale-95 transition-all"
                    >
                      <Icon icon="solar:gallery-wide-linear" />
                      Set as Backdrop
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRunOcrOnSlide(activeSlide.url)}
                      disabled={isOcrProcessing || activeSlide.type === 'video'}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-surface text-text-primary text-xs font-bold hover:border-brand active:scale-95 transition-all disabled:opacity-50"
                    >
                      <Icon icon={isOcrProcessing ? 'solar:spinner-linear' : 'solar:scanner-linear'} className={isOcrProcessing ? 'animate-spin text-brand' : ''} />
                      {isOcrProcessing ? 'Scanning Slide…' : 'Run OCR on Slide'}
                    </button>
                  </div>

                  {/* OCR Engine selector */}
                  <div className="flex items-center gap-3 pt-2 text-xs">
                    <span className="text-[10px] font-bold text-text-muted uppercase">OCR Engine:</span>
                    <label className="flex items-center gap-1.5 cursor-pointer text-text-muted hover:text-text-primary">
                      <input
                        type="radio"
                        name="ocrEngine"
                        checked={ocrEngine === 'ai'}
                        onChange={() => setOcrEngine('ai')}
                        className="text-brand focus:ring-0"
                      />
                      <span>AI Vision (Gemini)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-text-muted hover:text-text-primary">
                      <input
                        type="radio"
                        name="ocrEngine"
                        checked={ocrEngine === 'local'}
                        onChange={() => setOcrEngine('local')}
                        className="text-brand focus:ring-0"
                      />
                      <span>Local Free OCR (Browser)</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 3: Resolved Mentions Strip ── */}
      {postData?.mentions && postData.mentions.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <div className="flex items-center gap-2">
              <Icon icon="solar:users-group-rounded-linear" className="text-brand" width="18" />
              <h2 className="text-xs font-black uppercase tracking-wider text-text-primary">
                Resolved Social @Mentions ({postData.mentions.length})
              </h2>
            </div>
            <p className="text-[11px] text-text-muted">
              Auto-resolved to real human names in Nollywood database. Click to quick-add.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {postData.mentions.map((mention, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs transition-all hover:border-brand/40 shadow-sm"
              >
                {mention.photoUrl ? (
                  <img src={mention.photoUrl} alt="" className="h-6 w-6 rounded-full object-cover border border-border" />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-brand/10 text-brand flex items-center justify-center font-black text-[10px]">
                    {mention.resolvedName?.charAt(0) || '@'}
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-text-primary">{mention.resolvedName}</span>
                    {mention.matched && (
                      <Icon icon="solar:check-circle-bold" className="text-emerald-400" width="13" title="Verified in database" />
                    )}
                  </div>
                  <span className="text-[10px] text-text-muted font-mono">{mention.handle}</span>
                </div>

                <div className="flex items-center gap-1 ml-1 border-l border-border/60 pl-2">
                  <button
                    type="button"
                    onClick={() => handleAddMentionToCast(mention)}
                    className="p-1 rounded hover:bg-brand/10 text-text-muted hover:text-brand transition-colors text-[10px] font-bold"
                    title="Add to Cast list"
                  >
                    + Cast
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetMentionAsDirector(mention)}
                    className="p-1 rounded hover:bg-purple-500/10 text-text-muted hover:text-purple-400 transition-colors text-[10px] font-bold"
                    title="Set as Director"
                  >
                    + Dir
                  </button>
                  {activeTab === 'play' && (
                    <button
                      type="button"
                      onClick={() => handleSetMentionAsPlaywright(mention)}
                      className="p-1 rounded hover:bg-blue-500/10 text-text-muted hover:text-blue-400 transition-colors text-[10px] font-bold"
                      title="Set as Playwright"
                    >
                      + Writer
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 4: OCR Extraction Results (Collapsible) ── */}
      {ocrResult && (
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/50 pb-3">
            <div className="flex items-center gap-2">
              <Icon icon="solar:document-text-bold" className="text-brand" width="18" />
              <h2 className="text-xs font-black uppercase tracking-wider text-text-primary">
                OCR Billing Block Extraction
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleApplyOcrToCast}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-sm"
              >
                <Icon icon="solar:check-circle-bold" />
                Merge {ocrResult.cast?.length || 0} Actors into Cast Table
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface-2 p-3 space-y-2">
              <span className="text-[10px] font-black uppercase text-text-muted">Detected Cast & Characters</span>
              {ocrResult.cast?.length ? (
                <div className="space-y-1.5 max-h-56 overflow-y-auto scrollbar-thin">
                  {ocrResult.cast.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-surface border border-border/40">
                      <span className="font-bold text-text-primary">{c.name}</span>
                      <span className="text-text-muted italic">{c.character_name || 'No character'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-muted italic">No cast rows identified in this pass.</p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface-2 p-3 space-y-2">
              <span className="text-[10px] font-black uppercase text-text-muted">Detected Crew Roles</span>
              {ocrResult.crew?.length ? (
                <div className="space-y-1.5 max-h-56 overflow-y-auto scrollbar-thin">
                  {ocrResult.crew.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-surface border border-border/40">
                      <span className="text-brand font-bold uppercase text-[10px]">{c.role}</span>
                      <span className="text-text-primary font-medium">{c.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-muted italic">No standardized crew roles identified.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 5: Destination Selector Tabs ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
        <span className="text-[11px] font-black uppercase tracking-wider text-text-muted mr-2">
          Select Destination:
        </span>
        {DESTINATIONS.map(dest => (
          <button
            key={dest.id}
            type="button"
            onClick={() => setActiveTab(dest.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeTab === dest.id
                ? 'bg-brand text-white shadow-md shadow-brand/20 scale-105'
                : 'bg-surface-2 text-text-muted hover:text-text-primary border border-border'
            }`}
          >
            <Icon icon={dest.icon} width="16" />
            <span>{dest.label}</span>
          </button>
        ))}
      </div>

      {/* ── STEP 6: Interactive Pre-filled Form ── */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-6">

        {/* 🎬 FILM FORM */}
        {activeTab === 'film' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/40 pb-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-brand">
                  1. Film Specifications & Credits
                </h3>
                <p className="text-xs text-text-muted">Review and refine the extracted Nollywood film details.</p>
              </div>
              <span className="text-xs font-bold text-text-muted">
                Zero-Duplicate Actor Guarantee Active
              </span>
            </div>

            {/* Poster & Backdrop URLs */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Poster URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={filmForm.poster_url}
                    onChange={(e) => setFilmForm(prev => ({ ...prev, poster_url: e.target.value }))}
                    placeholder="https://..."
                    className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand font-mono"
                  />
                  {filmForm.poster_url && (
                    <img src={filmForm.poster_url} alt="" className="h-8 w-6 rounded object-cover border border-border shrink-0" />
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Backdrop / Banner URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={filmForm.backdrop_url}
                    onChange={(e) => setFilmForm(prev => ({ ...prev, backdrop_url: e.target.value }))}
                    placeholder="https://..."
                    className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand font-mono"
                  />
                  {filmForm.backdrop_url && (
                    <img src={filmForm.backdrop_url} alt="" className="h-8 w-12 rounded object-cover border border-border shrink-0" />
                  )}
                </div>
              </div>
            </div>

            {/* Title, Year, Release Date */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={filmForm.title}
                  onChange={(e) => setFilmForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Official Movie Title"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm font-bold text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Year
                </label>
                <input
                  type="number"
                  value={filmForm.year}
                  onChange={(e) => setFilmForm(prev => ({ ...prev, year: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Release Date (YYYY-MM-DD)
                </label>
                <input
                  type="date"
                  value={filmForm.release_date || ''}
                  onChange={(e) => setFilmForm(prev => ({ ...prev, release_date: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
                />
              </div>
            </div>

            {/* Director, Platform, Content Type */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Director (Real Name)
                </label>
                <input
                  type="text"
                  value={filmForm.director}
                  onChange={(e) => setFilmForm(prev => ({ ...prev, director: e.target.value }))}
                  placeholder="e.g. Kunle Afolayan"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Primary Platform
                </label>
                <select
                  value={filmForm.platform}
                  onChange={(e) => setFilmForm(prev => ({ ...prev, platform: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs font-bold text-text-primary outline-none focus:border-brand"
                >
                  <option value="Cinema">Cinema</option>
                  <option value="Prime Video">Prime Video</option>
                  <option value="Netflix">Netflix</option>
                  <option value="YouTube">YouTube</option>
                  <option value="Showmax">Showmax</option>
                  <option value="Festival">Film Festival</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Content Type
                </label>
                <select
                  value={filmForm.content_type}
                  onChange={(e) => setFilmForm(prev => ({ ...prev, content_type: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs font-bold text-text-primary outline-none focus:border-brand"
                >
                  <option value="movie">Feature Film (Movie)</option>
                  <option value="series">TV / Web Series</option>
                  <option value="short">Short Film</option>
                </select>
              </div>
            </div>

            {/* Synopsis */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                Synopsis *
              </label>
              <textarea
                value={filmForm.synopsis}
                onChange={(e) => setFilmForm(prev => ({ ...prev, synopsis: e.target.value }))}
                rows={4}
                placeholder="Full synopsis of the film..."
                className="w-full rounded-xl border border-border bg-surface-2 p-3 text-xs leading-relaxed text-text-primary outline-none focus:border-brand"
              />
            </div>

            {/* Genres selector */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1.5">
                Genres
              </label>
              <div className="flex flex-wrap gap-1.5">
                {STANDARD_GENRES.map(g => {
                  const isSelected = filmForm.genres.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => handleToggleGenre(g)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-brand text-white'
                          : 'bg-surface-2 text-text-muted border border-border hover:border-brand/40'
                      }`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cast Table */}
            <div className="rounded-xl border border-border bg-surface-2/40 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-text-primary">
                    Cast Ensemble ({filmForm.cast?.length || 0})
                  </h4>
                  <p className="text-[10px] text-text-muted">
                    Linked in-place to person profiles. Actors will not be duplicated.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddManualCastRow}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-surface text-xs font-bold text-text-primary hover:border-brand"
                >
                  <Icon icon="solar:user-plus-linear" />
                  Add Row
                </button>
              </div>

              {filmForm.cast?.length === 0 ? (
                <p className="text-xs text-text-muted italic py-3 text-center">
                  No cast members added yet. Quick-add from @mentions above or click "Add Row".
                </p>
              ) : (
                <div className="space-y-2">
                  {filmForm.cast.map((c, idx) => {
                    const actorName = typeof c === 'string' ? c : (c.name || '');
                    const charName = typeof c === 'object' ? (c.character_name || '') : '';

                    return (
                      <div key={idx} className="flex items-center gap-2 bg-surface p-2 rounded-lg border border-border/60">
                        <span className="text-[10px] font-black text-text-muted w-5 text-center">
                          #{idx + 1}
                        </span>
                        <input
                          type="text"
                          value={actorName}
                          onChange={(e) => handleUpdateCastRow(idx, 'name', e.target.value)}
                          placeholder="Actor Name (e.g. Deyemi Okanlawon)"
                          className="flex-1 rounded border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-brand"
                        />
                        <input
                          type="text"
                          value={charName}
                          onChange={(e) => handleUpdateCastRow(idx, 'character_name', e.target.value)}
                          placeholder="Character (e.g. Oba)"
                          className="w-40 rounded border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-brand"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveCastRow(idx)}
                          className="p-1.5 text-text-muted hover:text-red-400 transition-colors"
                          title="Remove row"
                        >
                          <Icon icon="solar:trash-bin-trash-linear" width="16" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 🎭 STAGE PLAY FORM */}
        {activeTab === 'play' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="border-b border-border/40 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-brand">
                1. Stage Play / Theatre Details
              </h3>
              <p className="text-xs text-text-muted">Extract and list theatre productions and stage performances.</p>
            </div>

            {/* Poster & Banner */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Poster Flyer URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={playForm.poster_url}
                    onChange={(e) => setPlayForm(prev => ({ ...prev, poster_url: e.target.value }))}
                    placeholder="https://..."
                    className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand font-mono"
                  />
                  {playForm.poster_url && (
                    <img src={playForm.poster_url} alt="" className="h-8 w-6 rounded object-cover border border-border shrink-0" />
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Banner / Venue Artwork URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={playForm.banner_url}
                    onChange={(e) => setPlayForm(prev => ({ ...prev, banner_url: e.target.value }))}
                    placeholder="https://..."
                    className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand font-mono"
                  />
                  {playForm.banner_url && (
                    <img src={playForm.banner_url} alt="" className="h-8 w-12 rounded object-cover border border-border shrink-0" />
                  )}
                </div>
              </div>
            </div>

            {/* Title, Year, Status */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Stage Play Title *
                </label>
                <input
                  type="text"
                  value={playForm.title}
                  onChange={(e) => setPlayForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Saro The Musical"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm font-bold text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Year
                </label>
                <input
                  type="number"
                  value={playForm.year}
                  onChange={(e) => setPlayForm(prev => ({ ...prev, year: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Status
                </label>
                <select
                  value={playForm.status}
                  onChange={(e) => setPlayForm(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs font-bold text-text-primary outline-none focus:border-brand"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="currently_running">Currently Running</option>
                  <option value="archived">Archived / Past Production</option>
                </select>
              </div>
            </div>

            {/* Venue, City, Country */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Venue Name
                </label>
                <input
                  type="text"
                  value={playForm.venue}
                  onChange={(e) => setPlayForm(prev => ({ ...prev, venue: e.target.value }))}
                  placeholder="e.g. Terra Kulture, Muson Centre"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={playForm.city}
                  onChange={(e) => setPlayForm(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="Lagos"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Performance Time
                </label>
                <input
                  type="text"
                  value={playForm.performance_time}
                  onChange={(e) => setPlayForm(prev => ({ ...prev, performance_time: e.target.value }))}
                  placeholder="e.g. 3:00 PM & 7:00 PM"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Run Start Date
                </label>
                <input
                  type="date"
                  value={playForm.run_start_date || ''}
                  onChange={(e) => setPlayForm(prev => ({ ...prev, run_start_date: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Run End Date
                </label>
                <input
                  type="date"
                  value={playForm.run_end_date || ''}
                  onChange={(e) => setPlayForm(prev => ({ ...prev, run_end_date: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
                />
              </div>
            </div>

            {/* Playwright, Director, Producer */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Playwright (Writer)
                </label>
                <input
                  type="text"
                  value={playForm.playwright}
                  onChange={(e) => setPlayForm(prev => ({ ...prev, playwright: e.target.value }))}
                  placeholder="e.g. Wole Soyinka"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Stage Director
                </label>
                <input
                  type="text"
                  value={playForm.director}
                  onChange={(e) => setPlayForm(prev => ({ ...prev, director: e.target.value }))}
                  placeholder="e.g. Bolanle Austen-Peters"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Producer / Production House
                </label>
                <input
                  type="text"
                  value={playForm.producer}
                  onChange={(e) => setPlayForm(prev => ({ ...prev, producer: e.target.value }))}
                  placeholder="e.g. BAP Productions"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
                />
              </div>
            </div>

            {/* Synopsis */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                Stage Synopsis
              </label>
              <textarea
                value={playForm.synopsis}
                onChange={(e) => setPlayForm(prev => ({ ...prev, synopsis: e.target.value }))}
                rows={3}
                placeholder="Storyline of the stage play..."
                className="w-full rounded-xl border border-border bg-surface-2 p-3 text-xs leading-relaxed text-text-primary outline-none focus:border-brand"
              />
            </div>
          </div>
        )}

        {/* ⭐ CRITIC REVIEW FORM */}
        {activeTab === 'critic_review' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="border-b border-border/40 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-brand">
                1. Critic Review Details
              </h3>
              <p className="text-xs text-text-muted">Link a verified press or social review quote to a film or play.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Film or Stage Play Title *
                </label>
                <input
                  type="text"
                  value={reviewForm.film_title}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, film_title: e.target.value }))}
                  placeholder="Enter film title to match..."
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm font-bold text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Critic / Reviewer Name *
                </label>
                <input
                  type="text"
                  value={reviewForm.critic_name}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, critic_name: e.target.value }))}
                  placeholder="e.g. CinemaPointer, In Nollywood"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Publication / Channel
                </label>
                <input
                  type="text"
                  value={reviewForm.publication}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, publication: e.target.value }))}
                  placeholder="e.g. Pulse Nigeria, What Kept Me Up"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Rating ({reviewForm.rating} / {reviewForm.rating_scale})
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max={reviewForm.rating_scale}
                    step="0.5"
                    value={reviewForm.rating || 0}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, rating: Number(e.target.value) }))}
                    className="flex-1 accent-brand"
                  />
                  <span className="font-bold text-xs text-text-primary w-8">{reviewForm.rating}</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Rating Scale
                </label>
                <select
                  value={reviewForm.rating_scale}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, rating_scale: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand"
                >
                  <option value="10">Out of 10</option>
                  <option value="5">Out of 5</option>
                  <option value="100">Out of 100%</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                Review Pull-Quote *
              </label>
              <textarea
                value={reviewForm.quote}
                onChange={(e) => setReviewForm(prev => ({ ...prev, quote: e.target.value }))}
                rows={4}
                placeholder="The punchy verdict or review summary..."
                className="w-full rounded-xl border border-border bg-surface-2 p-3 text-xs leading-relaxed text-text-primary outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                Full Review Link / Source URL
              </label>
              <input
                type="text"
                value={reviewForm.review_url}
                onChange={(e) => setReviewForm(prev => ({ ...prev, review_url: e.target.value }))}
                placeholder="https://..."
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand font-mono"
              />
            </div>
          </div>
        )}

        {/* 📱 SOCIAL STUDIO DRAFT FORM */}
        {activeTab === 'social_post' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="border-b border-border/40 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-brand">
                1. Social Studio Draft
              </h3>
              <p className="text-xs text-text-muted">Prepare a multi-platform editorial draft for Social Studio.</p>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                Post Headline / Topic
              </label>
              <input
                type="text"
                value={socialForm.headline}
                onChange={(e) => setSocialForm(prev => ({ ...prev, headline: e.target.value }))}
                placeholder="Punchy editorial headline..."
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm font-bold text-text-primary outline-none focus:border-brand"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Instagram Caption
                </label>
                <textarea
                  value={socialForm.instagram_caption}
                  onChange={(e) => setSocialForm(prev => ({ ...prev, instagram_caption: e.target.value }))}
                  rows={5}
                  className="w-full rounded-xl border border-border bg-surface-2 p-3 text-xs leading-relaxed text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Facebook Caption
                </label>
                <textarea
                  value={socialForm.facebook_caption}
                  onChange={(e) => setSocialForm(prev => ({ ...prev, facebook_caption: e.target.value }))}
                  rows={5}
                  className="w-full rounded-xl border border-border bg-surface-2 p-3 text-xs leading-relaxed text-text-primary outline-none focus:border-brand"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                Threads / X Short Post
              </label>
              <textarea
                value={socialForm.threads_post}
                onChange={(e) => setSocialForm(prev => ({ ...prev, threads_post: e.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-border bg-surface-2 p-3 text-xs leading-relaxed text-text-primary outline-none focus:border-brand"
              />
            </div>
          </div>
        )}

        {/* ── Publish / Action Button ── */}
        <div className="border-t border-border/50 pt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-xs text-text-muted">
            All records pass through the MuviDB deduplication & credit integrity gate.
          </p>

          <button
            type="button"
            onClick={handlePublish}
            disabled={isPublishing}
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-brand text-white font-black text-sm hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all shadow-xl shadow-brand/20"
          >
            {isPublishing ? (
              <>
                <Icon icon="solar:spinner-linear" className="animate-spin" width="20" />
                <span>Creating Record…</span>
              </>
            ) : (
              <>
                <Icon
                  icon={
                    activeTab === 'film'
                      ? 'solar:clapperboard-play-bold'
                      : activeTab === 'play'
                      ? 'solar:mask-hamsa-bold'
                      : activeTab === 'critic_review'
                      ? 'solar:chat-round-bold'
                      : 'solar:magic-stick-3-bold'
                  }
                  width="20"
                />
                <span>
                  {activeTab === 'film'
                    ? 'Create Film in MuviDB'
                    : activeTab === 'play'
                    ? 'Create Stage Play in MuviDB'
                    : activeTab === 'critic_review'
                    ? 'Publish Critic Review'
                    : 'Create Social Studio Draft'}
                </span>
              </>
            )}
          </button>
        </div>

        {/* Success Card */}
        {publishResult && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2 animate-fadeIn">
            <div className="flex items-center gap-2 text-emerald-400 font-black text-sm">
              <Icon icon="solar:check-circle-bold" width="20" />
              <span>Created Successfully!</span>
            </div>
            <p className="text-xs text-text-muted">
              {publishResult.title ? `"${publishResult.title}" has been saved.` : 'Record created in database.'}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              {publishResult.viewUrl && (
                <a
                  href={publishResult.viewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow hover:brightness-110 transition-all"
                >
                  <Icon icon="solar:link-circle-linear" />
                  View Public Page
                </a>
              )}
              {publishResult.adminUrl && (
                <Link
                  to={publishResult.adminUrl}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-text-primary text-xs font-bold hover:border-brand transition-all"
                >
                  <Icon icon="solar:pen-new-square-linear" />
                  Manage in Admin
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
