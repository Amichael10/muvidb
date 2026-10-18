import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { detectPlatform, GENERIC_LINK } from '../../lib/socialPlatforms';
import { fetchPortfolioByHandle, savePortfolio, sanitizeHandle, formatVideoEmbed } from '../../lib/portfolioClient';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { supabase } from '../../lib/supabase';
import { authHeaders } from '../../lib/apiAuth';

const THEME_OPTIONS = [
  {
    id: 'muvi',
    name: 'Muvi Cinema',
    tag: 'African Cinema Noir + Orange',
    bg: '#080A0D',
    cardBg: '#12161D',
    glowColor: 'rgba(255, 90, 31, 0.4)',
    accent: '#FF5A1F',
    ring: 'ring-brand',
    border: 'border-brand/50',
    textAccent: 'text-brand',
    buttonBg: '#FF5A1F',
    buttonText: '#ffffff',
  },
  {
    id: 'midnight',
    name: 'Midnight Noir',
    tag: 'Deep Charcoal & Silver',
    bg: '#0a0a0c',
    cardBg: '#141418',
    glowColor: 'rgba(255, 255, 255, 0.25)',
    accent: '#ffffff',
    ring: 'ring-white',
    border: 'border-white/40',
    textAccent: 'text-white',
    buttonBg: '#ffffff',
    buttonText: '#000000',
  },
  {
    id: 'aurora',
    name: 'Aurora Marble',
    tag: 'Emerald & Lime Swirl',
    bg: '#061a14',
    cardBg: '#0d281e',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    accent: '#84cc16',
    ring: 'ring-lime-500',
    border: 'border-lime-500/50',
    textAccent: 'text-lime-400',
    buttonBg: '#84cc16',
    buttonText: '#051b14',
  },
  {
    id: 'air',
    name: 'Clean Air',
    tag: 'Crisp Minimalist Light',
    bg: '#f8fafc',
    cardBg: '#ffffff',
    glowColor: 'rgba(0, 0, 0, 0.1)',
    accent: '#0f172a',
    ring: 'ring-slate-900',
    border: 'border-slate-300',
    textAccent: 'text-slate-900',
    buttonBg: '#0f172a',
    buttonText: '#ffffff',
  },
  {
    id: 'neon',
    name: 'Cyber Indie',
    tag: 'Cyan & Neon Blue',
    bg: '#080b11',
    cardBg: '#0f1420',
    glowColor: 'rgba(6, 182, 212, 0.4)',
    accent: '#06b6d4',
    ring: 'ring-cyan-500',
    border: 'border-cyan-500/50',
    textAccent: 'text-cyan-400',
    buttonBg: '#06b6d4',
    buttonText: '#080b11',
  },
  {
    id: 'minimal',
    name: 'Editorial Noir',
    tag: 'Monochrome B&W',
    bg: '#111113',
    cardBg: '#1a1a1e',
    glowColor: 'rgba(255, 255, 255, 0.3)',
    accent: '#ffffff',
    ring: 'ring-white',
    border: 'border-white/50',
    textAccent: 'text-zinc-100',
    buttonBg: '#ffffff',
    buttonText: '#000000',
  },
];

const LAYOUT_OPTIONS = [
  { id: 'classic', label: 'Classic', desc: 'Centered circular portrait' },
  { id: 'hero', label: 'Hero', desc: 'Full-bleed cinematic portrait' },
  { id: 'banner', label: 'Banner', desc: 'Cover banner with avatar' },
  { id: 'cutout', label: 'Cutout', desc: 'Modern badge framing' },
  { id: 'shape', label: 'Shape', desc: 'Geometric squircle frame' },
];

/**
 * Icon for a saved link. Delegates to the shared registry so the editor
 * preview and the public portfolio page can never disagree.
 *
 * The previous implementation substring-matched `url + title`, so an article
 * titled "my instagram tips" was given the Instagram mark. Detection is now on
 * the URL host only.
 */
function getLinkIcon(url = '') {
  return (detectPlatform(url) || GENERIC_LINK).icon;
}

export default function PortfolioEditorModal({ isOpen = true, onClose, person, onSaved, isInline = false }) {
  useBodyScrollLock(isOpen && !isInline);
  const scrollBodyRef = useRef(null);
  const [activeTab, setActiveTab] = useState('header'); // 'header' | 'themes' | 'content' | 'contact'
  const [themeSubTab, setThemeSubTab] = useState('curated'); // 'curated' | 'custom'
  const [mobilePane, setMobilePane] = useState('editor'); // 'editor' | 'preview'
  const [titleStyle, setTitleStyle] = useState('text'); // 'text' | 'logo'
  const [altFont, setAltFont] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Featured films search & filter
  const [filmSearch, setFilmSearch] = useState('');
  const [filmFilter, setFilmFilter] = useState('all'); // 'all' | 'selected' | 'recent'

  // Core portfolio state
  const [portfolio, setPortfolio] = useState({
    handle: '',
    tagline: '',
    bio_statement: '',
    featured_reel_url: '',
    featured_film_ids: [],
    custom_links: [],
    inquiry_email: '',
    inquiry_phone: '',
    epk_pdf_url: '',
    theme_preset: 'muvi',
    accent_color: '#FF5A1F',
    header_layout: 'hero',
    avatar_override: '',
    is_published: true,
  });

  const handleShuffleTheme = () => {
    const otherThemes = THEME_OPTIONS.filter((t) => t.id !== portfolio.theme_preset);
    const randomTheme = otherThemes[Math.floor(Math.random() * otherThemes.length)] || THEME_OPTIONS[0];
    setPortfolio((prev) => ({
      ...prev,
      theme_preset: randomTheme.id,
      accent_color: randomTheme.accent,
    }));
    toast.success(`Theme switched to ${randomTheme.name}!`);
  };

  const [availableFilms, setAvailableFilms] = useState([]);
  const [newLink, setNewLink] = useState({ title: '', url: '' });

  // Photo gallery picker state
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [uploadingNewPhoto, setUploadingNewPhoto] = useState(false);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load portfolio data
  useEffect(() => {
    if (!isOpen || !person?.slug) return;
    setLoading(true);

    fetchPortfolioByHandle(person.slug)
      .then((res) => {
        if (res) {
          const links = res.portfolio.custom_links || [];
          // Extract layout preference if stored in metadata
          const metaLink = links.find((l) => l._meta === 'layout');
          const headerLayout = metaLink?.layout || 'hero';
          const avatarOverride = metaLink?.avatar || '';

          setPortfolio({
            handle: res.portfolio.handle || person.slug,
            tagline: res.portfolio.tagline || person.bio?.split('.')[0] || '',
            bio_statement: res.portfolio.bio_statement || person.bio || '',
            featured_reel_url: res.portfolio.featured_reel_url || '',
            featured_film_ids: res.portfolio.featured_film_ids || [],
            custom_links: links.filter((l) => !l._meta),
            inquiry_email: res.portfolio.inquiry_email || person.booking_email || '',
            inquiry_phone: res.portfolio.inquiry_phone || person.booking_phone || '',
            epk_pdf_url: res.portfolio.epk_pdf_url || '',
            theme_preset: res.portfolio.theme_preset || 'muvi',
            accent_color: res.portfolio.accent_color || '#FF5A1F',
            header_layout: headerLayout,
            avatar_override: avatarOverride,
            is_published: res.portfolio.is_published ?? true,
          });
          setAvailableFilms(res.allFilms || []);
        }
      })
      .catch((err) => {
        console.error('Failed to load portfolio:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, person]);

  // Fetch actor gallery photos when picker is opened
  const handleOpenPhotoPicker = async () => {
    setShowPhotoPicker(true);
    setLoadingGallery(true);
    try {
      const photos = [];

      // 1. Fetch from person_media
      if (person?.id) {
        const { data: mediaData } = await supabase
          .from('person_media')
          .select('*')
          .eq('person_id', person.id)
          .eq('media_type', 'photo')
          .order('created_at', { ascending: false });

        if (mediaData && mediaData.length > 0) {
          mediaData.forEach((m) => {
            if (m.url && !photos.some((p) => p.url === m.url)) {
              photos.push({
                id: m.id,
                url: m.url,
                thumbnail: m.thumbnail_url || m.url,
                title: m.title || 'Portfolio Photo',
                is_primary: m.is_primary,
              });
            }
          });
        }
      }

      // 2. Fetch from person highlights
      const highlights = person?.youtube_stats?.instagram_highlights || [];
      if (Array.isArray(highlights)) {
        highlights.forEach((h, idx) => {
          const imgUrl = h.url || h.thumbnail;
          if (imgUrl && !photos.some((p) => p.url === imgUrl)) {
            photos.push({
              id: `hl_${idx}`,
              url: imgUrl,
              thumbnail: imgUrl,
              title: h.title || 'Highlight Photo',
              is_primary: !!h.is_primary,
            });
          }
        });
      }

      // 3. Fallback to existing photo_url
      if (person?.photo_url && !photos.some((p) => p.url === person.photo_url)) {
        photos.unshift({
          id: 'primary_current',
          url: person.photo_url,
          thumbnail: person.photo_url,
          title: 'Current Headshot',
          is_primary: true,
        });
      }

      setGalleryPhotos(photos);
    } catch (err) {
      console.error('Error fetching gallery:', err);
    } finally {
      setLoadingGallery(false);
    }
  };

  // Select an existing photo from the gallery
  const handleSelectGalleryPhoto = (photoUrl) => {
    setPortfolio((prev) => ({ ...prev, avatar_override: photoUrl }));
    setShowPhotoPicker(false);
    toast.success('Profile image updated in live preview!');
  };

  // Upload a brand new photo
  const handleUploadNewPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (JPEG, PNG, WebP)');
      return;
    }

    setUploadingNewPhoto(true);
    try {
      const uploadSessionRes = await fetch('/api/social?task=create_r2_upload_url', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          fileName: `${person.slug || person.id}_${Date.now()}_${file.name}`,
          mimeType: file.type || 'image/jpeg',
        }),
      });

      if (!uploadSessionRes.ok) throw new Error('Could not initiate photo upload');
      const session = await uploadSessionRes.json();
      if (!session?.uploadUrl) throw new Error('No upload URL returned');

      await fetch(session.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'image/jpeg' },
        body: file,
      });

      const uploadedUrl = session.publicUrl;
      setPortfolio((prev) => ({ ...prev, avatar_override: uploadedUrl }));

      // Also persist to person_media
      try {
        await supabase.from('person_media').insert({
          person_id: person.id,
          media_type: 'photo',
          category: 'headshot',
          title: file.name.replace(/\.[^/.]+$/, ''),
          url: uploadedUrl,
          thumbnail_url: uploadedUrl,
          status: 'pending',
        });
      } catch (err) {
        console.warn('Note on person_media insert:', err);
      }

      setShowPhotoPicker(false);
      toast.success('Photo uploaded and set as portfolio image!');
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error(err.message || 'Photo upload failed');
    } finally {
      setUploadingNewPhoto(false);
    }
  };

  if (!isOpen) return null;

  const currentTheme = THEME_OPTIONS.find((t) => t.id === portfolio.theme_preset) || THEME_OPTIONS[0];
  const activeAvatar = portfolio.avatar_override || person.photo_url || '/images/person-placeholder.png';
  const liveUrl = `${window.location.origin}/@${sanitizeHandle(portfolio.handle || person.slug)}`;
  const videoPreview = formatVideoEmbed(portfolio.featured_reel_url);

  const handleToggleFilm = (filmId) => {
    const current = portfolio.featured_film_ids || [];
    if (current.includes(filmId)) {
      setPortfolio({ ...portfolio, featured_film_ids: current.filter((id) => id !== filmId) });
    } else {
      if (current.length >= 6) {
        toast.error('You can feature up to 6 priority films at the top.');
        return;
      }
      setPortfolio({ ...portfolio, featured_film_ids: [...current, filmId] });
    }
  };

  const handleMoveFilmOrder = (filmId, direction) => {
    const current = [...(portfolio.featured_film_ids || [])];
    const idx = current.indexOf(filmId);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= current.length) return;
    const temp = current[idx];
    current[idx] = current[targetIdx];
    current[targetIdx] = temp;
    setPortfolio({ ...portfolio, featured_film_ids: current });
  };

  const filteredFilms = useMemo(() => {
    return (availableFilms || []).filter((film) => {
      const q = filmSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (film.title && film.title.toLowerCase().includes(q)) ||
        (film.roles && film.roles.some((r) => r.toLowerCase().includes(q))) ||
        (film.year && film.year.toString().includes(q));

      if (!matchesSearch) return false;

      if (filmFilter === 'selected') {
        return (portfolio.featured_film_ids || []).includes(film.id);
      }
      if (filmFilter === 'recent') {
        return film.year && Number(film.year) >= 2022;
      }
      return true;
    });
  }, [availableFilms, filmSearch, filmFilter, portfolio.featured_film_ids]);

  const handleAddLink = () => {
    if (!newLink.title.trim() || !newLink.url.trim()) {
      toast.error('Please enter both title and URL.');
      return;
    }
    const cleanUrl = newLink.url.startsWith('http') ? newLink.url.trim() : `https://${newLink.url.trim()}`;
    const updated = [
      ...(portfolio.custom_links || []),
      {
        id: Date.now().toString(),
        title: newLink.title.trim(),
        url: cleanUrl,
        // Recorded at save time so the public page does not have to re-detect,
        // and so a later registry change cannot silently alter saved links.
        platform: detectPlatform(cleanUrl)?.key || null,
      },
    ];
    setPortfolio({ ...portfolio, custom_links: updated });
    setNewLink({ title: '', url: '' });
  };

  const handleRemoveLink = (id) => {
    const updated = (portfolio.custom_links || []).filter((l) => l.id !== id);
    setPortfolio({ ...portfolio, custom_links: updated });
  };

  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSaving(true);

    // Embed header layout preference in custom_links metadata
    const cleanLinks = (portfolio.custom_links || []).filter((l) => !l._meta);
    const linksWithMeta = [
      ...cleanLinks,
      {
        _meta: 'layout',
        layout: portfolio.header_layout || 'hero',
        avatar: portfolio.avatar_override || '',
      },
    ];

    const res = await savePortfolio({
      ...portfolio,
      custom_links: linksWithMeta,
      person_id: person.id,
      handle: sanitizeHandle(portfolio.handle || person.slug),
    });

    setSaving(false);
    if (!res.success) {
      toast.error(res.error || 'Failed to save portfolio settings.');
    } else {
      toast.success('Portfolio updated and published!');
      if (onSaved) onSaved(res.data);
      if (onClose) onClose();
    }
  };

  const handleWheelCapture = (e) => {
    if (scrollBodyRef.current && !scrollBodyRef.current.contains(e.target)) {
      scrollBodyRef.current.scrollTop += e.deltaY;
      e.preventDefault();
    }
  };

  const studioCard = (
    <div
      data-lenis-prevent="true"
      style={{ overscrollBehavior: 'contain' }}
      className={`w-full flex flex-col rounded-3xl border border-white/10 bg-[#121214] shadow-2xl relative ${
        isInline ? 'overflow-visible' : 'max-w-6xl max-h-[94vh] overflow-hidden overscroll-contain'
      }`}
    >
      {/* Top Studio Bar */}
      <div className="px-5 py-3.5 border-b border-white/10 bg-[#121214] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand/10 text-brand shrink-0">
            <Icon icon="solar:link-circle-bold" width="18" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-white tracking-tight truncate">
                Link-in-Bio Studio
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-mono font-bold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Sync
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 truncate font-mono">
              {liveUrl}
            </p>
          </div>
        </div>

        {/* Right Actions: Mobile toggle + Share + Top Save + Close */}
        <div className="flex items-center gap-2">
          {/* Mobile View Toggle */}
          <div className="flex lg:hidden bg-white/5 rounded-xl p-0.5 border border-white/10 text-xs font-bold">
            <button
              type="button"
              onClick={() => setMobilePane('editor')}
              className={`px-2.5 py-1 rounded-lg transition ${
                mobilePane === 'editor' ? 'bg-brand text-white' : 'text-zinc-400'
              }`}
            >
              Editor
            </button>
            <button
              type="button"
              onClick={() => setMobilePane('preview')}
              className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                mobilePane === 'preview' ? 'bg-brand text-white' : 'text-zinc-400'
              }`}
            >
              <Icon icon="solar:smartphone-bold" width="12" />
              Preview
            </button>
          </div>

          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-semibold transition"
          >
            <span>View Public</span>
            <Icon icon="solar:arrow-right-up-linear" width="13" />
          </a>

          <button
            type="button"
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(liveUrl);
                toast.success('Portfolio link copied to clipboard!');
              }
            }}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-semibold transition"
            title="Share portfolio"
          >
            <Icon icon="solar:share-bold" width="13" />
            <span>Share</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold shadow-lg shadow-brand/20 transition disabled:opacity-50"
          >
            <Icon icon="solar:diskette-bold" width="15" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>

          {!isInline && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition"
              title="Close modal"
            >
              <Icon icon="solar:close-circle-bold" width="18" />
            </button>
          )}
        </div>
      </div>

        {/* Studio Body: Split View (Editor on Left, Live Phone Mockup on Right) */}
        <div className={isInline ? "w-full" : "flex-1 flex overflow-hidden min-h-0"}>
          <div className={isInline ? "grid grid-cols-1 lg:grid-cols-12 gap-8 items-start p-4 sm:p-6" : "flex-1 flex overflow-hidden min-h-0 w-full"}>
            {/* LEFT: Editor Panel */}
            <div
              ref={isInline ? undefined : scrollBodyRef}
              data-lenis-prevent="true"
              className={
                isInline
                  ? `lg:col-span-7 xl:col-span-8 space-y-6 ${mobilePane === 'preview' ? 'hidden lg:block' : 'block'}`
                  : `flex-1 flex flex-col overflow-y-auto overscroll-contain custom-scrollbar ${mobilePane === 'preview' ? 'hidden lg:flex' : 'flex'}`
              }
            >
              {/* Linktree-Style Tab Navigation */}
              <div className={`pb-2 border-b border-white/5 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 ${isInline ? 'px-1' : 'px-6 pt-4'}`}>
              {[
                { id: 'header', label: 'Header & Bio', icon: 'solar:user-bold' },
                { id: 'themes', label: 'Themes & Skin', icon: 'solar:palette-bold' },
                { id: 'content', label: 'Links & Reels', icon: 'solar:link-round-bold' },
                { id: 'contact', label: 'Booking & EPK', icon: 'solar:mailbox-bold' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-brand/10 text-brand border border-brand/30 shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Icon icon={tab.icon} width="14" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {loading ? (
              <div className="py-24 text-center text-xs font-mono text-zinc-500 uppercase tracking-widest">
                Loading portfolio settings...
              </div>
            ) : (
              <div className="p-6 space-y-6 flex-1">
                {/* TAB 1: HEADER & BIO */}
                {activeTab === 'header' && (
                  <div className="space-y-6 animate-fade-in">
                    {/* Header Layout Options (Classic vs Hero vs Banner vs Cutout) */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                          Header Portrait Layout
                        </label>
                        <span className="text-[10px] font-mono text-brand uppercase">
                          {portfolio.header_layout}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                        {LAYOUT_OPTIONS.map((lo) => {
                          const isSel = portfolio.header_layout === lo.id;
                          return (
                            <button
                              key={lo.id}
                              type="button"
                              onClick={() => setPortfolio({ ...portfolio, header_layout: lo.id })}
                              className={`p-3 rounded-2xl border text-left transition ${
                                isSel
                                  ? 'border-brand bg-brand/10 ring-1 ring-brand'
                                  : 'border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-bold text-white">{lo.label}</p>
                                {isSel && <Icon icon="solar:check-circle-bold" className="text-brand" width="14" />}
                              </div>
                              <p className="text-[10px] text-zinc-400 leading-snug">{lo.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Image quality recommendation banner matching Linktree */}
                    <div className="flex items-start gap-2.5 p-3 rounded-2xl border border-sky-500/20 bg-sky-500/10 text-sky-300 text-xs">
                      <Icon icon="solar:info-circle-bold" className="shrink-0 text-sky-400 mt-0.5" width="16" />
                      <div>
                        <p className="font-bold">For best quality, use a larger image</p>
                        <p className="text-[11px] text-sky-200/80 mt-0.5 leading-snug">
                          The {portfolio.header_layout.toUpperCase()} layout looks best when your profile image is 1160×1160 pixels or larger.
                        </p>
                      </div>
                    </div>

                    {/* Profile Image & Gallery Picker */}
                    <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img
                            src={activeAvatar}
                            alt="Avatar"
                            className="w-16 h-16 rounded-2xl border-2 border-white/20 object-cover shadow-lg"
                          />
                          <button
                            type="button"
                            onClick={handleOpenPhotoPicker}
                            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center shadow hover:bg-brand-hover transition"
                            title="Choose from Photos"
                          >
                            <Icon icon="solar:pen-bold" width="12" />
                          </button>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">Profile Portrait</p>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            Select from your uploaded portfolio photos or add a new shot.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={handleOpenPhotoPicker}
                          className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center gap-1.5"
                        >
                          <Icon icon="solar:gallery-bold" width="14" className="text-brand" />
                          <span>Choose from Photos</span>
                        </button>
                        <label className="px-3.5 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5">
                          <Icon icon="solar:upload-track-2-bold" width="14" />
                          <span>Upload New</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleUploadNewPhoto}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Photo Picker Modal Sheet */}
                    {showPhotoPicker && (
                      <div className="p-4 rounded-2xl border border-brand/30 bg-black/60 space-y-3 animate-fade-in">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon icon="solar:gallery-bold" className="text-brand" width="16" />
                            <h4 className="text-xs font-bold text-white">Your Photo Gallery</h4>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowPhotoPicker(false)}
                            className="text-xs text-zinc-400 hover:text-white"
                          >
                            Close
                          </button>
                        </div>

                        {loadingGallery ? (
                          <p className="text-xs text-zinc-500 font-mono py-4 text-center">Loading gallery...</p>
                        ) : galleryPhotos.length === 0 ? (
                          <div className="text-center py-4">
                            <p className="text-xs text-zinc-400">No photos found in your gallery.</p>
                            <label className="inline-block mt-2 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-bold cursor-pointer hover:bg-brand-hover transition">
                              Upload First Photo
                              <input type="file" accept="image/*" onChange={handleUploadNewPhoto} className="hidden" />
                            </label>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                            {galleryPhotos.map((p) => {
                              const isCurrent = activeAvatar === p.url;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => handleSelectGalleryPhoto(p.url)}
                                  className={`relative group aspect-square rounded-xl overflow-hidden border transition ${
                                    isCurrent ? 'border-brand ring-2 ring-brand' : 'border-white/10 hover:border-white/40'
                                  }`}
                                >
                                  <img src={p.thumbnail || p.url} alt="" className="w-full h-full object-cover" />
                                  {isCurrent && (
                                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-brand text-white flex items-center justify-center font-bold text-[9px]">
                                      ✓
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Vanity Handle */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                          Vanity Handle * (@username)
                        </label>
                        <span className="text-[10px] font-mono text-zinc-500">
                          muvidb.com/@{portfolio.handle || 'username'}
                        </span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-xs text-zinc-500 font-mono">@</span>
                        <input
                          type="text"
                          required
                          value={portfolio.handle}
                          onChange={(e) => setPortfolio({ ...portfolio, handle: sanitizeHandle(e.target.value) })}
                          placeholder="username"
                          className="w-full rounded-xl border border-white/10 bg-white/5 pl-8 pr-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-brand focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    {/* Tagline / Title */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                          Title / Tagline
                        </label>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {(portfolio.tagline || '').length}/50
                        </span>
                      </div>
                      <input
                        type="text"
                        maxLength={50}
                        value={portfolio.tagline || ''}
                        onChange={(e) => setPortfolio({ ...portfolio, tagline: e.target.value })}
                        placeholder="e.g. Award-winning Director & Visual Storyteller"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-brand focus:outline-none"
                      />
                    </div>

                    {/* Bio Statement */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                          Bio Statement
                        </label>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {(portfolio.bio_statement || '').length}/160
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        maxLength={160}
                        value={portfolio.bio_statement || ''}
                        onChange={(e) => setPortfolio({ ...portfolio, bio_statement: e.target.value })}
                        placeholder="Creative Product Designer voyaging around emerging technologies e.g AI, Web3."
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-brand focus:outline-none resize-none"
                      />
                    </div>

                    {/* Title Style and Font Options */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-white/5">
                      <div>
                        <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                          Title Style
                        </label>
                        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
                          <button
                            type="button"
                            onClick={() => setTitleStyle('text')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                              titleStyle === 'text' ? 'bg-white/15 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            <span className="font-serif">Aa</span>
                            <span>Text</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setTitleStyle('logo')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                              titleStyle === 'logo' ? 'bg-white/15 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            <Icon icon="solar:gallery-minimalistic-bold" width="13" />
                            <span>Logo</span>
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold text-white">Alternative Title Font</p>
                            <p className="text-[10px] text-zinc-400">Matches page font by default</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAltFont(!altFont)}
                            className={`w-10 h-6 rounded-full transition-colors p-0.5 ${
                              altFont ? 'bg-brand' : 'bg-white/10'
                            }`}
                          >
                            <div
                              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                                altFont ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: THEMES & SKINS */}
                {activeTab === 'themes' && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="flex items-center justify-between pb-3 border-b border-white/5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab('header')}
                          className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition"
                        >
                          <Icon icon="solar:alt-arrow-left-linear" width="16" />
                        </button>
                        <h3 className="text-sm font-black text-white">Theme</h3>
                      </div>
                      <button
                        type="button"
                        onClick={handleShuffleTheme}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold text-white transition shadow-sm"
                      >
                        <Icon icon="solar:dice-bold" width="14" className="text-brand" />
                        <span>Shuffle</span>
                      </button>
                    </div>

                    {/* Curated vs Customizable tabs */}
                    <div className="flex items-center gap-4 border-b border-white/10 pb-2">
                      <button
                        type="button"
                        onClick={() => setThemeSubTab('curated')}
                        className={`text-xs font-bold transition relative pb-1 ${
                          themeSubTab === 'curated' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        Curated
                        {themeSubTab === 'curated' && (
                          <span className="absolute bottom-0 inset-x-0 h-0.5 bg-brand rounded-full" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setThemeSubTab('custom')}
                        className={`text-xs font-bold transition relative pb-1 ${
                          themeSubTab === 'custom' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        Customizable
                        {themeSubTab === 'custom' && (
                          <span className="absolute bottom-0 inset-x-0 h-0.5 bg-brand rounded-full" />
                        )}
                      </button>
                    </div>

                    <div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {THEME_OPTIONS.map((t) => {
                          const isSelected = portfolio.theme_preset === t.id;
                          return (
                            <div
                              key={t.id}
                              onClick={() =>
                                setPortfolio({
                                  ...portfolio,
                                  theme_preset: t.id,
                                  accent_color: t.accent,
                                })
                              }
                              className={`group relative cursor-pointer rounded-2xl border p-2 transition-all ${
                                isSelected
                                  ? 'border-brand bg-white/[0.08] shadow-lg shadow-brand/15 ring-2 ring-brand'
                                  : 'border-white/10 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.05]'
                              }`}
                            >
                              <div
                                className="w-full aspect-square rounded-xl relative overflow-hidden border border-white/10 p-2.5 flex flex-col justify-between shadow-inner"
                                style={{ backgroundColor: t.bg }}
                              >
                                <div
                                  className="absolute inset-x-0 top-0 h-16 pointer-events-none opacity-90"
                                  style={{
                                    background: `radial-gradient(ellipse at 50% 0%, ${t.glowColor}, transparent 80%)`,
                                  }}
                                />
                                <div className="relative z-1 flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-white/90 truncate">{t.name}</span>
                                  {isSelected && (
                                    <Icon icon="solar:check-circle-bold" className="text-brand" width="12" />
                                  )}
                                </div>
                                <div className="relative z-1 space-y-1">
                                  <div
                                    className="h-1.5 w-full rounded"
                                    style={{ backgroundColor: t.cardBg }}
                                  />
                                  <div
                                    className="h-1 w-1/2 rounded"
                                    style={{ backgroundColor: t.accent }}
                                  />
                                </div>
                              </div>
                              <div className="mt-2 px-1">
                                <p className="text-[11px] font-bold text-white truncate">{t.name}</p>
                                <p className="text-[9px] text-zinc-400 truncate">{t.tag}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Accent Color Preset Swatches */}
                    <div>
                      <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-2">
                        Accent Highlight Color
                      </label>
                      <div className="flex items-center gap-2">
                        {['#FF5A1F', '#E64A19', '#06b6d4', '#ec4899', '#10b981', '#ffffff'].map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setPortfolio({ ...portfolio, accent_color: color })}
                            className={`w-7 h-7 rounded-full border-2 transition ${
                              portfolio.accent_color === color ? 'border-white scale-110' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: CONTENT & REELS */}
                {activeTab === 'content' && (
                  <div className="space-y-6 animate-fade-in">
                    {/* Featured Reel URL */}
                    <div>
                      <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                        Featured Showreel or Teaser (YouTube / Vimeo)
                      </label>
                      <input
                        type="url"
                        value={portfolio.featured_reel_url || ''}
                        onChange={(e) => setPortfolio({ ...portfolio, featured_reel_url: e.target.value })}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-brand focus:outline-none"
                      />
                    </div>

                    {/* Custom Links Manager */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                          Custom Links (Press, Socials, Podcasts)
                        </label>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {portfolio.custom_links?.length || 0} links
                        </span>
                      </div>

                      {/* Add New Link Inputs */}
                      <div className="flex flex-col sm:flex-row gap-2 mb-3">
                        <input
                          type="text"
                          value={newLink.title}
                          onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
                          placeholder="Title (e.g. IMDb Profile)"
                          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-brand focus:outline-none"
                        />
                        <input
                          type="text"
                          value={newLink.url}
                          onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                          placeholder="https://..."
                          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-brand focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddLink}
                          className="px-4 py-2 rounded-xl bg-brand text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 hover:bg-brand-hover shadow-sm"
                        >
                          <Icon icon="solar:add-circle-bold" width="14" />
                          <span>Add</span>
                        </button>
                      </div>

                      {/* Existing Links List */}
                      <div className="space-y-2">
                        {(portfolio.custom_links || []).map((link) => (
                          <div
                            key={link.id}
                            className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-white/10 bg-white/5"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icon icon={getLinkIcon(link.url)} className="text-brand shrink-0" width="16" />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate">{link.title}</p>
                                <p className="text-[10px] text-zinc-400 truncate">{link.url}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveLink(link.id)}
                              className="p-1.5 text-zinc-500 hover:text-red-400 transition"
                            >
                              <Icon icon="solar:trash-bin-trash-bold" width="14" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Featured Films Selector */}
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                            Priority Featured Films (Max 6)
                          </label>
                          <p className="text-[10px] text-zinc-400 mt-0.5">
                            Pin your lead roles and highest-profile movies to the top of your public Link-in-Bio.
                          </p>
                        </div>
                        <span className="text-xs font-mono text-brand font-black px-2.5 py-1 rounded-full bg-brand/10 border border-brand/20 self-start sm:self-auto shrink-0">
                          {portfolio.featured_film_ids?.length || 0} / 6 Pinned
                        </span>
                      </div>

                      {/* Film Search & Filter Bar */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                        {/* Search Input */}
                        <div className="relative flex-1">
                          <Icon
                            icon="solar:magnifer-linear"
                            className="absolute left-3 top-2.5 text-zinc-400"
                            width="15"
                          />
                          <input
                            type="text"
                            value={filmSearch}
                            onChange={(e) => setFilmSearch(e.target.value)}
                            placeholder="Search films by title, character, or year..."
                            className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-8 py-2 text-xs text-white placeholder-zinc-500 focus:border-brand focus:outline-none"
                          />
                          {filmSearch && (
                            <button
                              type="button"
                              onClick={() => setFilmSearch('')}
                              className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-white"
                            >
                              <Icon icon="solar:close-circle-bold" width="14" />
                            </button>
                          )}
                        </div>

                        {/* Filter Chips */}
                        <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
                          <button
                            type="button"
                            onClick={() => setFilmFilter('all')}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition whitespace-nowrap ${
                              filmFilter === 'all'
                                ? 'bg-brand text-white shadow'
                                : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            All ({availableFilms.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setFilmFilter('selected')}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition whitespace-nowrap flex items-center gap-1 ${
                              filmFilter === 'selected'
                                ? 'bg-brand text-white shadow'
                                : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            <span>Selected</span>
                            <span className="font-mono text-[10px]">
                              ({portfolio.featured_film_ids?.length || 0})
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFilmFilter('recent')}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition whitespace-nowrap ${
                              filmFilter === 'recent'
                                ? 'bg-brand text-white shadow'
                                : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            Recent (2022+)
                          </button>
                        </div>
                      </div>

                      {/* Film Cards List with Small Rectangle Posters */}
                      <div className="max-h-80 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02] p-2 space-y-2 custom-scrollbar">
                        {filteredFilms.length === 0 ? (
                          <div className="py-8 text-center text-xs text-zinc-500 font-medium">
                            No films match your search or filter.
                          </div>
                        ) : (
                          filteredFilms.map((film) => {
                            const isChecked = (portfolio.featured_film_ids || []).includes(film.id);
                            const selectedIndex = (portfolio.featured_film_ids || []).indexOf(film.id);
                            return (
                              <div
                                key={film.id}
                                onClick={() => handleToggleFilm(film.id)}
                                className={`group p-2.5 rounded-xl cursor-pointer flex items-center justify-between gap-3 transition border ${
                                  isChecked
                                    ? 'bg-brand/10 border-brand/40 shadow-sm ring-1 ring-brand/20'
                                    : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/15'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  {/* Selection Checkbox */}
                                  <span
                                    className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black transition ${
                                      isChecked
                                        ? 'bg-brand text-white shadow-sm'
                                        : 'border border-white/20 text-transparent'
                                    }`}
                                  >
                                    ✓
                                  </span>

                                  {/* Small rectangular poster */}
                                  <div className="w-11 h-16 rounded-lg overflow-hidden shrink-0 bg-zinc-800 border border-white/10 relative shadow">
                                    {film.poster_url ? (
                                      <img
                                        src={film.poster_url}
                                        alt={film.title}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-600">
                                        <Icon icon="solar:clapperboard-bold" width="16" />
                                      </div>
                                    )}
                                    {isChecked && (
                                      <span className="absolute top-1 left-1 bg-black/80 backdrop-blur-sm text-brand font-mono text-[8px] font-black px-1 rounded shadow">
                                        #{selectedIndex + 1}
                                      </span>
                                    )}
                                  </div>

                                  {/* Film Metadata */}
                                  <div className="min-w-0">
                                    <p className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-brand transition">
                                      {film.title}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                      {film.roles && film.roles.length > 0 && (
                                        <span className="text-[10px] text-zinc-400 truncate font-medium">
                                          {film.roles.join(', ')}
                                        </span>
                                      )}
                                      {film.year && (
                                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 shrink-0 border border-white/5">
                                          {film.year}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Reorder Controls & Action Badge */}
                                <div className="flex items-center gap-2 shrink-0">
                                  {isChecked ? (
                                    <div className="flex items-center gap-1">
                                      {/* Reorder Up / Down */}
                                      {selectedIndex > 0 && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMoveFilmOrder(film.id, -1);
                                          }}
                                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition"
                                          title="Move up in priority"
                                        >
                                          <Icon icon="solar:arrow-up-linear" width="13" />
                                        </button>
                                      )}
                                      {selectedIndex < (portfolio.featured_film_ids?.length || 0) - 1 && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMoveFilmOrder(film.id, 1);
                                          }}
                                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition"
                                          title="Move down in priority"
                                        >
                                          <Icon icon="solar:arrow-down-linear" width="13" />
                                        </button>
                                      )}
                                      <span className="text-[10px] font-mono font-bold text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded-full">
                                        Pinned #{selectedIndex + 1}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-zinc-400 group-hover:text-brand font-bold transition flex items-center gap-0.5">
                                      <span>+ Pin</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: CONTACT & BOOKING */}
                {activeTab === 'contact' && (
                  <div className="space-y-4 animate-fade-in">
                    <div>
                      <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                        Work & Booking Inquiry Email
                      </label>
                      <input
                        type="email"
                        value={portfolio.inquiry_email || ''}
                        onChange={(e) => setPortfolio({ ...portfolio, inquiry_email: e.target.value })}
                        placeholder="agent@production.com"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-brand focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                        Inquiry Phone / WhatsApp (Optional)
                      </label>
                      <input
                        type="text"
                        value={portfolio.inquiry_phone || ''}
                        onChange={(e) => setPortfolio({ ...portfolio, inquiry_phone: e.target.value })}
                        placeholder="+234 800 000 0000"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-brand focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                        EPK / Lookbook Document Link (PDF)
                      </label>
                      <input
                        type="url"
                        value={portfolio.epk_pdf_url || ''}
                        onChange={(e) => setPortfolio({ ...portfolio, epk_pdf_url: e.target.value })}
                        placeholder="https://..."
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-brand focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Live Interactive Phone Mockup Preview */}
          <div
            className={
              isInline
                ? `lg:col-span-5 xl:col-span-4 sticky top-28 self-start flex flex-col items-center justify-center ${mobilePane === 'preview' ? 'flex' : 'hidden lg:flex'}`
                : `w-full lg:w-[350px] xl:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 bg-black/40 flex-col items-center justify-center p-4 lg:p-6 overflow-hidden ${mobilePane === 'preview' ? 'flex' : 'hidden lg:flex'}`
            }
          >
            {/* Phone Bezel Frame */}
            <div
              className="w-full max-w-[260px] h-[510px] rounded-[28px] border-[3.5px] border-zinc-800 shadow-2xl relative overflow-hidden flex flex-col"
              style={{ backgroundColor: currentTheme.bg }}
            >
              {/* Dynamic Island / Notch */}
              <div className="absolute top-1.5 inset-x-0 z-30 flex justify-center pointer-events-none">
                <div className="w-16 h-3.5 bg-black rounded-full flex items-center justify-end px-1.5">
                  <span className="w-1 h-1 rounded-full bg-zinc-700" />
                </div>
              </div>

              {/* Scrollable Phone Content Screen */}
              <div className="flex-1 overflow-y-auto pt-6 pb-4 px-3 space-y-2.5 text-center custom-scrollbar">
                {/* Header Section (reflecting selected layout: hero vs classic vs banner) */}
                {portfolio.header_layout === 'hero' ? (
                  <div className="relative -mx-3 -mt-6 mb-2 h-36 overflow-hidden rounded-b-2xl">
                    <img src={activeAvatar} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col justify-end p-2.5 text-left">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-black text-white">{person.name}</span>
                        <Icon icon="solar:verified-check-bold" className="text-brand" width="12" />
                      </div>
                      <p className="text-[9px] font-mono text-zinc-300">@{portfolio.handle || person.slug}</p>
                    </div>
                  </div>
                ) : portfolio.header_layout === 'banner' ? (
                  <div className="space-y-2">
                    <div className="relative -mx-3 -mt-6 h-14 bg-gradient-to-r from-brand/20 to-brand/40 overflow-hidden" />
                    <div className="-mt-8 flex flex-col items-center">
                      <img src={activeAvatar} alt="" className="w-12 h-12 rounded-full border-2 border-white/20 object-cover shadow-lg" />
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs font-black text-white">{person.name}</span>
                        <Icon icon="solar:verified-check-bold" className="text-brand" width="12" />
                      </div>
                      <p className="text-[9px] font-mono text-zinc-400">@{portfolio.handle || person.slug}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center pt-2">
                    <img src={activeAvatar} alt="" className="w-14 h-14 rounded-full border-2 border-white/20 object-cover shadow-lg" />
                    <div className="flex items-center gap-1 mt-1.5">
                      <span className="text-xs font-black text-white">{person.name}</span>
                      <Icon icon="solar:verified-check-bold" className="text-brand" width="12" />
                    </div>
                    <p className="text-[9px] font-mono text-zinc-400">@{portfolio.handle || person.slug}</p>
                  </div>
                )}

                {/* Tagline */}
                {portfolio.tagline && (
                  <p className="text-[10px] text-zinc-300 font-medium px-1 leading-tight">
                    {portfolio.tagline}
                  </p>
                )}

                {/* Social icons row */}
                <div className="flex items-center justify-center gap-1.5 py-0.5 text-zinc-400">
                  <span className="p-1 rounded-full bg-white/5 hover:text-white"><Icon icon="simple-icons:x" width="11" /></span>
                  <span className="p-1 rounded-full bg-white/5 hover:text-white"><Icon icon="simple-icons:instagram" width="11" /></span>
                  <span className="p-1 rounded-full bg-white/5 hover:text-white"><Icon icon="simple-icons:youtube" width="11" /></span>
                  <span className="p-1 rounded-full bg-white/5 hover:text-white"><Icon icon="simple-icons:imdb" width="11" /></span>
                  <span className="p-1 rounded-full bg-white/5 hover:text-white"><Icon icon="simple-icons:linkedin" width="11" /></span>
                  {portfolio.inquiry_email && (
                    <span className="p-1 rounded-full bg-white/5 hover:text-white"><Icon icon="solar:letter-bold" width="11" /></span>
                  )}
                </div>

                {/* Showreel Preview inside Phone */}
                {videoPreview && (
                  <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-md border border-white/10">
                    <iframe src={videoPreview} title="Reel" className="w-full h-full border-0 pointer-events-none" />
                  </div>
                )}

                {/* Links inside Phone */}
                <div className="space-y-1.5">
                  {(portfolio.custom_links || []).map((link) => (
                    <div
                      key={link.id}
                      className="w-full rounded-xl px-2.5 py-1.5 flex items-center justify-between border border-white/10 shadow-sm transition hover:scale-[1.01]"
                      style={{ backgroundColor: currentTheme.cardBg }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon icon={getLinkIcon(link.url)} className="text-brand shrink-0" width="13" />
                        <span className="text-[10px] font-bold text-white truncate">{link.title}</span>
                      </div>
                      <Icon icon="solar:arrow-right-linear" width="10" className="text-zinc-500" />
                    </div>
                  ))}
                </div>

                {/* Featured Films Row inside Phone */}
                {availableFilms.filter((f) => (portfolio.featured_film_ids || []).includes(f.id)).length > 0 && (
                  <div className="pt-1.5 text-left">
                    <p className="text-[8px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
                      Featured Work
                    </p>
                    <div className="grid grid-cols-3 gap-1">
                      {availableFilms
                        .filter((f) => (portfolio.featured_film_ids || []).includes(f.id))
                        .slice(0, 3)
                        .map((f) => (
                          <div key={f.id} className="aspect-[2/3] rounded-lg overflow-hidden border border-white/10 bg-zinc-900">
                            {f.poster_url ? (
                              <img src={f.poster_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[7px] text-zinc-500 p-1 text-center font-bold">
                                {f.title}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Simulated Linktree-style MuviDB Footer */}
                <div className="pt-2 pb-1 border-t border-white/10 text-center">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-[8px] font-bold text-zinc-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                    <span>See full profile on MuviDB</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating action buttons below phone frame on a straight horizontal line */}
            <div className="flex flex-row items-center justify-center gap-2 mt-3">
              <a
                href={liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition shadow-sm hover:border-brand/40"
                title="Open live link"
              >
                <Icon icon="solar:arrow-right-up-linear" width="14" />
              </a>
              <button
                type="button"
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(liveUrl);
                    toast.success('Link copied to clipboard!');
                  }
                }}
                className="w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition shadow-sm hover:border-brand/40"
                title="Copy link"
              >
                <Icon icon="solar:link-linear" width="14" />
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.success('AI bio recommendation: "Award-winning creator shaping contemporary African cinema."');
                }}
                className="w-8 h-8 rounded-xl bg-brand/10 hover:bg-brand/20 border border-brand/30 flex items-center justify-center text-brand transition shadow-sm hover:border-brand/60"
                title="AI Bio Enhancer"
              >
                <Icon icon="solar:magic-stick-3-bold" width="14" />
              </button>
            </div>
          </div>
        </div>
      </div>

        {/* Sticky Footer: Only shown in Modal Mode (Eliminates redundant second save in Inline Studio) */}
        {!isInline && (
          <div className="px-5 py-3 border-t border-white/10 bg-[#121214] flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition rounded-xl hover:bg-white/5"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="rounded-xl bg-brand text-white px-5 py-2 text-xs font-bold hover:bg-brand-hover transition flex items-center gap-2 shadow-lg shadow-brand/20 disabled:opacity-50"
            >
              <Icon icon="solar:diskette-bold" width="15" />
              <span>{saving ? 'Saving...' : 'Save & Publish Portfolio'}</span>
            </button>
          </div>
        )}
      </div>
  );

  if (isInline) {
    return studioCard;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-lenis-prevent="true"
      style={{ overscrollBehavior: 'contain' }}
      onWheel={handleWheelCapture}
      className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-fade-in overscroll-contain"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      {studioCard}
    </div>
  );
}
