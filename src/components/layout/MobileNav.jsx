import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '@iconify/react';

const MobileNav = () => {
  const location = useLocation();

  const navItems = [
    { name: 'Home', path: '/', icon: 'solar:home-2-linear', activeIcon: 'solar:home-2-bold' },
    { name: 'Browse', path: '/browse', icon: 'solar:clapperboard-play-linear', activeIcon: 'solar:clapperboard-play-bold' },
    { name: 'Search', path: '/search', icon: 'solar:magnifer-linear', activeIcon: 'solar:magnifer-bold' },
    { name: 'Profile', path: '/dashboard', icon: 'solar:user-linear', activeIcon: 'solar:user-bold' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] lg:hidden bg-surface/80 backdrop-blur-xl border-t border-border px-4 pb-safe pt-2">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex flex-col items-center gap-1 p-2 transition-all duration-300 ${
                isActive ? 'text-brand' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <div className={`relative ${isActive ? 'scale-110' : 'scale-100'} transition-transform duration-300`}>
                <Icon 
                  icon={isActive ? item.activeIcon : item.icon} 
                  width="24" 
                  height="24"
                />
                {isActive && (
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-brand rounded-full shadow-[0_0_8px_var(--color-brand)]"></div>
                )}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
