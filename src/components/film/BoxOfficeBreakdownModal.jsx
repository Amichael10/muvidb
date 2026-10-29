import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../../context/AuthContext';

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

export default function BoxOfficeBreakdownModal({ film, onClose, isAdmin: propIsAdmin = false }) {
  if (!film) return null;

  const { user } = useAuth();
  const isAdmin = propIsAdmin || user?.role === 'admin' || user?.role === 'admin_limited';

  const [expandedDate, setExpandedDate] = useState(null);

  const boxOfficeData = film.streaming_links?.box_office || {};
  const domestic = film.box_office_domestic || boxOfficeData.domestic;
  const openingWeekend = film.box_office_opening_weekend || boxOfficeData.opening_weekend;
  const admissions = boxOfficeData.admissions || boxOfficeData.admissions_total;
  const weekendAdmissions = boxOfficeData.admissions_weekend;
  const locations = boxOfficeData.locations;
  const source = film.box_office_source || boxOfficeData.source || 'Nigerian Film Intelligence / CEAN';
  const sourceIssue = boxOfficeData.source_issue;
  const weeklyHistory = boxOfficeData.history || [];
  const reachMetrics = boxOfficeData.reach_metrics;

  const totalWeeklyGross = weeklyHistory.reduce((acc, w) => acc + (Number(w.gross) || 0), 0);
  const remainingGross = (domestic && totalWeeklyGross > 0 && domestic > totalWeeklyGross)
    ? domestic - totalWeeklyGross
    : 0;

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

        {/* Reach Cinema Daily Live Intelligence */}
        {reachMetrics && reachMetrics.cumulative_reach_tickets > 0 && (
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Icon icon="solar:chart-square-bold" className="text-sm" />
                <span>Live Reach POS Circuit Tracking</span>
              </span>
              <span className="text-[10px] text-text-muted bg-surface px-2 py-0.5 rounded border border-border">
                26 Tracked Branches
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="p-2 rounded-lg bg-surface/80 border border-border/50">
                <span className="text-[10px] text-text-muted block">Circuit Tickets</span>
                <span className="text-base font-bold text-text-primary">
                  {Number(reachMetrics.cumulative_reach_tickets).toLocaleString()}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-surface/80 border border-border/50">
                <span className="text-[10px] text-text-muted block">Circuit Revenue</span>
                <span className="text-base font-bold text-amber-400">
                  {formatNaira(reachMetrics.cumulative_reach_revenue)}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-surface/80 border border-border/50">
                <span className="text-[10px] text-text-muted block">Hall Occupancy</span>
                <span className="text-base font-bold text-emerald-400">
                  {reachMetrics.latest_occupancy ? `${reachMetrics.latest_occupancy}%` : '—'}
                </span>
              </div>
            </div>

            {reachMetrics.daily_history && reachMetrics.daily_history.length > 0 && (
              <div className="pt-2 border-t border-amber-500/10">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">
                  Daily Admissions & Price Tracking
                </span>
                <div className="space-y-1.5">
                  {reachMetrics.daily_history.slice(-5).reverse().map((dh, i) => {
                    const isExpanded = expandedDate === dh.date;
                    const locationEntries = dh.locations ? Object.entries(dh.locations) : [];

                    return (
                      <div key={i} className="rounded-lg bg-surface/60 border border-border/40 p-2 text-[11px] space-y-1.5">
                        <div 
                          className="flex items-center justify-between cursor-pointer select-none"
                          onClick={() => setExpandedDate(isExpanded ? null : dh.date)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-text-muted">{dh.date}</span>
                            <span className="font-semibold text-text-primary">
                              {dh.ticketsSold} ticket{dh.ticketsSold !== 1 ? 's' : ''} ({formatNaira(dh.estimatedRevenue)})
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px]">
                            {dh.avgTicketPrice ? (
                              <span className="text-amber-400 font-mono">~₦{dh.avgTicketPrice.toLocaleString()}/tkt</span>
                            ) : null}
                            <span className="text-emerald-400">{dh.occupancyRate}% full</span>
                            {locationEntries.length > 0 && (
                              <Icon 
                                icon={isExpanded ? "solar:alt-arrow-up-bold" : "solar:alt-arrow-down-bold"} 
                                className="text-text-muted text-xs" 
                              />
                            )}
                          </div>
                        </div>

                        {isExpanded && locationEntries.length > 0 && (
                          <div className="pt-1.5 border-t border-border/30 pl-2 space-y-1">
                            <span className="text-[9px] font-semibold text-text-muted uppercase tracking-wider block">
                              Circuit Branch Breakdown:
                            </span>
                            {locationEntries.map(([locName, locStat]) => (
                              <div key={locName} className="flex items-center justify-between text-[10px] text-text-secondary pr-1">
                                <span className="truncate max-w-[200px]">{locName}</span>
                                <span className="font-mono text-text-primary">
                                  {locStat.ticketsSold} tkt{locStat.ticketsSold !== 1 ? 's' : ''} • {formatNaira(locStat.estimatedRevenue)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Weekly Progression History if available */}
        {weeklyHistory && weeklyHistory.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">Weekly Run Tracking</h4>
            <div className="divide-y divide-border/40 rounded-xl border border-border overflow-hidden bg-surface-2/40">
              {weeklyHistory.map((week, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-text-primary block">{week.label || (week.date ? '' : `Week ${idx + 1}`)}</span>
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

              {/* Others / Remaining Reported Box Office Gross */}
              {remainingGross > 0 && (
                <div className="p-3 flex items-center justify-between text-xs bg-amber-500/5 border-t border-dashed border-amber-500/20">
                  <div>
                    <span className="font-bold text-text-primary block">Others</span>
                    <span className="text-[11px] text-text-muted">Remaining reported box office balance</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-amber-400 block">{formatNaira(remainingGross)}</span>
                    <span className="text-[10px] text-text-muted font-mono">₦{Number(remainingGross).toLocaleString('en-NG')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Source & Verification Footer — Restricted to Admins only */}
        {isAdmin && (
          <div className="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-text-muted bg-surface-2/30 -mx-6 -mb-6 p-4 rounded-b-2xl">
            <div className="flex items-center gap-1.5">
              <Icon icon="solar:shield-check-bold" className="text-emerald-400 text-sm" />
              <span>Verified Source (Admin): <strong className="text-text-primary">{source}</strong></span>
            </div>
            {sourceIssue && (
              <span className="text-[11px] text-text-muted italic truncate max-w-xs">{sourceIssue}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
