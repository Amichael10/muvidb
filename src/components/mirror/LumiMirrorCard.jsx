import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import LumiLiveLine from './LumiLiveLine';
import LumiMirrorBackPass from './LumiMirrorBackPass';
import { downloadVCard } from '../../lib/vcard';

/**
 * Lumi Mirror Card
 * The flagship optical glass digital identity component with:
 * - 3D Card Flip to Event QR Pass
 * - Living Video / Cutout Avatar with ambient specular halo
 * - The "Live Line" real-time status beacon
 * - 1-Tap Save Contact to iOS & Android Contacts (.vcf)
 */
export default function LumiMirrorCard({
  person,
  portfolio,
  handle,
  roles,
  finish,
  liveStatusText,
  liveStatusCategory,
  onOpenLiveStatusEditor,
  avatarVideoUrl,
}) {
  const [isFlipped, setIsFlipped] = useState(false);

  const portfolioUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/@${handle}`
    : `https://muvidb.com/@${handle}`;

  const handleSaveContact = () => {
    const success = downloadVCard({
      name: person.name,
      roles: roles,
      email: portfolio.inquiry_email || person.booking_email || 'contact@muvidb.com',
      whatsapp: person.booking_whatsapp || person.booking_phone,
      website: portfolioUrl,
      bio: portfolio.tagline || person.bio,
      avatarUrl: person.photo_url,
      instagramUrl: person.instagram_url,
      twitterUrl: person.twitter_url,
      youtubeUrl: person.youtube_handle ? `https://youtube.com/@${person.youtube_handle}` : undefined,
    });

    if (success) {
      toast.success(`Contact card for ${person.name} downloaded!`, {
        icon: '📇',
        style: { background: '#141416', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' },
      });
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
      try {
        await navigator.share({
          title: `${person.name} | Lumi Mirror`,
          text: `Check out ${person.name}'s digital passport on Lumi.`,
          url: portfolioUrl,
        });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    navigator.clipboard.writeText(portfolioUrl);
    toast.success('Creator link copied to clipboard!', {
      icon: '🔗',
      style: { background: '#141416', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' },
    });
  };

  return (
    <div className="perspective-1000 w-full select-none">
      <div
        className={`relative w-full transition-transform duration-700 preserve-3d ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
      >
        {/* ===================== FRONT: OPTICAL MIRROR ===================== */}
        <div className="w-full backface-hidden">
          <section
            className={`relative rounded-3xl ${finish.cardSurface} ${finish.specularEdge} p-5 sm:p-7 overflow-hidden`}
          >
            {/* Ambient Backlight Halo Glow */}
            <div
              className={`absolute -top-24 -right-24 w-64 h-64 rounded-full bg-gradient-to-b ${finish.ambientGlow} blur-3xl opacity-50 pointer-events-none`}
            />

            {/* Top Row: Avatar on Left + Identity Info on Right */}
            <div className="relative flex items-start gap-4 z-10">
              {/* Living Video Avatar or Headshot with ambient border */}
              <div
                onClick={() => setIsFlipped(true)}
                className="relative shrink-0 cursor-pointer group"
                title="Tap to view Event QR Pass"
              >
                <div
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border border-white/25 shadow-2xl bg-zinc-900 group-hover:scale-[1.03] transition-transform duration-500 relative"
                  style={{
                    boxShadow: `0 8px 30px -4px ${finish.ringColor || 'rgba(255,255,255,0.2)'}`,
                  }}
                >
                  {avatarVideoUrl ? (
                    <video
                      src={avatarVideoUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={person.photo_url || '/placeholder-avatar.png'}
                      alt={person.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}

                  {/* 3D Flip Hint Chip on Hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-mono font-bold tracking-wider uppercase">
                    Flip Pass
                  </div>
                </div>

                {person.is_verified && (
                  <div
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center shadow-md border-2 border-black"
                    title="Verified Creator"
                  >
                    <Icon icon="solar:verified-check-bold" width="13" />
                  </div>
                )}
              </div>

              {/* Name, Roles, Handle & Action Buttons */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
                    {person.name}
                  </h1>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsFlipped(true)}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white transition active:scale-90"
                      title="Flip 3D Event Pass"
                    >
                      <Icon icon="solar:qr-code-bold" width="16" />
                    </button>
                    <button
                      type="button"
                      onClick={handleShare}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white transition active:scale-90"
                      title="Share Profile"
                    >
                      <Icon icon="solar:share-linear" width="16" />
                    </button>
                  </div>
                </div>

                {/* Primary Roles */}
                <p className="text-xs sm:text-sm font-semibold text-zinc-400 mt-0.5 truncate tracking-wide">
                  {roles}
                </p>

                {/* Bio / Tagline */}
                <p className="text-xs text-zinc-300 leading-relaxed mt-2.5 line-clamp-3">
                  {portfolio.tagline || person.bio || 'Filmmaker, Director & Creative Producer.'}
                </p>
              </div>
            </div>

            {/* The Live Line: Real-time Status Beacon */}
            <div className="mt-4 relative z-10">
              <LumiLiveLine
                statusText={liveStatusText}
                category={liveStatusCategory}
                updatedAt="Updated 1h ago"
                onClick={onOpenLiveStatusEditor}
              />
            </div>

            {/* Mirror Fast Action Bar: 1-Tap Save Contact + Flip Pass */}
            <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-2 gap-2.5 relative z-10">
              <button
                type="button"
                onClick={handleSaveContact}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs tracking-wide transition shadow-md active:scale-95 ${finish.accentBg}`}
              >
                <Icon icon="solar:user-plus-bold" width="15" />
                <span>Save Contact</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFlipped(true)}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-white transition shadow-sm active:scale-95"
              >
                <Icon icon="solar:restart-bold" width="14" />
                <span>Show QR Pass</span>
              </button>
            </div>
          </section>
        </div>

        {/* ===================== BACK: 3D HOLOGRAPHIC PASS ===================== */}
        <div className="absolute inset-0 w-full h-full rotate-y-180 backface-hidden">
          <LumiMirrorBackPass
            person={person}
            handle={handle}
            roles={roles}
            finish={finish}
            onFlipBack={() => setIsFlipped(false)}
          />
        </div>
      </div>
    </div>
  );
}
