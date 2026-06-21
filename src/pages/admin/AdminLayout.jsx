import { useState, useEffect } from 'react';
import { Outlet, NavLink, Link, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '@iconify/react';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
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

  const navItems = [
    { path: '/admin', label: 'Overview', icon: 'solar:graph-up-linear', exact: true },
    { path: '/admin/films', label: 'Films', icon: 'solar:clapperboard-play-linear' },
    { path: '/admin/people', label: 'People', icon: 'solar:user-linear' },
    { path: '/admin/credits', label: 'Credits', icon: 'solar:case-linear' },
    { path: '/admin/companies', label: 'Companies', icon: 'solar:buildings-linear' },
    { path: '/admin/claims', label: 'Pending Claims', icon: 'solar:clipboard-list-linear' },
    { path: '/admin/users', label: 'Users', icon: 'solar:users-group-two-rounded-linear' },
    { path: '/admin/cinemas', label: 'Cinemas', icon: 'solar:buildings-2-linear' },
    { path: '/admin/channels', label: 'Channels', icon: 'solar:videocamera-record-linear' },
    { path: '/admin/countries', label: 'Countries', icon: 'solar:global-linear' },
    { path: '/admin/cinema-films', label: 'Cinema Films', icon: 'solar:ticket-linear' },
    { path: '/admin/cinema-scraping', label: 'Scraping', icon: 'solar:refresh-linear' },
    { path: '/admin/logs', label: 'Activity Logs', icon: 'solar:history-linear' },
    { path: '/admin/ai', label: 'AI Agent', icon: 'solar:cpu-linear' },
    { path: '/admin/spotlight', label: 'Spotlight', icon: 'solar:star-fall-linear' },
    { path: '/admin/top10', label: 'Top 10', icon: 'solar:medal-star-linear' },
    { path: '/admin/import', label: 'Import Hub', icon: 'solar:import-linear' },
    { path: '/admin/automation', label: 'Automation', icon: 'solar:server-square-linear' },
  ];

  const allowedPathsForLimited = ['/admin', '/admin/films', '/admin/people', '/admin/credits', '/admin/companies'];
  
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

  const currentPage = visibleNavItems.find(item => location.pathname === item.path) || 
                      visibleNavItems.find(item => location.pathname.startsWith(item.path));

  return (
    <div className={`flex min-h-screen font-sans ${isDark ? 'dark' : 'light'} bg-bg transition-colors duration-300`}>
      {/* Sidebar - Always Dark for Hybrid Look */}
      <aside 
        className={`bg-sidebar border-r border-sidebar-border flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out relative z-30 h-screen sticky top-0 ${
          isCollapsed ? 'w-[72px]' : 'w-[260px]'
        }`}
      >
        {/* Toggle Button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-8 w-6 h-6 bg-brand text-white rounded-full flex items-center justify-center shadow-lg z-40 hover:scale-110 transition-transform cursor-pointer border-2 border-sidebar"
        >
          <Icon icon={isCollapsed ? "solar:alt-arrow-right-linear" : "solar:alt-arrow-left-linear"} width="12" />
        </button>

        <div className={`h-16 flex items-center mb-4 ${isCollapsed ? 'justify-center px-6' : 'px-6'}`}>
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

        <nav className="flex-1 overflow-y-auto px-3 space-y-1 py-4 scrollbar-hide">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              title={isCollapsed ? item.label : ''}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-brand/10 text-brand font-bold'
                    : 'text-sidebar-text hover:bg-surface-2 hover:text-text-primary'
                } ${isCollapsed ? 'justify-center px-0' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon icon={item.icon} className={`text-xl transition-transform duration-200 ${isCollapsed ? 'scale-110' : ''}`} />
                  {!isCollapsed && (
                    <span className="text-sm whitespace-nowrap">{item.label}</span>
                  )}
                  {/* Active Indicator Pip */}
                  {!isCollapsed && (
                    <div className={`ml-auto w-1 h-1 rounded-full bg-brand transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Card */}
        <div className="p-4 border-t border-sidebar-border bg-surface-2/30">
          <div className={`flex items-center gap-3 overflow-hidden ${isCollapsed ? 'justify-center gap-0' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-surface-2 border border-border flex flex-shrink-0 items-center justify-center text-brand font-bold text-sm">
              {user?.name?.charAt(0) || user?.email?.charAt(0) || 'A'}
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <p className="text-text-primary font-medium truncate text-xs">{user?.name || 'Admin'}</p>
                <p className="text-text-muted text-[10px] truncate">{user?.email}</p>
              </div>
            )}
          </div>
          {!isCollapsed && (
            
            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={logout}
                className="w-full text-center py-2.5 text-xs bg-red-500/5 rounded-lg text-red-500 hover:text-white hover:bg-red-500 transition-all font-bold flex items-center justify-center gap-2 border border-red-500/10"
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Bar */}
        <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-8 flex-shrink-0 z-20">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-text-primary tracking-tight">
              {currentPage?.label || 'Dashboard'}
            </h1>
            <div className="hidden md:flex ml-8 items-center bg-surface-2 rounded-lg px-3 py-1.5 border border-border group">
              <Icon icon="solar:magnifer-linear" className="text-text-muted transition-colors group-focus-within:text-brand" />
              <input 
                type="text" 
                placeholder="Search resources..." 
                className="bg-transparent border-none focus:ring-0 text-sm w-64 placeholder:text-text-muted ml-2 text-text-primary outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button 
              onClick={() => setIsDark(!isDark)}
              className={`w-10 h-10 rounded-lg bg-surface-2 border border-border transition-all flex items-center justify-center shadow-sm ${!isDark ? 'text-brand border-brand/30' : 'text-text-muted hover:text-brand hover:border-brand/30'}`}
              title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
            >
              <Icon icon={isDark ? 'solar:sun-2-linear' : 'solar:moon-linear'} width="20" />
            </button>

            <Link
              to="/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-surface-2 border border-border text-text-primary rounded-lg text-xs font-semibold hover:bg-surface-3 transition-all flex items-center gap-2 shadow-sm"
            >
              <span className="text-brand">●</span> View Site
            </Link>
            
            <button className="relative w-10 h-10 rounded-lg bg-surface-2 border border-border text-text-muted hover:text-brand transition-all flex items-center justify-center shadow-sm">
              <Icon icon="solar:bell-linear" width="20" />
              <span className="absolute top-2 right-2 bg-brand text-white text-[8px] font-bold w-3 h-3 rounded-full flex items-center justify-center border border-surface ring-2 ring-transparent">
                3
              </span>
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar relative">
          <div className="max-w-[1600px] w-full mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
