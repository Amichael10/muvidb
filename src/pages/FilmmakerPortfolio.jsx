import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { fetchPortfolioByHandle, formatVideoEmbed, computePortfolioMetrics, formatCurrencyShort, formatViewsShort } from '../lib/portfolioClient';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import { formatFilmTitle, toTitleCase } from '../utils/format';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import CareerPassportModal from '../components/professional/CareerPassportModal';
import {
  SOCIAL_PLATFORMS,
  GENERIC_LINK,
  detectPlatform,
  platformFor,
  resolveSocialUrl,
  prettyUrl,
  handleFromUrl,
} from '../lib/socialPlatforms';

/**
 * MuviDB brand orange. Not Tailwind's `amber` — that is a different, yellower
 * hue that had been hardcoded across this page, which is why portfolios all
 * looked yellow regardless of the theme their creator picked.
 */
const BRAND_ACCENT = '#FF5A1F';

/** The amber the filmmaker_portfolios.accent_color column defaults to. */
const LEGACY_DEFAULT_ACCENT = '#f59e0b';

/**
 * `accent` is injected as the --color-brand CSS variable on the page root, so
 * every `brand` utility below it (bg-brand, text-brand, border-brand/30 ...)
 * resolves to the creator's chosen colour automatically.
 */
const THEME_STYLES = {
  heritage: {
    accent: BRAND_ACCENT,
    hexBg: '#0a0604',
    bg: 'bg-[#0a0604]',
    heroSkin: '/skins/heritage-hero.png',
    footerSkin: '/skins/heritage-footer.png',
    topSkin: '/skins/heritage-hero.png',
    bottomSkin: '/skins/heritage-footer.png',
    heroGlow: 'from-amber-500/25 via-orange-600/10 to-transparent',
    cardBg: 'bg-[#120a06]/85 backdrop-blur-xl border border-amber-500/25 shadow-2xl shadow-black/80',
    cardHover: 'hover:border-amber-500/40',
    accentText: 'text-amber-400',
    accentBorder: 'border-amber-500/30',
    accentBg: 'bg-brand',
    badgeTone: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    statBorder: 'border-amber-500/20 bg-amber-500/[0.04]',
    linkCardBg: 'bg-[#160d08]/90 border border-amber-500/20 hover:border-amber-500/50 hover:bg-[#1f110a]',
    filmCardBg: 'bg-[#140b07]/80 border border-amber-500/15 hover:border-amber-500/35',
  },
  noir: {
    accent: BRAND_ACCENT,
    hexBg: '#08090b',
    bg: 'bg-[#08090b]',
    heroSkin: '/skins/noir-hero.png',
    footerSkin: '/skins/noir-footer.png',
    topSkin: '/skins/noir-hero.png',
    bottomSkin: '/skins/noir-footer.png',
    heroGlow: 'from-[#FF5A1F]/25 via-transparent to-transparent',
    cardBg: 'bg-[#101319]/85 backdrop-blur-xl border border-brand/25 shadow-2xl shadow-black/80',
    cardHover: 'hover:border-brand/40',
    accentText: 'text-brand',
    accentBorder: 'border-brand/30',
    accentBg: 'bg-brand',
    badgeTone: 'border-brand/25 bg-brand/10 text-brand',
    statBorder: 'border-brand/20 bg-brand/[0.04]',
    linkCardBg: 'bg-[#121620]/90 border border-brand/20 hover:border-brand/45 hover:bg-[#181e2b]',
    filmCardBg: 'bg-[#10141d]/80 border border-brand/15 hover:border-brand/35',
  },
  cyan: {
    accent: '#00E5FF',
    hexBg: '#040a12',
    bg: 'bg-[#040a12]',
    heroSkin: '/skins/cyan-hero.png',
    footerSkin: '/skins/cyan-footer.png',
    topSkin: '/skins/cyan-hero.png',
    bottomSkin: '/skins/cyan-footer.png',
    heroGlow: 'from-cyan-500/25 via-transparent to-transparent',
    cardBg: 'bg-[#08121f]/85 backdrop-blur-xl border border-cyan-400/25 shadow-2xl shadow-black/80',
    cardHover: 'hover:border-cyan-400/40',
    accentText: 'text-cyan-400',
    accentBorder: 'border-cyan-400/30',
    accentBg: 'bg-cyan-400 text-black',
    badgeTone: 'border-cyan-400/25 bg-cyan-400/10 text-cyan-300',
    statBorder: 'border-cyan-400/20 bg-cyan-400/[0.04]',
    linkCardBg: 'bg-[#0a1526]/90 border border-cyan-400/20 hover:border-cyan-400/50 hover:bg-[#0f1f38]',
    filmCardBg: 'bg-[#08121f]/80 border border-cyan-400/15 hover:border-cyan-400/35',
  },
  velvet: {
    accent: '#E11D48',
    hexBg: '#0d0508',
    bg: 'bg-[#0d0508]',
    heroSkin: '/skins/velvet-hero.png',
    footerSkin: '/skins/velvet-footer.png',
    topSkin: '/skins/velvet-hero.png',
    bottomSkin: '/skins/velvet-footer.png',
    heroGlow: 'from-rose-500/25 via-transparent to-transparent',
    cardBg: 'bg-[#18080f]/85 backdrop-blur-xl border border-rose-500/25 shadow-2xl shadow-black/80',
    cardHover: 'hover:border-rose-500/40',
    accentText: 'text-rose-400',
    accentBorder: 'border-rose-500/30',
    accentBg: 'bg-rose-500',
    badgeTone: 'border-rose-500/25 bg-rose-500/10 text-rose-300',
    statBorder: 'border-rose-500/20 bg-rose-500/[0.04]',
    linkCardBg: 'bg-[#1d0a13]/90 border border-rose-500/20 hover:border-rose-500/50 hover:bg-[#280f1b]',
    filmCardBg: 'bg-[#18080f]/80 border border-rose-500/15 hover:border-rose-500/35',
  },
  amethyst: {
    accent: '#A855F7',
    hexBg: '#0c0512',
    bg: 'bg-[#0c0512]',
    heroSkin: '/skins/amethyst-hero.png',
    footerSkin: '/skins/amethyst-footer.png',
    topSkin: '/skins/amethyst-hero.png',
    bottomSkin: '/skins/amethyst-footer.png',
    heroGlow: 'from-purple-500/25 via-transparent to-transparent',
    cardBg: 'bg-[#150821]/85 backdrop-blur-xl border border-purple-500/25 shadow-2xl shadow-black/80',
    cardHover: 'hover:border-purple-500/40',
    accentText: 'text-purple-400',
    accentBorder: 'border-purple-500/30',
    accentBg: 'bg-purple-500',
    badgeTone: 'border-purple-500/25 bg-purple-500/10 text-purple-300',
    statBorder: 'border-purple-500/20 bg-purple-500/[0.04]',
    linkCardBg: 'bg-[#190b29]/90 border border-purple-500/20 hover:border-purple-500/50 hover:bg-[#24103a]',
    filmCardBg: 'bg-[#150821]/80 border border-purple-500/15 hover:border-purple-500/35',
  },
  emerald: {
    accent: '#10B981',
    hexBg: '#040f09',
    bg: 'bg-[#040f09]',
    heroSkin: '/skins/emerald-hero.png',
    footerSkin: '/skins/emerald-footer.png',
    topSkin: '/skins/emerald-hero.png',
    bottomSkin: '/skins/emerald-footer.png',
    heroGlow: 'from-emerald-500/25 via-transparent to-transparent',
    cardBg: 'bg-[#081810]/85 backdrop-blur-xl border border-emerald-500/25 shadow-2xl shadow-black/80',
    cardHover: 'hover:border-emerald-500/40',
    accentText: 'text-emerald-400',
    accentBorder: 'border-emerald-500/30',
    accentBg: 'bg-emerald-500 text-black',
    badgeTone: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
    statBorder: 'border-emerald-500/20 bg-emerald-500/[0.04]',
    linkCardBg: 'bg-[#0b2016]/90 border border-emerald-500/20 hover:border-emerald-500/50 hover:bg-[#102d1f]',
    filmCardBg: 'bg-[#081810]/80 border border-emerald-500/15 hover:border-emerald-500/35',
  },
  sapphire: {
    accent: '#3B82F6',
    hexBg: '#030714',
    bg: 'bg-[#030714]',
    heroSkin: '/skins/sapphire-hero.png',
    footerSkin: '/skins/sapphire-footer.png',
    topSkin: '/skins/sapphire-hero.png',
    bottomSkin: '/skins/sapphire-footer.png',
    heroGlow: 'from-blue-500/25 via-transparent to-transparent',
    cardBg: 'bg-[#070f24]/85 backdrop-blur-xl border border-blue-500/25 shadow-2xl shadow-black/80',
    cardHover: 'hover:border-blue-500/40',
    accentText: 'text-blue-400',
    accentBorder: 'border-blue-500/30',
    accentBg: 'bg-blue-500',
    badgeTone: 'border-blue-500/25 bg-blue-500/10 text-blue-300',
    statBorder: 'border-blue-500/20 bg-blue-500/[0.04]',
    linkCardBg: 'bg-[#091533]/90 border border-blue-500/20 hover:border-blue-500/50 hover:bg-[#0e204c]',
    filmCardBg: 'bg-[#070f24]/80 border border-blue-500/15 hover:border-blue-500/35',
  },
  obsidian: {
    accent: '#94A3B8',
    hexBg: '#090a0d',
    bg: 'bg-[#090a0d]',
    heroSkin: '/skins/obsidian-hero.png',
    footerSkin: '/skins/obsidian-footer.png',
    topSkin: '/skins/obsidian-hero.png',
    bottomSkin: '/skins/obsidian-footer.png',
    heroGlow: 'from-slate-400/20 via-transparent to-transparent',
    cardBg: 'bg-[#111318]/85 backdrop-blur-xl border border-white/15 shadow-2xl shadow-black/80',
    cardHover: 'hover:border-white/35',
    accentText: 'text-slate-300',
    accentBorder: 'border-white/20',
    accentBg: 'bg-white text-black',
    badgeTone: 'border-white/20 bg-white/10 text-zinc-200',
    statBorder: 'border-white/10 bg-white/[0.02]',
    linkCardBg: 'bg-[#151821]/90 border border-white/15 hover:border-white/40 hover:bg-[#1c202c]',
    filmCardBg: 'bg-[#111318]/80 border border-white/10 hover:border-white/25',
  },
};

// Map legacy preset names to the new canonical themes
THEME_STYLES.muvi = THEME_STYLES.noir;
THEME_STYLES.gold = THEME_STYLES.heritage;
THEME_STYLES.midnight = THEME_STYLES.sapphire;
THEME_STYLES.neon = THEME_STYLES.cyan;
THEME_STYLES.minimal = THEME_STYLES.obsidian;

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
  const [passportModalOpen, setPassportModalOpen] = useState(false);
  useBodyScrollLock(contactModalOpen || passportModalOpen);
  const [inquirySent, setInquirySent] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({
    name: '',
    email: '',
    projectType: 'Directing',
    budget: '',
    message: '',
  });
  const [showAllFilmography, setShowAllFilmography] = useState(false);

  const handle = useMemo(() => {
    const raw =
      params.handle ||
      params['*'] ||
      (location.pathname.startsWith('/@')
        ? location.pathname.slice(2).split('/')[0]
        : '');
    return decodeURIComponent(raw || '').replace(/^@+/, '').trim();
  }, [params, location.pathname]);

  const allFilms = data?.allFilms || [];
  const stageCredits = data?.stageCredits || [];
  const metrics = data?.metrics;
  const person = data?.person;

  const computedMetrics = useMemo(() => {
    if (!data) return null;
    if (metrics) return metrics;
    return computePortfolioMetrics(allFilms, stageCredits, person?.youtube_stats);
  }, [data, metrics, allFilms, stageCredits, person]);

  // Dynamically compute department tabs based ONLY on what this creator has actually done.
  // If they have never directed or produced, those tabs will not appear.
  const availableTabs = useMemo(() => {
    if (!data) return [{ id: 'all', label: 'All' }];
    const tabs = [{ id: 'all', label: 'All' }];
    const allRoles = allFilms.flatMap((f) => (f.roles || []).map((r) => String(r).toLowerCase()));

    const hasDirecting = allRoles.some((r) => r.includes('direct'));
    if (hasDirecting) tabs.push({ id: 'directing', label: 'Directing' });

    const hasProducing = allRoles.some((r) => r.includes('produc'));
    if (hasProducing) tabs.push({ id: 'producing', label: 'Producing' });

    const hasWriting = allRoles.some((r) => r.includes('writ') || r.includes('screen'));
    if (hasWriting) tabs.push({ id: 'writing', label: 'Writing' });

    const hasActing = allRoles.some((r) => r.includes('act') || r.includes('cast'));
    if (hasActing) tabs.push({ id: 'acting', label: 'Acting' });

    if (stageCredits && stageCredits.length > 0) {
      tabs.push({ id: 'stage', label: '🎭 Stage & Theatre' });
    }

    return tabs;
  }, [data, allFilms, stageCredits]);

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some((t) => t.id === activeTab)) {
      setActiveTab('all');
    }
  }, [availableTabs, activeTab]);

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
          document.title = `${res.person.name} | Official Creator Link | MuviDB`;
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
    toast.success('Creator Link copied to clipboard!', {
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
          <div className="absolute inset-0 rounded-full border-2 border-brand/20 animate-ping" />
          <div className="w-10 h-10 rounded-full border-2 border-brand border-t-transparent animate-spin" />
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
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-brand mb-4">
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
            className="rounded-full bg-brand text-black px-5 py-2.5 text-xs font-bold hover:bg-brand transition"
          >
            Claim Your Portfolio
          </Link>
        </div>
      </div>
    );
  }

  const { portfolio, featuredFilms, media, settings = {} } = data;
  const showMetrics = settings.show_metrics !== false;
  const showBoxOffice = settings.show_box_office !== false;
  const showYoutubeViews = settings.show_youtube_views !== false;

  const hasCommercialToDisplay =
    showMetrics &&
    ((showBoxOffice && (computedMetrics?.totalBoxOffice || 0) > 0) ||
     (showBoxOffice && (computedMetrics?.totalStageBoxOffice || 0) > 0) ||
     (showYoutubeViews && (computedMetrics?.totalViews || 0) > 0));

  const theme = THEME_STYLES[portfolio.theme_preset] || THEME_STYLES.heritage || THEME_STYLES.midnight;
  // A creator can store a free-form accent_color; fall back to the preset's
  // colour, then to the MuviDB brand. Previously none of this was read at all.
  //
  // '#f59e0b' is skipped on purpose: it is the column default from the original
  // migration, so EVERY portfolio carries it whether or not anyone chose it.
  // Treating it as a real choice is what kept these pages amber instead of
  // MuviDB orange. A creator who genuinely wants amber can pick the gold theme.
  const storedAccent = String(portfolio.accent_color || '').trim().toLowerCase();
  const creatorPicked = /^#[0-9a-f]{6}$/i.test(storedAccent) && storedAccent !== LEGACY_DEFAULT_ACCENT;
  const accentColor = creatorPicked ? storedAccent : (theme.accent || BRAND_ACCENT);
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
      const platform =
        platformFor(link.platform) ||
        platformFor(link.title) ||
        detectPlatform(link.url) ||
        null;
      let finalUrl = link.url.trim();
      // If user typed a bare handle into url (e.g. "@endtoendtest" or "endtoendtest") and platform is known, convert to full url:
      if (platform && !/^https?:\/\//i.test(finalUrl) && !/^[\w.-]+\.[a-z]{2,}\//i.test(finalUrl)) {
        finalUrl = platform.handleToUrl(finalUrl.replace(/^@+/, ''));
      }
      return {
        key: link.id || finalUrl,
        url: finalUrl,
        title: link.title?.trim() || platform?.label || prettyUrl(finalUrl),
        subtitle: handleFromUrl(finalUrl) || prettyUrl(finalUrl),
        art: platform || GENERIC_LINK,
      };
    });

  // Filter filmography tabs
  const filteredFilms = (allFilms || []).filter((film) => {
    if (activeTab === 'all') return true;
    const lowerRoles = (film.roles || []).map((r) => String(r).toLowerCase());
    if (activeTab === 'directing') return lowerRoles.some((r) => r.includes('direct'));
    if (activeTab === 'producing') return lowerRoles.some((r) => r.includes('produc'));
    if (activeTab === 'writing') return lowerRoles.some((r) => r.includes('writ') || r.includes('screen'));
    if (activeTab === 'acting') return lowerRoles.some((r) => r.includes('act') || r.includes('cast'));
    return true;
  });

  const displayedFilms = showAllFilmography ? filteredFilms : filteredFilms.slice(0, 5);

  return (
    <div
      className={`min-h-screen ${theme.bg} text-white selection:bg-brand selection:text-black font-sans relative overflow-x-hidden`}
      style={{ '--color-brand': accentColor, '--color-brand-hover': accentColor }}
    >
      {/* Top Cinema Skin Backdrop Graphic */}
      {(theme.heroSkin || theme.topSkin) && (
        <div className="absolute top-0 inset-x-0 h-[520px] sm:h-[640px] lg:h-[740px] pointer-events-none overflow-hidden select-none z-0">
          <img
            src={theme.heroSkin || theme.topSkin}
            alt=""
            className="w-full h-full object-cover object-top opacity-95"
          />
          {/* Subtle top edge blend for status bar / header */}
          <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/40 to-transparent" />
          {/* Smooth bottom fade into deep page background */}
          <div
            className="absolute bottom-0 inset-x-0 h-44 bg-gradient-to-b from-transparent to-[var(--skin-bg)]"
            style={{ '--skin-bg': theme.hexBg || '#0a0604' }}
          />
        </div>
      )}

      {/* Side Decorative African Pattern Strips (Ultra-Wide screens) */}
      {theme.patternStrip && (
        <>
          <div
            className="hidden 2xl:block fixed top-0 bottom-0 left-0 w-28 pointer-events-none opacity-20 mix-blend-screen z-0"
            style={{
              backgroundImage: `url(${theme.patternStrip})`,
              backgroundRepeat: 'repeat-y',
              backgroundSize: '100% auto',
              maskImage: 'linear-gradient(to right, black, transparent)',
              WebkitMaskImage: 'linear-gradient(to right, black, transparent)',
            }}
          />
          <div
            className="hidden 2xl:block fixed top-0 bottom-0 right-0 w-28 pointer-events-none opacity-20 mix-blend-screen transform scale-x-[-1] z-0"
            style={{
              backgroundImage: `url(${theme.patternStrip})`,
              backgroundRepeat: 'repeat-y',
              backgroundSize: '100% auto',
              maskImage: 'linear-gradient(to right, black, transparent)',
              WebkitMaskImage: 'linear-gradient(to right, black, transparent)',
            }}
          />
        </>
      )}

      {/* Bottom Cinema Skin Backdrop Graphic */}
      {(theme.footerSkin || theme.bottomSkin) && (
        <div className="absolute bottom-0 inset-x-0 h-[420px] sm:h-[500px] lg:h-[580px] pointer-events-none overflow-hidden select-none z-0">
          <img
            src={theme.footerSkin || theme.bottomSkin}
            alt=""
            className="w-full h-full object-cover object-bottom opacity-95"
          />
          {/* Smooth top edge blend upward into deep page background */}
          <div
            className="absolute top-0 inset-x-0 h-40 bg-gradient-to-t from-transparent to-[var(--skin-bg)]"
            style={{ '--skin-bg': theme.hexBg || '#0a0604' }}
          />
          {/* Subtle bottom edge darken */}
          <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      )}

      {/* Main Container - Elevated Above Skin Backdrop Artwork */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 py-8 lg:py-14 space-y-12">
        {/* Profile Card / Hero Identity */}
        <section className={`relative rounded-3xl ${theme.cardBg || 'border border-white/10 bg-zinc-950/80'} p-6 lg:p-8 backdrop-blur-xl overflow-hidden shadow-2xl`}>
          <div className={`absolute -top-32 -right-32 w-80 h-80 rounded-full bg-gradient-to-b ${theme.heroGlow} blur-3xl pointer-events-none`} />

          <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
            {/* Generously Sized Headshot with Prestige Ring */}
            <div className="relative shrink-0">
              <div className="w-36 h-36 sm:w-40 sm:h-40 lg:w-48 lg:h-48 rounded-3xl overflow-hidden border-2 border-white/20 shadow-2xl bg-zinc-900 relative group">
                <ImageWithFallback
                  src={person.photo_url}
                  alt={person.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              {person.is_verified && (
                <div className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-brand text-black flex items-center justify-center shadow-xl border-2 border-black" title="Verified Creator">
                  <Icon icon="solar:verified-check-bold" width="20" />
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
                      className="w-9 h-9 rounded-full grid place-items-center text-white/90 border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/25 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 transition-all duration-200"
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
                    <span className="block text-lg font-black text-brand">{person.awards.length}</span>
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
                  className="rounded-full bg-brand text-black px-6 py-2.5 text-xs font-black uppercase tracking-wider hover:bg-brand transition flex items-center gap-2 shadow-lg shadow-brand/20 active:scale-95"
                >
                  <Icon icon="solar:letter-bold" width="16" />
                  <span>Work Inquiry</span>
                </button>

                <button
                  onClick={() => setPassportModalOpen(true)}
                  className="rounded-full border border-white/20 bg-white/5 hover:bg-white/10 px-5 py-2.5 text-xs font-bold text-white transition flex items-center gap-2 hover:border-brand/40 shadow-sm"
                  title="Customize & Export PDF Casting CV"
                >
                  <Icon icon="solar:document-text-bold" width="16" className="text-brand" />
                  <span>Export PDF CV</span>
                </button>

                {portfolio.epk_pdf_url && (
                  <a
                    href={portfolio.epk_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-white/20 bg-white/5 hover:bg-white/10 px-5 py-2.5 text-xs font-bold text-white transition flex items-center gap-2"
                  >
                    <Icon icon="solar:download-minimalistic-linear" width="16" />
                    <span>Download EPK</span>
                  </a>
                )}

                <button
                  onClick={copyPortfolioLink}
                  className="rounded-full border border-white/10 bg-white/5 hover:bg-white/10 p-2.5 text-zinc-400 hover:text-white transition"
                  title="Copy Creator Link"
                >
                  <Icon icon="solar:copy-bold" width="16" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Commercial Footprint (Cinema Box Office, Theatre Box Office & YouTube Views) */}
        {hasCommercialToDisplay && (
          <section className={`relative rounded-3xl ${theme.cardBg || 'border border-white/10 bg-zinc-950/80'} p-6 sm:p-7 backdrop-blur-xl overflow-hidden shadow-xl`}>
            {/* Ambient Background Glow */}
            <div className={`absolute top-0 right-0 w-80 h-80 rounded-full bg-gradient-to-b ${theme.heroGlow} blur-3xl opacity-20 pointer-events-none`} />

            {/* Section Header */}
            <div className="relative border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <Icon icon="solar:chart-square-bold" width="18" className="text-brand" />
                <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-bold">
                  Commercial Footprint
                </h2>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Documented theatrical box office milestones and verified digital viewership
              </p>
            </div>

            {/* Metric Highlights Grid - Strictly Commercial & Audience Figures */}
            <div className="relative mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {showBoxOffice && (computedMetrics?.totalBoxOffice || 0) > 0 && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] p-5 flex flex-col justify-between hover:border-amber-500/50 transition">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400">
                      Cinema Box Office
                    </span>
                    <Icon icon="solar:ticket-bold" width="16" className="text-amber-400" />
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
                      {computedMetrics.formattedBoxOffice}
                    </div>
                    <p className="text-xs text-zinc-300 font-medium mt-1">
                      Documented Cinema Box Office
                    </p>
                  </div>
                </div>
              )}

              {showBoxOffice && (computedMetrics?.totalStageBoxOffice || 0) > 0 && (
                <div className="rounded-2xl border border-purple-500/30 bg-purple-500/[0.04] p-5 flex flex-col justify-between hover:border-purple-500/50 transition">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-400">
                      Theatre Box Office
                    </span>
                    <Icon icon="solar:masks-bold" width="16" className="text-purple-400" />
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
                      {computedMetrics.formattedStageBoxOffice}
                    </div>
                    <p className="text-xs text-zinc-300 font-medium mt-1">
                      Documented Theatre Box Office
                    </p>
                  </div>
                </div>
              )}

              {showYoutubeViews && (computedMetrics?.totalViews || 0) > 0 && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.04] p-5 flex flex-col justify-between hover:border-red-500/50 transition">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-red-400">
                      Audience Reach
                    </span>
                    <Icon icon="simple-icons:youtube" width="16" className="text-red-400" />
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
                      {computedMetrics.formattedViews}
                    </div>
                    <p className="text-xs text-zinc-300 font-medium mt-1">
                      Combined YouTube Views
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Featured Video / Showreel Section */}
        {embedUrl && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon icon="solar:videocamera-record-bold" className="text-brand" width="18" />
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

        {/* The Director's Showcase (Featured Films - 3 on a Straight Line) */}
        {featuredFilms.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon icon="solar:stars-bold" className="text-brand" width="18" />
                <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-400">Featured Showcase</h2>
              </div>
              <span className="text-xs text-zinc-500">{Math.min(featuredFilms.length, 3)} Curated Titles</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {featuredFilms.slice(0, 3).map((film) => {
                const links = film.streaming_links || {};
                const availableProviders = STREAMING_PROVIDERS.filter((p) => Boolean(links[p.key]));

                return (
                  <article
                    key={film.id}
                    className={`group relative rounded-2xl ${theme.cardBg || 'border border-white/10 bg-zinc-950/70'} ${theme.cardHover || 'hover:border-brand/40'} transition duration-300 overflow-hidden flex flex-col justify-between`}
                  >
                    {/* Backdrop / Poster Top */}
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-900">
                      <ImageWithFallback
                        src={film.backdrop_url || film.poster_url}
                        alt={film.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />

                      {film.year && (
                        <span className="absolute top-2.5 right-2.5 rounded-md bg-black/70 backdrop-blur-md px-2 py-0.5 text-[10px] font-mono font-bold text-zinc-200 border border-white/10">
                          {film.year}
                        </span>
                      )}

                      <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1 z-10">
                        {showMetrics && showBoxOffice && film.box_office_domestic > 0 && (
                          <span className="rounded-md bg-black/80 backdrop-blur-md px-1.5 py-0.5 text-[9px] font-mono font-bold text-white border border-brand/40 shadow-sm flex items-center gap-1">
                            <Icon icon="solar:ticket-bold" width="10" className="text-brand" />
                            <span>{formatCurrencyShort(film.box_office_domestic)}</span>
                          </span>
                        )}
                        {showMetrics && showYoutubeViews && film.view_count > 0 && (
                          <span className="rounded-md bg-black/80 backdrop-blur-md px-1.5 py-0.5 text-[9px] font-mono font-bold text-white border border-red-500/40 shadow-sm flex items-center gap-1">
                            <Icon icon="simple-icons:youtube" width="10" className="text-red-500" />
                            <span>{formatViewsShort(film.view_count)}</span>
                          </span>
                        )}
                      </div>

                      <div className="absolute bottom-2.5 left-3 right-3">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-brand font-bold block mb-0.5 truncate">
                          {film.roles.join(' • ')}
                        </span>
                        <h3 className="text-sm font-bold text-white tracking-tight leading-snug truncate">
                          {formatFilmTitle(film.title)}
                        </h3>
                      </div>
                    </div>

                    {/* Synopsis & Watch Bar */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                      {film.synopsis ? (
                        <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
                          {film.synopsis}
                        </p>
                      ) : (
                        <p className="text-[11px] text-zinc-600 italic">No synopsis available.</p>
                      )}

                      {/* Where to Watch Buttons */}
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 flex-wrap min-w-0">
                          {availableProviders.length > 0 ? (
                            availableProviders.slice(0, 2).map((prov) => (
                              <a
                                key={prov.key}
                                href={links[prov.key]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-white/10 bg-white/5 text-[10px] font-medium text-zinc-300 transition ${prov.color}`}
                                title={`Watch on ${prov.name}`}
                              >
                                <Icon icon={prov.icon} width="11" />
                                <span className="truncate max-w-[65px]">{prov.name}</span>
                              </a>
                            ))
                          ) : (
                            <span className="text-[10px] text-zinc-500 font-mono">In Catalogue</span>
                          )}
                        </div>

                        <Link
                          to={`/film/${film.slug}`}
                          className="shrink-0 text-[11px] font-bold text-brand hover:underline flex items-center gap-1"
                        >
                          <span>Details</span>
                          <Icon icon="solar:arrow-right-linear" width="11" />
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
              <Icon icon="solar:link-bold" className="text-brand" width="18" />
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
                  className={`group relative flex items-stretch overflow-hidden rounded-2xl ${theme.linkCardBg || 'border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/25'} hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 transition-all duration-200`}
                >
                  <span className={`w-16 sm:w-20 shrink-0 grid place-items-center ${link.art.tint} ${link.art.fg}`}>
                    <Icon icon={link.art.icon} width="24" />
                  </span>
                  <span className="flex-1 min-w-0 flex items-center justify-between gap-3 px-4 py-4">
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-white truncate group-hover:text-brand transition">
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
                  className={`group relative flex items-stretch overflow-hidden rounded-2xl ${theme.linkCardBg || 'border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/25'} hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 transition-all duration-200`}
                >
                  <span className={`w-16 sm:w-20 shrink-0 grid place-items-center ${platform.tint} ${platform.fg}`}>
                    <Icon icon={platform.icon} width="24" />
                  </span>
                  <span className="flex-1 min-w-0 flex items-center justify-between gap-3 px-4 py-4">
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-white truncate group-hover:text-brand transition">
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
              <Icon icon="solar:clapperboard-play-bold" className="text-brand" width="18" />
              <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-400">Complete Filmography</h2>
            </div>

            {/* Department Filter Tabs (Only shown if creator has performed multiple roles) */}
            {availableTabs.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-white/5 border border-white/10 self-start sm:self-auto">
                {availableTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition ${
                      activeTab === tab.id
                        ? 'bg-brand text-black shadow-sm font-bold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={`rounded-2xl ${theme.cardBg || 'border border-white/10 bg-zinc-950/60'} divide-y divide-white/5 overflow-hidden`}>
            {activeTab === 'stage' ? (
              stageCredits.length > 0 ? (
                stageCredits.map((stg, idx) => {
                  const play = stg.plays || stg.play || {};
                  return (
                    <Link
                      key={stg.id || idx}
                      to={play.slug ? `/play/${play.slug}` : `/plays`}
                      className="p-4 flex items-center justify-between gap-4 hover:bg-white/[0.03] transition group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-14 rounded-lg overflow-hidden bg-purple-950/40 border border-purple-500/30 shrink-0 flex items-center justify-center text-purple-300">
                          {play.poster_url ? (
                            <ImageWithFallback src={play.poster_url} alt={play.title} className="w-full h-full object-cover" />
                          ) : (
                            <Icon icon="solar:mask-hamsa-bold" width="20" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white group-hover:text-brand transition truncate flex items-center gap-2">
                            <span>{formatFilmTitle(play.title || 'Stage Production')}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold uppercase tracking-wider">
                              Stage
                            </span>
                          </p>
                          <p className="text-xs text-zinc-400">
                            {stg.role_name || 'Performer'} {play.venue_name ? `· ${play.venue_name}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {play.year && <span className="text-xs font-mono text-zinc-500">{play.year}</span>}
                        <Icon icon="solar:alt-arrow-right-linear" className="text-zinc-600 group-hover:text-white transition" width="16" />
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="p-8 text-center text-xs text-zinc-500 font-mono">
                  No verified stage credits listed.
                </div>
              )
            ) : displayedFilms.length > 0 ? (
              displayedFilms.map((film) => (
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
                      <p className="text-sm font-bold text-white group-hover:text-brand transition truncate">
                        {formatFilmTitle(film.title)}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {film.roles.join(', ')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    {showMetrics && showBoxOffice && film.box_office_domestic > 0 && (
                      <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-brand/30 text-[10px] font-mono font-bold text-brand">
                        <Icon icon="solar:ticket-bold" width="11" />
                        <span>{formatCurrencyShort(film.box_office_domestic)}</span>
                      </span>
                    )}
                    {showMetrics && showYoutubeViews && film.view_count > 0 && (
                      <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-red-500/30 text-[10px] font-mono font-bold text-red-400">
                        <Icon icon="simple-icons:youtube" width="11" />
                        <span>{formatViewsShort(film.view_count)}</span>
                      </span>
                    )}
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

            {/* Expand / Collapse Top 5 Limit */}
            {activeTab !== 'stage' && filteredFilms.length > 5 && (
              <div className="p-3 bg-zinc-950/80 text-center border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowAllFilmography(!showAllFilmography)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-zinc-300 hover:text-white hover:bg-white/5 border border-white/10 transition"
                >
                  <span>{showAllFilmography ? 'Show Top 5 Only' : `View All ${filteredFilms.length} Credits`}</span>
                  <Icon
                    icon={showAllFilmography ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
                    width="14"
                  />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Linktree-style Signature MuviDB Actions & Footer */}
        <footer className="pt-10 pb-20 border-t border-white/10 text-center space-y-5">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-lg mx-auto">
            <Link
              to={`/people/${person.slug || person.id}`}
              className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 px-5 py-3 text-xs font-bold text-white transition hover:scale-[1.02] shadow-lg whitespace-nowrap"
            >
              <Icon icon="solar:user-bold" className="text-brand" width="16" />
              <span>View on MuviDB</span>
              <Icon icon="solar:arrow-right-up-linear" width="14" className="text-zinc-400" />
            </Link>

            <Link
              to="/claim"
              className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 rounded-2xl bg-brand text-black font-black px-6 py-3 text-xs uppercase tracking-wider hover:brightness-110 transition hover:scale-[1.02] shadow-lg shadow-brand/20 whitespace-nowrap"
            >
              <Icon icon="solar:shield-check-bold" width="16" />
              <span>Claim Your Profile</span>
            </Link>
          </div>

          <div className="pt-2 text-center">
            <p className="text-[11px] text-zinc-500 font-mono tracking-wider">
              Powered by{' '}
              <Link to="/" className="text-zinc-300 hover:text-white font-bold underline underline-offset-2">
                MuviDB
              </Link>{' '}
              — The living record of African film & theatre.
            </p>
          </div>
        </footer>
      </main>

      {/* Floating Linktree-style Bottom Brand Bar */}
      <div className="fixed bottom-4 inset-x-0 z-40 pointer-events-none flex justify-center px-4">
        <div className="pointer-events-auto flex items-center gap-3 px-4 py-2 rounded-full border border-white/20 bg-black/80 backdrop-blur-xl shadow-2xl text-xs text-white">
          <Link to="/" className="flex items-center gap-1.5 font-black tracking-wider hover:text-brand transition">
            <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
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
            className="text-[11px] text-brand hover:text-brand font-bold transition flex items-center gap-1"
          >
            <span>Claim Your Creator Link</span>
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
              <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-brand">Official Channel</span>
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
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-brand focus:outline-none"
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
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                    Project Type
                  </label>
                  <select
                    value={inquiryForm.projectType}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, projectType: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3.5 py-2.5 text-xs text-white focus:border-brand focus:outline-none"
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
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-brand focus:outline-none"
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
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-brand focus:outline-none resize-none"
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
                  className="rounded-full bg-brand text-black px-6 py-2.5 text-xs font-black uppercase tracking-wider hover:bg-brand transition flex items-center gap-2"
                >
                  <Icon icon="solar:plain-bold" width="14" />
                  <span>{inquirySent ? 'Opening Mail...' : 'Send Inquiry'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customizable Career Passport & PDF Export Studio Modal */}
      {passportModalOpen && (
        <CareerPassportModal
          person={{ ...person, claimed: true }}
          credits={allFilms.map(f => ({
            id: f.id,
            role: f.roles?.[0] || 'Contributor',
            character_name: '',
            year: f.year,
            films: f,
          }))}
          stageCredits={stageCredits}
          personalized
          onClose={() => setPassportModalOpen(false)}
        />
      )}
    </div>
  );
}
