import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import {
  fetchPortfolioByHandle,
  formatVideoEmbed,
  computePortfolioMetrics,
  formatCurrencyShort,
  formatViewsShort,
} from '../lib/portfolioClient';
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
 * MuviDB brand orange.
 */
const BRAND_ACCENT = '#FF5A1F';

/** The amber the filmmaker_portfolios.accent_color column defaults to. */
const LEGACY_DEFAULT_ACCENT = '#f59e0b';

/**
 * `accent` is injected as the --color-brand CSS variable on the page root, so
 * every `brand` utility below it resolves to the creator's chosen colour automatically.
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
    cardBg: 'bg-[#120a06]/90 backdrop-blur-xl border border-amber-500/25 shadow-2xl shadow-black/80',
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
    cardBg: 'bg-[#101319]/90 backdrop-blur-xl border border-brand/25 shadow-2xl shadow-black/80',
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
    cardBg: 'bg-[#08121f]/90 backdrop-blur-xl border border-cyan-400/25 shadow-2xl shadow-black/80',
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
    cardBg: 'bg-[#18080f]/90 backdrop-blur-xl border border-rose-500/25 shadow-2xl shadow-black/80',
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
    cardBg: 'bg-[#150821]/90 backdrop-blur-xl border border-purple-500/25 shadow-2xl shadow-black/80',
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
    cardBg: 'bg-[#081810]/90 backdrop-blur-xl border border-emerald-500/25 shadow-2xl shadow-black/80',
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
    cardBg: 'bg-[#070f24]/90 backdrop-blur-xl border border-blue-500/25 shadow-2xl shadow-black/80',
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
    cardBg: 'bg-[#111318]/90 backdrop-blur-xl border border-white/15 shadow-2xl shadow-black/80',
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

// Map legacy preset names to canonical themes
THEME_STYLES.muvi = THEME_STYLES.noir;
THEME_STYLES.gold = THEME_STYLES.heritage;
THEME_STYLES.midnight = THEME_STYLES.sapphire;
THEME_STYLES.neon = THEME_STYLES.cyan;
THEME_STYLES.minimal = THEME_STYLES.obsidian;

/**
 * Flowing curved wave graphic for Career Impact metric cards,
 * matching the signature MuviDB visual aesthetic.
 */
function MetricWave({ color = '#FF5A1F' }) {
  return (
    <svg
      className="absolute bottom-0 right-0 w-32 sm:w-36 h-20 pointer-events-none opacity-40 overflow-visible select-none"
      viewBox="0 0 140 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0 65 C 45 65, 80 45, 140 10"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M20 75 C 60 75, 95 55, 140 25"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M40 80 C 80 80, 110 65, 140 40"
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.3"
      />
    </svg>
  );
}

function getYouTubeVideoId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|(?:embed|v|shorts)\/))([\w-]{11})/i);
  return match ? match[1] : null;
}

export default function FilmmakerPortfolio() {
  const params = useParams();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Active top-level sub-tab: 'overview' | 'credits' | 'links'
  const [portfolioViewTab, setPortfolioViewTab] = useState('overview');

  // Filmography department filter tab
  const [activeFilmographyTab, setActiveFilmographyTab] = useState('all');

  // Modals & player states
  const [isPlayingReel, setIsPlayingReel] = useState(false);
  const [metricsInfoOpen, setMetricsInfoOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [passportModalOpen, setPassportModalOpen] = useState(false);
  const [howItWorksModalOpen, setHowItWorksModalOpen] = useState(false);
  const [showAllFilmography, setShowAllFilmography] = useState(false);

  useBodyScrollLock(contactModalOpen || passportModalOpen || howItWorksModalOpen);

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
  const availableFilmographyTabs = useMemo(() => {
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
    if (availableFilmographyTabs.length > 0 && !availableFilmographyTabs.some((t) => t.id === activeFilmographyTab)) {
      setActiveFilmographyTab('all');
    }
  }, [availableFilmographyTabs, activeFilmographyTab]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchPortfolioByHandle(handle)
      .then((res) => {
        if (!isMounted) return;
        if (!res) {
          setError(`No creator link found for @${handle}`);
        } else {
          setData(res);
          document.title = `${res.person.name} | Creator Link | MuviDB`;
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Failed to load creator link.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [handle]);

  const copyPortfolioLink = () => {
    const url = `${window.location.origin}/@${handle}`;
    navigator.clipboard.writeText(url);
    toast.success('Creator Link copied to clipboard!', {
      style: { background: '#1c1c1f', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' },
    });
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/@${handle}`;
    const shareData = {
      title: `${person?.name || 'Creator'} | MuviDB Creator Link`,
      text: `Check out ${person?.name || 'this creator'}'s official portfolio and filmography on MuviDB.`,
      url,
    };
    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if (err.name !== 'AbortError') {
          copyPortfolioLink();
        }
      }
    } else {
      copyPortfolioLink();
    }
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

  // Construct stylized roles string e.g. "Actor • Producer • Director"
  const rolesList = useMemo(() => {
    if (!person) return 'Filmmaker';
    const roleSet = new Set();

    if (Array.isArray(person.roles) && person.roles.length > 0) {
      person.roles.forEach((r) => {
        if (r) roleSet.add(toTitleCase(String(r).trim()));
      });
    }

    (allFilms || []).forEach((f) => {
      (f.roles || []).forEach((r) => {
        const lower = String(r).toLowerCase();
        if (lower.includes('direct')) roleSet.add('Director');
        else if (lower.includes('produc')) roleSet.add('Producer');
        else if (lower.includes('act') || lower.includes('cast')) roleSet.add('Actor');
        else if (lower.includes('writ') || lower.includes('screen')) roleSet.add('Writer');
        else if (lower.includes('cinemat') || lower.includes('dp')) roleSet.add('Cinematographer');
      });
    });

    if (stageCredits && stageCredits.length > 0) {
      roleSet.add('Theatre');
    }

    const arr = Array.from(roleSet);
    if (arr.length > 0) {
      const priority = ['Actor', 'Producer', 'Director', 'Writer', 'Cinematographer', 'Theatre'];
      arr.sort((a, b) => {
        const idxA = priority.indexOf(a);
        const idxB = priority.indexOf(b);
        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
      });
      return arr.slice(0, 3).join(' • ');
    }

    return 'Filmmaker';
  }, [person, allFilms, stageCredits]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#08090b] text-white flex flex-col items-center justify-center p-6">
        <div className="relative w-14 h-14 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-[#FF5A1F]/20 animate-ping" />
          <div className="w-9 h-9 rounded-full border-2 border-[#FF5A1F] border-t-transparent animate-spin" />
        </div>
        <p className="mt-4 text-xs font-mono uppercase tracking-[0.2em] text-zinc-500">
          Loading Creator Link...
        </p>
      </div>
    );
  }

  // Not found or error state
  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#08090b] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#FF5A1F] mb-4">
          <Icon icon="solar:clapperboard-broken" width="32" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-100">Creator Link Not Found</h1>
        <p className="mt-2 text-sm text-zinc-400 max-w-sm">
          {error || `We couldn't locate an active creator link under @${handle}.`}
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
            className="rounded-full bg-brand text-black px-5 py-2.5 text-xs font-bold hover:brightness-110 transition"
          >
            Claim Your Creator Link
          </Link>
        </div>
      </div>
    );
  }

  const { portfolio, featuredFilms = [], settings = {} } = data;
  const showMetrics = settings.show_metrics !== false;
  const showBoxOffice = settings.show_box_office !== false;
  const showYoutubeViews = settings.show_youtube_views !== false;

  const theme = THEME_STYLES[portfolio.theme_preset] || THEME_STYLES.heritage || THEME_STYLES.noir;
  const storedAccent = String(portfolio.accent_color || '').trim().toLowerCase();
  const creatorPicked = /^#[0-9a-f]{6}$/i.test(storedAccent) && storedAccent !== LEGACY_DEFAULT_ACCENT;
  const accentColor = creatorPicked ? storedAccent : (theme.accent || BRAND_ACCENT);

  const embedUrl = formatVideoEmbed(portfolio.featured_reel_url);
  const ytVideoId = getYouTubeVideoId(portfolio.featured_reel_url);

  // Resolved social links
  const socialLinks = SOCIAL_PLATFORMS
    .map((platform) => {
      const stored = person.socials?.[platform.key]
        ?? (platform.key === 'x' ? person.socials?.twitter : undefined);
      const url = resolveSocialUrl(platform.key, stored);
      return url ? { platform, url } : null;
    })
    .filter(Boolean);

  // Custom bio links added by the filmmaker
  const bioLinks = (portfolio.custom_links || [])
    .filter((link) => link && !link._meta && typeof link.url === 'string' && link.url.trim())
    .map((link) => {
      const platform =
        platformFor(link.platform) ||
        platformFor(link.title) ||
        detectPlatform(link.url) ||
        null;
      let finalUrl = link.url.trim();
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

  // Top 3 featured titles (guarantee 3 cards if creator has films)
  const topFeaturedTitles = [
    ...featuredFilms,
    ...allFilms.filter((f) => !featuredFilms.some((ff) => ff.id === f.id)),
  ].slice(0, 3);

  // Showreel preview thumbnail
  const reelThumbnail =
    ytVideoId
      ? `https://img.youtube.com/vi/${ytVideoId}/hqdefault.jpg`
      : topFeaturedTitles[0]?.backdrop_url ||
        topFeaturedTitles[0]?.poster_url ||
        person.photo_url;

  // Dynamic Career Impact Metric Cards
  const activeMetricCards = [];
  if (showMetrics) {
    if (showYoutubeViews && (computedMetrics?.totalViews || 0) > 0) {
      activeMetricCards.push({
        id: 'youtube',
        label: 'Combined YouTube Views',
        value: computedMetrics.formattedViews,
        desc1: 'Across credited films and productions on YouTube',
        descMulti: 'Audience reach across credited titles',
        icon: 'simple-icons:youtube',
        iconColor: 'text-[#FF0000]',
        badgeBg: 'bg-red-500/10',
        waveColor: '#FF3B30',
        glowWave: 'from-red-600/30',
        fontClass: 'font-mono font-extrabold',
      });
    }

    if (showBoxOffice && (computedMetrics?.totalBoxOffice || 0) > 0) {
      activeMetricCards.push({
        id: 'cinema',
        label: 'Cinema Box Office',
        value: computedMetrics.formattedBoxOffice,
        desc1: 'Total grosses from credited films',
        descMulti: 'Total grosses from credited films',
        icon: 'solar:clapperboard-play-bold',
        iconColor: 'text-amber-400',
        badgeBg: 'bg-amber-500/10',
        waveColor: '#F59E0B',
        glowWave: 'from-amber-600/30',
        fontClass: 'font-serif font-bold',
      });
    }

    if (showBoxOffice && (computedMetrics?.totalStageBoxOffice || 0) > 0) {
      activeMetricCards.push({
        id: 'stage',
        label: 'Stage Box Office',
        value: computedMetrics.formattedStageBoxOffice,
        desc1: 'Total ticket grosses from stage productions',
        descMulti: 'Total ticket grosses from stage productions',
        icon: 'solar:masks-bold',
        iconColor: 'text-orange-400',
        badgeBg: 'bg-orange-500/10',
        waveColor: '#FB923C',
        glowWave: 'from-orange-600/30',
        fontClass: 'font-serif font-bold',
      });
    }
  }

  // Official links list for the Overview tab
  const overviewOfficialLinks = [];
  const ig = socialLinks.find((s) => s.platform.key === 'instagram');
  if (ig) {
    overviewOfficialLinks.push({
      key: 'instagram',
      title: 'Instagram',
      url: ig.url,
      icon: 'simple-icons:instagram',
      iconColor: 'text-[#E4405F]',
      badgeBg: 'bg-[#E4405F]/15',
    });
  }

  const yt = socialLinks.find((s) => s.platform.key === 'youtube');
  if (yt) {
    overviewOfficialLinks.push({
      key: 'youtube',
      title: 'YouTube',
      url: yt.url,
      icon: 'simple-icons:youtube',
      iconColor: 'text-[#FF0000]',
      badgeBg: 'bg-red-500/15',
    });
  }

  // Other social networks
  socialLinks.forEach(({ platform, url }) => {
    if (platform.key !== 'instagram' && platform.key !== 'youtube') {
      overviewOfficialLinks.push({
        key: platform.key,
        title: platform.label,
        url,
        icon: platform.icon,
        iconColor: 'text-white',
        badgeBg: 'bg-white/10',
      });
    }
  });

  // Custom bio links
  bioLinks.forEach((b) => {
    overviewOfficialLinks.push({
      key: b.key,
      title: b.title,
      url: b.url,
      icon: b.art.icon || 'solar:link-bold',
      iconColor: 'text-brand',
      badgeBg: 'bg-brand/10',
    });
  });

  // MuviDB Full Profile link
  overviewOfficialLinks.push({
    key: 'portfolio',
    title: 'Portfolio',
    url: `/people/${person.slug || person.id}`,
    icon: 'solar:globe-bold',
    iconColor: 'text-cyan-400',
    badgeBg: 'bg-cyan-500/15',
    isInternal: true,
  });

  // Booking / Work inquiry
  overviewOfficialLinks.push({
    key: 'booking',
    title: 'Booking',
    action: () => setContactModalOpen(true),
    icon: 'solar:letter-bold',
    iconColor: 'text-brand',
    badgeBg: 'bg-brand/15',
    isAction: true,
  });

  // Export CV
  overviewOfficialLinks.push({
    key: 'cv',
    title: 'Export CV',
    action: () => setPassportModalOpen(true),
    icon: 'solar:document-text-bold',
    iconColor: 'text-amber-400',
    badgeBg: 'bg-amber-500/15',
    isAction: true,
  });

  // Download EPK (if provided)
  if (portfolio.epk_pdf_url) {
    overviewOfficialLinks.push({
      key: 'epk',
      title: 'Download EPK',
      url: portfolio.epk_pdf_url,
      icon: 'solar:download-minimalistic-linear',
      iconColor: 'text-rose-400',
      badgeBg: 'bg-rose-500/15',
    });
  }

  // Filter filmography credits
  const filteredFilms = (allFilms || []).filter((film) => {
    if (activeFilmographyTab === 'all') return true;
    const lowerRoles = (film.roles || []).map((r) => String(r).toLowerCase());
    if (activeFilmographyTab === 'directing') return lowerRoles.some((r) => r.includes('direct'));
    if (activeFilmographyTab === 'producing') return lowerRoles.some((r) => r.includes('produc'));
    if (activeFilmographyTab === 'writing') return lowerRoles.some((r) => r.includes('writ') || r.includes('screen'));
    if (activeFilmographyTab === 'acting') return lowerRoles.some((r) => r.includes('act') || r.includes('cast'));
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
        <div className="absolute top-0 inset-x-0 h-[480px] sm:h-[600px] pointer-events-none overflow-hidden select-none z-0">
          <img
            src={theme.heroSkin || theme.topSkin}
            alt=""
            className="w-full h-full object-cover object-top opacity-90"
          />
          <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/50 to-transparent" />
          <div
            className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-b from-transparent to-[var(--skin-bg)]"
            style={{ '--skin-bg': theme.hexBg || '#08090b' }}
          />
        </div>
      )}

      {/* Bottom Cinema Skin Backdrop Graphic */}
      {(theme.footerSkin || theme.bottomSkin) && (
        <div className="absolute bottom-0 inset-x-0 h-[380px] sm:h-[460px] pointer-events-none overflow-hidden select-none z-0">
          <img
            src={theme.footerSkin || theme.bottomSkin}
            alt=""
            className="w-full h-full object-cover object-bottom opacity-90"
          />
          <div
            className="absolute top-0 inset-x-0 h-36 bg-gradient-to-t from-transparent to-[var(--skin-bg)]"
            style={{ '--skin-bg': theme.hexBg || '#08090b' }}
          />
        </div>
      )}

      {/* Main Content Container: Mobile-First linktree width */}
      <main className="relative z-10 max-w-md sm:max-w-xl mx-auto px-4 py-4 sm:py-6 pb-20 space-y-4">
        {/* Standalone Brand Header (Logo on left, "How it works" on right) */}
        <header className="flex items-center justify-between py-2">
          <Link to="/" className="flex items-center group select-none">
            <img
              src="/images/MuviDB Brand/White Wordmark.svg"
              alt="MuviDB - Every Film. Every Credit."
              className="h-7 sm:h-8 object-contain group-hover:opacity-90 transition-opacity"
            />
          </Link>

          <button
            type="button"
            onClick={() => setHowItWorksModalOpen(true)}
            className="rounded-full bg-brand text-white px-3.5 py-1.5 text-xs font-bold hover:brightness-110 active:scale-95 transition shadow-sm"
          >
            How it works
          </button>
        </header>

        {/* Profile Identity Card */}
        <section
          className={`relative rounded-3xl ${
            theme.cardBg || 'border border-white/10 bg-zinc-950/80'
          } p-4 sm:p-5 backdrop-blur-xl shadow-xl overflow-hidden`}
        >
          {/* Subtle Ambient Glow */}
          <div
            className={`absolute -top-20 -right-20 w-56 h-56 rounded-full bg-gradient-to-b ${theme.heroGlow} blur-3xl opacity-40 pointer-events-none`}
          />

          {/* Top Row: Avatar on Left + Details on Right */}
          <div className="relative flex items-start gap-3.5 sm:gap-4">
            {/* Square Rounded Headshot */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-white/20 shadow-md bg-zinc-900 group">
                <ImageWithFallback
                  src={person.photo_url}
                  alt={person.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              {person.is_verified && (
                <div
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center shadow-md border-2 border-black"
                  title="Verified Creator"
                >
                  <Icon icon="solar:verified-check-bold" width="13" />
                </div>
              )}
            </div>

            {/* Name, Roles, Bio & Share */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
                  {person.name}
                </h1>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="hidden sm:inline-block text-[11px] font-mono text-zinc-400">
                    @{handle}
                  </span>
                  <button
                    type="button"
                    onClick={handleShare}
                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition active:scale-90"
                    title="Share Creator Link"
                  >
                    <Icon icon="solar:share-linear" width="16" />
                  </button>
                </div>
              </div>

              {/* Roles String */}
              <p className="text-xs sm:text-sm font-medium text-zinc-400 mt-0.5 truncate">
                {rolesList}
              </p>

              {/* Bio Paragraph */}
              <p className="text-xs text-zinc-300 leading-relaxed mt-2 line-clamp-3 sm:line-clamp-4">
                {portfolio.tagline || person.bio || 'Filmmaker, Director & Creative Producer.'}
              </p>
            </div>
          </div>

          {/* Short Link Pill (Frosted Glass as in Image 5) */}
          <div className="mt-4 rounded-full bg-white/[0.06] border border-white/10 px-4 py-2.5 flex items-center justify-between text-xs backdrop-blur-md shadow-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <Icon icon="solar:link-minimalistic-2-bold" className="text-brand shrink-0" width="16" />
              <span className="font-mono text-zinc-200 text-xs sm:text-sm font-semibold truncate">
                muvidb.com/@{handle}
              </span>
            </div>
            <button
              type="button"
              onClick={copyPortfolioLink}
              className="p-1 text-zinc-400 hover:text-white transition active:scale-90 shrink-0 flex items-center gap-1"
              title="Copy creator link"
            >
              <Icon icon="solar:copy-linear" width="16" />
            </button>
          </div>
        </section>

        {/* Showreel Section (Interactive video or Banner Preview) */}
        {portfolio.featured_reel_url && (
          <section>
            {isPlayingReel ? (
              <div className="relative aspect-[16/8] sm:aspect-[16/7] rounded-2xl overflow-hidden border border-white/15 bg-black shadow-xl">
                <iframe
                  src={`${embedUrl}&autoplay=1`}
                  title={`${person.name} Showreel`}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
                <button
                  type="button"
                  onClick={() => setIsPlayingReel(false)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white/80 hover:text-white transition"
                  title="Close player"
                >
                  <Icon icon="solar:close-circle-bold" width="20" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => setIsPlayingReel(true)}
                className="relative rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-r from-[#171513] via-[#1a1715] to-[#121110] shadow-xl group cursor-pointer"
              >
                <div className="flex items-center justify-between min-h-[135px] sm:min-h-[150px]">
                  {/* Left Info & CTA */}
                  <div className="flex-1 p-4 sm:p-5 z-10 min-w-0">
                    <span className="block text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase">
                      SHOWREEL
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5 truncate">
                      {person.name}
                    </h3>
                    <p className="text-xs sm:text-sm font-serif italic text-zinc-400 mb-3 truncate">
                      Director's Reel
                    </p>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-brand hover:brightness-110 text-white font-bold px-3.5 py-1.5 text-xs shadow-md active:scale-95 transition">
                      <Icon icon="solar:play-bold" width="13" />
                      <span>Watch Showreel</span>
                    </div>
                  </div>

                  {/* Right Photo with Gradient Blend */}
                  <div className="relative w-36 sm:w-48 h-[135px] sm:h-[150px] shrink-0 overflow-hidden">
                    <img
                      src={reelThumbnail}
                      alt={`${person.name} Showreel`}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#171513] via-[#171513]/40 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Dynamic Career Impact Section */}
        {activeMetricCards.length > 0 && (
          <section className="space-y-2">
            {/* Header */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-brand rounded-full shrink-0" />
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Career Impact
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setMetricsInfoOpen(!metricsInfoOpen)}
                className="text-zinc-500 hover:text-zinc-300 p-1 transition"
                title="About Career Impact"
              >
                <Icon icon="solar:info-circle-linear" width="16" />
              </button>
            </div>

            {/* Informational Dropdown Tooltip */}
            {metricsInfoOpen && (
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-xs text-zinc-300 leading-relaxed mb-2">
                Documented theatrical box office milestones from cinema exhibitors and verified digital viewership across credited productions.
              </div>
            )}

            {/* Dynamic Grid Layout */}
            {activeMetricCards.length === 1 && (
              /* 1 Metric: Full-Width Single Card */
              <div
                className={`rounded-2xl ${
                  theme.cardBg || 'bg-white/[0.04] border border-white/10'
                } p-5 relative overflow-hidden shadow-lg`}
              >
                <div className="flex items-center gap-2 text-zinc-300 text-xs font-semibold mb-2">
                  <Icon
                    icon={activeMetricCards[0].icon}
                    className={activeMetricCards[0].iconColor}
                    width="16"
                  />
                  <span>{activeMetricCards[0].label}</span>
                </div>

                <div className={`text-3xl sm:text-4xl text-white tracking-tight ${activeMetricCards[0].fontClass || 'font-mono font-extrabold'}`}>
                  {activeMetricCards[0].value}
                </div>

                <p className="text-xs text-zinc-400 mt-1.5">
                  {activeMetricCards[0].desc1}
                </p>

                {/* Flowing wave graphic */}
                <MetricWave color={activeMetricCards[0].waveColor || '#FF5A1F'} />

                {/* Subtle corner glow */}
                <div
                  className={`absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-gradient-to-tl ${activeMetricCards[0].glowWave} to-transparent blur-2xl pointer-events-none opacity-40`}
                />
              </div>
            )}

            {activeMetricCards.length === 2 && (
              /* 2 Metrics: 2-Column Grid */
              <div className="grid grid-cols-2 gap-3">
                {activeMetricCards.map((card) => (
                  <div
                    key={card.id}
                    className={`rounded-2xl ${
                      theme.cardBg || 'bg-white/[0.04] border border-white/10'
                    } p-4 relative overflow-hidden shadow-lg flex flex-col justify-between`}
                  >
                    <div>
                      <div className="flex items-center gap-2 text-zinc-300 text-xs font-semibold mb-2">
                        <Icon icon={card.icon} className={card.iconColor} width="16" />
                        <span className="truncate">{card.label}</span>
                      </div>

                      <div className={`text-2xl sm:text-3xl text-white tracking-tight ${card.fontClass || 'font-mono font-extrabold'}`}>
                        {card.value}
                      </div>
                    </div>

                    <p className="text-[11px] text-zinc-400 mt-2 line-clamp-2">
                      {card.descMulti}
                    </p>

                    {/* Flowing wave graphic */}
                    <MetricWave color={card.waveColor || '#FF5A1F'} />

                    {/* Subtle glow wave in corner */}
                    <div
                      className={`absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-gradient-to-tl ${card.glowWave} to-transparent blur-xl pointer-events-none opacity-40`}
                    />
                  </div>
                ))}
              </div>
            )}

            {activeMetricCards.length === 3 && (
              /* 3 Metrics: 3-Column Compact Grid */
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                {activeMetricCards.map((card) => (
                  <div
                    key={card.id}
                    className={`rounded-2xl ${
                      theme.cardBg || 'bg-white/[0.04] border border-white/10'
                    } p-3 sm:p-3.5 relative overflow-hidden shadow-lg flex flex-col justify-between`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 text-zinc-300 text-[11px] font-semibold mb-1.5">
                        <Icon icon={card.icon} className={`${card.iconColor} shrink-0`} width="14" />
                        <span className="truncate">{card.label}</span>
                      </div>

                      <div className={`text-lg sm:text-2xl text-white tracking-tight ${card.fontClass || 'font-mono font-extrabold'}`}>
                        {card.value}
                      </div>
                    </div>

                    <p className="text-[10px] text-zinc-400 mt-1.5 line-clamp-2 leading-tight">
                      {card.descMulti}
                    </p>

                    {/* Flowing wave graphic */}
                    <MetricWave color={card.waveColor || '#FF5A1F'} />

                    <div
                      className={`absolute -bottom-4 -right-4 w-16 h-16 rounded-full bg-gradient-to-tl ${card.glowWave} to-transparent blur-lg pointer-events-none opacity-40`}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Segmented Navigation Tabs (Matching Image 5) */}
        <nav className="rounded-full bg-[#1c1c1e]/90 border border-white/5 p-1 flex items-center justify-between shadow-inner">
          <button
            type="button"
            onClick={() => setPortfolioViewTab('overview')}
            className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-full transition flex flex-col items-center justify-center relative ${
              portfolioViewTab === 'overview' ? 'text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>Overview</span>
            {portfolioViewTab === 'overview' && (
              <span className="w-10 h-0.5 bg-brand rounded-full mt-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setPortfolioViewTab('credits')}
            className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-full transition flex flex-col items-center justify-center relative ${
              portfolioViewTab === 'credits' ? 'text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>Credits</span>
            {portfolioViewTab === 'credits' && (
              <span className="w-10 h-0.5 bg-brand rounded-full mt-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setPortfolioViewTab('links')}
            className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-full transition flex flex-col items-center justify-center relative ${
              portfolioViewTab === 'links' ? 'text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>Links</span>
            {portfolioViewTab === 'links' && (
              <span className="w-10 h-0.5 bg-brand rounded-full mt-0.5" />
            )}
          </button>
        </nav>

        {/* TAB 1: OVERVIEW */}
        {portfolioViewTab === 'overview' && (
          <div className="space-y-6 pt-1">
            {/* Featured Titles */}
            {topFeaturedTitles.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Featured Titles
                </h3>

                <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                  {topFeaturedTitles.map((film) => (
                    <Link
                      key={film.id}
                      to={`/film/${film.slug}`}
                      className="group relative aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 bg-zinc-900 shadow-lg cursor-pointer block"
                    >
                      <ImageWithFallback
                        src={film.poster_url || film.backdrop_url}
                        alt={film.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                      {/* Overlaid Film Title */}
                      <div className="absolute bottom-2.5 inset-x-2 text-center">
                        <span className="block font-heading text-xs sm:text-sm font-black tracking-wide text-white uppercase drop-shadow-md line-clamp-2 leading-tight">
                          {formatFilmTitle(film.title)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Official Links */}
            <section className="space-y-3">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Official Links
              </h3>

              <div className="space-y-2.5">
                {overviewOfficialLinks.map((link) => {
                  const cardContent = (
                    <div
                      className={`w-full rounded-2xl ${
                        theme.linkCardBg ||
                        'bg-white/[0.04] border border-white/5 hover:border-white/20 hover:bg-white/[0.08]'
                      } p-3 sm:p-3.5 flex items-center justify-between transition group shadow-sm cursor-pointer`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl ${
                            link.badgeBg || 'bg-white/5'
                          } border border-white/10 flex items-center justify-center shrink-0`}
                        >
                          <Icon icon={link.icon} className={link.iconColor} width="18" />
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-white group-hover:text-brand transition truncate">
                          {link.title}
                        </span>
                      </div>

                      <Icon
                        icon="solar:alt-arrow-right-linear"
                        width="16"
                        className="text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition shrink-0 ml-2"
                      />
                    </div>
                  );

                  if (link.isAction) {
                    return (
                      <button
                        key={link.key}
                        type="button"
                        onClick={link.action}
                        className="w-full text-left"
                      >
                        {cardContent}
                      </button>
                    );
                  }

                  if (link.isInternal) {
                    return (
                      <Link key={link.key} to={link.url} className="block w-full">
                        {cardContent}
                      </Link>
                    );
                  }

                  return (
                    <a
                      key={link.key}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full"
                    >
                      {cardContent}
                    </a>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: CREDITS */}
        {portfolioViewTab === 'credits' && (
          <div className="space-y-4 pt-1">
            {/* Department Filter Sub-Tabs */}
            {availableFilmographyTabs.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-white/5 border border-white/10">
                {availableFilmographyTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFilmographyTab(tab.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition ${
                      activeFilmographyTab === tab.id
                        ? 'bg-brand text-black shadow-sm font-bold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            {/* Filmography Credit List */}
            <div
              className={`rounded-2xl ${
                theme.cardBg || 'border border-white/10 bg-zinc-950/60'
              } divide-y divide-white/5 overflow-hidden`}
            >
              {activeFilmographyTab === 'stage' ? (
                stageCredits.length > 0 ? (
                  stageCredits.map((stg, idx) => {
                    const play = stg.plays || stg.play || {};
                    return (
                      <Link
                        key={stg.id || idx}
                        to={play.slug ? `/play/${play.slug}` : `/plays`}
                        className="p-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.03] transition group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-14 rounded-lg overflow-hidden bg-purple-950/40 border border-purple-500/30 shrink-0 flex items-center justify-center text-purple-300">
                            {play.poster_url ? (
                              <ImageWithFallback
                                src={play.poster_url}
                                alt={play.title}
                                className="w-full h-full object-cover"
                              />
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

                        <div className="flex items-center gap-2 shrink-0">
                          {play.year && <span className="text-xs font-mono text-zinc-500">{play.year}</span>}
                          <Icon
                            icon="solar:alt-arrow-right-linear"
                            className="text-zinc-600 group-hover:text-white transition"
                            width="16"
                          />
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
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.03] transition group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
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
                        <p className="text-xs text-zinc-400 truncate">
                          {film.roles.join(', ')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
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
                      {film.year && <span className="text-xs font-mono text-zinc-500">{film.year}</span>}
                      <Icon
                        icon="solar:alt-arrow-right-linear"
                        className="text-zinc-600 group-hover:text-white transition"
                        width="16"
                      />
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-zinc-500 font-mono">
                  No credits found under {activeFilmographyTab}.
                </div>
              )}

              {/* Show All Toggle */}
              {activeFilmographyTab !== 'stage' && filteredFilms.length > 5 && (
                <div className="p-3 bg-zinc-950/80 text-center border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setShowAllFilmography(!showAllFilmography)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-zinc-300 hover:text-white hover:bg-white/5 border border-white/10 transition"
                  >
                    <span>
                      {showAllFilmography ? 'Show Top 5 Only' : `View All ${filteredFilms.length} Credits`}
                    </span>
                    <Icon
                      icon={showAllFilmography ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
                      width="14"
                    />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: LINKS */}
        {portfolioViewTab === 'links' && (
          <div className="space-y-4 pt-1">
            {/* Direct Professional Inquiry & Actions */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setContactModalOpen(true)}
                className="rounded-2xl bg-brand text-black font-black p-3.5 text-xs uppercase tracking-wider hover:brightness-110 transition flex items-center justify-center gap-2 shadow-lg shadow-brand/20 active:scale-95"
              >
                <Icon icon="solar:letter-bold" width="16" />
                <span>Work Inquiry</span>
              </button>

              <button
                type="button"
                onClick={() => setPassportModalOpen(true)}
                className="rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 p-3.5 text-xs font-bold text-white transition flex items-center justify-center gap-2 hover:border-brand/40 shadow-sm active:scale-95"
              >
                <Icon icon="solar:document-text-bold" width="16" className="text-brand" />
                <span>Export PDF CV</span>
              </button>
            </div>

            {portfolio.epk_pdf_url && (
              <a
                href={portfolio.epk_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 p-3.5 text-xs font-bold text-white transition flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <Icon icon="solar:download-minimalistic-linear" width="16" className="text-brand" />
                  <span>Download Electronic Press Kit (EPK)</span>
                </div>
                <Icon icon="solar:arrow-right-up-linear" width="14" className="text-zinc-400" />
              </a>
            )}

            {/* Custom Links List */}
            {bioLinks.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 block">
                  Featured Links
                </span>
                {bioLinks.map((link) => (
                  <a
                    key={link.key}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full rounded-2xl ${
                      theme.linkCardBg ||
                      'bg-white/[0.04] border border-white/5 hover:border-white/20'
                    } p-3.5 flex items-center justify-between group transition shadow-sm`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                        <Icon icon={link.art.icon || 'solar:link-bold'} className="text-brand" width="16" />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs sm:text-sm font-semibold text-white group-hover:text-brand transition truncate">
                          {link.title}
                        </span>
                        <span className="block text-[10px] text-zinc-500 truncate">{link.subtitle}</span>
                      </div>
                    </div>
                    <Icon
                      icon="solar:arrow-right-up-linear"
                      width="16"
                      className="text-zinc-500 group-hover:text-white transition shrink-0 ml-2"
                    />
                  </a>
                ))}
              </div>
            )}

            {/* Social Links List */}
            {socialLinks.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 block">
                  Official Channels
                </span>
                {socialLinks.map(({ platform, url }) => (
                  <a
                    key={platform.key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full rounded-2xl ${
                      theme.linkCardBg ||
                      'bg-white/[0.04] border border-white/5 hover:border-white/20'
                    } p-3.5 flex items-center justify-between group transition shadow-sm`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                        <Icon icon={platform.icon} className="text-white" width="16" />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs sm:text-sm font-semibold text-white group-hover:text-brand transition truncate">
                          {platform.label}
                        </span>
                        <span className="block text-[10px] text-zinc-500 truncate">
                          {handleFromUrl(url) || prettyUrl(url)}
                        </span>
                      </div>
                    </div>
                    <Icon
                      icon="solar:arrow-right-up-linear"
                      width="16"
                      className="text-zinc-500 group-hover:text-white transition shrink-0 ml-2"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Minimal Linktree-Style Footer */}
        <footer className="pt-10 pb-12 text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <Link
              to="/claim"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-bold text-brand transition shadow-sm"
            >
              <Icon icon="solar:shield-check-bold" width="14" />
              <span>Claim Your Creator Link</span>
            </Link>
          </div>

          <p className="text-[11px] text-zinc-500 font-mono tracking-wider">
            Powered by{' '}
            <Link to="/" className="text-zinc-300 hover:text-white font-bold underline underline-offset-2">
              MuviDB
            </Link>{' '}
            — The living record of African film & theatre.
          </p>
        </footer>
      </main>

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
                  className="rounded-full bg-brand text-black px-6 py-2.5 text-xs font-black uppercase tracking-wider hover:brightness-110 transition flex items-center gap-2"
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
          credits={allFilms.map((f) => ({
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

      {/* "How It Works" Informational Modal */}
      {howItWorksModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          data-lenis-prevent="true"
          style={{ overscrollBehavior: 'contain' }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overscroll-contain"
          onClick={(e) => {
            if (e.target === e.currentTarget) setHowItWorksModalOpen(false);
          }}
        >
          <div
            data-lenis-prevent="true"
            style={{ overscrollBehavior: 'contain' }}
            className="w-full max-w-md rounded-3xl border border-white/15 bg-zinc-950 p-6 sm:p-7 shadow-2xl relative overscroll-contain text-left"
          >
            <button
              onClick={() => setHowItWorksModalOpen(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white p-1"
            >
              <Icon icon="solar:close-circle-bold" width="22" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-brand">
                MuviDB Creator Link
              </span>
            </div>

            <h3 className="text-xl font-bold text-white tracking-tight">
              How Creator Links Work
            </h3>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              The verified bio link designed specifically for African filmmakers, actors, directors, and cinema practitioners.
            </p>

            <div className="mt-5 space-y-3.5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0 border border-brand/20">
                  <Icon icon="solar:verified-check-bold" width="16" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Audited Filmography & Credits</h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Your credits are backed by the official MuviDB database, preventing impersonation and uncredited omissions.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                  <Icon icon="solar:ticket-bold" width="16" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Documented Commercial Impact</h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Showcase certified cinema box office totals and audited YouTube viewership to studios, investors, and casting directors.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/20">
                  <Icon icon="solar:letter-bold" width="16" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Direct Bookings & Inquiries</h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Producers and brands contact you directly with project type and budget range, eliminating commission friction.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
              <Link
                to="/claim"
                onClick={() => setHowItWorksModalOpen(false)}
                className="w-full rounded-full bg-brand text-black text-center py-2.5 text-xs font-bold hover:brightness-110 transition shadow-lg shadow-brand/20"
              >
                Claim Your Creator Link
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
