import React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../ui/ImageWithFallback';
import { formatPersonName } from '../../utils/format';

/**
 * TalentAccessModal - Uniform industry & representation portal (IMDbPro style).
 * Appears uniformly across ALL profiles without leaking whether an account is claimed.
 */
export default function TalentAccessModal({
  isOpen,
  onClose,
  person,
  user,
  representations = [],
  pendingClaim = null,
}) {
  if (!isOpen || !person) return null;

  const isClaimed = Boolean(person.claimed_by);
  const isOwner = Boolean(user && person.claimed_by && user.id === person.claimed_by);
  const isDeceased = Boolean(person.is_deceased || person.date_of_death);
  const claimUrl = `/claim?person=${encodeURIComponent(person.slug || person.id)}`;
  const hasAgencies = Boolean(representations && representations.length > 0);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-brand/15 via-surface-2/70 to-surface border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-border shrink-0 bg-surface-2 shadow-sm">
              <ImageWithFallback
                src={person.photo_url || person.photo || person.headshots?.[0]}
                alt={person.name}
                fallbackType="avatar"
                name={person.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-heading font-black text-base text-text-primary truncate">
                  {formatPersonName(person.name)}
                </h3>
                {person.is_verified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand/15 text-brand border border-brand/30">
                    <Icon icon="solar:verified-check-bold" width="11" />
                    Verified
                  </span>
                )}
              </div>
              <p className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1.5">
                <span className="font-bold text-brand uppercase tracking-wider text-[10px]">MuviDB Pro</span>
                <span>•</span>
                <span>Industry & Representation Portal</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-border bg-surface flex items-center justify-center text-text-muted hover:text-text-primary hover:border-brand transition shrink-0 ml-3"
            aria-label="Close"
          >
            <Icon icon="solar:close-circle-linear" width="20" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-text-secondary">
          {/* CASE 1: Current User is the Verified Profile Manager */}
          {isOwner && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-brand/30 bg-brand/10 space-y-2">
                <div className="flex items-center gap-2 text-brand font-bold text-sm">
                  <Icon icon="solar:shield-check-bold" width="18" />
                  <span>You manage this official profile</span>
                </div>
                <p className="text-text-secondary leading-relaxed">
                  Your account is verified as the official manager of {formatPersonName(person.name)} on MuviDB Pro. You can update headshots, manage representation, add showreels, and view career metrics.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <Link
                  to="/pro-dashboard"
                  onClick={onClose}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white font-bold text-xs hover:bg-brand/90 transition shadow-sm"
                >
                  <Icon icon="solar:pen-new-square-bold" width="16" />
                  <span>Open Pro Dashboard</span>
                </Link>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-border bg-surface-2 text-text-primary font-bold text-xs hover:bg-surface transition"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* CASE 2: Deceased Profile */}
          {!isOwner && isDeceased && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-border bg-surface-2/60 space-y-2">
                <div className="flex items-center gap-2 text-text-primary font-bold text-sm">
                  <Icon icon="solar:monument-bold" width="18" className="text-brand" />
                  <span>Cinematic Heritage & Legacy Profile</span>
                </div>
                <p className="text-text-secondary leading-relaxed">
                  This profile is preserved as part of African cinema history. Accredited estates, family representatives, or guild archives wishing to update historical credits or submit memorial archival material can reach out to our editorial archives team.
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <a
                  href={`mailto:heritage@muvidb.com?subject=${encodeURIComponent(`Legacy Archive Inquiry: ${person.name}`)}`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-surface text-text-primary font-bold hover:border-brand hover:text-brand transition"
                >
                  <Icon icon="solar:letter-bold" width="16" />
                  <span>Contact Archives Desk</span>
                </a>
              </div>
            </div>
          )}

          {/* CASE 3: Active Profile Claimed by Other Verified Representation */}
          {!isOwner && !isDeceased && isClaimed && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-border bg-surface-2/60 space-y-2">
                <div className="flex items-center gap-2 text-text-primary font-bold text-sm">
                  <Icon icon="solar:verified-check-bold" width="18" className="text-emerald-400" />
                  <span>Verified Representation</span>
                </div>
                <p className="text-text-secondary leading-relaxed">
                  This profile is actively managed and verified through {formatPersonName(person.name)}'s official talent representation.
                </p>
              </div>

              {hasAgencies && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-text-muted">Accredited Agency Roster</p>
                  <div className="space-y-2">
                    {representations.map((rep) => (
                      <div key={rep.id} className="p-3 rounded-xl border border-border bg-surface flex items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-text-primary">{rep.companies?.name || 'Talent Agency'}</p>
                          <p className="text-[11px] text-text-muted">{rep.representation_type || 'Theatrical / Film'}</p>
                        </div>
                        {rep.contact_email && (
                          <a
                            href={`mailto:${rep.contact_email}?subject=${encodeURIComponent(`Casting Inquiry for ${person.name}`)}`}
                            className="px-3 py-1.5 rounded-lg border border-border bg-surface-2 hover:border-brand hover:text-brand text-xs font-bold transition flex items-center gap-1.5"
                          >
                            <Icon icon="solar:letter-bold" width="13" />
                            <span>Inquire</span>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-border/60 text-[11px] text-text-muted space-y-1">
                <p className="font-semibold text-text-secondary">Are you an authorized talent agent or legal representative?</p>
                <p>
                  To request access or submit representation changes, contact our pro verification team at{' '}
                  <a href="mailto:pro@muvidb.com" className="text-brand hover:underline font-bold">pro@muvidb.com</a>.
                </p>
              </div>
            </div>
          )}

          {/* CASE 4: Unclaimed Profile (or User Has Pending Claim) */}
          {!isOwner && !isDeceased && !isClaimed && (
            <div className="space-y-4">
              {pendingClaim ? (
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                    <Icon icon="solar:clock-circle-bold" width="18" />
                    <span>Claim Submitted & Under Review</span>
                  </div>
                  <p className="text-text-secondary leading-relaxed">
                    You have submitted a claim for this profile. The MuviDB verification desk is reviewing your submission. You will receive a notification as soon as verification completes.
                  </p>
                  <div className="pt-1">
                    <Link
                      to={claimUrl}
                      onClick={onClose}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 hover:underline"
                    >
                      <span>Check claim details →</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <h4 className="font-heading font-black text-sm text-text-primary">
                      Represent {formatPersonName(person.name)} or managing this talent page?
                    </h4>
                    <p className="text-text-secondary leading-relaxed">
                      MuviDB Pro is the industry directory for Nollywood and African screen talent. Claiming this page gives actors and accredited agents official control:
                    </p>
                  </div>

                  <div className="space-y-2.5 py-1">
                    <div className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand mt-0.5">
                        <Icon icon="solar:check-circle-bold" width="13" />
                      </span>
                      <p className="text-text-secondary text-xs">
                        <strong className="text-text-primary font-bold">Filmography & Credits:</strong> Maintain an official, clean record of all screen performances and crew roles.
                      </p>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand mt-0.5">
                        <Icon icon="solar:check-circle-bold" width="13" />
                      </span>
                      <p className="text-text-secondary text-xs">
                        <strong className="text-text-primary font-bold">Media Portfolio:</strong> Add high-resolution headshots, acting showreels, monologues, and press photos.
                      </p>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand mt-0.5">
                        <Icon icon="solar:check-circle-bold" width="13" />
                      </span>
                      <p className="text-text-secondary text-xs">
                        <strong className="text-text-primary font-bold">Casting & Booking Access:</strong> Connect verified agency representation, booking email, and direct WhatsApp contact.
                      </p>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand mt-0.5">
                        <Icon icon="solar:check-circle-bold" width="13" />
                      </span>
                      <p className="text-text-secondary text-xs">
                        <strong className="text-text-primary font-bold">Verified Talent Badge:</strong> Display verified roster status across search, film credits, and box office pages.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                    <Link
                      to={claimUrl}
                      onClick={onClose}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand text-white font-bold text-xs hover:bg-brand/90 hover:shadow-lg hover:shadow-brand/25 transition shadow-sm"
                    >
                      <Icon icon="solar:shield-check-bold" width="16" />
                      <span>Claim Page on MuviDB Pro</span>
                    </Link>
                    <button
                      onClick={onClose}
                      className="px-4 py-3 rounded-xl border border-border bg-surface-2 text-text-muted hover:text-text-primary font-bold text-xs hover:bg-surface transition"
                    >
                      Cancel
                    </button>
                  </div>

                  <p className="text-[10px] text-text-muted text-center pt-1">
                    MuviDB verifies identity via official social handles, agency domains, or valid production documents.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
