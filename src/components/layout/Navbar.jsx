import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Icon } from '@iconify/react';

const MOTION_STORAGE_KEY = 'MuviDB_motion_enabled';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState(['King of Boys', 'Funke Akindele', 'Anikulapo', 'Wole Soyinka']);
  const [unreadNotifications, setUnreadNotifications] = useState(false);
  const [isMotionEnabled, setIsMotionEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(MOTION_STORAGE_KEY) !== 'false';
  });
  
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const searchInputRef = useRef(null);
  const moreMenuRef = useRef(null);
  const isHome = location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Global keyboard shortcuts (Cmd+K / Ctrl+K and / to trigger search)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    
    // Stop/Start Lenis scrolling when search is open
    const lenis = window.lenis;
    if (lenis) {
      if (isSearchOpen) {
        lenis.stop();
      } else {
        lenis.start();
      }
    }
  }, [isSearchOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    document.documentElement.classList.toggle('muvi-motion-paused', !isMotionEnabled);
    localStorage.setItem(MOTION_STORAGE_KEY, isMotionEnabled ? 'true' : 'false');
  }, [isMotionEnabled]);

  // Close search and menus on route change
  useEffect(() => {
    setIsSearchOpen(false);
    setIsUserMenuOpen(false);
    setIsMoreOpen(false);
    setIsMobileMenuOpen(false);
  }, [location]);

  useEffect(() => {
    if (!isMoreOpen) return undefined;
    const onDoc = (e) => {
      if (!moreMenuRef.current?.contains(e.target)) setIsMoreOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [isMoreOpen]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  // Primary desktop navigation links
  const primaryLinks = [
    { name: 'Movies', path: '/browse' },
    { name: 'TV Shows', path: '/tv-shows' },
    { name: 'Showtimes', path: '/showtimes' },
    { name: 'Stage', path: '/plays' },
    { name: 'People', path: '/people' },
  ];

  // Mega-Menu structured categories matching user reference architecture
  const megaDirectory = [
    { name: 'Film Academies', path: '/companies?type=academy', icon: 'solar:diploma-bold', desc: 'Directing, acting bootcamps & VFX institutes', badge: 'NEW', badgeColor: 'bg-red-500/20 text-red-400 border-red-500/30' },
    { name: 'Production Studios', path: '/companies?type=production', icon: 'solar:clapperboard-play-bold', desc: 'Studios, soundstages & distribution slates' },
    { name: 'Talent Agencies & Guilds', path: '/companies?type=talent_agency', icon: 'solar:users-group-two-rounded-bold', desc: 'Actor management, creative reps & talent rosters' },
    { name: 'Cinema Venues', path: '/cinemas', icon: 'solar:videocamera-record-bold', desc: 'Multiplexes & independent screen schedules' },
    { name: 'Channels & Networks', path: '/channels', icon: 'solar:tv-bold', desc: 'Broadcasters & streaming channels' },
  ];

  const megaTools = [
    { name: 'Box Office Leaderboard', path: '/box-office', icon: 'solar:ticket-bold', desc: 'Weekend grosses & all-time cinema charts', badge: 'LIVE', badgeColor: 'bg-green-500/20 text-green-400 border-green-500/30' },
    { name: 'Live Stage Plays', path: '/plays', icon: 'solar:masks-bold', desc: 'Terra Kulture, Muson & National Theatre' },
    { name: 'Critics Lounge', path: '/critics', icon: 'solar:pen-new-square-bold', desc: 'Verified scorecards & video roundtables' },
    { name: 'Awards & Honors Hub', path: '/awards', icon: 'solar:cup-star-bold', desc: 'AMVCA, AMAA, AFRIFF & guild honorees' },
    { name: 'Advanced Search', path: '/advanced-search', icon: 'solar:tuning-square-2-bold', desc: 'Deep filtered cast, crew & genre search' },
  ];

  const allMoreLinks = [...megaDirectory, ...megaTools];
  const isMoreActive = allMoreLinks.some(
    (link) => location.pathname === link.path || location.pathname.startsWith(`${link.path}/`)
  );

  return (
    <>
      <nav 
        className={`fixed top-0 left-0 right-0 z-[100] h-[72px] transition-all duration-300 border-b
          ${isScrolled 
            ? 'bg-surface/95 backdrop-blur-xl border-border shadow-[0_8px_24px_rgba(0,0,0,0.25)]' 
            : 'bg-gradient-to-b from-bg via-bg/80 to-bg/0 border-transparent'}
        `}
      >
        <div className="max-w-[1440px] mx-auto h-full flex items-center gap-8 px-4 sm:px-6 lg:px-8">
          {/* Left: Brand Logo */}
          <Link to="/" className="flex items-center group shrink-0 select-none">
            <img 
              src={theme === 'light' ? "/images/MuviDB Brand/Wordmark.svg" : "/images/MuviDB Brand/White Wordmark.svg"}
              alt="MuviDB" 
              className="h-8 sm:h-9 object-contain group-hover:opacity-90 transition-opacity duration-300" 
            />
          </Link>

          {/* Left-aligned primary links with underline indicator (desktop lg+) */}
          <div className="hidden lg:flex items-stretch h-full gap-1">
            {primaryLinks.map((link) => {
              const isActive =
                location.pathname === link.path ||
                (link.path !== '/' && location.pathname.startsWith(`${link.path}/`));
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  className={`relative flex items-center px-3.5 text-[15px] font-semibold transition-colors duration-200 whitespace-nowrap select-none
                    ${isActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}
                  `}
                >
                  {link.name}
                  <span
                    className={`absolute left-3.5 right-3.5 bottom-0 h-[3px] rounded-t-full bg-brand transition-all duration-300 origin-center
                      ${isActive ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-50'}
                    `}
                  />
                </Link>
              );
            })}

            {/* More Menu Trigger */}
            <div className="relative flex items-stretch" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => setIsMoreOpen((open) => !open)}
                aria-expanded={isMoreOpen}
                aria-haspopup="menu"
                className={`relative inline-flex items-center gap-1.5 px-3.5 text-[15px] font-semibold transition-colors duration-200 whitespace-nowrap cursor-pointer select-none
                  ${isMoreOpen || isMoreActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}
                `}
              >
                {(isMoreOpen || isMoreActive) && (
                  <span className="absolute left-3.5 right-3.5 bottom-0 h-[3px] rounded-t-full bg-brand" />
                )}
                <span>More</span>
                <Icon
                  icon="solar:alt-arrow-down-linear"
                  width="14"
                  height="14"
                  className={`transition-transform duration-200 ${isMoreOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* ─── EDITORIAL MEGA-MENU DROPDOWN ─── */}
              {isMoreOpen && (
                <div
                  role="menu"
                  className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-[840px] max-w-[calc(100vw-2rem)] bg-surface/98 backdrop-blur-2xl border border-border/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[110]"
                >
                  <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
                    
                    {/* Column 1: Directory & Ecosystem */}
                    <div className="md:col-span-4 space-y-3">
                      <p className="px-2 text-[10.5px] font-black uppercase tracking-[0.2em] text-brand flex items-center gap-1.5">
                        <Icon icon="solar:folder-with-files-bold" className="text-xs" />
                        <span>Public Directory</span>
                      </p>
                      <div className="space-y-1">
                        {megaDirectory.map((item) => {
                          const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                          return (
                            <Link
                              key={item.name}
                              to={item.path}
                              role="menuitem"
                              onClick={() => setIsMoreOpen(false)}
                              className={`flex items-start gap-3 p-2.5 rounded-xl transition-all group ${
                                isActive
                                  ? 'bg-brand/10 text-brand'
                                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-2/60'
                              }`}
                            >
                              <div className="w-8 h-8 rounded-lg bg-surface-2 border border-border flex items-center justify-center shrink-0 text-text-muted group-hover:text-brand group-hover:border-brand/40 transition-colors">
                                <Icon icon={item.icon} className="text-base" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs font-bold leading-tight group-hover:text-brand transition-colors">{item.name}</p>
                                  {item.badge && (
                                    <span className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider border ${item.badgeColor}`}>
                                      {item.badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-text-muted leading-tight mt-0.5 line-clamp-1">{item.desc}</p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>

                    {/* Column 2: Commercial Intelligence & Tools */}
                    <div className="md:col-span-4 space-y-3">
                      <p className="px-2 text-[10.5px] font-black uppercase tracking-[0.2em] text-amber-400 flex items-center gap-1.5">
                        <Icon icon="solar:chart-square-bold" className="text-xs" />
                        <span>Commercial &amp; Tools</span>
                      </p>
                      <div className="space-y-1">
                        {megaTools.map((item) => {
                          const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                          return (
                            <Link
                              key={item.name}
                              to={item.path}
                              role="menuitem"
                              onClick={() => setIsMoreOpen(false)}
                              className={`flex items-start gap-3 p-2.5 rounded-xl transition-all group ${
                                isActive
                                  ? 'bg-amber-500/10 text-amber-400'
                                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-2/60'
                              }`}
                            >
                              <div className="w-8 h-8 rounded-lg bg-surface-2 border border-border flex items-center justify-center shrink-0 text-text-muted group-hover:text-amber-400 group-hover:border-amber-400/40 transition-colors">
                                <Icon icon={item.icon} className="text-base" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs font-bold leading-tight group-hover:text-amber-400 transition-colors">{item.name}</p>
                                  {item.badge && (
                                    <span className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider border ${item.badgeColor}`}>
                                      {item.badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-text-muted leading-tight mt-0.5 line-clamp-1">{item.desc}</p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>

                    {/* Column 3: Featured Spotlight Card */}
                    <div className="md:col-span-4 rounded-xl border border-border/80 bg-gradient-to-b from-[#180F0D] to-[#0E0706] p-4 flex flex-col justify-between gap-3 shadow-inner relative overflow-hidden group">
                      <div className="absolute -top-12 -right-12 w-32 h-32 bg-red-600/15 rounded-full blur-2xl pointer-events-none" />
                      <div className="relative z-10 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-widest bg-red-600/25 text-red-400 border border-red-500/30">
                            Institutional Spotlight
                          </span>
                          <span className="text-[10px] text-amber-300 font-bold">Warner Bros. Co-Lab</span>
                        </div>

                        <div className="aspect-[16/9] w-full rounded-lg overflow-hidden border border-white/10 relative bg-black">
                          <img
                            src="/media/delyork/shot_cinematography.jpg"
                            alt="Del-York Creative Academy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white text-[9.5px] font-bold">
                            <span>Victoria Island, Lagos</span>
                            <span className="text-red-400">Accredited Academy</span>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-heading font-black text-sm text-white group-hover:text-brand transition-colors">
                            Del-York Creative Academy
                          </h4>
                          <p className="text-[11px] text-text-muted leading-relaxed mt-1">
                            Africa's foremost capacity-building institution for film, directing, cinematography &amp; VFX soundstages.
                          </p>
                        </div>
                      </div>

                      <Link
                        to="/companies/del-york-creative-academy"
                        onClick={() => setIsMoreOpen(false)}
                        className="relative z-10 w-full py-2 px-3 rounded-lg bg-surface border border-border hover:border-brand text-xs font-bold text-brand flex items-center justify-between group-hover:bg-brand group-hover:text-black transition-all"
                      >
                        <span>Explore Academy Profile</span>
                        <Icon icon="solar:arrow-right-linear" className="text-sm" />
                      </Link>
                    </div>

                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Search Field + Theme + Motion + User Actions */}
          <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Desktop search field (looks like an input, opens the search overlay) */}
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="hidden md:flex items-center gap-3 h-11 w-64 xl:w-80 pl-4 pr-2 rounded-xl bg-surface-2/80 hover:bg-surface-2 border border-border hover:border-brand/50 text-text-muted hover:text-text-primary transition-all group cursor-text select-none"
              aria-label="Search"
              title="Search database (Press ⌘K or /)"
            >
              <Icon icon="solar:magnifer-linear" className="text-lg shrink-0 group-hover:text-brand transition-colors" />
              <span className="flex-1 text-left text-sm text-text-muted truncate">
                Search films, plays, talent...
              </span>
              <kbd className="hidden lg:inline-flex items-center gap-0.5 px-2 py-1 text-[10px] font-mono font-bold text-text-muted bg-surface border border-border rounded-md">
                <span>⌘</span>K
              </kbd>
            </button>

            {/* Mobile Search Icon */}
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="md:hidden w-10 h-10 flex items-center justify-center text-text-secondary hover:text-brand hover:bg-brand/10 rounded-full transition-all active:scale-90"
              aria-label="Search"
            >
              <Icon icon="solar:magnifer-linear" width="21" height="21" />
            </button>

            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-brand hover:bg-brand/10 rounded-full transition-all active:scale-90 cursor-pointer"
              aria-label="Toggle theme"
            >
              <Icon icon={theme === 'dark' ? 'solar:sun-2-linear' : 'solar:moon-linear'} width="21" height="21" />
            </button>

            {/* Motion Toggle on Home */}
            {isHome && (
              <button
                onClick={() => setIsMotionEnabled((enabled) => !enabled)}
                className={`w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-90 cursor-pointer ${
                  isMotionEnabled
                    ? 'bg-brand/10 text-brand hover:bg-brand/15'
                    : 'text-text-muted hover:text-brand hover:bg-brand/10'
                }`}
                aria-label={isMotionEnabled ? 'Turn off homepage animations' : 'Turn on homepage animations'}
                aria-pressed={isMotionEnabled}
                title={isMotionEnabled ? 'Turn off homepage animations' : 'Turn on homepage animations'}
              >
                <span
                  className={`muvi-motion-toggle-kernel ${
                    isMotionEnabled ? '' : 'muvi-motion-toggle-kernel--off'
                  }`}
                  aria-hidden="true"
                />
              </button>
            )}

            {/* User Session */}
            {isAuthenticated ? (
              <div className="flex items-center gap-2.5">
                {/* Notification Bell */}
                <button className="relative w-10 h-10 flex items-center justify-center text-text-secondary hover:text-brand hover:bg-brand/10 rounded-full transition-all active:scale-90 cursor-pointer">
                  <Icon icon="solar:bell-linear" width="21" height="21" />
                  {unreadNotifications && (
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-brand rounded-full border-2 border-surface"></span>
                  )}
                </button>

                {/* User Avatar & Dropdown */}
                <div className="relative group/user">
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    aria-label="Account menu"
                    className="w-10 h-10 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center text-brand font-bold text-sm overflow-hidden transition-all active:scale-95 hover:ring-2 hover:ring-brand/40 cursor-pointer"
                  >
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      user.name?.charAt(0) || 'U'
                    )}
                  </button>

                  {/* User Dropdown Menu */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-3 w-56 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[110]">
                      <div className="p-4 border-b border-border bg-surface-2/50">
                        <p className="text-sm font-bold text-text-primary line-clamp-1">{user.name}</p>
                        <p className="text-xs text-text-muted line-clamp-1">{user.email}</p>
                        {(user.role === 'admin' || user.role === 'admin_limited') && (
                          <span className="mt-2 inline-block px-2 py-0.5 bg-brand/10 text-brand text-[10px] font-bold rounded tracking-wide">
                            {user.role === 'admin' ? 'Admin' : 'Sub-Admin'}
                          </span>
                        )}
                      </div>
                      <div className="p-2 space-y-0.5">
                        <Link 
                          to={(user.role === 'admin' || user.role === 'admin_limited') ? "/admin" : (user.role === 'professional' ? "/pro-dashboard" : "/dashboard")} 
                          className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-lg transition-colors"
                        >
                          <Icon icon="solar:user-linear" width="16" height="16" />
                          <span>Your Profile</span>
                        </Link>
                        {(user.role === 'admin' || user.role === 'admin_limited') && (
                          <Link to="/admin" className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-brand hover:bg-brand/5 rounded-lg transition-colors">
                            <Icon icon="solar:clapperboard-play-linear" width="16" height="16" />
                            <span>Admin Panel</span>
                          </Link>
                        )}
                        <button 
                          onClick={logout}
                          className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-text-muted hover:text-text-primary hover:bg-white/5 rounded-lg transition-colors mt-1 cursor-pointer"
                        >
                          <Icon icon="solar:logout-linear" width="16" height="16" />
                          <span>Logout</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Link 
                to="/login"
                className="hidden sm:inline-flex px-5 h-10 items-center bg-brand hover:bg-brand/90 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-brand/20"
              >
                Sign In
              </Link>
            )}

            {/* Mobile Hamburger Drawer Button (lg:hidden) */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              className="lg:hidden w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-2 rounded-xl border border-border/70 transition-all active:scale-90 cursor-pointer"
              aria-label={isMobileMenuOpen ? 'Close navigation drawer' : 'Open navigation drawer'}
              aria-expanded={isMobileMenuOpen}
            >
              <Icon icon={isMobileMenuOpen ? 'solar:close-circle-bold' : 'solar:hamburger-menu-linear'} width="22" height="22" className={isMobileMenuOpen ? 'text-brand' : ''} />
            </button>
          </div>
        </div>
      </nav>

      {/* ─── APP-LIKE MOBILE NAVIGATION DRAWER (lg:hidden) ─── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[140] lg:hidden animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer Sheet */}
          <div className="absolute right-0 top-0 bottom-0 w-[84vw] max-w-sm bg-surface border-l border-border shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300">
            {/* Top Bar inside Drawer */}
            <div className="p-4 border-b border-border/80 flex items-center justify-between">
              <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center">
                <img 
                  src={theme === 'light' ? "/images/MuviDB Brand/Wordmark.svg" : "/images/MuviDB Brand/White Wordmark.svg"}
                  alt="MuviDB" 
                  className="h-7 object-contain" 
                />
              </Link>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-9 h-9 rounded-xl bg-surface-2 flex items-center justify-center text-text-secondary hover:text-text-primary border border-border cursor-pointer"
              >
                <Icon icon="solar:close-circle-bold" className="text-xl" />
              </button>
            </div>

            {/* Drawer Body Links */}
            <div className="p-4 space-y-6 flex-1">
              {/* Quick Search Tap Button */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsSearchOpen(true);
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-surface-2 border border-border text-xs text-text-muted hover:text-text-primary hover:border-brand/40 transition-colors cursor-pointer"
              >
                <Icon icon="solar:magnifer-linear" className="text-base text-brand" />
                <span>Search films, plays, talent...</span>
              </button>

              {/* Primary Pages */}
              <div className="space-y-1">
                <p className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">
                  Primary Channels
                </p>
                {primaryLinks.map((link) => {
                  const isActive = location.pathname === link.path || (link.path !== '/' && location.pathname.startsWith(`${link.path}/`));
                  return (
                    <Link
                      key={link.name}
                      to={link.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                        isActive
                          ? 'bg-brand/10 text-brand border border-brand/20'
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
                      }`}
                    >
                      <span>{link.name}</span>
                      <Icon icon="solar:arrow-right-linear" className="text-xs opacity-60" />
                    </Link>
                  );
                })}
              </div>

              {/* Directory & Institutions */}
              <div className="space-y-1">
                <p className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                  Directory &amp; Academies
                </p>
                {megaDirectory.map((item) => (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
                  >
                    <Icon icon={item.icon} className="text-base text-brand shrink-0" />
                    <span className="truncate">{item.name}</span>
                    {item.badge && (
                      <span className={`ml-auto px-1.5 py-0.2 rounded text-[8px] font-black uppercase border ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                ))}
              </div>

              {/* Intelligence & Tools */}
              <div className="space-y-1">
                <p className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                  Commercial &amp; Intelligence
                </p>
                {megaTools.map((item) => (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
                  >
                    <Icon icon={item.icon} className="text-base text-amber-400 shrink-0" />
                    <span className="truncate">{item.name}</span>
                    {item.badge && (
                      <span className={`ml-auto px-1.5 py-0.2 rounded text-[8px] font-black uppercase border ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>

            {/* Bottom Actions inside Drawer */}
            <div className="p-4 border-t border-border/80 bg-surface-2/40 space-y-3">
              {isAuthenticated ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-text-primary truncate">{user.name}</p>
                    <p className="text-[10px] text-text-muted truncate">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={logout}
                    className="px-3 py-1.5 rounded-lg bg-surface border border-border text-xs font-bold text-red-400 hover:border-red-400/50 cursor-pointer"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-brand hover:bg-brand/90 text-white font-bold text-xs uppercase tracking-wider text-center block shadow-md shadow-brand/20"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Search Overlay */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-[150] flex flex-col pt-[72px] animate-in fade-in duration-300">
          <div 
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
            onClick={() => setIsSearchOpen(false)}
          />
          
          <div className="relative w-full max-w-4xl mx-auto px-4 mt-12 md:mt-24">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="font-heading text-2xl md:text-3xl text-text-primary font-bold">Search MuviDB</h2>
                <p className="text-xs text-text-muted mt-1">Films, stage plays, talent, cinemas &amp; industry intelligence</p>
              </div>
              <button 
                onClick={() => setIsSearchOpen(false)}
                className="w-12 h-12 flex items-center justify-center text-text-muted hover:text-text-primary bg-white/5 hover:bg-white/10 rounded-full transition-all cursor-pointer"
                aria-label="Close search"
              >
                <Icon icon="solar:close-circle-linear" width="28" height="28" />
              </button>
            </div>

            <form onSubmit={handleSearch} className="relative group">
              <Icon icon="solar:magnifer-linear" className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand transition-colors" width="28" height="28" />
              <input 
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search films, plays, directors, venues, actors..."
                className="w-full bg-white/5 border-2 border-white/10 focus:border-brand rounded-3xl py-6 pl-16 pr-6 text-xl md:text-2xl text-text-primary placeholder-text-muted outline-none transition-all shadow-2xl"
              />
            </form>

            <div className="mt-12">
              <h3 className="text-sm font-bold text-text-muted tracking-wide mb-4">Popular Searches</h3>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term) => (
                  <button 
                    key={term}
                    onClick={() => {
                      setSearchQuery(term);
                      navigate(`/search?q=${encodeURIComponent(term)}`);
                      setIsSearchOpen(false);
                    }}
                    className="px-5 py-2.5 bg-white/5 hover:bg-brand hover:text-white border border-white/10 rounded-xl text-sm text-text-secondary transition-all active:scale-95 cursor-pointer"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-text-muted">Looking for multi-criteria filters or box office benchmarks?</span>
              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen(false);
                  navigate('/advanced-search');
                }}
                className="text-xs font-bold text-brand hover:underline flex items-center gap-1.5 cursor-pointer"
              >
                <Icon icon="solar:tuning-square-2-bold" />
                <span>Open Advanced Search &rarr;</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
