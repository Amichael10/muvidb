import { useState, useEffect, useMemo } from 'react';
import { Outlet, NavLink, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '@iconify/react';
import { useAdminNotifications } from '../../hooks/useAdminNotifications';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [globalSearch, setGlobalSearch] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [drawerNavFilter, setDrawerNavFilter] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  
  useBodyScrollLock(mobileMenuOpen);

  const isSuperAdmin = user?.role === 'admin';
  const { totalCount, cinemaCount, claimCount, notifications, loading: notificationsLoading } = useAdminNotifications(isSuperAdmin);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('MuviDB_admin_collapsed') === 'true';
  });
  
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('MuviDB_theme_mode') !== 'light';
  });

  useEffect(() => {
    localStorage.setItem('MuviDB_admin_collapsed', isCollapsed);
  }, [isCollapsed]);

  useEffect(() => {
    localStorage.setItem('MuviDB_theme_mode', isDark ? 'dark' : 'light');
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    setNotificationsOpen(false);
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
  }, [location.pathname]);

  const navItems = useMemo(() => [
    { path: '/admin', label: 'Overview', icon: 'solar:graph-up-linear', exact: true, category: 'Core' },
    { path: '/admin/films', label: 'Films', icon: 'solar:clapperboard-play-linear', category: 'Catalog' },
    { path: '/admin/people', label: 'People', icon: 'solar:user-linear', category: 'Catalog' },
    { path: '/admin/people-enrichment', label: 'People Enrichment', icon: 'solar:user-check-linear', category: 'Catalog' },
    { path: '/admin/credits', label: 'Credits', icon: 'solar:case-linear', category: 'Catalog' },
    { path: '/admin/credits/harvest', label: 'Credit Harvest', icon: 'solar:magnifer-zoom-in-linear', category: 'Catalog' },
    { path: '/admin/companies', label: 'Companies', icon: 'solar:buildings-linear', category: 'Catalog' },
    { path: '/admin/claims', label: 'Pending Claims', icon: 'solar:clipboard-list-linear', badge: isSuperAdmin ? claimCount : 0, category: 'Moderation' },
    { path: '/admin/actor-credits', label: 'Actor Credit Requests', icon: 'solar:clapperboard-edit-linear', category: 'Moderation' },
    { path: '/admin/outreach', label: 'Artist Outreach', icon: 'solar:chat-round-line-linear', category: 'Moderation' },
    { path: '/admin/contributions', label: 'Contributions', icon: 'solar:users-group-rounded-linear', category: 'Moderation' },
    { path: '/admin/users', label: 'Users', icon: 'solar:users-group-two-rounded-linear', category: 'Moderation' },
    { path: '/admin/cinemas', label: 'Cinemas', icon: 'solar:buildings-2-linear', category: 'Cinemas & Theatres' },
    { path: '/admin/channels', label: 'Channels', icon: 'solar:videocamera-record-linear', category: 'Media' },
    { path: '/admin/critics', label: 'Film Critics', icon: 'solar:chat-round-bold-linear', category: 'Editorial' },
    { path: '/admin/critic-videos', label: 'Video Reviews', icon: 'solar:video-library-bold-linear', category: 'Editorial' },
    { path: '/admin/plays', label: 'Theatre Plays', icon: 'solar:mask-hamsa-linear', category: 'Cinemas & Theatres' },
    { path: '/admin/countries', label: 'Countries', icon: 'solar:global-linear', category: 'Catalog' },
    { path: '/admin/cinema-films', label: 'Cinema Films', icon: 'solar:ticket-linear', badge: isSuperAdmin ? cinemaCount : 0, category: 'Cinemas & Theatres' },
    { path: '/admin/cinema-scraping', label: 'Scraping', icon: 'solar:refresh-linear', category: 'Automation' },
    { path: '/admin/logs', label: 'Activity Logs', icon: 'solar:history-linear', category: 'System' },
    { path: '/admin/deduplicator', label: 'Deduplicator', icon: 'solar:radar-2-linear', category: 'System' },
    { path: '/admin/ai', label: 'AI Agent', icon: 'solar:cpu-linear', category: 'Automation' },
    { path: '/admin/editorial', label: 'Editorial', icon: 'solar:pen-new-square-linear', category: 'Editorial' },
    { path: '/admin/social', label: 'Social Studio', icon: 'solar:magic-stick-3-linear', category: 'Editorial' },
    { path: '/admin/spotlight', label: 'Spotlight', icon: 'solar:star-fall-linear', category: 'Editorial' },
    { path: '/admin/jobs', label: 'Careers', icon: 'solar:case-round-linear', category: 'System' },
    { path: '/admin/top10', label: 'Top 10', icon: 'solar:medal-star-linear', category: 'Editorial' },
    { path: '/admin/new-releases', label: 'New to Stream', icon: 'solar:tv-linear', category: 'Editorial' },
    { path: '/admin/title-checker', label: 'Title Search', icon: 'solar:magnifer-zoom-in-bold', category: 'Catalog' },
    { path: '/admin/import', label: 'Import Hub', icon: 'solar:import-linear', category: 'System' },
    { path: '/admin/automation', label: 'Automation', icon: 'solar:server-square-linear', category: 'Automation' },
    { path: '/admin/endpoints', label: 'API & Endpoints', icon: 'solar:server-minimalistic-linear', category: 'System' },
    { path: '/admin/api-keys', label: 'Developer API', icon: 'solar:key-minimalistic-square-linear', category: 'System' },
  ], [isSuperAdmin, claimCount, cinemaCount]);

  const quickNavTabs = [
    { path: '/admin', label: 'Overview', icon: 'solar:graph-up-linear', exact: true },
    { path: '/admin/films', label: 'Films', icon: 'solar:clapperboard-play-linear' },
    { path: '/admin/people', label: 'People', icon: 'solar:user-linear' },
    { path: '/admin/credits/harvest', label: 'Harvest', icon: 'solar:magnifer-zoom-in-linear' },
    { path: '/admin/claims', label: 'Claims', icon: 'solar:clipboard-list-linear', badge: isSuperAdmin ? claimCount : 0 },
    { path: '/admin/editorial', label: 'Editorial', icon: 'solar:pen-new-square-linear' },
    { path: '/admin/cinema-scraping', label: 'Scrapers', icon: 'solar:refresh-linear' },
    { path: '/admin/logs', label: 'Logs', icon: 'solar:history-linear' },
  ];

  const allowedPathsForLimited = ['/admin', '/admin/films', '/admin/people', '/admin/credits', '/admin/companies', '/admin/critics', '/admin/critic-videos', '/admin/plays', '/admin/title-checker'];
  
  // Security guard for manual URL entry by admin_limited
  const isPathAllowed = (path) => {
    if (user?.role !== 'admin_limited') return true;
    if (path === '/admin' || path === '/admin/') return true;
    return allowedPathsForLimited.some(allowedPath => allowedPath !== '/admin' && path.startsWith(allowedPath));
  };

  if (user?.role === 'admin_limited' && !isPathAllowed(location.pathname)) {
    return <Navigate to="/admin" replace />;
  }

  const visibleNavItems = navItems.filter(item => {
    if (user?.role === 'admin_limited') {
      return allowedPathsForLimited.includes(item.path);
    }
    return true;
  });

  const filteredDrawerNavItems = useMemo(() => {
    if (!drawerNavFilter.trim()) return visibleNavItems;
    const q = drawerNavFilter.toLowerCase().trim();
    return visibleNavItems.filter(item => item.label.toLowerCase().includes(q) || item.category?.toLowerCase().includes(q));
  }, [visibleNavItems, drawerNavFilter]);

  const currentPage = visibleNavItems.find(item => location.pathname === item.path) || 
                      visibleNavItems.find(item => location.pathname.startsWith(item.path));

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const q = globalSearch.trim();
    if (!q) return;
    if (location.pathname.startsWith('/admin/films')) {
      navigate(`/admin/films?search=${encodeURIComponent(q)}`);
    } else {
      navigate(`/admin/people?search=${encodeURIComponent(q)}`);
    }
    setMobileSearchOpen(false);
  };

  return (
    <div className={`admin-workspace flex min-h-screen font-sans ${isDark ? 'dark' : 'light'} bg-bg transition-colors duration-300 relative overflow-x-hidden`}>
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MOBILE DRAWER BACKDROP & SLIDE-OUT ASIDE (< md)                          */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 md:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[min(340px,88vw)] bg-sidebar border-r border-sidebar-border flex flex-col md:hidden transform transition-transform duration-300 ease-in-out shadow-2xl ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-sidebar-border bg-sidebar flex-shrink-0">
          <Link to="/" className="flex items-center gap-2">
            <img 
              src="/images/MuviDB Brand/White Wordmark.svg" 
              alt="MuviDB Admin" 
              className="h-6 object-contain"
            />
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="w-10 h-10 rounded-xl bg-surface-2 border border-border text-text-primary hover:text-brand flex items-center justify-center transition"
            aria-label="Close menu"
          >
            <Icon icon="solar:close-square-linear" width="22" />
          </button>
        </div>

        {/* Generously Sized Admin Profile Identity Card */}
        <div className="p-4 border-b border-sidebar-border bg-surface-2/40 flex-shrink-0">
          <div className="flex items-center gap-4">
            {/* Prominent, Large Admin Avatar (64x64px) */}
            <div className="w-16 h-16 rounded-2xl bg-surface-2 border-2 border-brand/40 flex-shrink-0 flex items-center justify-center text-brand font-black text-2xl shadow-lg shadow-brand/10 overflow-hidden relative group">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={user?.name || 'Admin'} className="w-full h-full object-cover" />
              ) : (
                <span>{user?.name?.charAt(0) || user?.email?.charAt(0) || 'A'}</span>
              )}
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-sidebar flex items-center justify-center" title="Online Admin">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-text-primary font-bold text-sm truncate">{user?.name || 'Administrator'}</p>
              </div>
              <p className="text-text-muted text-[11px] truncate mt-0.5">{user?.email}</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-brand/15 text-brand border border-brand/30">
                  <Icon icon="solar:shield-check-bold" width="11" />
                  {isSuperAdmin ? 'Super Admin' : 'Admin'}
                </span>
                {totalCount > 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    {totalCount} alerts
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3.5">
            <Link
              to="/"
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 text-center text-xs bg-surface-2 hover:bg-surface-3 rounded-lg text-text-primary font-bold transition flex items-center justify-center gap-1.5 border border-border"
            >
              <Icon icon="solar:globus-linear" width="14" className="text-brand" />
              View Site
            </Link>
            <button
              onClick={logout}
              className="py-2 text-center text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg font-bold transition flex items-center justify-center gap-1.5 border border-red-500/20"
            >
              <Icon icon="solar:logout-linear" width="14" />
              Sign out
            </button>
          </div>
        </div>

        {/* Drawer Search Filter */}
        <div className="px-4 py-2.5 border-b border-sidebar-border bg-sidebar flex-shrink-0">
          <div className="flex items-center bg-surface-2 rounded-lg px-2.5 py-1.5 border border-border focus-within:border-brand">
            <Icon icon="solar:magnifer-linear" className="text-text-muted" width="16" />
            <input
              type="text"
              placeholder="Filter 34 admin modules..."
              value={drawerNavFilter}
              onChange={(e) => setDrawerNavFilter(e.target.value)}
              className="bg-transparent border-none text-xs w-full ml-2 text-text-primary placeholder:text-text-muted outline-none"
            />
            {drawerNavFilter && (
              <button onClick={() => setDrawerNavFilter('')} className="text-text-muted hover:text-text-primary text-xs">
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Drawer Scrollable Nav List */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1 custom-scrollbar">
          {filteredDrawerNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-brand text-white font-bold shadow-md shadow-brand/20'
                    : 'text-sidebar-text hover:bg-sidebar-hover hover:text-text-primary'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon icon={item.icon} className={`text-lg flex-shrink-0 ${isActive ? 'text-white' : 'text-text-muted group-hover:text-brand'}`} />
                    <span className="text-xs truncate">{item.label}</span>
                  </div>
                  {item.badge > 0 && (
                    <span className={`min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                      isActive ? 'bg-white text-brand' : 'bg-brand text-white'
                    }`}>
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* DESKTOP SIDEBAR (>= md)                                                  */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <aside 
        className={`admin-sidebar bg-sidebar border-r border-sidebar-border hidden md:flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out relative z-30 h-screen sticky top-0 ${
          isCollapsed ? 'w-[72px]' : 'w-[284px]'
        }`}
      >
        {/* Desktop Toggle Button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-8 w-6 h-6 bg-brand text-white rounded-full flex items-center justify-center shadow-lg z-40 hover:scale-110 transition-transform cursor-pointer border-2 border-sidebar"
        >
          <Icon icon={isCollapsed ? "solar:alt-arrow-right-linear" : "solar:alt-arrow-left-linear"} width="12" />
        </button>

        <div className={`h-16 flex items-center ${isCollapsed ? 'justify-center' : 'justify-start px-6'} mb-2`}>
          {isCollapsed ? (
            <img 
              src="/images/MuviDB Brand/Logo.png" 
              alt="MuviDB Logo" 
              className="w-8 h-8 object-contain"
            />
          ) : (
            <img 
              src="/images/MuviDB Brand/White Wordmark.svg" 
              alt="MuviDB Admin" 
              className="h-6 object-contain"
            />
          )}
        </div>

        <nav className="admin-nav flex-1 overflow-y-auto px-3 space-y-1 py-4 custom-scrollbar">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              title={isCollapsed ? item.label : ''}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-brand/10 text-brand font-bold shadow-[inset_3px_0_0_var(--color-brand)]'
                    : 'text-sidebar-text hover:bg-sidebar-hover hover:text-text-primary'
                } ${isCollapsed ? 'justify-center px-0' : 'justify-start'}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon icon={item.icon} className={`text-xl transition-transform duration-200 ${isCollapsed ? 'scale-110' : ''}`} />
                  {!isCollapsed && (
                    <span className="text-sm whitespace-nowrap">{item.label}</span>
                  )}
                  {item.badge > 0 && (
                    <span className={`${isCollapsed ? 'absolute right-0 top-0' : 'ml-auto'} min-w-5 h-5 px-1 rounded-md bg-brand text-white text-[9px] font-bold flex items-center justify-center`}>
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                  {!isCollapsed && !item.badge && (
                    <div className={`ml-auto w-1 h-1 rounded-full bg-brand transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Desktop User Card (Large & Prominent) */}
        <div className="p-4 border-t border-sidebar-border bg-surface-2/30">
          <div className={`flex items-center gap-3 overflow-hidden ${isCollapsed ? 'justify-center gap-0' : ''}`}>
            {/* Prominent Avatar on Desktop */}
            <div className="w-10 h-10 rounded-xl bg-surface-2 border border-brand/30 flex flex-shrink-0 items-center justify-center text-brand font-bold text-sm shadow-sm overflow-hidden">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={user?.name || 'Admin'} className="w-full h-full object-cover" />
              ) : (
                <span>{user?.name?.charAt(0) || user?.email?.charAt(0) || 'A'}</span>
              )}
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden min-w-0">
                <p className="text-text-primary font-bold truncate text-xs">{user?.name || 'Admin'}</p>
                <p className="text-text-muted text-[10px] truncate">{user?.email}</p>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={logout}
                className="w-full text-center py-2 text-xs bg-red-500/5 rounded-lg text-red-500 hover:text-white hover:bg-red-500 transition-all font-bold flex items-center justify-center gap-2 border border-red-500/10"
              >
                <Icon icon="solar:logout-linear" width="14" />
                Sign out
              </button>
              <Link
                to="/"
                className="w-full text-center py-2 text-xs bg-surface-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-3 transition-all font-bold"
              >
                Go to website
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MAIN CONTENT AREA                                                        */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-hidden">
        {/* Topbar Header */}
        <header className="admin-topbar h-16 bg-surface border-b border-border flex items-center justify-between px-3 md:px-6 flex-shrink-0 z-20">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {/* Mobile Hamburger Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-surface-2 border border-border text-text-primary hover:text-brand relative transition active:scale-95"
              aria-label="Open navigation menu"
            >
              <Icon icon="solar:hamburger-menu-linear" width="22" />
              {totalCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand text-white rounded-full text-[9px] font-bold flex items-center justify-center border-2 border-surface">
                  {totalCount > 9 ? '9+' : totalCount}
                </span>
              )}
            </button>

            {/* Mobile Logo Brand */}
            <div className="md:hidden flex items-center">
              <img src="/images/MuviDB Brand/Logo.png" alt="MuviDB" className="w-7 h-7 object-contain" />
            </div>

            <h1 className="text-sm sm:text-lg font-bold text-text-primary tracking-tight truncate">
              {currentPage?.label || 'Dashboard'}
            </h1>

            {/* Desktop Search Bar */}
            <form
              onSubmit={handleSearchSubmit}
              className="hidden md:flex ml-4 lg:ml-8 items-center bg-surface-2 rounded-lg px-3 py-1.5 border border-border group focus-within:border-brand transition-colors"
            >
              <Icon icon="solar:magnifer-linear" className="text-text-muted transition-colors group-focus-within:text-brand" />
              <input 
                type="text" 
                placeholder="Search people or films..." 
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-sm w-48 lg:w-64 placeholder:text-text-muted ml-2 text-text-primary outline-none"
              />
              {globalSearch && (
                <button
                  type="button"
                  onClick={() => setGlobalSearch('')}
                  className="text-text-muted hover:text-text-primary text-xs ml-1"
                >
                  ✕
                </button>
              )}
            </form>
          </div>

          {/* Topbar Actions */}
          <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
            {/* Mobile Search Toggle */}
            <button
              onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
              className={`md:hidden w-10 h-10 rounded-xl bg-surface-2 border transition-all flex items-center justify-center ${
                mobileSearchOpen ? 'border-brand text-brand' : 'border-border text-text-muted hover:text-text-primary'
              }`}
              title="Search films or people"
              aria-label="Toggle search"
            >
              <Icon icon="solar:magnifer-linear" width="20" />
            </button>

            {/* Theme Toggle */}
            <button 
              onClick={() => setIsDark(!isDark)}
              className={`w-10 h-10 rounded-xl bg-surface-2 border border-border transition-all flex items-center justify-center shadow-sm ${!isDark ? 'text-brand border-brand/30' : 'text-text-muted hover:text-brand hover:border-brand/30'}`}
              title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
            >
              <Icon icon={isDark ? 'solar:sun-2-linear' : 'solar:moon-linear'} width="20" />
            </button>

            {/* View Site (Desktop) */}
            <Link
              to="/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex px-4 py-2 bg-surface-2 border border-border text-text-primary rounded-lg text-xs font-semibold hover:bg-surface-3 transition-all items-center gap-2 shadow-sm"
            >
              <span className="text-brand">●</span> View Site
            </Link>
            
            {/* Notification Bell */}
            {isSuperAdmin && (
              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen(value => !value)}
                  className={`relative w-10 h-10 rounded-xl bg-surface-2 border transition-all flex items-center justify-center shadow-sm ${notificationsOpen ? 'border-brand text-brand' : 'border-border text-text-muted hover:text-brand'}`}
                  title={`${totalCount} items awaiting review`}
                  aria-label="Admin notifications"
                  aria-expanded={notificationsOpen}
                >
                  <Icon icon="solar:bell-linear" width="20" />
                  {totalCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-md border-2 border-surface bg-brand px-1 text-[9px] font-bold text-white">
                      {totalCount > 99 ? '99+' : totalCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 top-12 z-50 w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <div>
                        <p className="text-sm font-bold text-text-primary">Admin notifications</p>
                        <p className="text-[10px] text-text-muted">{claimCount} claims · {cinemaCount} cinema items</p>
                      </div>
                      <Icon icon="solar:ticket-linear" className="text-brand" width="20" />
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                      {notificationsLoading ? (
                        <p className="p-6 text-center text-xs text-text-muted">Loading...</p>
                      ) : notifications.length === 0 ? (
                        <div className="p-6 text-center">
                          <Icon icon="solar:check-circle-linear" className="mx-auto mb-2 text-emerald-500" width="24" />
                          <p className="text-xs font-bold text-text-primary">Queue is clear</p>
                        </div>
                      ) : notifications.map(item => (
                        <Link key={item.id} to={item.href} className="block border-b border-border px-4 py-3 last:border-0 hover:bg-surface-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 gap-3">
                              <Icon icon={item.type === 'actor_claim' ? 'solar:user-check-rounded-linear' : 'solar:ticket-linear'} className="mt-0.5 flex-shrink-0 text-brand" width="18" />
                              <div className="min-w-0">
                                <p className="truncate text-xs font-bold text-text-primary">{item.title}</p>
                                <p className="mt-1 truncate text-[10px] text-text-muted">{item.detail}</p>
                              </div>
                            </div>
                            {item.type === 'actor_claim' ? <span className="flex-shrink-0 rounded-md bg-brand/10 px-2 py-1 text-[9px] font-bold text-brand">CLAIM</span> : <span className="flex-shrink-0 rounded-md bg-brand/10 px-2 py-1 text-[9px] font-bold text-brand">{item.badge}</span>}
                          </div>
                        </Link>
                      ))}
                    </div>

                    <Link to={claimCount > 0 ? '/admin/claims' : '/admin/cinema-films'} className="flex h-11 items-center justify-center gap-2 border-t border-border text-xs font-bold text-brand hover:bg-brand/5">
                      Review pending items
                      <Icon icon="solar:arrow-right-linear" width="15" />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Mobile Full-Width Search Input (Collapsible) */}
        {mobileSearchOpen && (
          <div className="md:hidden border-b border-border bg-surface-2/60 p-2.5 animate-in slide-in-from-top-2 duration-200">
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 bg-surface rounded-xl px-3 py-2 border border-brand/50">
              <Icon icon="solar:magnifer-linear" className="text-brand flex-shrink-0" width="18" />
              <input
                type="text"
                placeholder="Search films or people on MuviDB..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                autoFocus
                className="bg-transparent border-none text-xs w-full text-text-primary placeholder:text-text-muted outline-none"
              />
              <button type="submit" className="px-3 py-1 bg-brand text-white text-xs font-bold rounded-lg flex-shrink-0">
                Search
              </button>
            </form>
          </div>
        )}

        {/* Mobile Fast-Switch Horizontal Ribbon (< md) */}
        <div className="flex md:hidden items-center gap-1.5 px-3 py-2 overflow-x-auto scrollbar-none border-b border-border bg-surface/80 backdrop-blur-md flex-shrink-0">
          {quickNavTabs.map(tab => {
            const isActive = tab.exact ? location.pathname === tab.path : location.pathname.startsWith(tab.path);
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition flex-shrink-0 ${
                  isActive
                    ? 'bg-brand text-white shadow-sm'
                    : 'bg-surface-2 border border-border text-text-muted hover:text-text-primary'
                }`}
              >
                <Icon icon={tab.icon} width="14" />
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="w-4 h-4 rounded-full bg-white text-brand text-[9px] font-black flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Scrollable Content - Full Width without clipping */}
        <main className="admin-content flex-1 min-w-0 w-full overflow-y-auto p-2.5 sm:p-4 md:p-6 xl:p-8 custom-scrollbar relative">
          <div className="admin-main-inner w-full min-w-0 mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }) {
  return (
    <div className="p-8 sm:p-12 text-center bg-surface border border-red-500/20 rounded-2xl shadow-2xl m-4 sm:m-8">
      <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 text-red-500 font-bold">⚠️</div>
      <h1 className="text-lg sm:text-xl font-black text-red-500 mb-2 uppercase tracking-wide">Admin Interface Error</h1>
      <p className="text-text-muted mb-6 text-xs sm:text-sm max-w-md mx-auto">{error?.message || 'An unexpected error occurred in this admin section.'}</p>
      <div className="flex justify-center gap-3 sm:gap-4 flex-wrap">
        <button onClick={() => window.location.reload()} className="px-5 py-2.5 bg-brand text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-brand-hover">
          Reload
        </button>
        <a href="/admin" className="px-5 py-2.5 bg-surface-2 border border-border text-text-primary rounded-lg text-xs font-black uppercase tracking-widest hover:border-brand/30">
          Admin Overview
        </a>
      </div>
    </div>
  );
}
