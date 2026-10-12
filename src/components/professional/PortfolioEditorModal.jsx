import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { fetchPortfolioByHandle, savePortfolio, sanitizeHandle, formatVideoEmbed } from '../../lib/portfolioClient';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

const THEME_OPTIONS = [
  {
    id: 'midnight',
    name: 'Midnight Cinema',
    tag: 'Deep Dark + Amber',
    bg: '#0a0a0c',
    cardBg: '#141418',
    glowColor: 'rgba(245, 158, 11, 0.4)',
    accent: '#f59e0b',
    ring: 'ring-amber-500',
    border: 'border-amber-500/50',
    textAccent: 'text-amber-400',
  },
  {
    id: 'gold',
    name: 'Golden Era',
    tag: 'Warm Film Glow',
    bg: '#0f0e0c',
    cardBg: '#1a1813',
    glowColor: 'rgba(234, 179, 8, 0.4)',
    accent: '#eab308',
    ring: 'ring-yellow-500',
    border: 'border-yellow-500/50',
    textAccent: 'text-yellow-400',
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
  },
];

export default function PortfolioEditorModal({ isOpen, onClose, person, onSaved }) {
  useBodyScrollLock(isOpen);
  const scrollBodyRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    theme_preset: 'midnight',
    accent_color: '#f59e0b',
    is_published: true,
  });
  const [availableFilms, setAvailableFilms] = useState([]);
  const [newLink, setNewLink] = useState({ title: '', url: '' });

  // Escape key close handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !person?.slug) return;
    setLoading(true);

    fetchPortfolioByHandle(person.slug)
      .then((res) => {
        if (res) {
          setPortfolio({
            handle: res.portfolio.handle || person.slug,
            tagline: res.portfolio.tagline || person.bio?.split('.')[0] || '',
            bio_statement: res.portfolio.bio_statement || person.bio || '',
            featured_reel_url: res.portfolio.featured_reel_url || '',
            featured_film_ids: res.portfolio.featured_film_ids || [],
            custom_links: res.portfolio.custom_links || [],
            inquiry_email: res.portfolio.inquiry_email || person.booking_email || '',
            inquiry_phone: res.portfolio.inquiry_phone || person.booking_phone || '',
            epk_pdf_url: res.portfolio.epk_pdf_url || '',
            theme_preset: res.portfolio.theme_preset || 'midnight',
            accent_color: res.portfolio.accent_color || '#f59e0b',
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

  if (!isOpen) return null;

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

  const handleAddLink = () => {
    if (!newLink.title.trim() || !newLink.url.trim()) {
      toast.error('Please enter both title and URL.');
      return;
    }
    const cleanUrl = newLink.url.startsWith('http') ? newLink.url.trim() : `https://${newLink.url.trim()}`;
    const updated = [
      ...(portfolio.custom_links || []),
      { id: Date.now().toString(), title: newLink.title.trim(), url: cleanUrl },
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

    const res = await savePortfolio({
      ...portfolio,
      person_id: person.id,
      handle: sanitizeHandle(portfolio.handle || person.slug),
    });

    setSaving(false);
    if (!res.success) {
      toast.error(res.error || 'Failed to save portfolio settings.');
    } else {
      toast.success('Portfolio updated successfully!');
      if (onSaved) onSaved(res.data);
      onClose();
    }
  };

  const liveUrl = `${window.location.origin}/@${sanitizeHandle(portfolio.handle || person.slug)}`;
  const videoPreview = formatVideoEmbed(portfolio.featured_reel_url);

  const handleWheelCapture = (e) => {
    // If scrolling on backdrop, header, or footer, forward scroll directly to the inner scroll body
    if (scrollBodyRef.current && !scrollBodyRef.current.contains(e.target)) {
      scrollBodyRef.current.scrollTop += e.deltaY;
      e.preventDefault();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-lenis-prevent="true"
      style={{ overscrollBehavior: 'contain' }}
      onWheel={handleWheelCapture}
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in overscroll-contain"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-lenis-prevent="true"
        style={{ overscrollBehavior: 'contain' }}
        className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl border border-white/15 bg-zinc-950 shadow-2xl overflow-hidden relative overscroll-contain"
      >
        {/* Sticky Header (Never scrolls away) */}
        <div className="px-6 py-4 border-b border-white/10 bg-zinc-950/95 backdrop-blur-md flex items-center justify-between shrink-0">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400 font-bold">
                Creator Studio
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
              Filmmaker Link-in-Bio Portfolio
            </h2>
            <p className="text-[11px] text-zinc-400 truncate hidden sm:block">
              Customize your standalone public reel, featured film showcase, and press links.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white transition shrink-0"
            title="Close dialog (Esc)"
          >
            <span className="text-xs font-semibold hidden sm:inline">Close</span>
            <Icon icon="solar:close-circle-bold" width="18" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div
          ref={scrollBodyRef}
          data-lenis-prevent="true"
          style={{ overscrollBehavior: 'contain' }}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-6 overscroll-contain"
        >
          {/* Live URL Pill Bar */}
          <div className="p-3.5 rounded-2xl border border-white/10 bg-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Icon icon="solar:link-bold" className="text-amber-400 shrink-0" width="16" />
              <span className="text-xs font-mono text-zinc-300 truncate">{liveUrl}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(liveUrl);
                  toast.success('Link copied to clipboard!');
                }}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1 transition"
              >
                <Icon icon="solar:copy-bold" width="13" />
                <span>Copy</span>
              </button>
              <a
                href={liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-bold flex items-center gap-1 hover:bg-amber-400 transition"
              >
                <Icon icon="solar:square-top-down-linear" width="13" />
                <span>View Live</span>
              </a>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-xs font-mono text-zinc-500 uppercase tracking-widest">
              Loading settings...
            </div>
          ) : (
            <form id="portfolio-form" onSubmit={handleSave} className="space-y-6">
              {/* Vanity Handle */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
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
                    className="w-full rounded-xl border border-white/10 bg-white/5 pl-8 pr-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Theme Aesthetic with Square Skin Previews */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                      Theme Aesthetic & Visual Skin
                    </label>
                    <p className="text-[11px] text-zinc-500">
                      Select your portfolio's cinematic atmosphere, lighting, and palette.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-amber-400 font-bold hidden sm:inline">
                    {THEME_OPTIONS.find((t) => t.id === portfolio.theme_preset)?.name || 'Midnight Cinema'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                        className={`group relative cursor-pointer rounded-2xl border p-2 transition-all duration-200 flex flex-col justify-between ${
                          isSelected
                            ? 'border-amber-400 bg-white/[0.08] shadow-lg shadow-amber-500/15 ring-2 ring-amber-400'
                            : 'border-white/10 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.05]'
                        }`}
                      >
                        {/* True Square Mini Skin Canvas */}
                        <div
                          className="w-full aspect-square rounded-xl relative overflow-hidden border border-white/10 p-2 flex flex-col justify-between shadow-inner"
                          style={{ backgroundColor: t.bg }}
                        >
                          {/* Ambient Glow */}
                          <div
                            className="absolute inset-x-0 top-0 h-16 pointer-events-none opacity-90"
                            style={{
                              background: `radial-gradient(ellipse at 50% 0%, ${t.glowColor}, transparent 80%)`,
                            }}
                          />

                          {/* Top Bar inside canvas: Name + Status/Checkmark */}
                          <div className="relative z-1 flex items-center justify-between gap-1">
                            <span className="text-[10px] font-bold text-white/90 truncate tracking-tight">
                              {t.name}
                            </span>
                            {isSelected ? (
                              <div className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-amber-400 text-black shadow font-bold shrink-0">
                                <Icon icon="solar:check-read-bold" width="9" />
                              </div>
                            ) : (
                              <span
                                className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                                style={{ backgroundColor: t.accent }}
                              />
                            )}
                          </div>

                          {/* Mini Profile Header Simulation */}
                          <div className="relative z-1 flex items-center gap-1.5 my-0.5">
                            <div
                              className="w-4 h-4 rounded-full border shrink-0 shadow-sm flex items-center justify-center text-[7px] font-black"
                              style={{
                                borderColor: t.accent,
                                backgroundColor: t.cardBg,
                                color: t.accent,
                              }}
                            >
                              ●
                            </div>
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="h-1 w-10 rounded-full bg-white/90" />
                              <div className="h-0.5 w-6 rounded-full bg-white/40" />
                            </div>
                          </div>

                          {/* Mini Links Simulation */}
                          <div className="relative z-1 space-y-1 my-0.5">
                            <div
                              className="rounded-md border px-1.5 py-0.5 flex items-center justify-between shadow-xs transition-colors"
                              style={{
                                backgroundColor: t.cardBg,
                                borderColor: isSelected ? t.accent : 'rgba(255,255,255,0.1)',
                              }}
                            >
                              <div className="flex items-center gap-1 min-w-0">
                                <div
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: t.accent }}
                                />
                                <div className="h-0.5 w-8 rounded bg-white/70" />
                              </div>
                              <div
                                className="h-0.5 w-2 rounded-full"
                                style={{ backgroundColor: t.accent }}
                              />
                            </div>
                          </div>

                          {/* Mini Action / Featured Button */}
                          <div
                            className="relative z-1 w-full py-0.5 rounded text-[7px] font-black text-center uppercase tracking-wider shadow-sm"
                            style={{
                              backgroundColor: t.accent,
                              color: '#000',
                            }}
                          >
                            Watch Reel
                          </div>
                        </div>

                        {/* Theme Label & Palette Swatches Below Card */}
                        <div className="mt-1.5 px-0.5 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-[11px] font-bold text-white truncate">{t.name}</p>
                            {/* Palette Swatches */}
                            <div className="flex items-center gap-0.5 shrink-0">
                              <span
                                className="w-1.5 h-1.5 rounded-full border border-white/20"
                                style={{ backgroundColor: t.bg }}
                                title="Background Canvas"
                              />
                              <span
                                className="w-1.5 h-1.5 rounded-full border border-white/20"
                                style={{ backgroundColor: t.cardBg }}
                                title="Card Surface"
                              />
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: t.accent }}
                                title="Accent Glow"
                              />
                            </div>
                          </div>
                          <p className="text-[9px] text-zinc-400 truncate mt-0.5">{t.tag}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tagline / Elevator Pitch */}
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                  One-Line Professional Tagline
                </label>
                <input
                  type="text"
                  value={portfolio.tagline || ''}
                  onChange={(e) => setPortfolio({ ...portfolio, tagline: e.target.value })}
                  placeholder="e.g. Award-winning Director & Visual Storyteller based in Lagos & London"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Featured Showreel / Teaser */}
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                  Featured Showreel / Teaser Trailer (YouTube or Vimeo)
                </label>
                <input
                  type="url"
                  value={portfolio.featured_reel_url || ''}
                  onChange={(e) => setPortfolio({ ...portfolio, featured_reel_url: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                />
                {videoPreview && (
                  <div className="mt-2.5 aspect-video max-h-52 rounded-xl overflow-hidden border border-white/10 bg-black">
                    <iframe src={videoPreview} title="Preview" className="w-full h-full border-0" />
                  </div>
                )}
              </div>

              {/* Curated Film Showcase Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                    Featured Film Showcase (Select 1–6 Top Projects)
                  </label>
                  <span className="text-[10px] font-mono text-amber-400 font-bold">
                    {portfolio.featured_film_ids?.length || 0} Selected
                  </span>
                </div>

                <div className="max-h-52 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02] p-2 space-y-1.5 divide-y divide-white/5 custom-scrollbar">
                  {availableFilms.map((film) => {
                    const isChecked = (portfolio.featured_film_ids || []).includes(film.id);
                    return (
                      <div
                        key={film.id}
                        onClick={() => handleToggleFilm(film.id)}
                        className={`p-2.5 rounded-xl cursor-pointer flex items-center justify-between gap-3 transition ${
                          isChecked ? 'bg-amber-500/10 border border-amber-500/30' : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-xs ${
                              isChecked
                                ? 'bg-amber-500 text-black font-bold'
                                : 'border border-white/20 text-transparent'
                            }`}
                          >
                            ✓
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{film.title}</p>
                            <p className="text-[10px] text-zinc-400">
                              {film.roles.join(', ')} {film.year ? `(${film.year})` : ''}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                          {isChecked ? 'Featured' : 'Add'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Contact & EPK */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                    Direct Booking / Inquiry Email
                  </label>
                  <input
                    type="email"
                    value={portfolio.inquiry_email || ''}
                    onChange={(e) => setPortfolio({ ...portfolio, inquiry_email: e.target.value })}
                    placeholder="agent@production.com"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                    EPK / Lookbook Document URL (PDF)
                  </label>
                  <input
                    type="url"
                    value={portfolio.epk_pdf_url || ''}
                    onChange={(e) => setPortfolio({ ...portfolio, epk_pdf_url: e.target.value })}
                    placeholder="https://drive.google.com/... or CDN link"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Linktree-Style Custom Press & Social Links */}
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-2">
                  Custom Links (Press, Festivals, Podcasts)
                </label>

                {/* Existing Links List */}
                <div className="space-y-2 mb-3">
                  {(portfolio.custom_links || []).map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-white/10 bg-white/5"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{link.title}</p>
                        <p className="text-[10px] text-zinc-400 truncate">{link.url}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveLink(link.id)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 transition"
                        title="Remove Link"
                      >
                        <Icon icon="solar:trash-bin-trash-bold" width="16" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add New Link Inputs */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newLink.title}
                    onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
                    placeholder="Link Title (e.g. Variety Feature)"
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={newLink.url}
                    onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                    placeholder="https://..."
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddLink}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Icon icon="solar:add-circle-bold" width="14" />
                    <span>Add Link</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Sticky Footer (Always Visible at bottom of modal) */}
        <div className="px-6 py-3.5 border-t border-white/10 bg-zinc-950/95 backdrop-blur-md flex items-center justify-between shrink-0">
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
            className="rounded-full bg-amber-500 text-black px-6 py-2.5 text-xs font-black uppercase tracking-wider hover:bg-amber-400 transition flex items-center gap-2 shadow-lg shadow-amber-500/25 disabled:opacity-50"
          >
            <Icon icon="solar:diskette-bold" width="16" />
            <span>{saving ? 'Saving...' : 'Save Portfolio'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
