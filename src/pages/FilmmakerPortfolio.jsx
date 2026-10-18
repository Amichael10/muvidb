import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { fetchPortfolioByHandle, formatVideoEmbed } from '../lib/portfolioClient';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import { formatFilmTitle, toTitleCase } from '../utils/format';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import {
  SOCIAL_PLATFORMS,
  GENERIC_LINK,
  detectPlatform,
  platformFor,
  resolveSocialUrl,
  prettyUrl,
  handleFromUrl,
} from '../lib/socialPlatforms';

const THEME_STYLES = {
  midnight: {
    bg: 'bg-[#0a0a0c]',
    heroGlow: 'from-amber-500/10 via-transparent to-transparent',
    accentText: 'text-amber-400',
    accentBorder: 'border-amber-500/30',
    accentBg: 'bg-amber-500',
    badgeTone: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  },
  gold: {
    bg: 'bg-[#0f0e0c]',
    heroGlow: 'from-yellow-500/15 via-transparent to-transparent',
    accentText: 'text-yellow-400',
    accentBorder: 'border-yellow-500/30',
    accentBg: 'bg-yellow-500',
    badgeTone: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-300',
  },
  neon: {
    bg: 'bg-[#080b11]',
    heroGlow: 'from-cyan-500/15 via-transparent to-transparent',
    accentText: 'text-cyan-400',
    accentBorder: 'border-cyan-500/30',
    accentBg: 'bg-cyan-500',
    badgeTone: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
  },
  minimal: {
    bg: 'bg-[#111113]',
    heroGlow: 'from-white/10 via-transparent to-transparent',
    accentText: 'text-white',
    accentBorder: 'border-white/20',
    accentBg: 'bg-white text-black',
    badgeTone: 'border-white/20 bg-white/10 text-zinc-200',
  },
};

const STREAMING_PROVIDERS = [
  { key: 'netflix', name: 'Netflix', icon: 'simple-icons:netflix', color: 'hover:text-red-500 hover:border-red-500/40' },
  { key: 'amazon', name: 'Prime', icon: 'simple-icons:primevideo', color: 'hover:text-blue-400 hover:border-blue-500/40' },
  { key: 'prime_video', name: 'Prime', icon: 'simple-icons:primevideo', color: 'hover:text-blue-400 hover:border-blue-500/40' },
  { key: 'youtube', name: 'YouTube', icon: 'simple-icons:youtube', color: 'hover:text-red-500 hover:border-red-500/40' },
  { key: 'cinema', name: 'In Theatres', icon: 'solar:ticket-bold', color: 'hover:text-yellow-400 hover:border-yellow-500/40' },
  { key: 'showmax', name: 'Showmax', icon: 'solar:play-circle-bold', color: 'hover:text-blue-500 hover:border-blue-500/40' },
  { key: 'iroko', name: 'iROKO', icon: 'solar:tv-bold', color: 'hover:text-emerald-400 hover:border-emerald-500/40' },
];

export default function FilmmakerPortfolio() {
  const params = useParams();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [contactModalOpen, setContactModalOpen] = useState(false);
  useBodyScrollLock(contactModalOpen);
  const [inquirySent, setInquirySent] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({
    name: '',
    email: '',
    projectType: 'Directing',
    budget: '',
    message: '',
  });

  const handle = useMemo(() => {
    const raw =
      params.handle ||
      params['*'] ||
      (location.pathname.startsWith('/@')
        ? location.pathname.slice(2).split('/')[0]
        : '');
    return decodeURIComponent(raw || '').replace(/^@+/, '').trim();
  }, [params, location.pathname]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchPortfolioByHandle(handle)
      .then((res) => {
        if (!isMounted) return;
        if (!res) {
          setError(`No portfolio found for @${handle}`);
        } else {
          setData(res);
          document.title = `${res.person.name} | Official Filmmaker Portfolio`;
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Failed to load portfolio.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [handle]);

  const copyPortfolioLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success('Portfolio link copied to clipboard!', {
      style: { background: '#1c1c1f', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' },
    });
  };

  const handleSendInquiry = (e) => {
    e.preventDefault();
    if (!inquiryForm.name || !inquiryForm.email || !inquiryForm.message) {
      toast.error('Please fill in all required fields.');
      return;
    }

    const recipient = data?.portfolio?.inquiry_email || data?.person?.booking_email;
    if (recipient) {
      const subject = encodeURIComponent(`Project Inquiry: ${inquiryForm.projectType} from ${inquiryForm.name}`);
      const body = encodeURIComponent(
        `Name: ${inquiryForm.name}\nEmail: ${inquiryForm.email}\nProject Type: ${inquiryForm.projectType}\nBudget Range: ${inquiryForm.budget}\n\nMessage:\n${inquiryForm.message}`
      );
      window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
    }

    setInquirySent(true);
    setTimeout(() => {
      setContactModalOpen(false);
      setInquirySent(false);
      setInquiryForm({ name: '', email: '', projectType: 'Directing', budget: '', message: '' });
      toast.success('Inquiry client opened!');
    }, 1200);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col items-center justify-center p-6">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-amber-500/20 animate-ping" />
          <div className="w-10 h-10 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
        </div>
        <p className="mt-4 text-xs font-mono uppercase tracking-[0.2em] text-zinc-500">
          Loading Cinema Portfolio...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-amber-400 mb-4">
          <Icon icon="solar:clapperboard-broken" width="32" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-100">Filmmaker Portfolio Not Found</h1>
        <p className="mt-2 text-sm text-zinc-400 max-w-sm">
          {error || `We couldn't locate an active portfolio under @${handle}.`}
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Link
            to="/people"
            className="rounded-full bg-white/10 px-5 py-2.5 text-xs font-medium text-white hover:bg-white/20 transition"
          >
            Browse Practitioners
          </Link>
          <Link
            to="/claim"
            className="rounded-full bg-amber-500 text-black px-5 py-2.5 text-xs font-bold hover:bg-amber-400 transition"
          >
            Claim Your Portfolio
          </Link>
        </div>
      </div>
    );
  }

  const { portfolio, person, featuredFilms, allFilms, media } = data;
  const theme = THEME_STYLES[portfolio.theme_preset] || THEME_STYLES.midnight;
  const embedUrl = formatVideoEmbed(portfolio.featured_reel_url);

  // Every social the person has, in registry order, resolved to a real URL.
  // Previously only Instagram and YouTube were rendered, so twitter/tiktok/
  // facebook were fetched from the people table and silently dropped.
  const socialLinks = SOCIAL_PLATFORMS
    .map((platform) => {
      const stored = person.socials?.[platform.key]
        ?? (platform.key === 'x' ? person.socials?.twitter : undefined);
      const url = resolveSocialUrl(platform.key, stored);
      return url ? { platform, url } : null;
    })
    .filter(Boolean);

  // custom_links doubles as a store for a `_meta: 'layout'` config row. The
  // editor filters it out; this page did not, and the row has no `url`, so
  // `link.url.replace(...)` threw and took the whole page down.
  const bioLinks = (portfolio.custom_links || [])
    .filter((link) => link && !link._meta && typeof link.url === 'string' && link.url.trim())
    .map((link) => {
      const platform = platformFor(link.platform) || detectPlatform(link.url) || null;
      return {
        key: link.id || link.url,
        url: link.url.trim(),
        title: link.title?.trim() || platform?.label || prettyUrl(link.url),
        subtitle: handleFromUrl(link.url) || prettyUrl(link.url),
        art: platform || GENERIC_LINK,
      };
    });

  // Filter filmography tabs
  const filteredFilms = allFilms.filter((film) => {
    if (activeTab === 'all') return true;
    const lowerRoles = film.roles.map((r) => r.toLowerCase());
    if (activeTab === 'directing') return lowerRoles.some((r) => r.includes('direct'));
    if (activeTab === 'producing') return lowerRoles.some((r) => r.includes('produc'));
    if (activeTab === 'writing') return lowerRoles.some((r) => r.includes('writ') || r.includes('screen'));
    if (activeTab === 'acting') return lowerRoles.some((r) => r.includes('act'));
    return true;
  });

  return (
    <div className={`min-h-screen ${theme.bg} text-white selection:bg-amber-500 selection:text-black font-sans`}>
      {/* Top Floating Cinema Bar */}
      <nav className="sticky top-0 z-40 backdrop-blur-md bg-black/60 border-b border-white/5 px-4 lg:px-8 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="w-6 h-6 rounded-md bg-amber-500 text-black font-black text-xs flex items-center justify-center font-mono">
            M
          </span>
          <span className="text-xs font-black tracking-wider uppercase text-zinc-300 group-hover:text-white transition">
            MuviDB <span className="text-amber-400 font-mono text-[10px]">CREATOR</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to={`/person/${person.slug}`}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 text-xs transition"
          >
            <Icon icon="solar:database-bold" width="14" />
            <span>Database Bio</span>
          </Link>

          <button
            onClick={copyPortfolioLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition"
          >
            <Icon icon="solar:share-bold" width="14" />
            <span>Share Link</span>
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 py-8 lg:py-12 space-y-12">
        {/* Profile Card / Hero Identity */}
        <section className="relative rounded-3xl border border-white/10 bg-zinc-950/80 p-6 lg:p-8 backdrop-blur-xl overflow-hidden shadow-2xl">
          <div className={`absolute -top-32 -right-32 w-80 h-80 rounded-full bg-gradient-to-b ${theme.heroGlow} blur-3xl pointer-events-none`} />

          <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
            {/* Headshot with Status Ring */}
            <div className="relative shrink-0">
              <div className="w-28 h-28 lg:w-32 lg:h-32 rounded-2xl overflow-hidden border-2 border-white/15 shadow-xl bg-zinc-900">
                <ImageWithFallback
                  src={person.photo_url}
                  alt={person.name}
                  className="w-full h-full object-cover"
                />
              </div>
              {person.is_verified && (
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-lg border-2 border-black" title="Verified Creator">
                  <Icon icon="solar:verified-check-bold" width="18" />
                </div>
              )}
            </div>

            {/* Name, Tagline & Badges */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${theme.badgeTone}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  {person.availability_status === 'available' ? 'Available for Bookings' : 'Filmmaker'}
                </span>
                {person.nationality && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium border border-white/10 bg-white/5 text-zinc-300">
                    <Icon icon="solar:map-point-wave-bold" width="12" />
                    {person.nationality}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
                {person.name}
              </h1>

              <p className="mt-1.5 text-sm sm:text-base font-medium text-zinc-300 max-w-xl">
                {portfolio.tagline || person.bio || 'Director, Screenwriter & Creative Producer.'}
              </p>

              {/* Brand icon row — appears the moment a social is added. */}
              {socialLinks.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  {socialLinks.map(({ platform, url }) => (
                    <a
                      key={platform.key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={platform.label}
                      title={platform.label}
                      className="w-9 h-9 rounded-full grid place-items-center text-white/90 border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/25 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 transition-all duration-200"
                    >
                      <Icon icon={platform.icon} width="17" />
                    </a>
                  ))}
                </div>
              )}

              {/* Stats Bar */}
              <div className="mt-5 flex items-center justify-center sm:justify-start gap-6 text-xs text-zinc-400 border-t border-white/5 pt-4">
                <div>
                  <span className="block text-lg font-black text-white">{allFilms.length}</span>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Films & Credits</span>
                </div>
                {person.awards?.length > 0 && (
                  <div>
                    <span className="block text-lg font-black text-amber-400">{person.awards.length}</span>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Festival Awards</span>
                  </div>
                )}
                <div>
                  <span className="block text-lg font-black text-white">
                    {allFilms.filter(f => f.roles.some(r => r.toLowerCase().includes('direct'))).length || 1}
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Directorial Titles</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <button
                  onClick={() => setContactModalOpen(true)}
                  className="rounded-full bg-amber-500 text-black px-6 py-2.5 text-xs font-black uppercase tracking-wider hover:bg-amber-400 transition flex items-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  <Icon icon="solar:letter-bold" width="16" />
                  <span>Work Inquiry</span>
                </button>

                {portfolio.epk_pdf_url && (
                  <a
                    href={portfolio.epk_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-white/20 bg-white/5 hover:bg-white/10 px-5 py-2.5 text-xs font-bold text-white transition flex items-center gap-2"
                  >
                    <Icon icon="solar:document-text-bold" width="16" />
                    <span>Download EPK</span>
                  </a>
                )}

                <button
                  onClick={copyPortfolioLink}
                  className="rounded-full border border-white/10 bg-white/5 hover:bg-white/10 p-2.5 text-zinc-400 hover:text-white transition"
                  title="Copy Bio Link"
                >
                  <Icon icon="solar:copy-bold" width="16" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Video / Showreel Section */}
        {embedUrl && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon icon="solar:videocamera-record-bold" className="text-amber-400" width="18" />
                <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-400">Featured Showreel</h2>
              </div>
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Cinema 1080p</span>
            </div>

            <div className="relative aspect-video rounded-3xl overflow-hidden border border-white/15 shadow-2xl bg-black">
              <iframe
                src={embedUrl}
                title={`${person.name} Showreel`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </section>
        )}

        {/* The Director's Showcase (Featured Films) */}
        {featuredFilms.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon icon="solar:stars-bold" className="text-amber-400" width="18" />
                <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-400">Featured Showcase</h2>
              </div>
              <span className="text-xs text-zinc-500">{featuredFilms.length} Curated Titles</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {featuredFilms.map((film) => {
                const links = film.streaming_links || {};
                const availableProviders = STREAMING_PROVIDERS.filter((p) => Boolean(links[p.key]));

                return (
                  <article
                    key={film.id}
                    className="group relative rounded-2xl border border-white/10 bg-zinc-950/60 hover:border-amber-500/40 transition duration-300 overflow-hidden flex flex-col justify-between"
                  >
                    {/* Backdrop / Poster Top */}
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-900">
                      <ImageWithFallback
                        src={film.backdrop_url || film.poster_url}
                        alt={film.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />

                      {film.year && (
                        <span className="absolute top-3 right-3 rounded-md bg-black/70 backdrop-blur-md px-2 py-0.5 text-[10px] font-mono font-bold text-zinc-200 border border-white/10">
                          {film.year}
                        </span>
                      )}

                      <div className="absolute bottom-3 left-3 right-3">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold block mb-0.5">
                          {film.roles.join(' • ')}
                        </span>
                        <h3 className="text-base font-bold text-white tracking-tight leading-snug truncate">
                          {formatFilmTitle(film.title)}
                        </h3>
                      </div>
                    </div>

                    {/* Synopsis & Watch Bar */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                      {film.synopsis ? (
                        <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                          {film.synopsis}
                        </p>
                      ) : (
                        <p className="text-xs text-zinc-600 italic">No synopsis available.</p>
                      )}

                      {/* Where to Watch Buttons */}
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {availableProviders.length > 0 ? (
                            availableProviders.map((prov) => (
                              <a
                                key={prov.key}
                                href={links[prov.key]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 text-[11px] font-medium text-zinc-300 transition ${prov.color}`}
                                title={`Watch on ${prov.name}`}
                              >
                                <Icon icon={prov.icon} width="12" />
                                <span>{prov.name}</span>
                              </a>
                            ))
                          ) : (
                            <span className="text-[11px] text-zinc-500 font-mono">In Catalogue</span>
                          )}
                        </div>

                        <Link
                          to={`/film/${film.slug}`}
                          className="shrink-0 text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                        >
                          <span>Details</span>
                          <Icon icon="solar:arrow-right-linear" width="12" />
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* Linktree-Style Custom Links / Press Section */}
        {(bioLinks.length > 0 || socialLinks.length > 0) && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon icon="solar:link-bold" className="text-amber-400" width="18" />
              <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-400">Links</h2>
            </div>

            <div className="space-y-2.5">
              {/* Custom links first: these are what the creator chose to feature. */}
              {bioLinks.map((link) => (
                <a
                  key={link.key}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex items-stretch overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/25 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 transition-all duration-200"
                >
                  <span className={`w-16 sm:w-20 shrink-0 grid place-items-center ${link.art.tint} ${link.art.fg}`}>
                    <Icon icon={link.art.icon} width="24" />
                  </span>
                  <span className="flex-1 min-w-0 flex items-center justify-between gap-3 px-4 py-4">
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-white truncate group-hover:text-amber-300 transition">
                        {link.title}
                      </span>
                      <span className="block text-[11px] text-zinc-500 truncate">{link.subtitle}</span>
                    </span>
                    <Icon
                      icon="solar:arrow-right-up-linear"
                      className="shrink-0 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"
                      width="18"
                    />
                  </span>
                </a>
              ))}

              {/* Then every verified social, driven entirely by the registry. */}
              {socialLinks.map(({ platform, url }) => (
                <a
                  key={platform.key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex items-stretch overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/25 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 transition-all duration-200"
                >
                  <span className={`w-16 sm:w-20 shrink-0 grid place-items-center ${platform.tint} ${platform.fg}`}>
                    <Icon icon={platform.icon} width="24" />
                  </span>
                  <span className="flex-1 min-w-0 flex items-center justify-between gap-3 px-4 py-4">
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-white truncate group-hover:text-amber-300 transition">
                        {platform.label}
                      </span>
                      <span className="block text-[11px] text-zinc-500 truncate">
                        {handleFromUrl(url) || prettyUrl(url)}
                      </span>
                    </span>
                    <Icon
                      icon="solar:arrow-right-up-linear"
                      className="shrink-0 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"
                      width="18"
                    />
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Complete Verified Filmography Timeline */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Icon icon="solar:clapperboard-play-bold" className="text-amber-400" width="18" />
              <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-400">Complete Filmography</h2>
            </div>

            {/* Department Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-full bg-white/5 border border-white/10 self-start sm:self-auto">
              {['all', 'directing', 'producing', 'writing', 'acting'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition ${
                    activeTab === tab
                      ? 'bg-amber-500 text-black shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 divide-y divide-white/5 overflow-hidden">
            {filteredFilms.length > 0 ? (
              filteredFilms.map((film) => (
                <Link
                  key={film.id}
                  to={`/film/${film.slug}`}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-white/[0.03] transition group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-14 rounded-lg overflow-hidden bg-zinc-900 border border-white/10 shrink-0">
                      <ImageWithFallback
                        src={film.poster_url}
                        alt={film.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white group-hover:text-amber-400 transition truncate">
                        {formatFilmTitle(film.title)}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {film.roles.join(', ')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {film.year && (
                      <span className="text-xs font-mono text-zinc-500">{film.year}</span>
                    )}
                    <Icon icon="solar:alt-arrow-right-linear" className="text-zinc-600 group-hover:text-white transition" width="16" />
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-zinc-500 font-mono">
                No credits found under {activeTab}.
              </div>
            )}
          </div>
        </section>

        {/* Linktree-style Signature MuviDB Actions & Footer */}
        <footer className="pt-10 pb-20 border-t border-white/10 text-center space-y-5">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
            <Link
              to={`/people/${person.slug || person.id}`}
              className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 px-5 py-3 text-xs font-bold text-white transition hover:scale-[1.02] shadow-lg"
            >
              <Icon icon="solar:user-bold" className="text-amber-400" width="16" />
              <span>See Full Profile on MuviDB</span>
              <Icon icon="solar:arrow-right-up-linear" width="14" className="text-zinc-400" />
            </Link>

            <Link
              to="/claim"
              className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-5 py-3 text-xs font-bold text-amber-300 transition hover:scale-[1.02] shadow-lg"
            >
              <Icon icon="solar:shield-check-bold" className="text-amber-400" width="16" />
              <span>Claim Your Profile on MuviDB</span>
            </Link>
          </div>

          <div className="pt-2 text-center">
            <p className="text-[11px] text-zinc-500 font-mono tracking-wider">
              Powered by{' '}
              <Link to="/" className="text-zinc-300 hover:text-white font-bold underline underline-offset-2">
                MuviDB
              </Link>{' '}
              — The Living African Film Database
            </p>
          </div>
        </footer>
      </main>

      {/* Floating Linktree-style Bottom Brand Bar */}
      <div className="fixed bottom-4 inset-x-0 z-40 pointer-events-none flex justify-center px-4">
        <div className="pointer-events-auto flex items-center gap-3 px-4 py-2 rounded-full border border-white/20 bg-black/80 backdrop-blur-xl shadow-2xl text-xs text-white">
          <Link to="/" className="flex items-center gap-1.5 font-black tracking-wider hover:text-amber-400 transition">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-200">MuviDB</span>
          </Link>
          <span className="h-3 w-px bg-white/20" />
          <Link
            to={`/people/${person.slug || person.id}`}
            className="text-[11px] text-zinc-300 hover:text-white font-medium transition flex items-center gap-1"
          >
            <span>Full Profile</span>
            <Icon icon="solar:arrow-right-up-linear" width="12" />
          </Link>
          <span className="h-3 w-px bg-white/20" />
          <Link
            to="/claim"
            className="text-[11px] text-amber-400 hover:text-amber-300 font-bold transition flex items-center gap-1"
          >
            <span>Claim Yours</span>
          </Link>
        </div>
      </div>

      {/* Direct Work Inquiry Modal */}
      {contactModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          data-lenis-prevent="true"
          style={{ overscrollBehavior: 'contain' }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overscroll-contain"
          onClick={(e) => {
            if (e.target === e.currentTarget) setContactModalOpen(false);
          }}
        >
          <div
            data-lenis-prevent="true"
            style={{ overscrollBehavior: 'contain' }}
            className="w-full max-w-lg rounded-3xl border border-white/15 bg-zinc-950 p-6 sm:p-8 shadow-2xl relative overscroll-contain"
          >
            <button
              onClick={() => setContactModalOpen(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white p-2"
            >
              <Icon icon="solar:close-circle-bold" width="22" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400">Official Channel</span>
            </div>

            <h3 className="text-xl font-black text-white">
              Work Inquiry with {person.name}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Direct professional inquiry for directing, co-production, speaking, or brand collaboration.
            </p>

            <form onSubmit={handleSendInquiry} className="mt-5 space-y-4 text-left">
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                  Your Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={inquiryForm.name}
                  onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                  placeholder="e.g. Adeola Johnson"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                    Your Work Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={inquiryForm.email}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, email: e.target.value })}
                    placeholder="name@production.com"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                    Project Type
                  </label>
                  <select
                    value={inquiryForm.projectType}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, projectType: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3.5 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="Directing">Feature / Series Directing</option>
                    <option value="Cinematography">Cinematography / DP</option>
                    <option value="Producing">Co-Production Partnership</option>
                    <option value="Writing">Screenwriting / Story</option>
                    <option value="Acting">Lead / Featured Acting</option>
                    <option value="Festival">Festival Programming / Jury</option>
                    <option value="Other">Other Inquiry</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                  Budget / Scope (Optional)
                </label>
                <input
                  type="text"
                  value={inquiryForm.budget}
                  onChange={(e) => setInquiryForm({ ...inquiryForm, budget: e.target.value })}
                  placeholder="e.g. $50k - $200k / Commercial / Independent"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                  Project Brief & Dates *
                </label>
                <textarea
                  required
                  rows={4}
                  value={inquiryForm.message}
                  onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })}
                  placeholder="Brief summary of the script, timeline, location, and your company..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setContactModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inquirySent}
                  className="rounded-full bg-amber-500 text-black px-6 py-2.5 text-xs font-black uppercase tracking-wider hover:bg-amber-400 transition flex items-center gap-2"
                >
                  <Icon icon="solar:plain-bold" width="14" />
                  <span>{inquirySent ? 'Opening Mail...' : 'Send Inquiry'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
