import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { downloadVCard } from '../../lib/vcard';

/**
 * Lumi Mirror Back Pass (Event & Red Carpet 3D Reverse View)
 * Displays a high-contrast holographic QR code for instant camera scan,
 * AirDrop sharing, and 1-tap vCard contact download.
 */
export default function LumiMirrorBackPass({
  person,
  handle,
  roles,
  finish,
  onFlipBack,
}) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const portfolioUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/@${handle}`
    : `https://muvidb.com/@${handle}`;

  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(portfolioUrl, {
      width: 320,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch((err) => console.error('Failed to generate pass QR:', err));

    return () => {
      isMounted = false;
    };
  }, [portfolioUrl]);

  const handleSaveContact = () => {
    const success = downloadVCard({
      name: person.name,
      roles: roles,
      email: person.booking_email || 'contact@muvidb.com',
      whatsapp: person.booking_whatsapp || person.booking_phone,
      website: portfolioUrl,
      bio: person.bio,
      avatarUrl: person.photo_url,
      instagramUrl: person.instagram_url,
      twitterUrl: person.twitter_url,
      youtubeUrl: person.youtube_handle ? `https://youtube.com/@${person.youtube_handle}` : undefined,
    });

    if (success) {
      toast.success(`Contact card for ${person.name} ready!`, {
        icon: '📇',
        style: { background: '#141416', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' },
      });
    } else {
      toast.error('Could not generate contact file.');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(portfolioUrl);
    toast.success('Link copied to clipboard!', {
      icon: '🔗',
      style: { background: '#141416', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' },
    });
  };

  return (
    <div
      className={`relative w-full rounded-3xl ${finish.cardSurface} ${finish.specularEdge} p-6 sm:p-8 flex flex-col items-center justify-between min-h-[460px] text-center overflow-hidden`}
    >
      {/* Subtle Holographic Grid Pattern Backdrop */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none select-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Top Bar: Pass Title & Flip Back Action */}
      <div className="w-full flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
          <span className="text-[11px] font-mono tracking-widest uppercase font-bold text-zinc-400">
            LUMI EVENT PASS
          </span>
        </div>

        <button
          type="button"
          onClick={onFlipBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs text-white font-medium transition active:scale-95 shadow-sm"
          title="Flip back to profile"
        >
          <Icon icon="solar:restart-bold" width="13" />
          <span>Flip Front</span>
        </button>
      </div>

      {/* Middle: Creator Summary & High-Contrast QR Code */}
      <div className="relative z-10 my-4 flex flex-col items-center">
        {/* Creator Mini Identity */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl overflow-hidden border border-white/20 shadow-md bg-zinc-900 shrink-0">
            <img
              src={person.photo_url || '/placeholder-avatar.png'}
              alt={person.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-left">
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>{person.name}</span>
              {person.is_verified && (
                <Icon icon="solar:verified-check-bold" className="text-brand text-sm shrink-0" />
              )}
            </h3>
            <p className="text-xs text-zinc-400 font-mono">@{handle}</p>
          </div>
        </div>

        {/* The Holographic QR Target Box */}
        <div className="relative p-3.5 bg-white rounded-2xl shadow-2xl border-4 border-white/80 group">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR Code for ${person.name}`}
              className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-lg"
            />
          ) : (
            <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center bg-zinc-100 text-zinc-400">
              <Icon icon="solar:qr-code-bold" width="40" />
            </div>
          )}

          {/* Center Lumi Logo Shield */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 rounded-xl bg-black border-2 border-white flex items-center justify-center shadow-lg">
              <span className="text-xs font-black text-brand tracking-tighter">LM</span>
            </div>
          </div>
        </div>

        <p className="text-[11px] font-mono text-zinc-400 mt-3 flex items-center gap-1.5">
          <Icon icon="solar:camera-minimalistic-bold" className="text-brand text-xs" />
          <span>Point any smartphone camera to scan</span>
        </p>
      </div>

      {/* Bottom Action Grid: 1-Tap Save Contact + Copy Link */}
      <div className="w-full grid grid-cols-2 gap-2.5 relative z-10 pt-2">
        <button
          type="button"
          onClick={handleSaveContact}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-xs tracking-wide transition shadow-lg active:scale-95 ${finish.accentBg}`}
        >
          <Icon icon="solar:user-plus-bold" width="16" />
          <span>Save Contact</span>
        </button>

        <button
          type="button"
          onClick={handleCopyLink}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-xs bg-white/10 hover:bg-white/15 border border-white/20 text-white transition shadow-sm active:scale-95"
        >
          <Icon icon="solar:link-minimalistic-2-bold" width="16" />
          <span>Copy URL</span>
        </button>
      </div>
    </div>
  );
}
