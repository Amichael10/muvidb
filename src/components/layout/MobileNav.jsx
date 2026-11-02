import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../../context/AuthContext';

const MobileNav = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Close drawer on path change
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [location.pathname]);

  // Hide on dedicated action pages (film detail and play detail have their own floating docks)
  const isDedicatedDockPage = /^\/(films?|plays)\/[^/]+(\/)?$/.test(location.pathname);
  if (isDedicatedDockPage) return null;

  const getProfilePath = () => {
    if (!user) return '/login';
    if (user.role === 'admin' || user.role === 'admin_limited') return '/admin';
    if (user.role === 'professional') return '/pro-dashboard';
    return '/dashboard';
  };

  const navItems = [
    { name: 'Home', path: '/', icon: 'solar:home-2-linear', activeIcon: 'solar:home-2-bold' },
    { name: 'Movies', path: '/browse', icon: 'solar:clapperboard-play-linear', activeIcon: 'solar:clapperboard-play-bold' },
    { name: 'Stage', path: '/plays', icon: 'solar:masks-linear', activeIcon: 'solar:masks-bold' },
    { name: 'Box Office', path: '/box-office', icon: 'solar:ticket-linear', activeIcon: 'solar:ticket-bold' },
  ];

  const drawerItems = [
    { name: 'Search', path: '/search', icon: 'solar:magnifer-linear' },
    { name: 'People & Talent', path: '/people', icon: 'solar:users-group-two-rounded-linear' },
    { name: 'Showtimes', path: '/showtimes', icon: 'solar:calendar-date-linear' },
    { name: 'Cinemas', path: '/cinemas', icon: 'solar:videocamera-linear' },
    { name: 'TV Shows', path: '/tv-shows', icon: 'solar:tv-linear' },
    { name: 'Critics & Reviews', path: '/critics', icon: 'solar:pen-new-square-linear' },
    { name: 'Awards Hub', path: '/awards', icon: 'solar:cup-star-linear' },
    { name: 'Adv. Search', path: '/advanced-search', icon: 'solar:tuning-square-2-linear' },
    { name: 'Channels', path: '/channels', icon: 'solar:tv-linear' },
    { name: 'Companies', path: '/companies', icon: 'solar:case-linear' },
  ];

  // Check if any drawer route is currently active
  const isDrawerActive = drawerItems.some(item => 
    location.pathname === item.path || location.pathname.startsWith(item.path + '/')
  );

  return (
    <>
      {/* Drawer Backdrop */}
      {isDrawerOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[98] animate-in fade-in duration-200"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Slide-up bottom drawer sheet */}
      {isDrawerOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-[99] lg:hidden bg-[#0e1116]/95 backdrop-blur-2xl border-t border-white/10 rounded-t-3xl px-5 pt-4 pb-28 max-h-[calc(100dvh-4rem)] overflow-y-auto animate-in slide-in-from-bottom-8 duration-300 ease-out shadow-2xl">
          {/* Native Grab Handle */}
          <div className="w-12 h-1.5 bg-white/25 rounded-full mx-auto mb-4" />

          {/* Quick Profile / Member Card */}
          <div className="flex items-center justify-between p-3.5 bg-white/5 border border-white/10 rounded-2xl mb-5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-brand/20 border border-brand/40 flex items-center justify-center text-brand font-black text-sm shrink-0 overflow-hidden">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  user?.name?.charAt(0) || <Icon icon="solar:user-linear" width="20" height="20" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{user?.name || 'Guest Explorer'}</p>
                <p className="text-[10px] text-white/50 truncate">
                  {user ? (user.role === 'admin' ? 'Administrator' : user.role === 'professional' ? 'Industry Pro' : 'Verified Member') : "Join Nollywood's #1 Database"}
                </p>
              </div>
            </div>
            <Link
              to={getProfilePath()}
              className="shrink-0 px-3 py-1.5 bg-brand text-white text-xs font-bold rounded-xl shadow-xs hover:bg-brand/90 transition"
            >
              {user ? 'My Profile' : 'Sign In'}
            </Link>
          </div>
          
          <h3 className="text-xs font-bold text-white/70 uppercase tracking-wider text-center mb-4">
            Explore MuviDB
          </h3>

          {/* 2-Column Responsive Grid */}
          <div className="grid grid-cols-2 gap-2.5 max-w-md mx-auto">
            {drawerItems.map((item) => {
              const isItemActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center gap-3 p-3 border rounded-2xl transition-all duration-200 active:scale-95 min-h-[46px] ${
                    isItemActive 
                      ? 'bg-brand/15 border-brand/50 text-brand shadow-lg shadow-brand/10' 
                      : 'bg-white/5 border-white/15 text-white hover:border-brand/40 hover:bg-white/10'
                  }`}
                >
                  <div className={`p-1.5 rounded-xl shrink-0 ${isItemActive ? 'bg-brand/20 text-brand' : 'bg-white/10 text-white/80'}`}>
                    <Icon icon={item.icon} width="18" height="18" />
                  </div>
                  <span className="text-xs font-bold truncate">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Bottom Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-[100] lg:hidden bg-surface/95 backdrop-blur-xl border-t border-border px-2 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_25px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-0.5 p-1 min-h-[44px] min-w-[54px] transition-all duration-300 ${
                  isActive ? (item.path === '/plays' ? 'text-purple-400 font-black' : 'text-brand font-black') : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <div className={`relative ${isActive ? 'scale-110' : 'scale-100'} transition-transform duration-300`}>
                  <Icon 
                    icon={isActive ? item.activeIcon : item.icon} 
                    width="21" 
                    height="21" 
                  />
                  {isActive && (
                    <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                      item.path === '/plays' ? 'bg-purple-400 shadow-[0_0_8px_#c084fc]' : 'bg-brand shadow-[0_0_8px_var(--color-brand)]'
                    }`}></div>
                  )}
                </div>
                <span className="text-[10px] font-bold tracking-tight">{item.name}</span>
              </Link>
            );
          })}

          {/* More / Explore Drawer Toggle */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className={`flex flex-col items-center justify-center gap-0.5 p-1 min-h-[44px] min-w-[54px] transition-all duration-300 ${
              isDrawerOpen || isDrawerActive ? 'text-brand font-black' : 'text-text-secondary hover:text-text-primary'
            }`}
            aria-label="More navigation options"
          >
            <div className={`relative ${isDrawerOpen || isDrawerActive ? 'scale-110' : 'scale-100'} transition-transform duration-300`}>
              <Icon 
                icon={isDrawerOpen ? 'solar:hamburger-menu-bold' : 'solar:hamburger-menu-linear'} 
                width="21" 
                height="21" 
              />
              {(isDrawerOpen || isDrawerActive) && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-brand rounded-full shadow-[0_0_8px_var(--color-brand)]"></div>
              )}
            </div>
            <span className="text-[10px] font-bold tracking-tight">More</span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default MobileNav;
