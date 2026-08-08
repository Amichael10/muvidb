/**
 * NFVCB approved-movies sync.
 *
 * The National Film and Video Censors Board publishes what it has actually
 * classified, month by month, at nfvcb.gov.ng/approved-movies — with the real
 * rating plus director, producer, cast, runtime, language and production
 * company. That makes this the one legitimate source of NFVCB ratings: an
 * inferred classification would be fabricating a government decision, but an
 * imported one is simply the Board's own published record.
 *
 *   npm run sync:nfvcb              # recent months
 *   npm run sync:nfvcb -- --months=january-2026,february-2026
 *   npm run sync:nfvcb -- --dry
 *
 * Matching is the risk, not fetching. Official titles are short, clean and ALL
 * CAPS; ours carry YouTube headline noise. Substring matching alone produces
 * confident nonsense — "STRINGS" hits "Strings of Sweet Love", "IMA" hits an
 * unrelated talk-show upload. Runtime is what separates a real match from a
 * collision, so anything not confirmed by runtime goes to
 * nfvcb_pending_matches for a human instead of being applied.
 */

import { supabase } from './lib/db';
import { startSyncLog } from './lib/sync';

const SOURCE = 'nfvcb_approved_movies';

/** Runtime agreement within this many minutes counts as confirmation. */
const RUNTIME_TOLERANCE_MIN = 5;

const RATINGS = new Set(['G', 'PG', '12', '12A', '15', '18', 'RE']);

const LABELS = [
  'Duration',
  'Language',
  'Director',
  'Producer',
  'Major Cast',
  'Preview Location',
  'Consumer Advice',
  'Date of Approval',
];

type NfvcbEntry = {
  title: string;
  company: string | null;
  rating: string | null;
  runtimeMinutes: number | null;
  language: string | null;
  director: string | null;
  producer: string | null;
  cast: string[];
  approvedOn: string | null;
};

function arg(name: string): string | null {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

/**
 * Recent months, newest first. The site exposes one page per month and no
 * index API, so the window is generated rather than crawled.
 */
function recentMonths(count = 6): string[] {
  const names = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${names[d.getUTCMonth()]}-${d.getUTCFullYear()}`);
  }
  return out;
}

/**
 * The site is a Next.js App Router build: no JSON API, page data arrives as
 * RSC flight payloads. Card class names are Tailwind-generated and exactly the
 * kind of thing that broke prime_sync, so this flattens to text and parses by
 * label structure instead.
 */
function toText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
}

export function parseEntries(text: string): NfvcbEntry[] {
  const lines = text.split('\n');
  const entries: NfvcbEntry[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (!RATINGS.has(lines[i])) continue;
    // The page's summary panel also lists bare rating tokens, but those are
    // followed by a count rather than the first field label.
    if (lines[i + 1] !== 'Duration') continue;

    const title = lines[i - 2];
    const company = lines[i - 1];
    if (!title) continue;

    const fields: Record<string, string> = {};
    for (let j = i + 1; j < Math.min(lines.length, i + 20); j += 1) {
      if (LABELS.includes(lines[j])) {
        fields[lines[j]] = lines[j + 1] || '';
        if (lines[j] === 'Date of Approval') break;
      }
    }

    const duration = (fields.Duration || '').match(/(\d+)\s*MIN/i);

    entries.push({
      title,
      company: company && !LABELS.includes(company) ? company : null,
      rating: lines[i],
      runtimeMinutes: duration ? Number(duration[1]) : null,
      language: fields.Language || null,
      director: fields.Director || null,
      producer: fields.Producer || null,
      cast: (fields['Major Cast'] || '').split(/\s*,\s*/).map(n => n.trim()).filter(Boolean),
      approvedOn: fields['Date of Approval'] || null,
    });
  }

  return entries;
}

async function fetchMonth(slug: string): Promise<NfvcbEntry[]> {
  const res = await fetch(`https://nfvcb.gov.ng/approved-movies/approved-movies-${slug}`, {
    headers: { 'user-agent': 'MuviDB/1.0 (+https://muvidb.com)' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseEntries(toText(await res.text()));
}

function runtimeAgrees(a: number | null, b: number | null | undefined): boolean {
  if (!a || !b) return false;
  return Math.abs(a - b) <= RUNTIME_TOLERANCE_MIN;
}

type MatchOutcome =
  | { kind: 'matched'; filmId: string; filmTitle: string; via: 'title' | 'title+runtime' | 'fuzzy+runtime' }
  | { kind: 'queue'; reason: string; candidateId?: string; candidateTitle?: string };

/**
 * Match cascade. Each step is only allowed to auto-apply when the result is
 * unambiguous — a single exact title, or a candidate whose runtime agrees.
 */
async function matchFilm(entry: NfvcbEntry): Promise<MatchOutcome> {
  const { data: exact } = await supabase
    .from('films')
    .select('id,title,runtime_minutes')
    .ilike('title', entry.title)
    .limit(5);

  if (exact?.length === 1) {
    return { kind: 'matched', filmId: exact[0].id, filmTitle: exact[0].title, via: 'title' };
  }

  if (exact && exact.length > 1) {
    const confirmed = exact.filter(f => runtimeAgrees(entry.runtimeMinutes, f.runtime_minutes));
    if (confirmed.length === 1) {
      return { kind: 'matched', filmId: confirmed[0].id, filmTitle: confirmed[0].title, via: 'title+runtime' };
    }
    return {
      kind: 'queue',
      reason: `${exact.length} films share this title and runtime does not single one out`,
      candidateId: exact[0].id,
      candidateTitle: exact[0].title,
    };
  }

  // Substring search is only trusted when runtime confirms it. Short official
  // titles otherwise collide with unrelated long YouTube headlines.
  if (entry.title.length < 8) {
    return { kind: 'queue', reason: 'Title too short to search safely without an exact match' };
  }

  const { data: fuzzy } = await supabase
    .from('films')
    .select('id,title,runtime_minutes')
    .ilike('title', `%${entry.title}%`)
    .limit(5);

  if (!fuzzy?.length) return { kind: 'queue', reason: 'No candidate in catalogue' };

  const confirmed = fuzzy.filter(f => runtimeAgrees(entry.runtimeMinutes, f.runtime_minutes));
  if (confirmed.length === 1) {
    return { kind: 'matched', filmId: confirmed[0].id, filmTitle: confirmed[0].title, via: 'fuzzy+runtime' };
  }

  return {
    kind: 'queue',
    reason: confirmed.length > 1
      ? 'Several candidates agree on runtime'
      : 'Partial title match not confirmed by runtime',
    candidateId: fuzzy[0].id,
    candidateTitle: fuzzy[0].title,
  };
}

/** Match a person by name, creating one only when nothing plausible exists. */
async function findOrCreatePerson(name: string): Promise<string | null> {
  const clean = name.trim();
  if (clean.length < 3) return null;

  const { data: existing } = await supabase
    .from('people')
    .select('id')
    .ilike('name', clean)
    .limit(2);

  if (existing?.length === 1) return existing[0].id;
  // Two people share the name — picking one would attach the credit to the
  // wrong person, so the credit is skipped rather than guessed.
  if (existing && existing.length > 1) return null;

  const { data: created, error } = await supabase
    .from('people')
    .insert({ name: clean, source: SOURCE })
    .select('id')
    .single();

  if (error) return null;
  return created.id;
}

async function applyCredits(filmId: string, entry: NfvcbEntry, dryRun: boolean): Promise<number> {
  // Roles are stored lowercase (57,913 'actor', 11,177 'director'…) and a
  // trigger normalises on write. Inserting 'Actor' meant the duplicate check
  // below never matched the existing 'actor' row, and the insert then collided
  // with credits_film_person_role_uidx.
  const wanted: { name: string; role: string }[] = [];
  if (entry.director) wanted.push({ name: entry.director, role: 'director' });
  if (entry.producer) wanted.push({ name: entry.producer, role: 'producer' });
  entry.cast.forEach(name => wanted.push({ name, role: 'actor' }));

  let added = 0;
  for (const item of wanted) {
    if (dryRun) { added += 1; continue; }

    const personId = await findOrCreatePerson(item.name);
    if (!personId) continue;

    const { data: existing } = await supabase
      .from('credits')
      .select('id')
      .eq('film_id', filmId)
      .eq('person_id', personId)
      .eq('role', item.role)
      .maybeSingle();

    if (existing) continue;

    const { error } = await supabase
      .from('credits')
      .insert({ film_id: filmId, person_id: personId, role: item.role, source: SOURCE });

    // Surfaced rather than swallowed: silently counting only successes hid a
    // run where every insert failed on a missing column and reported 0.
    //
    // 23505 is the exception — the credit already exists, which is a no-op
    // rather than a failure. It can still happen despite the check above when
    // two entries in one month name the same person on the same film.
    if (error) {
      if (error.code !== '23505') {
        console.warn(`[nfvcb] credit insert failed (${item.role} ${item.name}): ${error.message}`);
      }
      continue;
    }
    added += 1;
  }
  return added;
}

async function main() {
  const dryRun = process.argv.includes('--dry');
  const months = (arg('months') || '').split(',').filter(Boolean);
  const slugs = months.length ? months : recentMonths(6);

  const log = await startSyncLog(SOURCE, `Syncing NFVCB approved movies (${slugs.length} months)...`);

  try {
    let rated = 0;
    let credited = 0;
    let queued = 0;

    for (const slug of slugs) {
      let entries: NfvcbEntry[] = [];
      try {
        entries = await fetchMonth(slug);
      } catch (err: any) {
        // A month page that does not exist yet is normal, not a failure.
        console.warn(`[nfvcb] ${slug}: ${err.message}`);
        continue;
      }

      console.log(`[nfvcb] ${slug}: ${entries.length} approved entries`);

      for (const entry of entries) {
        log.counters.processed += 1;
        const outcome = await matchFilm(entry);

        if (outcome.kind === 'queue') {
          queued += 1;
          if (!dryRun) {
            const { error: queueError } = await supabase.from('nfvcb_pending_matches').upsert({
              source_month: slug,
              official_title: entry.title,
              rating: entry.rating,
              runtime_minutes: entry.runtimeMinutes,
              language: entry.language,
              director: entry.director,
              producer: entry.producer,
              major_cast: entry.cast,
              production_company: entry.company,
              approved_on: entry.approvedOn,
              candidate_film_id: outcome.candidateId ?? null,
              candidate_title: outcome.candidateTitle ?? null,
              reason: outcome.reason,
            }, { onConflict: 'source_month,official_title' });

            // Never silent: an unchecked upsert reported 286 rows queued while
            // writing none, because the table had RLS policies but no GRANT.
            if (queueError) {
              log.counters.failed += 1;
              console.warn(`[nfvcb] queue write failed (${entry.title}): ${queueError.message}`);
            }
          }
          continue;
        }

        if (!dryRun && entry.rating) {
          const { error } = await supabase
            .from('films')
            .update({
              nfvcb_rating: entry.rating,
              nfvcb_rating_source: SOURCE,
              nfvcb_rating_verified_at: new Date().toISOString(),
            })
            .eq('id', outcome.filmId);
          if (error) { log.counters.failed += 1; continue; }
        }

        rated += 1;
        credited += await applyCredits(outcome.filmId, entry, dryRun);
        log.counters.updated += 1;
      }

      // The Board's site is a small government host; do not hammer it.
      await new Promise(resolve => setTimeout(resolve, 1200));
    }

    const summary = `NFVCB sync complete. ${rated} films rated, ${credited} credits added, ${queued} queued for review.`;
    console.log(`\n${summary}${dryRun ? ' (dry run — nothing written)' : ''}`);
    await log.finish(summary);
  } catch (err: any) {
    console.error(err);
    await log.fail(err);
    process.exit(1);
  }
}

main();
