import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';

/**
 * Mirra Social Proof & Industry Footprint Row
 * Displays:
 * - `+ Connect` action
 * - Overlapping collaborator/mutual avatar stack
 * - Mutual collaborators count and total community connections
 * - `See all >` action
 */
export default function MirraConnectRow({
  creatorName = 'Creator',
  mutualsList = 'Kunle Afolayan, Bimbo Ademoye, Lateef Adedimeji... +45 mutuals',
  totalConnections = '105.8K Lumi Connections',
  avatars = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
  ],
  onSeeAll,
}) {
  const [isConnected, setIsConnected] = useState(false);

  const handleConnect = () => {
    setIsConnected(!isConnected);
    if (!isConnected) {
      toast.success(`Connected with ${creatorName}!`, {
        icon: '🤝',
        style: { background: '#121318', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' },
      });
    }
  };

  return (
    <div className="w-full flex items-center justify-between gap-3 px-1 py-1 select-none">
      {/* Left: + Connect Button */}
      <button
        type="button"
        onClick={handleConnect}
        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all active:scale-95 shrink-0 ${
          isConnected
            ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
            : 'bg-white/10 hover:bg-white/15 border border-white/15 text-white shadow-sm'
        }`}
      >
        <Icon icon={isConnected ? 'solar:check-circle-bold' : 'solar:user-plus-bold'} width="14" />
        <span>{isConnected ? 'Connected' : 'Connect'}</span>
      </button>

      {/* Middle: Mutual Avatars + Description */}
      <div className="flex-1 min-w-0 flex items-center gap-2.5">
        {/* Overlapping Stack of Mutuals */}
        <div className="flex items-center -space-x-2 shrink-0">
          {avatars.map((img, i) => (
            <div
              key={i}
              className="w-6 h-6 rounded-full overflow-hidden border-2 border-black bg-zinc-800 shadow-sm"
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>

        {/* Text Details */}
        <div className="min-w-0">
          <p className="text-[11px] text-zinc-300 font-medium truncate leading-tight">
            {mutualsList}
          </p>
          <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
            {totalConnections}
          </p>
        </div>
      </div>

      {/* Right: See All Link */}
      <button
        type="button"
        onClick={onSeeAll || (() => toast('Viewing all industry credits and connections', { icon: '👥' }))}
        className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 shrink-0 font-medium transition"
      >
        <span>See all</span>
        <Icon icon="solar:alt-arrow-right-linear" width="11" />
      </button>
    </div>
  );
}
