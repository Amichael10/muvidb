import React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../ui/ImageWithFallback';
import { getPlayDateLabel } from '../../lib/plays';

// 5 Top Stage Productions reflecting VeeTickets Theatre category & Accra/Lagos stage runs
const DEMO_THEATRE_PLAYS = [
  {
    id: 'gayinas-pound-of-flesh-2026',
    slug: 'gayinas-pound-of-flesh-2026',
    title: "Gayina's Pound of Flesh",
    genre: 'Drama / Shakespearean',
    status: 'currently_running',
    venue: 'National Theatre',
    city: 'Accra, Ghana',
    director: 'George Quaye',
    producer: 'Image Bureau Gh. Ltd',
    run_start_date: '2026-08-01',
    run_end_date: '2026-08-10',
    performance_time: '4:00 PM & 8:00 PM',
    poster_url: 'https://res.cloudinary.com/dg8kkh3xx/image/upload/v1786096697/events/dlaqqsw5j1axg0f94xbp.jpg',
    ticket_tiers: 'GH¢100 – 200 VIP',
    source_url: 'https://www.veetickets.com/events/gayinas-pound-of-flesh',
  },
  {
    id: 'honey-trap-2026',
    slug: 'honey-trap',
    title: 'Honey Trap',
    genre: 'Comedy / Romance',
    status: 'currently_running',
    venue: 'The National Theatre',
    city: 'Accra, Ghana',
    director: 'James Ebo Whyte',
    producer: 'Roverman Productions',
    run_start_date: '2026-09-04',
    run_end_date: '2026-09-12',
    performance_time: '4:00 PM & 8:00 PM',
    poster_url: 'https://korba-website-assets.s3.eu-west-1.amazonaws.com/projects/roverman/honey_trap.jpg',
    ticket_tiers: 'GH¢150 Standard',
    source_url: 'https://rovermantickets.korba365.com/',
  },
  {
    id: 'the-dilemma-of-a-ghost',
    slug: 'the-dilemma-of-a-ghost',
    title: 'The Dilemma of a Ghost',
    genre: 'Classic African Drama',
    status: 'currently_running',
    venue: 'Folks Place, National Theatre',
    city: 'Accra, Ghana',
    director: 'Ama Ata Aidoo Heritage',
    producer: 'National Theatre of Ghana',
    run_start_date: '2026-09-18',
    run_end_date: '2026-09-25',
    performance_time: '5:00 PM & 8:00 PM',
    poster_url: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=600&q=80',
    ticket_tiers: 'GH¢80 – 150 VIP',
    source_url: 'https://www.veetickets.com/categories/6a3b8f1675a03a4befbb957b',
  },
  {
    id: 'love-we-go-chop',
    slug: 'love-we-go-chop',
    title: 'Love We Go Chop?',
    genre: 'Romantic Stage Comedy',
    status: 'upcoming',
    venue: 'National Theatre',
    city: 'Accra, Ghana',
    director: 'George Quaye',
    producer: 'Image Bureau Gh. Ltd',
    run_start_date: '2026-10-10',
    run_end_date: '2026-10-18',
    performance_time: '4:00 PM & 8:00 PM',
    poster_url: 'https://images.unsplash.com/photo-1469488865564-c2de10f69f96?auto=format&fit=crop&w=600&q=80',
    ticket_tiers: 'GH¢100 – 200 VIP',
    source_url: 'https://www.veetickets.com/events/lovewegochop',
  },
  {
    id: 'saro-the-musical-lagos',
    slug: 'saro-the-musical',
    title: 'Saro The Musical: Homecoming',
    genre: 'Broadway Musical / Heritage',
    status: 'upcoming',
    venue: 'Terra Kulture Arena',
    city: 'Lagos, Nigeria',
    director: 'Bolanle Austen-Peters',
    producer: 'BAP Productions',
    run_start_date: '2026-12-22',
    run_end_date: '2027-01-03',
    performance_time: '3:00 PM & 7:00 PM',
    poster_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
    ticket_tiers: '₦15,000 – ₦50,000 VIP',
    source_url: 'https://www.terrakulture.com/',
  },
];

export default function HomeTheatreSection({ plays = [], isLoading = false }) {
  const displayPlays = plays && plays.length > 0 ? plays : DEMO_THEATRE_PLAYS;

  return (
    <section className="py-10 md:py-14 border-b border-hairline bg-surface/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-purple-400">
                Live Theatre &amp; Performing Arts
              </p>
            </div>
            <h2 className="font-heading font-bold text-2xl sm:text-3xl text-text-primary tracking-tight">
              Now on Stage &amp; Weekend Runs
            </h2>
            <p className="text-xs text-text-muted">
              Live theatrical plays, musicals, and stagecraft in Lagos, Accra &amp; Abuja
            </p>
          </div>

          <Link
            to="/plays"
            className="group inline-flex items-center gap-1.5 text-xs font-bold text-purple-400 hover:text-purple-300 hover:underline whitespace-nowrap"
          >
            <span>All Stage Plays &amp; Theatres</span>
            <Icon
              icon="solar:alt-arrow-right-linear"
              className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>

        {/* 5-Column Portrait Cards (Mobile App Swipe Carousel & Desktop 5-Col Grid) */}
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 sm:gap-4 pb-3 -mx-4 px-4 scrollbar-none md:grid md:grid-cols-5 md:mx-0 md:px-0 md:overflow-visible">
          {displayPlays.slice(0, 5).map((play) => {
            const isRunning = play.status === 'currently_running';
            const dateStr = play.run_start_date ? getPlayDateLabel(play) : 'Dates Announced';
            const tiers = play.ticket_tiers || (play.box_office_metrics?.ticket_tiers
              ? play.box_office_metrics.ticket_tiers.map(t => `${t.tier} ${t.currency} ${t.price}`).join(' · ')
              : null);

            return (
              <div
                key={play.id}
                className="group relative rounded-xl border border-border/80 bg-surface overflow-hidden flex flex-col justify-between hover:border-purple-500/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg shadow-sm w-[68vw] sm:w-[44vw] md:w-auto shrink-0 snap-start select-none"
              >
                {/* Portrait Poster (Aspect 2:3 Matching Film Cards) */}
                <div className="relative aspect-[2/3] w-full bg-black overflow-hidden">
                  <ImageWithFallback
                    src={play.poster_url || play.banner_url}
                    alt={play.title}
                    fallbackType="film"
                    name={play.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    width={400}
                    loading="lazy"
                  />

                  {/* Gradient Scrim */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/20 pointer-events-none" />

                  {/* Top Status Pill */}
                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1.5 z-10">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider backdrop-blur-md border shadow-md ${
                        isRunning
                          ? 'bg-emerald-500/85 text-white border-emerald-400'
                          : 'bg-purple-600/85 text-white border-purple-400'
                      }`}
                    >
                      {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                      <span>{isRunning ? 'Live Run' : 'Upcoming'}</span>
                    </span>

                    {play.city && (
                      <span className="truncate text-[9px] font-bold text-white/90 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded border border-white/10">
                        {play.city.split(',')[0]}
                      </span>
                    )}
                  </div>

                  {/* Bottom Venue Tag Over Image */}
                  <div className="absolute bottom-2 left-2 right-2 z-10 text-white space-y-0.5">
                    <p className="text-[10px] font-bold flex items-center gap-1 text-purple-300 truncate">
                      <Icon icon="solar:map-point-bold" className="text-xs shrink-0" />
                      <span className="truncate">{play.venue || 'National Theatre'}</span>
                    </p>
                  </div>
                </div>

                {/* Card Content Info */}
                <div className="p-3 flex-1 flex flex-col justify-between gap-2.5">
                  <div className="space-y-1">
                    <Link
                      to={`/plays/${play.slug || play.id}`}
                      className="font-heading font-bold text-[13px] text-text-primary group-hover:text-purple-400 transition-colors line-clamp-1 leading-snug"
                      title={play.title}
                    >
                      {play.title}
                    </Link>
                    <p className="text-[10px] text-text-muted flex items-center gap-1 truncate">
                      <Icon icon="solar:calendar-bold" className="text-xs text-brand shrink-0" />
                      <span className="truncate">{dateStr}</span>
                    </p>
                    {play.producer && (
                      <p className="text-[9.5px] uppercase font-bold tracking-wider text-text-secondary truncate">
                        {play.producer}
                      </p>
                    )}
                    {tiers && (
                      <p className="text-[9.5px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded truncate">
                        🎫 {tiers}
                      </p>
                    )}
                  </div>

                  {/* CTAs */}
                  <div className="pt-2 border-t border-hairline flex items-center justify-between gap-1.5">
                    <Link
                      to={`/plays/${play.slug || play.id}`}
                      className="text-[10px] font-bold text-text-secondary hover:text-brand transition-colors truncate"
                    >
                      Details
                    </Link>

                    {play.source_url ? (
                      <a
                        href={play.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold inline-flex items-center gap-1 transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
                      >
                        <span>Tickets</span>
                        <Icon icon="solar:arrow-right-up-linear" className="text-[10px]" />
                      </a>
                    ) : (
                      <Link
                        to={`/plays/${play.slug || play.id}`}
                        className="px-2.5 py-1 rounded-md bg-surface-2 hover:bg-surface-3 border border-border text-text-primary text-[10px] font-bold shrink-0"
                      >
                        View
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
