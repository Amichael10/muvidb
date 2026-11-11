import React from 'react';
import { Icon } from '@iconify/react';
import { LIVE_STATUS_PRESETS } from './mirrorThemes';

/**
 * The "Live Line" — Mirra-Grade real-time status beacon.
 * Displays the single most important activity the creator is engaged in right now.
 */
export default function LumiLiveLine({
  statusText = 'On Set filming in Ibadan',
  category = 'on_set',
  updatedAt = 'Active now',
  onClick,
}) {
  const preset = LIVE_STATUS_PRESETS.find((p) => p.category === category) || LIVE_STATUS_PRESETS[0];

  return (
    <div
      onClick={onClick}
      className={`group relative flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border transition-all duration-300 backdrop-blur-xl select-none ${
        onClick ? 'cursor-pointer hover:scale-[1.01] active:scale-[0.99]' : ''
      } ${preset.badgeColor} shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]`}
    >
      {/* Real-time Beacon Pulse Dot */}
      <div className="relative flex items-center justify-center shrink-0 w-3 h-3">
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${preset.dotColor}`}
        />
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${preset.dotColor} shadow-sm`}
        />
      </div>

      {/* Status Label & Custom Sentence */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-wider font-bold opacity-80 shrink-0">
          {preset.label}
        </span>
        <span className="text-zinc-500 opacity-60 text-xs">•</span>
        <p className="text-xs font-medium text-white/90 truncate tracking-tight">
          {statusText}
        </p>
      </div>

      {/* Freshness Timestamp */}
      <div className="hidden sm:flex items-center gap-1 shrink-0 text-[10px] font-mono opacity-70">
        <Icon icon="solar:clock-circle-linear" width="11" />
        <span>{updatedAt}</span>
      </div>
    </div>
  );
}
