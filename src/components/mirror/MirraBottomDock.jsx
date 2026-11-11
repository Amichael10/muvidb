import React from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';

/**
 * Mirra Floating Frosted Bottom Navigation Dock
 * Anchored to the bottom of the phone viewport with:
 * - Mini profile avatar
 * - Industry network / community
 * - DM Paper Plane with neon unread notification pill
 * - Chat thread
 * - Search icon
 */
export default function MirraBottomDock({
  avatarUrl,
  notificationCount = '12',
  onSelectTab,
}) {
  return (
    <div className="fixed bottom-5 inset-x-0 flex justify-center z-40 px-4 pointer-events-none">
      <nav
        className="pointer-events-auto flex items-center justify-between gap-4 sm:gap-6 px-4 py-2.5 rounded-full bg-black/55 backdrop-blur-3xl border border-white/25 shadow-[inset_0_1px_1px_rgba(255,255,255,0.45),0_20px_40px_rgba(0,0,0,0.8)] text-white select-none"
      >
        {/* Tab 1: Creator Avatar / Profile */}
        <button
          type="button"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            toast('Creator Passport', { icon: '🪞' });
          }}
          className="p-1 rounded-full hover:scale-110 active:scale-95 transition"
          title="Profile"
        >
          <div className="w-6 h-6 rounded-full overflow-hidden border border-white/40 bg-zinc-800">
            <img src={avatarUrl || '/placeholder-avatar.png'} alt="" className="w-full h-full object-cover" />
          </div>
        </button>

        {/* Tab 2: Community / Network */}
        <button
          type="button"
          onClick={() => toast('Industry Collaborations & Network', { icon: '👥' })}
          className="text-zinc-400 hover:text-white transition active:scale-90"
          title="Network"
        >
          <Icon icon="solar:users-group-two-rounded-linear" width="20" />
        </button>

        {/* Tab 3: Direct Messages (With Neon Notification Badge) */}
        <button
          type="button"
          onClick={() => toast('Direct Inquiries & Messages', { icon: '✈️' })}
          className="relative text-zinc-300 hover:text-white transition active:scale-90"
          title="Direct Messages"
        >
          <Icon icon="solar:plain-bold" width="20" />
          {notificationCount && (
            <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-[#E5FF00] text-black font-mono font-black text-[9px] flex items-center justify-center shadow-[0_0_10px_rgba(229,255,0,0.6)]">
              {notificationCount}
            </span>
          )}
        </button>

        {/* Tab 4: Chat / Thread */}
        <button
          type="button"
          onClick={() => toast('Live Conversations', { icon: '💬' })}
          className="text-zinc-400 hover:text-white transition active:scale-90"
          title="Chat"
        >
          <Icon icon="solar:chat-round-line-linear" width="20" />
        </button>

        {/* Tab 5: Search */}
        <button
          type="button"
          onClick={() => toast('Search Nollywood & African Talents', { icon: '🔍' })}
          className="text-zinc-400 hover:text-white transition active:scale-90"
          title="Search"
        >
          <Icon icon="solar:magnifer-linear" width="20" />
        </button>
      </nav>
    </div>
  );
}
