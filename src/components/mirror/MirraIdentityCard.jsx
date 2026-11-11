import React from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { downloadVCard } from '../../lib/vcard';

/**
 * Mirra Floating Liquid Glass Identity Card
 * Exact replication of Mirra's signature floating identity card with:
 * - Circular avatar thumbnail
 * - Name with verified badge & dynamic role
 * - Sparkline activity indicator & connection count
 * - 5-button tactile glass action bar (DM, Share Contact, Phone, WhatsApp, Email)
 */
export default function MirraIdentityCard({
  person,
  portfolio,
  handle,
  roles,
  connectionsCount = '287',
  onFlipPass,
  onOpenInquiry,
}) {
  const portfolioUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/@${handle}`
    : `https://muvidb.com/@${handle}`;

  const handleShareContact = () => {
    const success = downloadVCard({
      name: person.name,
      roles: roles,
      email: portfolio?.inquiry_email || person.booking_email || 'contact@muvidb.com',
      whatsapp: person.booking_whatsapp || person.booking_phone,
      website: portfolioUrl,
      bio: portfolio?.tagline || person.bio,
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
    }

    if (onFlipPass) {
      // Also trigger 3D pass flip for in-person demonstration
      onFlipPass();
    }
  };

  const handleCall = () => {
    const phone = person.booking_phone || person.booking_whatsapp;
    if (phone) {
      window.location.href = `tel:${phone.replace(/[^\d+]/g, '')}`;
    } else {
      toast('Booking contact available via inquiry', { icon: '📞' });
    }
  };

  const handleWhatsApp = () => {
    const wa = person.booking_whatsapp || person.booking_phone;
    if (wa) {
      window.open(
        `https://wa.me/${wa.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
          `Hello ${person.name}, I am reaching out regarding a production project via Lumi Mirror.`
        )}`,
        '_blank'
      );
    } else {
      toast('WhatsApp direct line not configured', { icon: '💬' });
    }
  };

  const handleEmail = () => {
    const email = portfolio?.inquiry_email || person.booking_email;
    if (email) {
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(
        `Project Inquiry for ${person.name}`
      )}`;
    } else if (onOpenInquiry) {
      onOpenInquiry();
    }
  };

  return (
    <section className="relative w-full rounded-[28px] bg-black/45 backdrop-blur-3xl border border-white/20 p-4 sm:p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.45),0_20px_45px_-12px_rgba(0,0,0,0.85)] text-white select-none">
      {/* Top Row: Mini Avatar, Name + Role, Sparkline Connections */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Circular Headshot */}
          <div
            onClick={onFlipPass}
            className="w-11 h-11 rounded-full overflow-hidden border border-white/30 shadow-md bg-zinc-900 shrink-0 cursor-pointer hover:scale-105 transition"
            title="Tap to flip Event QR pass"
          >
            <img
              src={person.photo_url || '/placeholder-avatar.png'}
              alt={person.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Name & Role Subtitle */}
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-1.5 truncate">
              <span>{person.name}</span>
              <Icon
                icon="solar:verified-check-bold"
                className="text-[#00A3FF] text-sm shrink-0"
                title="Verified Persona"
              />
            </h2>
            <p className="text-[11px] sm:text-xs text-zinc-300 font-medium truncate mt-0.5">
              {roles}
            </p>
          </div>
        </div>

        {/* Right: Sparkline + Connections count */}
        <div className="flex flex-col items-end shrink-0 pl-2">
          <div className="flex items-center gap-1 text-zinc-300">
            <Icon icon="solar:chart-2-bold" className="text-xs opacity-75" />
            <span className="text-xs font-mono font-bold text-white tracking-tight">
              {connectionsCount}
            </span>
          </div>
          <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400">
            Connections
          </span>
        </div>
      </div>

      {/* Bottom Row: Tactile Glass Action Bar (5 Controls) */}
      <div className="flex items-center gap-2">
        {/* Button 1: DM */}
        <button
          type="button"
          onClick={onOpenInquiry || handleEmail}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-xs font-semibold text-white transition active:scale-95 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] shrink-0"
        >
          <Icon icon="solar:plain-bold" width="13" />
          <span>DM</span>
        </button>

        {/* Button 2: Share Contact (Hero Action) */}
        <button
          type="button"
          onClick={handleShareContact}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-white/[0.14] hover:bg-white/[0.22] border border-white/25 text-xs font-bold text-white transition active:scale-95 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_6px_16px_rgba(0,0,0,0.4)] truncate"
          title="Download vCard & view QR pass"
        >
          <Icon icon="solar:user-plus-bold" width="14" className="shrink-0" />
          <span className="truncate">Share Contact</span>
        </button>

        {/* Button 3: Phone */}
        <button
          type="button"
          onClick={handleCall}
          className="w-10 h-10 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 flex items-center justify-center text-zinc-300 hover:text-white transition active:scale-95 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] shrink-0"
          title="Call representative"
        >
          <Icon icon="solar:phone-bold" width="15" />
        </button>

        {/* Button 4: WhatsApp / Chat */}
        <button
          type="button"
          onClick={handleWhatsApp}
          className="w-10 h-10 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 flex items-center justify-center text-zinc-300 hover:text-white transition active:scale-95 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] shrink-0"
          title="Chat on WhatsApp"
        >
          <Icon icon="solar:chat-round-dots-bold" width="16" />
        </button>

        {/* Button 5: Email */}
        <button
          type="button"
          onClick={handleEmail}
          className="w-10 h-10 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 flex items-center justify-center text-zinc-300 hover:text-white transition active:scale-95 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] shrink-0"
          title="Send email"
        >
          <Icon icon="solar:letter-bold" width="15" />
        </button>
      </div>
    </section>
  );
}
