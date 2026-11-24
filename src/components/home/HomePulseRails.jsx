import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../ui/ImageWithFallback';
import { selectBornTodayPeople } from '../../lib/ranking';

export default function HomePulseRails({
  birthdayPool = [],
  isLoading = false,
}) {
  const birthdaySelection = useMemo(() => selectBornTodayPeople(birthdayPool), [birthdayPool]);

  const todayFormatted = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-NG', {
        timeZone: 'Africa/Lagos',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).format(new Date());
    } catch {
      return '';
    }
  }, []);

  if (!isLoading && birthdaySelection.people.length === 0) {
    return null;
  }

  return (
    <section className="py-10 md:py-12 border-b border-hairline bg-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-amber-400">
                <Icon icon="solar:gift-bold" className="text-xs" />
                <span>Industry Calendar</span>
              </p>
              {todayFormatted && (
                <span className="px-2 py-0.5 rounded bg-surface-2 border border-border text-[10px] font-mono font-bold text-text-secondary">
                  {todayFormatted}
                </span>
              )}
            </div>
            <h2 className="font-heading font-bold text-2xl sm:text-3xl text-text-primary tracking-tight">
              {birthdaySelection.label}
            </h2>
            <p className="text-xs text-text-muted">
              Celebrating African actors, directors &amp; filmmakers marking another milestone year
            </p>
          </div>

          <Link
            to="/people"
            className="group inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline whitespace-nowrap"
          >
            <span>Explore All Talent</span>
            <Icon
              icon="solar:alt-arrow-right-linear"
              className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>

        {/* Elevated Editorial Birthday Cards (Horizontal Swipe Mobile / 4-Col Desktop) */}
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-3.5 pb-2 -mx-4 px-4 scrollbar-none sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:mx-0 sm:px-0 sm:overflow-visible">
          {birthdaySelection.people.slice(0, 8).map((person) => {
            const dept =
              person.known_for_department === 'Acting'
                ? 'Actor'
                : person.known_for_department || 'Filmmaker';

            return (
              <Link
                key={person.id}
                to={`/people/${person.slug || person.id}`}
                className={`group rounded-xl border p-3.5 flex items-center gap-3.5 transition-all w-[76vw] sm:w-auto shrink-0 snap-start ${
                  person._isExactToday
                    ? 'bg-surface-2 border-amber-400/40 hover:border-amber-400'
                    : 'bg-surface border-border hover:border-brand/50'
                }`}
              >
                <div
                  className={`relative w-16 h-16 sm:w-[70px] sm:h-[70px] rounded-full overflow-hidden shrink-0 bg-surface-2 ${
                    person._isExactToday
                      ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-bg'
                      : 'border border-border group-hover:border-brand/60'
                  }`}
                >
                  <ImageWithFallback
                    src={person.photo_url || person.photo_cutout_url}
                    alt={person.name}
                    fallbackType="avatar"
                    name={person.name}
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                    width={160}
                  />
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-1.5">
                    {person._isExactToday ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[9px] font-black uppercase tracking-wider">
                        <Icon icon="solar:confetti-bold" className="text-[10px]" />
                        Today
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-bold text-brand">
                        {person._birthdayLabel}
                      </span>
                    )}
                    {person._age && (
                      <span className="text-[10px] font-semibold text-text-muted">
                        · {person._isExactToday ? `Turns ${person._age}` : `Age ${person._age}`}
                      </span>
                    )}
                  </div>

                  <h3 className="font-heading font-black text-sm text-text-primary group-hover:text-brand truncate transition-colors">
                    {person.name}
                  </h3>

                  <div className="flex items-center justify-between gap-2 text-[11px] text-text-muted">
                    <span className="truncate font-medium">{dept}</span>
                    <span className="text-brand font-bold opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      →
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
