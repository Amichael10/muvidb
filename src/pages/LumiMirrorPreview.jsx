import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
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
import { downloadVCard } from '../lib/vcard';
import {
  SOCIAL_PLATFORMS,
  GENERIC_LINK,
  detectPlatform,
  platformFor,
  resolveSocialUrl,
  prettyUrl,
  handleFromUrl,
} from '../lib/socialPlatforms';
import CareerPassportModal from '../components/professional/CareerPassportModal';
import LumiLiveLine from '../components/mirror/LumiLiveLine';
import LumiMirrorBackPass from '../components/mirror/LumiMirrorBackPass';
import { MIRROR_FINISHES, LIVE_STATUS_PRESETS } from '../components/mirror/mirrorThemes';

/**
 * Metric wave graphic for Career Impact cards
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

/**
 * Lumi Mirror (True Mirra-Grade Elevation of FilmmakerPortfolio)
 * Combines all of Lumi's rich Nollywood filmography, box office figures,
 * showreels, and stage credits with Mirra's optical bevelled glass,
 * live pulsing status beacon, 3D flip-to-pass, and 1-tap contact saving.
 */
export default function LumiMirrorPreview() {
  const params = useParams();
  const rawHandle = params.handle || 'end-to-end-test';
  const handle = rawHandle.replace(/^@+/, '').replace(/\/+$/, '');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Optical Finish / Mirror Style
  const [activeFinishKey, setActiveFinishKey] = useState('obsidian');
  const finish = MIRROR_FINISHES[activeFinishKey] || MIRROR_FINISHES.obsidian;

  // 3D Flip Card state
  const [isFlipped, setIsFlipped] = useState(false);

  // Live Line state
  const [liveStatusKey, setLiveStatusKey] = useState('on_set');
  const [liveStatusText, setLiveStatusText] = useState('On Set in Lagos • Principal Photography');

  // Media & Interaction states
  const [isPlayingReel, setIsPlayingReel] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'filmography'
  const [activeFilmographyTab, setActiveFilmographyTab] = useState('all');
  const [showAllFilmography, setShowAllFilmography] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [passportModalOpen, setPassportModalOpen] = useState(false);
  const [metricsInfoOpen, setMetricsInfoOpen] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({
    name: '',
    email: '',
    projectType: 'Directing',
    budget: '',
    message: '',
  });

  // Fetch real portfolio data from database
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchPortfolioByHandle(handle)
      .then((res) => {
        if (!isMounted) return;
        if (!res) {
          setError(`No creator found for @${handle}`);
        } else {
          setData(res);
          document.title = `${res.person.name} | Lumi Mirror`;
          if (res.person.availability_note) {
            setLiveStatusText(res.person.availability_note);
          }
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

  // Derived attributes
  const person = data?.person || {};
  const portfolio = data?.portfolio || {};
  const allFilms = data?.films || [];
  const featuredFilms = data?.featuredFilms || [];
  const stageCredits = data?.stageCredits || [];

  const computedMetrics = useMemo(() => {
    if (!data) return null;
    return computePortfolioMetrics(allFilms, stageCredits);
  }, [data, allFilms, stageCredits]);

  // Construct stylized roles string e.g. "Actor • Producer • Director • Theatre"
  const rolesList = useMemo(() => {
    if (!person.name) return 'Filmmaker';
    const roleSet = new Set();
    if (Array.isArray(person.roles) && person.roles.length > 0) {
      person.roles.forEach((r) => r && roleSet.add(toTitleCase(String(r).trim())));
    }
    allFilms.forEach((f) => {
      (f.roles || []).forEach((r) => {
        const lower = String(r).toLowerCase();
        if (lower.includes('direct')) roleSet.add('Director');
        else if (lower.includes('produc')) roleSet.add('Producer');
        else if (lower.includes('act') || lower.includes('cast')) roleSet.add('Actor');
        else if (lower.includes('writ') || lower.includes('screen')) roleSet.add('Writer');
        else if (lower.includes('cinemat') || lower.includes('dp')) roleSet.add('Cinematographer');
      });
    });
    if (stageCredits.length > 0) roleSet.add('Theatre');

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
    return 'Filmmaker & Producer';
  }, [person, allFilms, stageCredits]);

  // Social & Custom Bio Links
  const socialLinks = useMemo(() => {
    return SOCIAL_PLATFORMS.map((platform) => {
      const stored = person.socials?.[platform.key] ?? (platform.key === 'x' ? person.socials?.twitter : undefined);
      const url = resolveSocialUrl(platform.key, stored);
      return url ? { platform, url } : null;
    }).filter(Boolean);
  }, [person]);

  const bioLinks = useMemo(() => {
    return (portfolio.custom_links || [])
      .filter((link) => link && !link._meta && typeof link.url === 'string' && link.url.trim())
      .map((link) => {
        const platform = platformFor(link.platform) || platformFor(link.title) || detectPlatform(link.url) || null;
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
  }, [portfolio]);

  const copyPortfolioLink = () => {
    const url = `${window.location.origin}/@${handle}`;
    navigator.clipboard.writeText(url);
    toast.success('Creator Link copied to clipboard!', {
      icon: '🔗',
      style: { background: '#141416', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' },
    });
  };

  const handleSaveContact = () => {
    const success = downloadVCard({
      name: person.name,
      roles: rolesList,
      email: portfolio.inquiry_email || person.booking_email || 'contact@muvidb.com',
      whatsapp: person.booking_whatsapp || person.booking_phone,
      website: `${window.location.origin}/@${handle}`,
      bio: portfolio.tagline || person.bio,
      avatarUrl: person.photo_url,
      instagramUrl: person.instagram_url,
      twitterUrl: person.twitter_url,
      youtubeUrl: person.youtube_handle ? `https://youtube.com/@${person.youtube_handle}` : undefined,
    });

    if (success) {
      toast.success(`Contact card for ${person.name} downloaded!`, {
        icon: '📇',
        style: { background: '#141416', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' },
      });
    }
  };

  const handleSendInquiry = (e) => {
    e.preventDefault();
    if (!inquiryForm.name || !inquiryForm.email || !inquiryForm.message) {
      toast.error('Please fill in all required fields.');
      return;
    }
    const recipient = portfolio.inquiry_email || person.booking_email;
    if (recipient) {
      const subject = encodeURIComponent(`Project Inquiry: ${inquiryForm.projectType} from ${inquiryForm.name}`);
      const body = encodeURIComponent(
        `Name: ${inquiryForm.name}\nEmail: ${inquiryForm.email}\nProject Type: ${inquiryForm.projectType}\nBudget Range: ${inquiryForm.budget}\n\nMessage:\n${inquiryForm.message}`
      );
      window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
    }
    setContactModalOpen(false);
    toast.success('Inquiry client opened!');
  };

  const embedUrl = formatVideoEmbed(portfolio.featured_reel_url);
  const ytVideoId = getYouTubeVideoId(portfolio.featured_reel_url);
  const reelThumbnail = ytVideoId
    ? `https://img.youtube.com/vi/${ytVideoId}/hqdefault.jpg`
    : allFilms[0]?.backdrop_url || allFilms[0]?.poster_url || person.photo_url;

  // Filter filmography credits
  const filteredFilms = useMemo(() => {
    return allFilms.filter((film) => {
      if (activeFilmographyTab === 'all') return true;
      const lowerRoles = (film.roles || []).map((r) => String(r).toLowerCase());
      if (activeFilmographyTab === 'directing') return lowerRoles.some((r) => r.includes('direct'));
      if (activeFilmographyTab === 'producing') return lowerRoles.some((r) => r.includes('produc'));
      if (activeFilmographyTab === 'writing') return lowerRoles.some((r) => r.includes('writ') || r.includes('screen'));
      if (activeFilmographyTab === 'acting') return lowerRoles.some((r) => r.includes('act') || r.includes('cast'));
      return true;
    });
  }, [allFilms, activeFilmographyTab]);

  const displayedFilms = showAllFilmography ? filteredFilms : filteredFilms.slice(0, 6);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07080A] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-brand animate-spin" />
          <p className="font-mono text-xs text-zinc-400">Loading Lumi Mirror...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07080A] text-white p-4">
        <div className="max-w-md w-full p-8 rounded-3xl bg-zinc-900/80 border border-white/10 text-center space-y-4">
          <Icon icon="solar:danger-circle-bold" className="text-red-500 text-4xl mx-auto" />
          <h2 className="text-xl font-bold">Creator Link Not Found</h2>
          <p className="text-sm text-zinc-400">{error || `Could not find @${handle}`}</p>
          <div className="pt-2 flex justify-center gap-2">
            <Link to="/mirror-preview/end-to-end-test" className="px-4 py-2 rounded-xl bg-brand text-white font-bold text-xs">
              Load End-to-End Test Profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${finish.bg} text-white selection:bg-brand selection:text-black font-sans relative overflow-x-hidden pb-24`}
    >
      {/* Ambient Radial Spotlight Backlight Halo */}
      <div
        className={`fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[550px] rounded-full bg-gradient-to-b ${finish.ambientGlow} blur-[140px] opacity-45 pointer-events-none z-0`}
      />

      {/* Top Floating Optical Glass Sandbox Switcher Bar */}
      <header className="sticky top-3 z-40 max-w-md sm:max-w-xl mx-auto px-4 mb-4 select-none">
        <div className="rounded-2xl bg-black/70 backdrop-blur-2xl border border-white/15 px-4 py-2.5 flex items-center justify-between gap-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_12px_30px_rgba(0,0,0,0.8)]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-brand animate-pulse shrink-0" />
            <span className="text-xs font-mono font-bold tracking-wider uppercase text-white truncate">
              LUMI MIRROR
            </span>
            <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-zinc-400">
              Optical Glass Sandbox
            </span>
          </div>

          {/* Finish Switcher */}
          <div className="flex items-center gap-1.5 shrink-0">
            {Object.values(MIRROR_FINISHES).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setActiveFinishKey(f.id);
                  toast(`Optical Finish: ${f.name}`, { icon: '🪞' });
                }}
                className={`w-6 h-6 rounded-full border transition-transform ${
                  activeFinishKey === f.id
                    ? 'scale-110 border-white shadow-md'
                    : 'border-white/20 opacity-70 hover:opacity-100'
                }`}
                style={{ backgroundColor: f.dotColor }}
                title={f.name}
              />
            ))}
          </div>
        </div>
      </header>

      {/* Main Responsive Glass Column: Mobile-first viewport (max-w-md sm:max-w-xl) */}
      <main className="relative z-10 max-w-md sm:max-w-xl mx-auto px-4 space-y-4">
        {/* Brand Bar: Logo + Original Link */}
        <div className="flex items-center justify-between py-1 px-1">
          <Link to="/" className="flex items-center group select-none">
            <img
              src="/images/MuviDB Brand/White Wordmark.svg"
              alt="Lumi"
              className="h-6 sm:h-7 object-contain opacity-90 group-hover:opacity-100 transition"
            />
          </Link>

          <Link
            to={`/@${handle}`}
            className="text-xs font-mono text-zinc-400 hover:text-white flex items-center gap-1.5 py-1 px-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition"
            title="View original creator link"
          >
            <span>Original Link</span>
            <Icon icon="solar:arrow-right-up-linear" width="12" />
          </Link>
        </div>

        {/* ===================== SECTION 1: THE MIRROR IDENTITY CARD (WITH 3D FLIP) ===================== */}
        <div className="perspective-1000 w-full select-none">
          <div
            className={`relative w-full transition-transform duration-700 preserve-3d ${
              isFlipped ? 'rotate-y-180' : ''
            }`}
          >
            {/* FRONT OF THE GLASS MIRROR */}
            <div className="w-full backface-hidden">
              <section
                className={`relative rounded-3xl ${finish.cardSurface} ${finish.specularEdge} p-5 sm:p-6 overflow-hidden`}
              >
                {/* Ambient Internal Glow */}
                <div
                  className={`absolute -top-24 -right-24 w-60 h-60 rounded-full bg-gradient-to-b ${finish.ambientGlow} blur-3xl opacity-50 pointer-events-none`}
                />

                {/* Top Row: Avatar on Left + Identity Info on Right */}
                <div className="relative flex items-start gap-4 z-10">
                  {/* Square Rounded Headshot with Refractive Bevel */}
                  <div
                    onClick={() => setIsFlipped(true)}
                    className="relative shrink-0 cursor-pointer group"
                    title="Tap to Flip 3D Event Pass"
                  >
                    <div
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-white/25 shadow-2xl bg-zinc-900 group-hover:scale-[1.03] transition-transform duration-500 relative"
                      style={{
                        boxShadow: `0 8px 30px -4px ${finish.ringColor || 'rgba(255,255,255,0.2)'}`,
                      }}
                    >
                      <ImageWithFallback
                        src={person.photo_url}
                        alt={person.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {/* Flip Hint */}
                      <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-mono font-bold tracking-wider uppercase">
                        Flip Pass
                      </div>
                    </div>

                    {person.is_verified && (
                      <div
                        className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center shadow-md border-2 border-black"
                        title="Verified Nollywood Creator"
                      >
                        <Icon icon="solar:verified-check-bold" width="13" />
                      </div>
                    )}
                  </div>

                  {/* Name, Roles, Bio & Quick Controls */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
                        {person.name}
                      </h1>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setIsFlipped(true)}
                          className="p-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white transition active:scale-90"
                          title="Flip 3D Event Pass"
                        >
                          <Icon icon="solar:qr-code-bold" width="16" />
                        </button>
                        <button
                          type="button"
                          onClick={copyPortfolioLink}
                          className="p-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white transition active:scale-90"
                          title="Share Creator Link"
                        >
                          <Icon icon="solar:share-linear" width="16" />
                        </button>
                      </div>
                    </div>

                    {/* Roles String */}
                    <p className="text-xs sm:text-sm font-semibold text-zinc-300 mt-0.5 truncate tracking-wide">
                      {rolesList}
                    </p>

                    {/* Bio Paragraph */}
                    <p className="text-xs text-zinc-300 leading-relaxed mt-2 line-clamp-3 sm:line-clamp-4">
                      {portfolio.tagline || person.bio || 'Filmmaker, Director & Creative Producer.'}
                    </p>
                  </div>
                </div>

                {/* The "Live Line": Real-Time Status Beacon */}
                <div className="mt-4 relative z-10">
                  <LumiLiveLine
                    statusText={liveStatusText}
                    category={liveStatusKey}
                    updatedAt="Active now"
                    onClick={() => {
                      const presets = LIVE_STATUS_PRESETS;
                      const nextIdx = (presets.findIndex((p) => p.key === liveStatusKey) + 1) % presets.length;
                      setLiveStatusKey(presets[nextIdx].key);
                      setLiveStatusText(presets[nextIdx].defaultText);
                      toast(`Live Line switched to ${presets[nextIdx].label}`, { icon: '🟢' });
                    }}
                  />
                </div>

                {/* Short Link Frosted Pill */}
                <div className="mt-3 rounded-full bg-white/[0.06] border border-white/15 px-3.5 py-2 flex items-center justify-between text-xs backdrop-blur-md shadow-sm relative z-10">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon icon="solar:link-minimalistic-2-bold" className="text-brand shrink-0" width="15" />
                    <span className="font-mono text-zinc-200 text-xs font-semibold truncate">
                      muvidb.com/@{handle}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={copyPortfolioLink}
                    className="p-1 text-zinc-400 hover:text-white transition active:scale-90 shrink-0"
                    title="Copy Link"
                  >
                    <Icon icon="solar:copy-linear" width="14" />
                  </button>
                </div>

                {/* Mirror Action Controls: Save Contact + Flip Pass + Inquiry */}
                <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-3 gap-2 relative z-10">
                  <button
                    type="button"
                    onClick={handleSaveContact}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs tracking-wide transition shadow-md active:scale-95 ${finish.accentBg} truncate`}
                  >
                    <Icon icon="solar:user-plus-bold" width="14" className="shrink-0" />
                    <span className="truncate">Save Contact</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsFlipped(true)}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-white transition shadow-sm active:scale-95 truncate"
                  >
                    <Icon icon="solar:restart-bold" width="13" className="shrink-0" />
                    <span className="truncate">Flip QR Pass</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setContactModalOpen(true)}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-white transition shadow-sm active:scale-95 truncate"
                  >
                    <Icon icon="solar:letter-bold" width="14" className="shrink-0" />
                    <span className="truncate">Booking</span>
                  </button>
                </div>
              </section>
            </div>

            {/* BACK OF THE GLASS MIRROR (3D HOLOGRAPHIC EVENT PASS) */}
            <div className="absolute inset-0 w-full h-full rotate-y-180 backface-hidden">
              <LumiMirrorBackPass
                person={person}
                handle={handle}
                roles={rolesList}
                finish={finish}
                onFlipBack={() => setIsFlipped(false)}
              />
            </div>
          </div>
        </div>

        {/* ===================== SECTION 2: SHOWREEL ===================== */}
        {portfolio.featured_reel_url && (
          <section className={`rounded-3xl ${finish.cardSurface} ${finish.specularEdge} p-4 sm:p-5 overflow-hidden`}>
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <Icon icon="solar:videocamera-record-bold" className="text-brand text-sm" />
                <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-zinc-300">
                  Featured Showreel
                </span>
              </div>
              {isPlayingReel && (
                <button
                  type="button"
                  onClick={() => setIsPlayingReel(false)}
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                >
                  <Icon icon="solar:close-circle-linear" width="14" />
                  <span>Close</span>
                </button>
              )}
            </div>

            {isPlayingReel ? (
              <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/15 bg-black shadow-inner">
                <iframe
                  src={`${embedUrl}&autoplay=1`}
                  title={`${person.name} Showreel`}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div
                onClick={() => setIsPlayingReel(true)}
                className="relative rounded-2xl overflow-hidden border border-white/10 bg-zinc-950 group cursor-pointer shadow-lg"
              >
                <div className="flex items-center justify-between min-h-[130px] sm:min-h-[145px]">
                  <div className="flex-1 p-4 sm:p-5 z-10 min-w-0">
                    <span className="block text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase">
                      SHOWREEL
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5 truncate">
                      {person.name}
                    </h3>
                    <p className="text-xs text-zinc-400 mb-3 truncate">Director's Reel</p>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-brand hover:brightness-110 text-white font-bold px-3.5 py-1.5 text-xs shadow-md active:scale-95 transition">
                      <Icon icon="solar:play-bold" width="12" />
                      <span>Watch Showreel</span>
                    </div>
                  </div>

                  <div className="relative w-36 sm:w-48 h-[130px] sm:h-[145px] shrink-0 overflow-hidden">
                    <img
                      src={reelThumbnail}
                      alt={`${person.name} Showreel`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent" />
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ===================== SECTION 3: CAREER IMPACT METRICS ===================== */}
        {computedMetrics && computedMetrics.hasCommercialFootprint && (
          <section className="space-y-2">
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

            {metricsInfoOpen && (
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-xs text-zinc-300 leading-relaxed mb-2">
                Documented theatrical box office milestones from cinema exhibitors and verified digital viewership across credited productions.
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {computedMetrics.formattedBoxOffice && (
                <div
                  className={`relative rounded-2xl ${finish.cardSurface} ${finish.specularEdge} p-4 overflow-hidden flex flex-col justify-between`}
                >
                  <MetricWave color="#F59E0B" />
                  <div className="flex items-center gap-1.5 text-zinc-400 mb-2 relative z-10">
                    <Icon icon="solar:clapperboard-play-bold" className="text-amber-400 text-sm" />
                    <span className="text-[10px] font-mono uppercase tracking-wider font-bold">
                      Cinema Gross
                    </span>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-white tracking-tight font-serif relative z-10">
                    {computedMetrics.formattedBoxOffice}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-1 relative z-10">Credited Box Office</p>
                </div>
              )}

              {computedMetrics.formattedViews && (
                <div
                  className={`relative rounded-2xl ${finish.cardSurface} ${finish.specularEdge} p-4 overflow-hidden flex flex-col justify-between`}
                >
                  <MetricWave color="#FF3B30" />
                  <div className="flex items-center gap-1.5 text-zinc-400 mb-2 relative z-10">
                    <Icon icon="simple-icons:youtube" className="text-red-500 text-sm" />
                    <span className="text-[10px] font-mono uppercase tracking-wider font-bold">
                      YouTube Views
                    </span>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-white tracking-tight font-mono relative z-10">
                    {computedMetrics.formattedViews}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-1 relative z-10">Audience Reach</p>
                </div>
              )}

              {computedMetrics.formattedStageBoxOffice && (
                <div
                  className={`relative rounded-2xl ${finish.cardSurface} ${finish.specularEdge} p-4 overflow-hidden flex flex-col justify-between col-span-2 sm:col-span-1`}
                >
                  <MetricWave color="#FB923C" />
                  <div className="flex items-center gap-1.5 text-zinc-400 mb-2 relative z-10">
                    <Icon icon="solar:masks-bold" className="text-orange-400 text-sm" />
                    <span className="text-[10px] font-mono uppercase tracking-wider font-bold">
                      Stage Gross
                    </span>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-white tracking-tight font-serif relative z-10">
                    {computedMetrics.formattedStageBoxOffice}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-1 relative z-10">Theatre Admissions</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ===================== SECTION 4: TABS (OVERVIEW VS FILMOGRAPHY) ===================== */}
        <div className="flex items-center gap-2 p-1 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition ${
              activeTab === 'overview'
                ? 'bg-white text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('filmography')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition ${
              activeTab === 'filmography'
                ? 'bg-white text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Filmography ({allFilms.length})
          </button>
        </div>

        {/* ===================== TAB CONTENT: OVERVIEW ===================== */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Top 3 Featured Cinema Titles */}
            {allFilms.length > 0 && (
              <section className={`rounded-3xl ${finish.cardSurface} ${finish.specularEdge} p-4 sm:p-5`}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:clapperboard-bold" className="text-brand text-sm" />
                    <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-zinc-300">
                      Signature Works
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('filmography')}
                    className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition"
                  >
                    <span>View All ({allFilms.length})</span>
                    <Icon icon="solar:arrow-right-linear" width="12" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                  {allFilms.slice(0, 3).map((film) => (
                    <Link
                      key={film.id}
                      to={`/films/${film.slug || film.id}`}
                      className="group relative rounded-2xl overflow-hidden border border-white/10 bg-zinc-900 aspect-[2/3] shadow-md hover:border-white/30 transition-all hover:scale-[1.02]"
                    >
                      <img
                        src={film.poster_url || '/placeholder-poster.png'}
                        alt={film.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent flex flex-col justify-end p-2 sm:p-2.5">
                        <span className="text-[10px] font-mono text-zinc-400">{film.year}</span>
                        <p className="text-xs font-bold text-white truncate drop-shadow-sm leading-tight">
                          {film.title}
                        </p>
                        <p className="text-[10px] text-brand truncate font-medium mt-0.5">
                          {film.roles?.[0] || 'Contributor'}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Stage & Theatre Productions */}
            {stageCredits.length > 0 && (
              <section className={`rounded-3xl ${finish.cardSurface} ${finish.specularEdge} p-4 sm:p-5`}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:masks-bold" className="text-orange-400 text-sm" />
                    <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-zinc-300">
                      Stage & Theatre ({stageCredits.length})
                    </span>
                  </div>
                  <Link to="/plays" className="text-xs text-zinc-400 hover:text-white flex items-center gap-1">
                    <span>Explore Stage</span>
                    <Icon icon="solar:arrow-right-linear" width="12" />
                  </Link>
                </div>

                <div className="space-y-2">
                  {stageCredits.slice(0, 2).map((credit, idx) => (
                    <Link
                      key={idx}
                      to={`/plays/${credit.play?.slug || credit.play_id}`}
                      className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition group"
                    >
                      <div className="w-10 h-14 rounded-xl overflow-hidden bg-zinc-900 shrink-0 border border-white/10">
                        <img
                          src={credit.play?.poster_url || '/placeholder-poster.png'}
                          alt={credit.play?.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-brand transition">
                          {credit.play?.title}
                        </h4>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                          {credit.role || 'Performer'} • {credit.character_name || credit.play?.venue_name || 'Stage'}
                        </p>
                      </div>
                      <Icon icon="solar:arrow-right-linear" className="text-zinc-500 group-hover:text-white transition" width="14" />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Official Links & Socials */}
            <section className={`rounded-3xl ${finish.cardSurface} ${finish.specularEdge} p-4 sm:p-5 space-y-2.5`}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <Icon icon="solar:link-circle-bold" className="text-brand text-sm" />
                <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-zinc-300">
                  Official Links & Verification
                </span>
              </div>

              {/* Verified Social Networks */}
              <div className="grid grid-cols-2 gap-2">
                {socialLinks.map(({ platform, url }) => (
                  <a
                    key={platform.key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 transition active:scale-95 group"
                  >
                    <Icon icon={platform.icon} className="text-base text-zinc-300 group-hover:text-white" />
                    <span className="text-xs font-semibold text-white truncate">{platform.label}</span>
                  </a>
                ))}
              </div>

              {/* Custom Bio Links */}
              {bioLinks.map((b) => (
                <a
                  key={b.key}
                  href={b.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 transition active:scale-95 group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon icon={b.art?.icon || 'solar:link-bold'} className="text-brand text-base shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{b.title}</p>
                      <p className="text-[10px] text-zinc-400 font-mono truncate">{b.subtitle}</p>
                    </div>
                  </div>
                  <Icon icon="solar:arrow-right-up-linear" className="text-zinc-500 group-hover:text-white shrink-0" width="14" />
                </a>
              ))}

              {/* Passport / CV Export Trigger */}
              <button
                type="button"
                onClick={() => setPassportModalOpen(true)}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 transition active:scale-95 text-left group"
              >
                <div className="flex items-center gap-2.5">
                  <Icon icon="solar:document-text-bold" className="text-amber-400 text-base shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-amber-300">Official Career Passport & CV</p>
                    <p className="text-[10px] text-amber-400/80 font-mono">Download verified PDF portfolio</p>
                  </div>
                </div>
                <Icon icon="solar:download-minimalistic-linear" className="text-amber-400 group-hover:scale-110 transition" width="16" />
              </button>
            </section>
          </div>
        )}

        {/* ===================== TAB CONTENT: FILMOGRAPHY ===================== */}
        {activeTab === 'filmography' && (
          <div className="space-y-4">
            {/* Role Filter Pills */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {['all', 'directing', 'producing', 'writing', 'acting'].map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setActiveFilmographyTab(role)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize whitespace-nowrap transition ${
                    activeFilmographyTab === role
                      ? 'bg-white text-black shadow-md'
                      : 'bg-white/5 border border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>

            {/* Filmography Cards */}
            <div className="space-y-2.5">
              {displayedFilms.map((film) => (
                <Link
                  key={film.id}
                  to={`/films/${film.slug || film.id}`}
                  className={`flex gap-3 p-3 rounded-2xl ${finish.cardSurface} ${finish.specularEdge} hover:border-white/35 transition group`}
                >
                  <div className="w-16 h-24 rounded-xl overflow-hidden bg-zinc-900 shrink-0 border border-white/15">
                    <img
                      src={film.poster_url || '/placeholder-poster.png'}
                      alt={film.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-white truncate group-hover:text-brand transition">
                          {film.title}
                        </h4>
                        <span className="text-xs font-mono text-zinc-400 shrink-0">{film.year}</span>
                      </div>
                      <p className="text-xs text-brand font-medium truncate mt-0.5">
                        {(film.roles || []).join(' • ')}
                      </p>
                      {film.synopsis && (
                        <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1 leading-snug">
                          {film.synopsis}
                        </p>
                      )}
                    </div>

                    {film.box_office_domestic != null && (
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-amber-400 mt-1">
                        <Icon icon="solar:clapperboard-play-bold" width="12" />
                        <span>{formatCurrencyShort(film.box_office_domestic, film.box_office_currency)} Domestic Gross</span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {filteredFilms.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAllFilmography(!showAllFilmography)}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white transition"
              >
                {showAllFilmography ? 'Show Less' : `Show All ${filteredFilms.length} Credits`}
              </button>
            )}
          </div>
        )}

        {/* Footer Brand Seal */}
        <footer className="pt-8 text-center text-zinc-500 text-xs">
          <p className="flex items-center justify-center gap-1.5 font-mono text-[11px]">
            <span>Powered by</span>
            <span className="font-bold text-white tracking-wider">LUMI</span>
            <span>• Cinema & Theatre Identity</span>
          </p>
        </footer>
      </main>

      {/* Project Inquiry Modal */}
      {contactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-3xl bg-zinc-950 border border-white/20 p-6 shadow-2xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Icon icon="solar:letter-bold" className="text-brand" />
                <span>Book / Inquire for {person.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setContactModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <Icon icon="solar:close-circle-bold" width="20" />
              </button>
            </div>

            <form onSubmit={handleSendInquiry} className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">Your Name</label>
                <input
                  type="text"
                  required
                  value={inquiryForm.name}
                  onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                  placeholder="e.g. Chioma Okafor"
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-white text-xs focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">Your Email</label>
                <input
                  type="email"
                  required
                  value={inquiryForm.email}
                  onChange={(e) => setInquiryForm({ ...inquiryForm, email: e.target.value })}
                  placeholder="chioma@production.com"
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-white text-xs focus:outline-none focus:border-brand"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">Role / Project Type</label>
                  <select
                    value={inquiryForm.projectType}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, projectType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs focus:outline-none focus:border-brand"
                  >
                    <option value="Directing">Directing</option>
                    <option value="Acting">Acting / Cast</option>
                    <option value="Producing">Producing</option>
                    <option value="Writing">Screenplay</option>
                    <option value="Stage">Stage / Theatre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">Budget Range</label>
                  <input
                    type="text"
                    value={inquiryForm.budget}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, budget: e.target.value })}
                    placeholder="e.g. ₦15M - ₦50M"
                    className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-white text-xs focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">Message</label>
                <textarea
                  rows={3}
                  required
                  value={inquiryForm.message}
                  onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })}
                  placeholder="Describe your production scope, timeline, and dates..."
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-white text-xs focus:outline-none focus:border-brand resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl font-bold text-xs bg-brand hover:brightness-110 text-white transition shadow-lg"
              >
                Send Inquiry to Booking Agent
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Official Career Passport PDF Modal */}
      {passportModalOpen && (
        <CareerPassportModal
          isOpen={passportModalOpen}
          onClose={() => setPassportModalOpen(false)}
          person={person}
          films={allFilms}
          stageCredits={stageCredits}
          metrics={computedMetrics}
          portfolioHandle={handle}
        />
      )}
    </div>
  );
}
