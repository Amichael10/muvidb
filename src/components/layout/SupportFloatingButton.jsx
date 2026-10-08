import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '@iconify/react';

export default function SupportFloatingButton() {
  const location = useLocation();

  // Don't show on support page or admin pages
  if (location.pathname.startsWith('/support') || location.pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <Link
      to="/support"
      className="fixed bottom-20 left-4 sm:bottom-7 sm:left-7 z-[95] group flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-surface/95 hover:bg-brand border border-border hover:border-brand text-text-primary hover:text-white shadow-[0_6px_25px_rgba(0,0,0,0.5)] hover:shadow-[0_8px_30px_rgba(255,90,31,0.4)] backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95"
      title="Support MuviDB"
      aria-label="Support MuviDB"
    >
      <Icon
        icon="solar:heart-bold"
        className="w-5 h-5 text-brand group-hover:text-white transition-all duration-300 group-hover:scale-110"
      />
      <span className="text-xs font-heading font-bold uppercase tracking-wider text-text-primary group-hover:text-white transition-colors">
        Support
      </span>
    </Link>
  );
}
