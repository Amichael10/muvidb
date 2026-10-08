import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '@iconify/react';

export default function SupportFloatingButton() {
  const location = useLocation();
  const [minimized, setMinimized] = useState(false);

  // Don't show on support page or admin pages
  if (location.pathname.startsWith('/support') || location.pathname.startsWith('/admin')) {
    return null;
  }

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-20 left-3 sm:bottom-6 sm:left-6 z-40 p-3 bg-surface/95 hover:bg-surface-2 border border-brand/40 hover:border-brand text-brand rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.8)] backdrop-blur-md transition-all duration-300 hover:scale-110 active:scale-95 group"
        title="Support the Archive"
        aria-label="Open Support the Archive"
      >
        <Icon icon="solar:heart-bold" className="w-5 h-5 text-brand group-hover:scale-110 transition-transform" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 left-3 sm:bottom-6 sm:left-6 z-40 flex items-center gap-2 group animate-in fade-in slide-in-from-bottom-3 duration-300">
      <Link
        to="/support"
        className="relative flex items-center gap-3 pl-3.5 pr-4 py-2.5 rounded-xl bg-surface/95 hover:bg-surface-2 border border-brand/35 hover:border-brand shadow-[0_10px_35px_rgba(0,0,0,0.75)] backdrop-blur-md transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group/btn"
      >
        {/* Subtle Brand Amber-Orange Glow */}
        <div className="absolute -inset-0.5 bg-brand/15 rounded-xl blur-sm opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 -z-10" />

        <div className="w-7 h-7 rounded-lg bg-brand/15 border border-brand/30 flex items-center justify-center shrink-0 text-brand group-hover/btn:bg-brand group-hover/btn:text-white transition-colors duration-200">
          <Icon icon="solar:heart-bold" className="w-4 h-4 transition-transform group-hover/btn:scale-110" />
        </div>

        <div className="flex flex-col text-left pr-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-white tracking-wide group-hover/btn:text-brand transition-colors">
              Support the Archive
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-ping opacity-75" />
          </div>
          <span className="text-[10px] text-text-muted font-medium tracking-tight">
            Help keep MuviDB 100% free
          </span>
        </div>
      </Link>

      {/* Minimize button */}
      <button
        onClick={() => setMinimized(true)}
        className="w-6 h-6 rounded-lg bg-surface/90 hover:bg-surface border border-border text-text-muted hover:text-white flex items-center justify-center shadow-md backdrop-blur-sm transition-all duration-200 hover:scale-105"
        title="Minimize"
        aria-label="Minimize support badge"
      >
        <Icon icon="solar:close-circle-linear" className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
