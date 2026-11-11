import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { MIRROR_FINISHES, LIVE_STATUS_PRESETS } from './mirrorThemes';

/**
 * Lumi Mirror Interactive Sandbox Toolbar
 * Allows real-time switching of optical finishes, live statuses,
 * and testing across different creator handles.
 */
export default function LumiMirrorToolbar({
  activeFinish,
  onSelectFinish,
  activeStatusKey,
  onSelectStatus,
  onCustomStatusChange,
  currentStatusText,
  creatorHandle,
  onSelectCreator,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [customInput, setCustomInput] = useState(currentStatusText);

  const FEATURED_CREATORS = [
    { handle: 'tope-adebayo', name: 'Tope Adebayo' },
    { handle: 'lateef-adedimeji', name: 'Lateef Adedimeji' },
    { handle: 'kunle-afolayan', name: 'Kunle Afolayan' },
    { handle: 'funke-akindele', name: 'Funke Akindele' },
    { handle: 'end-to-end-test', name: 'Test Portfolio' },
  ];

  return (
    <header className="sticky top-3 z-40 max-w-xl mx-auto px-4 mb-4 select-none">
      <div className="rounded-2xl bg-black/85 backdrop-blur-2xl border border-white/20 p-3 shadow-2xl">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse shrink-0" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-white truncate">
              LUMI MIRROR LAB
            </span>
            <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-zinc-400">
              Isolated Preview
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-white font-medium transition"
          >
            <Icon icon="solar:settings-linear" width="13" />
            <span>{isExpanded ? 'Hide Controls' : 'Customize Mirror'}</span>
            <Icon
              icon="solar:alt-arrow-down-linear"
              className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
              width="12"
            />
          </button>
        </div>

        {/* Expandable Controls Panel */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-white/10 space-y-3 animate-in fade-in duration-200">
            {/* Control 1: Optical Finishes */}
            <div>
              <span className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                Optical Glass Finish
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {Object.values(MIRROR_FINISHES).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onSelectFinish(f.id)}
                    className={`px-2 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition border ${
                      activeFinish.id === f.id
                        ? `${f.accentBg} border-white shadow-md`
                        : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: f.dotColor }}
                    />
                    <span className="truncate">{f.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Control 2: Live Status Presets */}
            <div>
              <span className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                "Live Line" Status Beacon
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {LIVE_STATUS_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => {
                      onSelectStatus(preset.key);
                      setCustomInput(preset.defaultText);
                    }}
                    className={`px-2 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition border ${
                      activeStatusKey === preset.key
                        ? 'bg-brand/20 border-brand text-brand'
                        : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    <Icon icon={preset.icon} width="12" className="shrink-0" />
                    <span className="truncate">{preset.label}</span>
                  </button>
                ))}
              </div>

              {/* Custom Status Text Input */}
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Custom sentence on your mirror..."
                  className="flex-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs focus:outline-none focus:border-brand"
                />
                <button
                  type="button"
                  onClick={() => onCustomStatusChange(customInput)}
                  className="px-3 py-1.5 rounded-xl bg-brand text-white font-bold text-xs hover:brightness-110 active:scale-95 transition"
                >
                  Set
                </button>
              </div>
            </div>

            {/* Control 3: Creator Profile Switcher */}
            <div>
              <span className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                Switch Creator Persona
              </span>
              <div className="flex flex-wrap gap-1.5">
                {FEATURED_CREATORS.map((c) => (
                  <button
                    key={c.handle}
                    type="button"
                    onClick={() => onSelectCreator(c.handle)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-medium transition border ${
                      creatorHandle === c.handle
                        ? 'bg-white text-black border-white'
                        : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
