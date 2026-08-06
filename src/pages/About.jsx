import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { SOCIAL_LINKS } from '../config/socialLinks';

/**
 * The places a single African film's credits currently live. Rendered as loose,
 * tilted chips because the page's argument is that this information is
 * scattered — a tidy list would quietly contradict the sentence it illustrates.
 */
const SCATTERED_SOURCES = [
  { label: 'Cinema posters', tilt: -3 },
  { label: 'YouTube descriptions', tilt: 2 },
  { label: 'Instagram posts', tilt: -1.5 },
  { label: 'Interviews', tilt: 3 },
  { label: 'Trailers', tilt: -2.5 },
  { label: 'Streaming pages', tilt: 1.5 },
  { label: 'Old blogs', tilt: -2 },
  { label: 'End credits', tilt: 2.5 },
];

const BUILDING = [
  {
    icon: 'solar:clapperboard-play-linear',
    title: 'Movies',
    body: 'African films across cinema, streaming, YouTube, television, and independent releases.',
  },
  {
    icon: 'solar:users-group-rounded-linear',
    title: 'People',
    body: 'Actors, directors, writers, producers, and crew members who contribute to African storytelling.',
  },
  {
    icon: 'solar:link-circle-linear',
    title: 'Credits',
    body: 'Cast and crew connections that show who worked on what.',
  },
  {
    icon: 'solar:star-linear',
    title: 'Reviews and ratings',
    body: 'Audience reactions and opinions that help people decide what to watch.',
  },
  {
    icon: 'solar:ticket-linear',
    title: 'Cinema listings',
    body: 'Information that helps viewers find what is showing and where.',
  },
  {
    icon: 'solar:monitor-smartphone-linear',
    title: 'Where to watch',
    body: 'A guide to where African films can be found across platforms.',
  },
  {
    icon: 'solar:compass-linear',
    title: 'Industry discovery',
    body: 'A better way to follow new releases, upcoming actors, filmmakers, and trends in African cinema.',
  },
];

const ECOSYSTEM = [
  {
    who: 'Movie lovers',
    body: 'It answers the simple questions. What should I watch? Who is in this movie? Where can I find it?',
  },
  {
    who: 'Actors and filmmakers',
    body: 'It creates visibility and continuity across their work.',
  },
  {
    who: 'Upcoming talent',
    body: 'It gives room for smaller credits to count, not just the biggest titles.',
  },
  {
    who: 'Industry professionals',
    body: 'It creates a structured way to understand people, projects, and trends.',
  },
  {
    who: 'African cinema as a whole',
    body: 'It helps preserve memory. When film information is not documented, parts of the industry\u2019s history can easily disappear.',
  },
];

const MISSION_POINTS = [
  'Fans to discover African films and the people behind them.',
  'Actors and filmmakers to have fuller, more accurate public profiles.',
  'Cinemas and platforms to reach audiences looking for African content.',
  'Researchers, journalists, and students to access better film information.',
  'The industry to preserve its creative history as it grows.',
];

const CLOSING = ['culture', 'history', 'identity', 'opportunity'];

function Sprockets({ className = '' }) {
  return (
    <div className={`flex items-center gap-[6px] ${className}`} aria-hidden="true">
      {Array.from({ length: 14 }).map((_, index) => (
        <span key={index} className="h-[9px] w-[6px] rounded-[1px] bg-current opacity-30" />
      ))}
    </div>
  );
}

function Section({ index, title, children }) {
  return (
    <section className="scroll-mt-24 border-t border-hairline pt-12 md:pt-16">
      <div className="flex flex-col gap-8 md:flex-row md:gap-14">
        <div className="md:w-52 md:shrink-0">
          <span className="font-heading text-4xl font-black tabular-nums text-brand opacity-40">
            {String(index).padStart(2, '0')}
          </span>
          <h2 className="mt-2 font-heading text-2xl font-black leading-tight tracking-tight md:text-[28px]">
            {title}
          </h2>
        </div>
        <div className="min-w-0 flex-1 space-y-5 text-[17px] leading-[1.75] text-text-muted">
          {children}
        </div>
      </div>
    </section>
  );
}

export default function About() {
  useEffect(() => {
    document.title = 'About Us | MuviDB';
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      {/* ── Leader ─────────────────────────────────────────────── */}
      <header className="relative overflow-hidden border-b border-border">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          aria-hidden="true"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, var(--color-text-primary) 0 2px, transparent 2px 96px)',
          }}
        />

        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-28 md:pt-36">
          <Sprockets className="mb-10 text-text-primary" />

          <p className="text-[11px] font-black uppercase tracking-[0.42em] text-brand">
            About MuviDB
          </p>

          <h1 className="mt-5 max-w-4xl font-heading text-5xl font-black leading-[0.95] tracking-tighter md:text-7xl">
            African cinema,
            <br />
            properly <span className="text-brand">documented</span>.
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-text-muted">
            MuviDB is a digital platform built to organize, preserve, and make African film
            information easier to discover.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        {/* ── The problem, shown before it is argued ───────────── */}
        <div className="space-y-6 text-[17px] leading-[1.75] text-text-muted">
          <p>
            Across Africa, thousands of films are released every year across cinemas, streaming
            platforms, YouTube, festival circuits, television, and independent distribution
            channels. Actors, directors, writers, producers, editors, cinematographers, and other
            creatives contribute to these stories, but their work is often scattered across
            different places.
          </p>
        </div>

        <div className="mt-9 rounded-2xl border border-border bg-surface p-7 md:p-9">
          <p className="text-[11px] font-black uppercase tracking-[0.32em] text-text-muted">
            Where one film&apos;s credits live today
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            {SCATTERED_SOURCES.map(source => (
              <span
                key={source.label}
                className="rounded-lg border border-dashed border-border bg-surface-2 px-3.5 py-2 text-xs font-bold text-text-muted"
                style={{ transform: `rotate(${source.tilt}deg)` }}
              >
                {source.label}
              </span>
            ))}
          </div>

          <div className="mt-7 flex items-center gap-4 border-t border-hairline pt-7">
            <Icon
              icon="solar:arrow-right-linear"
              width="20"
              className="shrink-0 text-brand"
              aria-hidden="true"
            />
            <p className="text-sm font-bold text-text-primary">
              One record, on one film page, with every credit attached.
            </p>
          </div>
        </div>

        <div className="mt-9 space-y-6 text-[17px] leading-[1.75] text-text-muted">
          <p>
            In many cases, the full journey of a film or filmmaker is difficult to trace.{' '}
            <strong className="text-text-primary">MuviDB exists to change that.</strong>
          </p>
          <p>
            We are building a central home for African movies, people, credits, reviews, cinema
            listings, and industry information. Our goal is simple: to make African cinema easier to
            find, easier to understand, and easier to document.
          </p>
        </div>

        {/* ── Sections ─────────────────────────────────────────── */}
        <div className="mt-16 space-y-12 md:mt-20 md:space-y-16">
          <Section index={1} title="Why we do this">
            <p className="text-xl font-bold leading-snug text-text-primary">
              African cinema is too important to remain fragmented.
            </p>
            <p>
              For decades, African filmmakers have created stories that reflect our culture,
              language, humor, pain, ambition, history, faith, family life, politics, love, and
              everyday realities. From Nollywood to Ghanaian cinema, from South African productions
              to Francophone African films, from cinema releases to YouTube dramas and independent
              features, African storytelling continues to grow in scale and influence.
            </p>
            <p>But the information around these films has not grown at the same pace.</p>
            <p>
              Many African actors and filmmakers do not have complete public filmographies. Many
              films have incomplete cast and crew records. Some projects are difficult to find after
              release. Upcoming actors can appear in several YouTube films, short films, web series,
              or independent projects, yet their public profiles may only show one or two recognized
              titles. This creates a gap between the work people have actually done and what the
              internet remembers about them.
            </p>
            <p>
              That gap is what MuviDB is trying to close. We believe every African film deserves to
              be discoverable, and every creative deserves a record that reflects their work more
              accurately.
            </p>
          </Section>

          <Section index={2} title="The moment that made this feel urgent">
            <p>
              One day, I was scrolling through TikTok and saw a video of an upcoming Nollywood
              actress celebrating that she had finally been listed on IMDb for one movie. She was
              genuinely happy, and that moment stayed with me.
            </p>
            <p>
              Out of curiosity, I checked her profile. What I found was familiar: the profile
              existed, but it did not capture her full journey. It showed one part of her work, but
              not the many other projects she had appeared in, especially YouTube films and smaller
              productions that were still part of her growth as an actor.
            </p>
            <p>
              For many African creatives, being &ldquo;visible&rdquo; online does not always mean
              being fully represented. A person can be working, building, acting, directing,
              writing, producing, and growing, yet the public record may only show a tiny fraction
              of their journey.
            </p>
            <p className="font-bold text-text-primary">
              MuviDB is being built for that missing record.
            </p>

            <figure className="relative mt-9 overflow-hidden rounded-2xl border border-border bg-surface-2 p-7 md:p-10">
              <span
                className="absolute inset-y-0 left-0 w-1.5 bg-brand"
                aria-hidden="true"
              />
              <blockquote className="font-heading text-xl font-black leading-snug tracking-tight text-text-primary md:text-[26px]">
                African cinema does not have a talent problem. It has a documentation problem.
                MuviDB is our attempt to make sure the work, the people, and the stories are easier
                to find, connect, and remember.
              </blockquote>
            </figure>
          </Section>

          <Section index={3} title={'What we\u2019re building'}>
            <p>
              MuviDB is more than a list of films. It is a growing film knowledge platform focused
              on African cinema and the people behind it. We are building tools and records that
              help users discover:
            </p>

            <ul className="grid gap-3 pt-2 sm:grid-cols-2">
              {BUILDING.map(item => (
                <li
                  key={item.title}
                  className="group rounded-xl border border-border bg-surface p-5 transition-colors hover:border-brand/40"
                >
                  <Icon
                    icon={item.icon}
                    width="22"
                    className="text-brand"
                    aria-hidden="true"
                  />
                  <h3 className="mt-3 font-heading text-base font-black tracking-tight text-text-primary">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{item.body}</p>
                </li>
              ))}
            </ul>

            <p className="pt-2">
              Our long-term goal is to make MuviDB a reliable reference point for African movies and
              film professionals, whether someone is a fan, researcher, journalist, actor,
              filmmaker, producer, casting director, cinema lover, or casual viewer looking for what
              to watch.
            </p>
          </Section>

          <Section index={4} title="Why African film information needs a home">
            <p>
              African film information is often scattered because the industry itself is diverse and
              fast-moving.
            </p>
            <p>
              A film may be announced on Instagram, released in cinemas for a short period, later
              appear on a streaming platform, then move to YouTube or television. Cast information
              may change between posters, trailers, and final credits. Some actors are tagged in
              promotional posts, while others are not. Crew members may be listed in end credits but
              never indexed anywhere else. Smaller productions may never reach major databases at
              all.
            </p>
            <p className="font-bold text-text-primary">This makes discovery difficult.</p>
            <ul className="space-y-3 border-l-2 border-hairline pl-6">
              <li>
                For <strong className="text-text-primary">viewers</strong>, it becomes hard to know
                what to watch, who is in a film, or where to find it.
              </li>
              <li>
                For <strong className="text-text-primary">actors and filmmakers</strong>, it becomes
                hard to build a public record of their work.
              </li>
              <li>
                For <strong className="text-text-primary">researchers and journalists</strong>, it
                becomes hard to trace film history, career growth, industry patterns, and cultural
                impact.
              </li>
              <li>
                For <strong className="text-text-primary">the industry</strong>, it means valuable
                information can disappear.
              </li>
            </ul>
            <p>
              MuviDB is our response to this problem. We want to bring structure to the scattered
              pieces.
            </p>
          </Section>

          <Section index={5} title="Our mission">
            <p className="text-xl font-bold leading-snug text-text-primary">
              To document and organize African cinema so that its films, people, and stories can be
              discovered, credited, and remembered.
            </p>
            <p>We want to make it easier for:</p>
            <ul className="space-y-3">
              {MISSION_POINTS.map(point => (
                <li key={point} className="flex gap-3">
                  <Icon
                    icon="solar:check-circle-linear"
                    width="19"
                    className="mt-1 shrink-0 text-brand"
                    aria-hidden="true"
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section index={6} title="Our vision">
            <p className="text-xl font-bold leading-snug text-text-primary">
              To become the most useful and trusted discovery platform for African cinema.
            </p>
            <p>
              We imagine a future where an upcoming actor&rsquo;s YouTube features matter. Where an
              independent filmmaker&rsquo;s first short film can be part of their visible journey.
              Where a viewer can find what is showing in cinemas, what is streaming, who acted in a
              film, who directed it, and how audiences responded to it.
            </p>
            <p>
              We want MuviDB to become a living archive of African film culture. Not a static
              catalogue, but a growing map of the people, stories, platforms, and moments shaping
              African cinema.
            </p>
          </Section>

          <Section index={7} title="Built for the whole ecosystem">
            <p>MuviDB is built for everyone who cares about African film.</p>
            <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border">
              {ECOSYSTEM.map(item => (
                <div key={item.who} className="bg-surface p-5 md:flex md:gap-6 md:p-6">
                  <dt className="font-heading text-sm font-black tracking-tight text-text-primary md:w-56 md:shrink-0">
                    {item.who}
                  </dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-text-muted md:mt-0">
                    {item.body}
                  </dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section index={8} title="What makes MuviDB different">
            <p>
              MuviDB is focused on African cinema from the ground up.{' '}
              <strong className="text-text-primary">That focus matters.</strong>
            </p>
            <p>
              Many global databases exist, but African films are often underrepresented, incomplete,
              or treated as side entries in a much larger global system. MuviDB is designed with the
              realities of African film distribution in mind, including cinema releases, YouTube
              features, independent projects, streaming originals, festival films, and
              social-media-driven discovery.
            </p>
            <p>
              We are not only interested in the biggest names. We also care about the emerging
              actors, the background crew, the independent producers, the YouTube filmmakers, and
              the early-career creatives whose journeys are still being built.
            </p>
            <p className="font-bold text-text-primary">
              MuviDB is built around the belief that every credit is part of a story.
            </p>
          </Section>

          <Section index={9} title="Our belief">
            <ul className="space-y-4">
              {[
                'African cinema deserves better documentation.',
                'visibility should not be limited to only the most popular films or the most established actors.',
                'upcoming creatives deserve to have their work recognized as part of their journey.',
                'audiences should be able to discover African films more easily.',
                'the industry\u2019s history should not be scattered across posts, captions, posters, and memory.',
              ].map(belief => (
                <li key={belief} className="flex gap-3.5">
                  <span
                    className="mt-2.5 h-1.5 w-4 shrink-0 rounded-full bg-brand"
                    aria-hidden="true"
                  />
                  <span>
                    <span className="font-bold text-text-primary">We believe</span> {belief}
                  </span>
                </li>
              ))}
            </ul>
            <p className="pt-1">MuviDB is our contribution to solving that.</p>
          </Section>

          <Section index={10} title="The road ahead">
            <p>
              MuviDB is still growing. The database will continue to expand as more films, people,
              credits, reviews, cinema listings, and watch options are added. Like African cinema
              itself, MuviDB is a work in progress, shaped by the people, stories, and communities
              it serves.
            </p>
            <p>
              Our work is not only about building a database. It is about building memory, access,
              and visibility for African film.
            </p>
          </Section>

          <Section index={11} title="Data attribution">
            <p>
              Some catalogue metadata and images are sourced via{' '}
              <a
                href="https://www.themoviedb.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-brand hover:underline"
              >
                The Movie Database (TMDB)
              </a>
              . This product uses the TMDB API but is not endorsed or certified by TMDB.
            </p>
            <a
              href="https://www.themoviedb.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center"
              aria-label="The Movie Database — opens in a new tab"
            >
              <img
                src="/images/attribution/tmdb-logo.svg"
                alt="TMDB"
                className="h-8 w-auto opacity-90"
                width="160"
                height="35"
              />
            </a>
          </Section>
        </div>

        {/* ── Closing statement ────────────────────────────────── */}
        <section className="mt-16 overflow-hidden rounded-2xl border border-border bg-surface-2 px-7 py-14 md:mt-20 md:px-14 md:py-20">
          <Sprockets className="mb-9 text-text-primary" />
          <p className="font-heading text-2xl font-black leading-tight tracking-tighter md:text-4xl">
            African cinema is not just entertainment.
          </p>
          <ul className="mt-8 flex flex-wrap gap-x-3 gap-y-2">
            {CLOSING.map(word => (
              <li
                key={word}
                className="font-heading text-3xl font-black leading-none tracking-tighter text-brand md:text-5xl"
              >
                {word}
                <span className="text-text-muted opacity-30">.</span>
              </li>
            ))}
          </ul>
          <p className="mt-9 max-w-xl text-[17px] leading-relaxed text-text-muted">
            And it deserves to be documented properly.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/browse"
              className="rounded-lg bg-brand px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90 active:scale-95"
            >
              Browse the database
            </Link>
            <Link
              to="/contact"
              className="rounded-lg border border-border bg-surface px-6 py-3 text-xs font-black uppercase tracking-widest text-text-primary transition-all hover:border-brand hover:text-brand active:scale-95"
            >
              Get in touch
            </Link>
          </div>
        </section>

        {/* ── Follow ───────────────────────────────────────────── */}
        <section className="mt-9 rounded-2xl border border-border bg-surface p-7 md:p-9">
          <h2 className="font-heading text-xl font-black tracking-tight">Connect with us</h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-text-muted">
            Join our growing community of film lovers and creators. Follow us for the latest
            updates, recommendations, and behind-the-scenes content.
          </p>

          <ul className="mt-7 flex flex-wrap gap-3">
            {SOCIAL_LINKS.map(social => {
              const content = (
                <>
                  <Icon icon={social.icon} width="20" aria-hidden="true" />
                  <span className="flex flex-col leading-tight">
                    <span className="text-sm font-bold">{social.label}</span>
                    <span className="text-[11px] font-semibold text-text-muted">
                      {social.handle}
                    </span>
                  </span>
                </>
              );

              return (
                <li key={social.label}>
                  {social.href ? (
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 px-5 py-3 text-text-primary transition-all hover:border-brand hover:text-brand"
                    >
                      {content}
                    </a>
                  ) : (
                    <span className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-surface-2 px-5 py-3 text-text-muted opacity-50">
                      {content}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── Google disclosure. Required for our OAuth and YouTube API
               verification — keep this wording discoverable. ────────── */}
        <section className="mt-9 rounded-2xl border border-border bg-surface-2 p-7 md:p-9">
          <h2 className="font-heading text-xl font-black tracking-tight">Google services we use</h2>
          <dl className="mt-5 space-y-4 text-[15px] leading-relaxed text-text-muted">
            <div>
              <dt className="font-bold text-text-primary">Google Sign-In</dt>
              <dd>
                Optional account creation. We receive your name, email, and profile photo only if
                you choose to sign in with Google.
              </dd>
            </div>
            <div>
              <dt className="font-bold text-text-primary">YouTube Data API</dt>
              <dd>
                Public catalogue metadata — titles, thumbnails, statistics, and channel information
                — so MuviDB can list free African films and trailers. We do not access private
                YouTube account data.
              </dd>
            </div>
          </dl>
          <p className="mt-5 text-[15px] text-text-muted">
            Details are in our{' '}
            <Link to="/privacy" className="font-bold text-brand hover:underline">
              Privacy Policy
            </Link>{' '}
            and{' '}
            <Link to="/terms" className="font-bold text-brand hover:underline">
              Terms
            </Link>
            .
          </p>
        </section>

        <Sprockets className="mt-14 justify-center text-text-primary" />
      </main>
    </div>
  );
}
