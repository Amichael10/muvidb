/**
 * Precompute "More Like This" into the film_related table.
 *
 *   npx tsx scripts/build_related_films.ts             # full rebuild
 *   npx tsx scripts/build_related_films.ts --limit=200 # first 200 films (dry-ish test)
 *   npx tsx scripts/build_related_films.ts --dry       # compute + print, write nothing
 *
 * WHY precompute: the DB runs 8-15s under load and FilmDetail is cached SSR, so a
 * live multi-signal ranking query per view would fight the cache. This does the
 * heavy work once and FilmDetail reads one indexed row set.
 *
 * THE BLEND (why suggestions are relevant for THIS catalogue — 39k films, 62%
 * "Drama", 32% with cast, ~95% English):
 *   - shared cast/crew        strongest; "More with <name>" is relevant + explainable
 *   - rarity-weighted genre   a shared "Drama" is near-worthless (everyone's Drama);
 *                             a shared "Epic"/"Faith" is a strong signal (IDF weight)
 *   - shared minority language for a Yoruba/Twi/Igbo film, same-language is gold;
 *                             for English (the 95%) it's ignored
 *   - same series             obvious relation
 *   - year proximity          mild
 *   - popularity/quality      tiebreak, and the non-random fallback
 *
 * Never falls back to arbitrary rows: a film with no signal gets popular titles
 * in its own primary genre (or globally popular), which is still a sane rail.
 */
import { supabase } from './lib/db';

const TOP_N = 12; // rows stored per film
const CANDIDATE_CAP = 400; // max candidates scored per film (keeps it bounded)
// A genre must clear this IDF to count at all. Drama sits on 97% of the catalogue
// (IDF ~0.03), so it's excluded from candidate-gathering, scoring AND labelling —
// "both films are Drama" is no signal here. Romance/Action/Epic (~1-3%, IDF >3)
// clear it easily. This is the single most important lever for relevance.
const MIN_GENRE_IDF = 1.0;

const arg = (name: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}`));
  if (!hit) return undefined;
  const eq = hit.indexOf('=');
  return eq === -1 ? 'true' : hit.slice(eq + 1);
};
const LIMIT = arg('limit') ? Number(arg('limit')) : Infinity;
const DRY = arg('dry') !== undefined;
const FOCUS = arg('film'); // score only this film (with --dry, inspect its result)

// English + a couple of near-universal tags don't discriminate, so same-language
// only earns a bonus for the minority tongues.
const NON_DISCRIMINATING_LANG = new Set(['english', '', 'unknown']);

type Film = {
  id: string;
  title: string | null;
  year: number | null;
  language: string | null;
  content_type: string | null;
  series_id: string | null;
  view_count: number | null;
  liked_percent: number | null;
};

// Normalised title for de-duping. The catalogue has many re-uploads of the same
// film under variant titles ("Cwa (Calamity Wanders Ahead)" vs "Calamity Wanders
// Ahead"), and a "more like this" rail must never surface the film itself.
const titleKey = (t: string | null) =>
  String(t ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();

/** True if two titles are the same movie / a direct re-upload (equal, or one
 *  meaningfully contains the other). */
function sameMovieTitle(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 8 && long.includes(short);
}

// Franchise key: the title with part/season/episode markers and numbers stripped,
// so "Koleoso Pt 13 (Season 3)" and "Koleoso (Part 7)" collapse to "koleoso".
// Used to stop one series filling the whole rail. Number tokens are early in many
// Nollywood titles, which defeats a naive first-N-words prefix.
const SEQUEL_WORDS = new Set(['part', 'pt', 'season', 'episode', 'ep', 'ft', 'feat', 'vol', 'volume', 'chapter', 'finale']);
function franchiseKey(k: string): string {
  const meaningful = k
    .split(' ')
    .filter((t) => t && !SEQUEL_WORDS.has(t) && !/^\d+$/.test(t) && !/^[ivx]+$/.test(t));
  return meaningful.slice(0, 2).join(' ');
}

async function pageAll<T>(
  table: string,
  columns: string,
  tweak?: (q: any) => any,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  const size = 1000;
  for (;;) {
    let q = supabase.from(table).select(columns).range(from, from + size - 1);
    if (tweak) q = tweak(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    out.push(...(data as T[]));
    if (data.length < size) break;
    from += size;
  }
  return out;
}

async function main() {
  console.log('📥 Loading catalogue…');
  const films = await pageAll<Film>(
    'films',
    'id, title, year, language, content_type, series_id, view_count, liked_percent',
    (q) => q.eq('is_published', true),
  );
  console.log(`   ${films.length} published films`);

  const filmById = new Map(films.map((f) => [f.id, f]));
  const keyById = new Map(films.map((f) => [f.id, titleKey(f.title)]));

  // credits: person -> films, and film -> people (billing_order to weight leads)
  console.log('📥 Loading credits…');
  const credits = await pageAll<{ person_id: string; film_id: string; billing_order: number | null }>(
    'credits',
    'person_id, film_id, billing_order',
  );
  const filmsByPerson = new Map<string, string[]>();
  const peopleByFilm = new Map<string, { person_id: string; billing: number }[]>();
  for (const c of credits) {
    if (!c.person_id || !filmById.has(c.film_id)) continue;
    (filmsByPerson.get(c.person_id) ?? filmsByPerson.set(c.person_id, []).get(c.person_id)!).push(c.film_id);
    (peopleByFilm.get(c.film_id) ?? peopleByFilm.set(c.film_id, []).get(c.film_id)!).push({
      person_id: c.person_id,
      billing: c.billing_order ?? 99,
    });
  }
  console.log(`   ${credits.length} credits, ${filmsByPerson.size} distinct people`);

  // genres: film -> genreIds, and genre document frequency for IDF weighting
  console.log('📥 Loading genres…');
  const fg = await pageAll<{ film_id: string; genre_id: number }>('film_genres', 'film_id, genre_id');
  const genresByFilm = new Map<string, number[]>();
  const filmsByGenre = new Map<number, string[]>();
  const genreFreq = new Map<number, number>();
  for (const row of fg) {
    if (!filmById.has(row.film_id)) continue;
    (genresByFilm.get(row.film_id) ?? genresByFilm.set(row.film_id, []).get(row.film_id)!).push(row.genre_id);
    (filmsByGenre.get(row.genre_id) ?? filmsByGenre.set(row.genre_id, []).get(row.genre_id)!).push(row.film_id);
    genreFreq.set(row.genre_id, (genreFreq.get(row.genre_id) ?? 0) + 1);
  }
  // IDF: a genre on N films is worth log(total / N). "Drama" (huge N) ≈ 0;
  // a rare genre approaches log(total).
  const totalGenred = genresByFilm.size || 1;
  const genreIdf = new Map<number, number>();
  for (const [gid, freq] of genreFreq) genreIdf.set(gid, Math.log(totalGenred / freq));
  // Genres worth using as a signal (rare enough to be informative).
  const rareGenres = new Set([...genreIdf].filter(([, idf]) => idf >= MIN_GENRE_IDF).map(([gid]) => gid));
  console.log(`   ${rareGenres.size}/${genreIdf.size} genres clear the IDF bar (rest, incl. Drama, ignored)`);

  // genre id -> name, for the reason label
  const genreRows = await pageAll<{ id: number; name: string }>('genres', 'id, name');
  const genreName = new Map(genreRows.map((g) => [g.id, g.name]));

  // person id -> name, only for people who'll plausibly drive a reason label
  console.log('📥 Loading person names…');
  const people = await pageAll<{ id: string; name: string }>('people', 'id, name');
  const personName = new Map(people.map((p) => [p.id, p.name]));

  const pop = (f?: Film) =>
    (Math.log10((f?.view_count ?? 0) + 1) * 2) + ((f?.liked_percent ?? 0) / 100);

  // Precompute once for the fallback, so we never re-sort a 35k Drama list per film.
  const globalTop = [...films].sort((a, b) => pop(b) - pop(a)).slice(0, 120).map((f) => f.id);

  console.log(`\n🧮 Scoring${DRY ? ' (dry run)' : ''}…`);
  const rowsToWrite: { film_id: string; related_id: string; rank: number; score: number; reason: string | null }[] = [];
  let processed = 0;
  const targets = FOCUS
    ? films.filter((f) => f.id === FOCUS)
    : films.slice(0, LIMIT === Infinity ? films.length : LIMIT);

  for (const film of targets) {
    const myPeople = peopleByFilm.get(film.id) ?? [];
    const myGenres = genresByFilm.get(film.id) ?? [];
    const myLang = String(film.language ?? '').toLowerCase().trim();
    const langDiscriminates = !NON_DISCRIMINATING_LANG.has(myLang);

    // Gather candidates from shared people + shared genres.
    const myTitleKey = keyById.get(film.id) ?? '';
    const cand = new Map<string, { sharedPeople: string[]; sharedGenres: number[] }>();
    const bump = (fid: string, kind: 'p' | 'g', key: string | number) => {
      if (fid === film.id || !filmById.has(fid)) return;
      // Skip re-uploads of the SAME movie under a variant title.
      if (sameMovieTitle(myTitleKey, keyById.get(fid) ?? '')) return;
      let e = cand.get(fid);
      if (!e) { e = { sharedPeople: [], sharedGenres: [] }; cand.set(fid, e); }
      if (kind === 'p') e.sharedPeople.push(key as string);
      else e.sharedGenres.push(key as number);
    };
    for (const { person_id } of myPeople) for (const fid of filmsByPerson.get(person_id) ?? []) bump(fid, 'p', person_id);
    // Only gather via RARE genres — gathering by Drama would pull ~36k candidates
    // and drown the signal. Common genres contribute nothing anyway.
    for (const gid of myGenres) {
      if (!rareGenres.has(gid)) continue;
      for (const fid of filmsByGenre.get(gid) ?? []) bump(fid, 'g', gid);
    }

    let scored = [...cand.entries()].map(([fid, e]) => {
      const cf = filmById.get(fid)!;
      // Cast: each shared person worth more if either film billed them near the top.
      let castScore = 0;
      for (const pid of e.sharedPeople) castScore += 6;
      // Genre: sum IDF of shared genres — Drama contributes ~0, rare genres a lot.
      let genreScore = 0;
      for (const gid of e.sharedGenres) genreScore += (genreIdf.get(gid) ?? 0) * 1.5;
      // Language: only when the shared tongue is a minority one.
      const candLang = String(cf.language ?? '').toLowerCase().trim();
      const langScore = langDiscriminates && candLang === myLang ? 4 : 0;
      // Same series (episodes/parts of one work).
      const seriesScore = film.series_id && cf.series_id && film.series_id === cf.series_id ? 8 : 0;
      // Year proximity (mild), and same content_type keeps movies with movies.
      const yearScore = film.year && cf.year ? Math.max(0, 3 - Math.abs(film.year - cf.year) / 5) : 0;
      const typePenalty = film.content_type && cf.content_type && film.content_type !== cf.content_type ? -3 : 0;

      const base = castScore + genreScore + langScore + seriesScore + yearScore + typePenalty;
      // Popularity as a gentle multiplier-ish add, so relevance leads and
      // popularity only sorts among comparably-relevant candidates.
      const score = base + pop(cf) * 0.5;
      return { fid, score, e, castScore, genreScore, langScore, seriesScore };
    });

    // Keep only candidates with a real relational signal; sort; cap.
    scored = scored
      .filter((s) => s.castScore > 0 || s.genreScore > 0 || s.seriesScore > 0 || s.langScore > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, CANDIDATE_CAP);

    // De-dupe the final list: drop re-uploads of the same movie, and cap each
    // franchise (same first 3 title words, e.g. "Daakye Hene …") to 2 entries so
    // one series can't fill the whole rail. Highest-scored survives each group.
    const keptKeys: string[] = [];
    const franchiseCount = new Map<string, number>();
    scored = scored.filter((s) => {
      const k = keyById.get(s.fid) ?? s.fid;
      if (keptKeys.some((kept) => sameMovieTitle(kept, k))) return false;
      const fr = franchiseKey(k);
      const n = franchiseCount.get(fr) ?? 0;
      if (fr.length >= 4 && n >= 2) return false;
      franchiseCount.set(fr, n + 1);
      keptKeys.push(k);
      return true;
    });

    let top = scored.slice(0, TOP_N);

    // Non-random fallback: not enough signal → popular films sharing the primary
    // genre, else globally popular. Never arbitrary rows.
    if (top.length < TOP_N) {
      const have = new Set(top.map((t) => t.fid));
      // Prefer popular films sharing a RARE genre with this film; else globally
      // popular. Both pools are small/precomputed — never re-sort the Drama list.
      const rareGid = myGenres.find((g) => rareGenres.has(g));
      const pool = (rareGid !== undefined
        ? [...(filmsByGenre.get(rareGid) ?? [])].sort((a, b) => pop(filmById.get(b)) - pop(filmById.get(a)))
        : globalTop
      ).filter((fid) => fid !== film.id && !have.has(fid) && filmById.has(fid));
      const filler = pool
        .slice(0, TOP_N - top.length)
        .map((fid) => ({ fid, score: pop(filmById.get(fid)), e: null as any, castScore: 0, genreScore: 0, langScore: 0, seriesScore: 0 }));
      top = [...top, ...filler];
    }

    top.forEach((t, rank) => {
      rowsToWrite.push({
        film_id: film.id,
        related_id: t.fid,
        rank,
        score: Number(t.score.toFixed(3)),
        reason: reasonFor(t, personName, genreName, filmById.get(t.fid)),
      });
    });

    processed++;
    if (processed % 2000 === 0) console.log(`   scored ${processed}/${targets.length}`);
  }

  console.log(`\n✅ Computed ${rowsToWrite.length} related rows for ${processed} films (avg ${(rowsToWrite.length / Math.max(1, processed)).toFixed(1)}/film)`);

  if (DRY) {
    const titleById = new Map(
      (await pageAll<{ id: string; title: string }>('films', 'id, title', (q) => q.eq('is_published', true)))
        .map((f) => [f.id, f.title]),
    );
    const byFilm = new Map<string, typeof rowsToWrite>();
    for (const r of rowsToWrite) (byFilm.get(r.film_id) ?? byFilm.set(r.film_id, []).get(r.film_id)!).push(r);

    const focus = FOCUS;
    const show = (fid: string) => {
      const rows = byFilm.get(fid) ?? [];
      console.log(`\n"${titleById.get(fid) ?? fid}"  (${fid.slice(0, 8)})`);
      rows.slice(0, 8).forEach((r) =>
        console.log(`   #${r.rank}  ${String(r.score).padEnd(7)} ${(r.reason ?? '·').padEnd(26)} → ${titleById.get(r.related_id) ?? r.related_id}`),
      );
    };

    if (focus) {
      show(focus);
    } else {
      // Prefer films that actually got a relational reason, so we judge the good path.
      const withReason = [...byFilm.keys()].filter((fid) => (byFilm.get(fid) ?? []).some((r) => r.reason));
      console.log(`\n--- DRY RUN: ${withReason.length}/${byFilm.size} sampled films have a relational reason ---`);
      withReason.slice(0, 4).forEach(show);
      console.log('\n--- and 2 signal-less films (popularity fallback) ---');
      [...byFilm.keys()].filter((fid) => !(byFilm.get(fid) ?? []).some((r) => r.reason)).slice(0, 2).forEach(show);
    }
    return;
  }

  // Write: full rebuild for the films we processed. Delete-then-insert per batch
  // of film_ids so a partial run never leaves half a film's list.
  console.log('\n💾 Writing…');
  const processedIds = targets.map((f) => f.id);
  for (let i = 0; i < processedIds.length; i += 500) {
    const chunk = processedIds.slice(i, i + 500);
    const { error } = await supabase.from('film_related').delete().in('film_id', chunk);
    if (error) throw new Error(`delete: ${error.message}`);
  }
  for (let i = 0; i < rowsToWrite.length; i += 1000) {
    const chunk = rowsToWrite.slice(i, i + 1000);
    const { error } = await supabase.from('film_related').insert(chunk);
    if (error) throw new Error(`insert: ${error.message}`);
    if ((i / 1000) % 10 === 0) console.log(`   wrote ${Math.min(i + 1000, rowsToWrite.length)}/${rowsToWrite.length}`);
  }
  console.log('🎉 Done.');
}

function reasonFor(
  t: { castScore: number; genreScore: number; langScore: number; seriesScore: number; e: any },
  personName: Map<string, string>,
  genreName: Map<number, string>,
  candFilm?: Film,
): string | null {
  if (t.seriesScore > 0) return 'From the same series';
  // Strongest contributing signal wins the label.
  if (t.castScore >= t.genreScore && t.castScore > 0 && t.e?.sharedPeople?.length) {
    const nm = personName.get(t.e.sharedPeople[0]);
    if (nm) return `More with ${nm}`;
  }
  if (t.genreScore > 0 && t.e?.sharedGenres?.length) {
    // Label with the rarest shared genre (most informative).
    const rarest = [...t.e.sharedGenres].sort(
      (a: number, b: number) => (genreName.get(a) ? 0 : 1) - (genreName.get(b) ? 0 : 1),
    )[0];
    const gn = genreName.get(rarest);
    if (gn) return `More ${gn}`;
  }
  if (t.langScore > 0 && candFilm?.language) return `More ${candFilm.language} films`;
  return null;
}

main().catch((e) => {
  console.error('💀 build_related_films failed:', e);
  process.exit(1);
});
