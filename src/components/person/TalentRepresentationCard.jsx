import React from 'react';
import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../ui/ImageWithFallback';
import { toTitleCase } from '../../utils/format';

/**
 * TalentRepresentationCard
 * 
 * Displays verified talent agency, manager, or legal representation (IMDbPro style)
 * with direct booking and agent contact action buttons.
 */
export default function TalentRepresentationCard({ representations = [], personName = '' }) {
  if (!representations || representations.length === 0) return null;

  return (
    <div className="border border-border/90 rounded-2xl bg-surface overflow-hidden shadow-lg">
      {/* Header */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-surface-2/80 to-surface-2/30 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-brand text-[10px] font-black uppercase tracking-wider">
          <Icon icon="solar:shield-check-bold" className="w-3.5 h-3.5 text-brand" />
          <span>Representation & Booking</span>
        </div>
        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-brand/10 text-brand border border-brand/20">
          Verified
        </span>
      </div>

      {/* Representation List */}
      <div className="divide-y divide-border/60">
        {representations.map((rep) => {
          const company = rep.companies || {};
          const companySlugOrId = company.slug || company.id;
          const agencyName = company.name || 'Talent Agency';
          const repType = rep.representation_type || 'Talent Management';
          const email = rep.contact_email || company.email;
          const phone = rep.contact_phone || company.phone;
          const bookingUrl = rep.booking_url || company.website;

          const emailSubject = encodeURIComponent(`Booking Enquiry: ${personName || 'Talent'}`);
          const emailBody = encodeURIComponent(
            `Hello ${rep.agent_name || agencyName},\n\nI am reaching out regarding representation and booking availability for ${personName || 'this talent'}.\n\nProject Details:\n\nThank you.`
          );

          return (
            <div key={rep.id} className="p-5 space-y-4">
              {/* Agency Info */}
              <div className="flex items-center gap-3.5">
                <Link
                  to={companySlugOrId ? `/companies/${companySlugOrId}` : '#'}
                  className="w-12 h-12 rounded-xl overflow-hidden bg-black/50 border border-border shrink-0 hover:border-brand/60 transition-colors group"
                >
                  <ImageWithFallback
                    src={company.logo_url}
                    alt={agencyName}
                    fallbackType="company"
                    name={agencyName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </Link>

                <div className="flex-1 min-w-0">
                  <span className="inline-block text-[9px] font-black uppercase tracking-wider text-text-muted bg-surface-2 px-2 py-0.5 rounded border border-border/60 mb-0.5">
                    {repType}
                  </span>
                  <Link
                    to={companySlugOrId ? `/companies/${companySlugOrId}` : '#'}
                    className="block font-heading font-black text-sm text-text-primary hover:text-brand transition-colors truncate"
                  >
                    {toTitleCase(agencyName)}
                  </Link>
                  {rep.agent_name && (
                    <p className="text-[11px] text-text-secondary truncate">
                      Rep: <span className="font-semibold text-text-primary">{rep.agent_name}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons: Email, Call, Booking Profile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {email && (
                  <a
                    href={`mailto:${email}?subject=${emailSubject}&body=${emailBody}`}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-brand text-black font-heading font-black text-xs uppercase tracking-wider hover:bg-brand-hover hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm"
                  >
                    <Icon icon="solar:letter-bold" className="w-3.5 h-3.5" />
                    <span>Email Rep</span>
                  </a>
                )}

                {phone && (
                  <a
                    href={`tel:${phone}`}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary hover:border-brand/50 hover:text-brand font-heading font-bold text-xs uppercase tracking-wider transition-all"
                  >
                    <Icon icon="solar:phone-bold" className="w-3.5 h-3.5" />
                    <span>Call Agent</span>
                  </a>
                )}
              </div>

              {/* Booking URL or Agency Profile Link */}
              <div className="flex items-center justify-between text-[11px] pt-1 text-text-muted border-t border-border/40">
                {bookingUrl ? (
                  <a
                    href={bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-text-secondary hover:text-brand transition-colors font-medium"
                  >
                    <span>Official Booking Link</span>
                    <Icon icon="solar:arrow-right-up-linear" className="w-3 h-3" />
                  </a>
                ) : (
                  <span />
                )}

                {companySlugOrId && (
                  <Link
                    to={`/companies/${companySlugOrId}`}
                    className="inline-flex items-center gap-1 text-brand font-bold hover:underline"
                  >
                    <span>View Roster</span>
                    <Icon icon="solar:arrow-right-linear" className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
