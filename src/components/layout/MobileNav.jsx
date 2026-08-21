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

  const getProfilePath = () => {
    if (!user) return '/login';
    if (user.role === 'admin' || user.role === 'admin_limited') return '/admin';
    if (user.role === 'professional') return '/pro-dashboard';
    return '/dashboard';
  };

  const navItems = [
    { name: 'Home', path: '/', icon: 'solar:home-2-linear', activeIcon: 'solar:home-2-bold' },
    { name: 'Movies', path: '/browse', icon: 'solar:clapperboard-play-linear', activeIcon: 'solar:clapperboard-play-bold' },
    { name: 'Search', path: '/search', icon: 'solar:magnifer-linear', activeIcon: 'solar:magnifer-bold' },
  ];

  const drawerItems = [
    { name: 'TV Shows', path: '/tv-shows', icon: 'solar:tv-linear' },
    { name: 'Showtimes', path: '/showtimes', icon: 'solar:calendar-date-linear' },
    { name: 'Cinemas', path: '/cinemas', icon: 'solar:videocamera-linear' },
    { name: 'Channels', path: '/channels', icon: 'solar:tv-linear' },
    { name: 'People', path: '/people', icon: 'solar:users-group-two-rounded-linear' },
    { name: 'Critics', path: '/critics', icon: 'solar:pen-new-square-linear' },
    { name: 'Theatre', path: '/plays', icon: 'solar:masks-linear' },
    { name: 'Awards', path: '/awards', icon: 'solar:cup-star-linear' },
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
        <div className="fixed bottom-0 left-0 right-0 z-[99] lg:hidden bg-black/90 backdrop-blur-2xl border-t border-white/10 rounded-t-3xl px-6 pt-4 pb-28 max-h-[calc(100dvh-4rem)] overflow-y-auto animate-in slide-in-from-bottom-8 duration-300 ease-out">
          {/* Native Grab Handle */}
          <div className="w-12 h-1.5 bg-white/25 rounded-full mx-auto mb-6" />
          
          <h3 className="text-xs font-bold text-white/70 uppercase tracking-wider text-center mb-6">
            Explore MuviDB
          </h3>

          {/* 2-Column Responsive Grid */}
          <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
            {drawerItems.map((item) => {
              const isItemActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center gap-3 p-3.5 border rounded-2xl transition-all duration-200 active:scale-95 min-h-[48px] ${
                    isItemActive 
                      ? 'bg-brand/15 border-brand/50 text-brand shadow-lg shadow-brand/10' 
                      : 'bg-white/5 border-white/15 text-white hover:border-brand/40 hover:bg-white/10'
                  }`}
                >
                  <div className={`p-2 rounded-xl ${isItemActive ? 'bg-brand/20 text-brand' : 'bg-white/10 text-white/80'}`}>
                    <Icon icon={item.icon} width="20" height="20" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Bottom Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-[100] lg:hidden bg-surface/90 backdrop-blur-xl border-t border-border px-3 pb-safe pt-1.5 shadow-2xl">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-1 p-1.5 min-h-[48px] min-w-[56px] transition-all duration-300 ${
                  isActive ? 'text-brand font-bold' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <div className={`relative ${isActive ? 'scale-110' : 'scale-100'} transition-transform duration-300`}>
                  <Icon 
                    icon={isActive ? item.activeIcon : item.icon} 
                    width="22" 
                    height="22"
                  />
                  {isActive && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-brand rounded-full shadow-[0_0_8px_var(--color-brand)]"></div>
                  )}
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider">{item.name}</span>
              </Link>
            );
          })}

          {/* More Button */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className={`flex flex-col items-center justify-center gap-1 p-1.5 min-h-[48px] min-w-[56px] transition-all duration-300 ${
              isDrawerOpen || isDrawerActive ? 'text-brand font-bold' : 'text-text-secondary hover:text-text-primary'
            }`}
            aria-label="More navigation options"
          >
            <div className={`relative ${isDrawerOpen || isDrawerActive ? 'scale-110' : 'scale-100'} transition-transform duration-300`}>
              <Icon 
                icon={isDrawerOpen ? 'solar:hamburger-menu-bold' : 'solar:hamburger-menu-linear'} 
                width="22" 
                height="22"
              />
              {(isDrawerOpen || isDrawerActive) && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-brand rounded-full shadow-[0_0_8px_var(--color-brand)]"></div>
              )}
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider">More</span>
          </button>

          {/* Profile Button */}
          <Link
            to={getProfilePath()}
            className={`flex flex-col items-center justify-center gap-1 p-1.5 min-h-[48px] min-w-[56px] transition-all duration-300 ${
              location.pathname === getProfilePath() ? 'text-brand font-bold' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <div className={`relative ${location.pathname === getProfilePath() ? 'scale-110' : 'scale-100'} transition-transform duration-300`}>
              <Icon 
                icon={location.pathname === getProfilePath() ? 'solar:user-bold' : 'solar:user-linear'} 
                width="22" 
                height="22"
              />
              {location.pathname === getProfilePath() && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-brand rounded-full shadow-[0_0_8px_var(--color-brand)]"></div>
              )}
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider">Profile</span>
          </Link>
        </div>
      </nav>
    </>
  );
};

export default MobileNav;
