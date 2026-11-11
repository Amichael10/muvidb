import React from 'react';

/**
 * High-fidelity Smartphone Device Wrapper
 * Provides an authentic iPhone 16 Pro bezel on desktop while
 * expanding to native full-bleed edge-to-edge on mobile screens.
 */
export default function MirraPhoneFrame({ children }) {
  return (
    <div className="w-full min-h-screen flex items-center justify-center p-0 sm:py-8 sm:px-4">
      {/* Phone Shell on Desktop (Max-w 420px, 860px height or auto) */}
      <div className="w-full sm:max-w-[420px] sm:rounded-[52px] bg-black sm:border-[10px] sm:border-[#22242B] sm:shadow-[0_25px_70px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.15)] relative overflow-hidden flex flex-col">
        {/* iOS Native Status Bar */}
        <div className="relative z-30 pt-3 pb-1 px-6 flex items-center justify-between text-white text-xs font-semibold select-none">
          {/* Time */}
          <span className="font-mono text-[13px] tracking-tight">4:16</span>

          {/* Dynamic Island Pill Cutout */}
          <div className="hidden sm:block w-24 h-5 rounded-full bg-black border border-white/10 shadow-inner" />

          {/* Right Status Icons: Cell Signal, WiFi, Battery */}
          <div className="flex items-center gap-1.5 text-zinc-200">
            {/* Cellular */}
            <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor">
              <rect x="0" y="8" width="2.5" height="3" rx="0.5" />
              <rect x="4" y="6" width="2.5" height="5" rx="0.5" />
              <rect x="8" y="3" width="2.5" height="8" rx="0.5" />
              <rect x="12" y="0" width="2.5" height="11" rx="0.5" />
            </svg>
            {/* WiFi */}
            <svg width="14" height="11" viewBox="0 0 16 12" fill="currentColor">
              <path d="M8 9.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-3.5-3a5 5 0 0 1 7 0l-1.2 1.2a3.3 3.3 0 0 0-4.6 0L4.5 6.5zm-3-3a9.5 9.5 0 0 1 13 0l-1.2 1.2a7.8 7.8 0 0 0-10.6 0L1.5 3.5z" />
            </svg>
            {/* Battery */}
            <div className="w-5 h-2.5 rounded-sm border border-current p-0.5 flex items-center">
              <div className="w-full h-full bg-current rounded-xs" />
            </div>
          </div>
        </div>

        {/* Scrollable Screen Content */}
        <div className="w-full flex-1 overflow-y-auto no-scrollbar relative">
          {children}
        </div>
      </div>
    </div>
  );
}
