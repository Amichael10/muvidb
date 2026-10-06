import React from 'react';
import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../ui/ImageWithFallback';
import { toTitleCase } from '../../utils/format';

export default function BookingModal({
  isOpen,
  onClose,
  person,
  representations = []
}) {
  if (!isOpen || !person) return null;

  const rawPhone = person.booking_whatsapp || person.booking_phone || '';
  const cleanPhone = rawPhone.replace(/\D/g, '');
  const hasDirectContacts = Boolean(person.booking_whatsapp || person.booking_phone || person.booking_email);
  const hasAgencies = Boolean(representations && representations.length > 0);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'available':
        return { label: 'Available for Bookings', bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400', icon: 'solar:check-circle-bold' };
      case 'on_project':
        return { label: 'Currently On Set / In Production', bg: 'bg-amber-500/15 border-amber-500/30 text-amber-400', icon: 'solar:clapperboard-play-bold' };
      case 'wrapping_soon':
        return { label: 'Wrapping Soon (Taking Inquiries)', bg: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400', icon: 'solar:clock-circle-bold' };
      case 'booked':
        return { label: 'Fully Booked', bg: 'bg-rose-500/15 border-rose-500/30 text-rose-400', icon: 'solar:lock-bold' };
      case 'hiatus':
        return { label: 'On Hiatus', bg: 'bg-zinc-500/15 border-zinc-500/30 text-zinc-400', icon: 'solar:pause-circle-bold' };
      default:
        return { label: 'Profile Roster & Contacts', bg: 'bg-surface-2 border-border text-text-secondary', icon: 'solar:user-bold' };
    }
  };

  const statusInfo = getStatusBadge(person.availability_status);
  const whatsappUrl = cleanPhone 
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hello, I am reaching out via MuviDB regarding a casting and booking inquiry for ${person.name}.`)}`
    : null;

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-surface-2/90 via-surface-2/50 to-surface border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-border shrink-0 bg-surface-2 shadow-sm">
              <ImageWithFallback
                src={person.avatar_url || person.headshots?.[0]}
                alt={person.name}
                fallbackType="avatar"
                name={person.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-heading font-black text-base text-text-primary truncate">
                  {person.name}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusInfo.bg}`}>
                  <Icon icon={statusInfo.icon} width="11" />
                  <span>{statusInfo.label}</span>
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-border bg-surface flex items-center justify-center text-text-muted hover:text-text-primary hover:border-brand transition shrink-0 ml-3"
            title="Close modal"
          >
            <Icon icon="solar:close-circle-bold" width="20" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Subtitle / Instruction */}
          <div className="bg-surface-2/60 border border-border/80 rounded-xl p-3.5 flex items-start gap-2.5">
            <Icon icon="solar:info-circle-bold" width="18" className="text-brand shrink-0 mt-0.5" />
            <p className="text-xs text-text-secondary leading-relaxed">
              Official casting and business representation contacts. Use these channels for film, television, commercial casting, and production bookings.
            </p>
          </div>

          {/* Direct Talent Contacts Section */}
          {hasDirectContacts && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <Icon icon="solar:user-bold" width="14" className="text-brand" />
                  <span>Direct Talent Contact</span>
                </h4>
                <span className="text-[10px] text-text-muted bg-surface-2 px-2 py-0.5 rounded border border-border/60">
                  Verified Contact
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 font-bold text-xs transition group"
                    title={`Send a direct WhatsApp message for booking inquiries`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon icon="ri:whatsapp-fill" width="18" className="text-emerald-400 group-hover:scale-110 transition-transform" />
                      <span>Direct WhatsApp</span>
                    </div>
                    <Icon icon="solar:arrow-right-up-linear" width="14" />
                  </a>
                )}

                {person.booking_phone && (
                  <a
                    href={`tel:${person.booking_phone}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-surface-2 border border-border hover:border-brand/40 text-text-primary font-bold text-xs transition group"
                    title={`Call direct talent line: ${person.booking_phone}`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon icon="solar:phone-bold" width="16" className="text-brand group-hover:scale-110 transition-transform" />
                      <span className="truncate">{person.booking_phone}</span>
                    </div>
                    <Icon icon="solar:arrow-right-linear" width="14" className="text-text-muted" />
                  </a>
                )}

                {person.booking_email && (
                  <a
                    href={`mailto:${person.booking_email}?subject=${encodeURIComponent(`Casting / Booking Inquiry: ${person.name}`)}`}
                    className="sm:col-span-2 flex items-center justify-between p-3 rounded-xl bg-surface-2 border border-border hover:border-brand/40 text-text-primary font-bold text-xs transition group"
                    title={`Email direct booking address: ${person.booking_email}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon icon="solar:letter-bold" width="16" className="text-brand shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="truncate">{person.booking_email}</span>
                    </div>
                    <span className="text-[10px] text-brand font-black uppercase shrink-0">Send Email</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Agency & Manager Representations */}
          {hasAgencies && (
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <Icon icon="solar:buildings-2-bold" width="14" className="text-brand" />
                <span>Agency &amp; Management Representation</span>
              </h4>

              <div className="space-y-2.5">
                {representations.map((rep) => {
                  const company = rep.companies || {};
                  const agencyName = company.name || 'Talent Agency';
                  const repType = rep.representation_type || 'Management';
                  const repEmail = rep.contact_email || company.email;
                  const repPhone = rep.contact_phone || company.phone;

                  return (
                    <div key={rep.id} className="p-3.5 rounded-xl border border-border bg-surface-2/40 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-border bg-black/40 shrink-0">
                          <ImageWithFallback
                            src={company.logo_url}
                            alt={agencyName}
                            fallbackType="company"
                            name={agencyName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black font-heading text-text-primary truncate">
                              {toTitleCase(agencyName)}
                            </span>
                            <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted">
                              {repType}
                            </span>
                          </div>
                          {rep.agent_name && (
                            <p className="text-[11px] text-text-secondary truncate mt-0.5">
                              Agent: <span className="font-semibold text-text-primary">{rep.agent_name}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Rep Actions */}
                      <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                        {repEmail && (
                          <a
                            href={`mailto:${repEmail}?subject=${encodeURIComponent(`Casting Inquiry for ${person.name}`)}`}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-brand text-black text-xs font-black uppercase hover:bg-brand-hover transition"
                          >
                            <Icon icon="solar:letter-bold" width="14" />
                            <span>Contact Agent</span>
                          </a>
                        )}
                        {repPhone && (
                          <a
                            href={`tel:${repPhone}`}
                            className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-surface border border-border text-text-primary text-xs font-bold hover:border-brand/40 transition"
                            title={`Call agent: ${repPhone}`}
                          >
                            <Icon icon="solar:phone-bold" width="14" />
                            <span>Call</span>
                          </a>
                        )}
                        {company.slug && (
                          <Link
                            to={`/companies/${company.slug}`}
                            className="inline-flex items-center justify-center p-2 rounded-lg bg-surface border border-border text-text-muted hover:text-brand hover:border-brand transition"
                            title="View Agency Profile"
                          >
                            <Icon icon="solar:arrow-right-linear" width="14" />
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* If No Direct Contacts or Agencies Listed */}
          {!hasDirectContacts && !hasAgencies && (
            <div className="text-center py-6 px-4 border border-dashed border-border rounded-xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <Icon icon="solar:shield-warning-bold" width="24" />
              </div>
              <h4 className="text-sm font-bold text-text-primary">No Direct Contacts Listed Yet</h4>
              <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
                {person.name} has not linked public representation or direct casting contact information yet.
              </p>
              <div className="pt-2">
                <Link
                  to={`/claim?person=${encodeURIComponent(person.slug || person.id)}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white font-bold text-xs hover:bg-brand/90 transition shadow-sm"
                >
                  <Icon icon="solar:shield-check-bold" width="15" />
                  <span>Claim Profile &amp; Add Booking Contacts</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-surface-2 border-t border-border flex items-center justify-between text-[11px] text-text-muted">
          <span className="flex items-center gap-1.5">
            <Icon icon="solar:shield-check-bold" width="13" className="text-brand" />
            <span>MuviDB Verified Talent Directory</span>
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-border bg-surface text-text-primary font-bold hover:bg-surface-2 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
