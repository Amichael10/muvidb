import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';

/**
 * Mirra Floating Frosted AI Prompt Bar
 * Features:
 * - Ultra-frosted glass background with specular 1px top highlight
 * - Ambient indigo/cyan radial glow in the center of the input
 * - Interactive mic and submit arrow controls
 */
export default function MirraPromptBar({
  placeholder = 'Ask me anything...',
  creatorName = 'Creator',
  onAsk,
}) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    if (onAsk) {
      onAsk(query);
    } else {
      toast.success(`Prompting Lumi AI about ${creatorName}...`, {
        icon: '✨',
        style: { background: '#121318', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' },
      });
    }
    setQuery('');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`relative w-full rounded-2xl transition-all duration-300 backdrop-blur-3xl overflow-hidden ${
        isFocused
          ? 'bg-black/60 border border-white/40 shadow-[0_10px_30px_rgba(0,180,255,0.25)]'
          : 'bg-black/35 hover:bg-black/45 border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_12px_32px_rgba(0,0,0,0.5)]'
      }`}
    >
      {/* Signature Mirra Ambient Radial Glow in the center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-12 bg-gradient-to-r from-cyan-500/20 via-blue-500/25 to-indigo-500/20 blur-xl pointer-events-none opacity-80" />

      <div className="relative z-10 flex items-center justify-between px-4 py-3 gap-2">
        <input
          type="text"
          value={query}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-white placeholder-zinc-300 text-xs sm:text-sm font-medium focus:outline-none tracking-tight"
        />

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              toast('Voice input listening...', { icon: '🎙️' });
            }}
            className="p-1 text-zinc-300 hover:text-white transition active:scale-90"
            title="Voice prompt"
          >
            <Icon icon="solar:microphone-3-bold" width="16" />
          </button>

          <button
            type="submit"
            className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 border border-white/30 flex items-center justify-center text-white transition active:scale-90 shadow-sm"
            title="Send prompt"
          >
            <Icon icon="solar:arrow-up-linear" width="14" />
          </button>
        </div>
      </div>
    </form>
  );
}
