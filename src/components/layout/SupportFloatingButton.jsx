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
        className="fixed bottom-20 left-4 sm:bottom-6 sm:left-6 z-40 p-3 bg-surface/90 hover:bg-surface border border-rose-500/30 hover:border-rose-500 text-rose-400 rounded-full shadow-2xl backdrop-blur-md transition-all duration-300 hover:scale-110 active:scale-95 group"
        title="Support the Archive"
        aria-label="Open Support the Archive"
      >
        <Icon icon="solar:heart-bold" className="w-5 h-5 text-rose-500 animate-pulse" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 left-4 sm:bottom-6 sm:left-6 z-40 flex items-center gap-2 group animate-in fade-in slide-in-from-bottom-3 duration-300">
      <Link
        to="/support"
        className="relative flex items-center gap-3 pl-3.5 pr-4 py-2.5 rounded-full bg-[#0F1216]/95 hover:bg-[#14181E] border border-rose-500/30 hover:border-rose-500/60 shadow-[0_8px_30px_rgb(0,0,0,0.6)] backdrop-blur-md transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] group/btn"
      >
        {/* Glow backdrop */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-rose-500/20 to-amber-500/20 rounded-full blur opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 -z-10" />

        <div className="w-7 h-7 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0 text-rose-400 group-hover/btn:bg-rose-500 group-hover/btn:text-white transition-colors duration-300 shadow-inner">
          <Icon icon="solar:heart-angle-bold" className="w-4 h-4 transition-transform group-hover/btn:scale-110" />
        </div>

        <div className="flex flex-col text-left pr-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-white tracking-wide group-hover/btn:text-rose-200 transition-colors">
              Support the Archive
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping opacity-75" />
          </div>
          <span className="text-[10px] text-text-muted font-medium tracking-tight">
            Help keep MuviDB free
          </span>
        </div>
      </Link>

      {/* Minimize button */}
      <button
        onClick={() => setMinimized(true)}
        className="w-6 h-6 rounded-full bg-surface/80 hover:bg-surface border border-border/80 text-text-muted hover:text-white flex items-center justify-center shadow-md backdrop-blur-sm transition-all duration-200 hover:scale-105"
        title="Minimize"
        aria-label="Minimize support button"
      >
        <Icon icon="solar:close-circle-linear" className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
