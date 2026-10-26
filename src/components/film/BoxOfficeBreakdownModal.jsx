import React from 'react';
import { Icon } from '@iconify/react';

function formatNaira(amount) {
  if (!amount || isNaN(amount)) return '—';
  if (amount >= 1_000_000_000) {
    return `₦${(amount / 1_000_000_000).toFixed(2)} Billion`;
  }
  if (amount >= 1_000_000) {
    return `₦${(amount / 1_000_000).toFixed(1)} Million`;
  }
  return `₦${Number(amount).toLocaleString('en-NG')}`;
}

export default function BoxOfficeBreakdownModal({ film, onClose }) {
  if (!film) return null;

  const boxOfficeData = film.streaming_links?.box_office || {};
  const domestic = film.box_office_domestic || boxOfficeData.domestic;
  const openingWeekend = film.box_office_opening_weekend || boxOfficeData.opening_weekend;
  const admissions = boxOfficeData.admissions || boxOfficeData.admissions_total;
  const weekendAdmissions = boxOfficeData.admissions_weekend;
  const locations = boxOfficeData.locations;
  const source = film.box_office_source || boxOfficeData.source || 'Nigerian Film Intelligence / CEAN';
  const sourceIssue = boxOfficeData.source_issue;
  const weeklyHistory = boxOfficeData.history || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-lg rounded-2xl bg-surface border border-border shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
              <Icon icon="solar:ticket-bold" className="text-sm" />
              <span>Theatrical Box Office Breakdown</span>
            </div>
            <h3 className="text-xl font-black text-text-primary font-heading tracking-tight">
              {film.title} {film.year ? `(${film.year})` : ''}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <Icon icon="solar:close-circle-bold" className="text-2xl" />
          </button>
        </div>

        {/* Primary Metric Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-surface-2 border border-border/60 space-y-1">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Total Box Office</span>
            <p className="text-2xl font-black text-amber-400 font-heading">
              {formatNaira(domestic)}
            </p>
            {domestic ? (
              <span className="text-[10px] text-text-muted font-mono block">
                ₦{Number(domestic).toLocaleString('en-NG')}
              </span>
            ) : null}
          </div>

          <div className="p-4 rounded-xl bg-surface-2 border border-border/60 space-y-1">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Opening Weekend</span>
            <p className="text-2xl font-black text-text-primary font-heading">
              {formatNaira(openingWeekend)}
            </p>
            {openingWeekend ? (
              <span className="text-[10px] text-text-muted font-mono block">
                ₦{Number(openingWeekend).toLocaleString('en-NG')}
              </span>
            ) : null}
          </div>

          {admissions ? (
            <div className="p-4 rounded-xl bg-surface-2 border border-border/60 space-y-1">
              <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Admissions (Tickets)</span>
              <p className="text-xl font-bold text-text-primary flex items-center gap-1.5">
                <Icon icon="solar:users-group-two-rounded-bold" className="text-amber-400" />
                <span>{Number(admissions).toLocaleString('en-NG')}</span>
              </p>
              {weekendAdmissions ? (
                <span className="text-[10px] text-text-muted block">
                  {Number(weekendAdmissions).toLocaleString()} in latest weekend
                </span>
              ) : null}
            </div>
          ) : null}

          {locations ? (
            <div className="p-4 rounded-xl bg-surface-2 border border-border/60 space-y-1">
              <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Screen Reach</span>
              <p className="text-xl font-bold text-text-primary flex items-center gap-1.5">
                <Icon icon="solar:clapperboard-play-bold" className="text-amber-400" />
                <span>{locations} Locations</span>
              </p>
              <span className="text-[10px] text-text-muted block">Nationwide coverage</span>
            </div>
          ) : null}
        </div>

        {/* Weekly Progression History if available */}
        {weeklyHistory && weeklyHistory.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">Weekly Run Tracking</h4>
            <div className="divide-y divide-border/40 rounded-xl border border-border overflow-hidden bg-surface-2/40">
              {weeklyHistory.map((week, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-text-primary block">{week.label || `Week ${idx + 1}`}</span>
                    <span className="text-[11px] text-text-muted">{week.date || ''}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-amber-400 block">{formatNaira(week.gross)}</span>
                    {week.admissions ? (
                      <span className="text-[10px] text-text-muted">{Number(week.admissions).toLocaleString()} admissions</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Source & Verification Footer */}
        <div className="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-text-muted">
          <div className="flex items-center gap-1.5">
            <Icon icon="solar:shield-check-bold" className="text-emerald-400 text-sm" />
            <span>Verified Source: <strong className="text-text-primary">{source}</strong></span>
          </div>
          {sourceIssue && (
            <span className="text-[11px] text-text-muted italic truncate max-w-xs">{sourceIssue}</span>
          )}
        </div>
      </div>
    </div>
  );
}
