/**
 * Precompute "More Like This" into the film_related table.
 *
 *   npx tsx scripts/build_related_films.ts             # full rebuild
 *   npx tsx scripts/build_related_films.ts --limit=200
 *   npx tsx scripts/build_related_films.ts --dry
 *   npx tsx scripts/build_related_films.ts --film=<uuid> --dry
 *
 * Blend: shared cast/crew > Cohere embedding similarity > rarity-weighted genre >
 * minority language > same series > year, with popularity as tiebreak / fallback.
 */
import { supabase } from './lib/db';

const TOP_N = 12;
const CANDIDATE_CAP = 400;
const MIN_GENRE_IDF = 1.0;
const EMB_NEIGHBOR_N = 40;
/** Cosine similarity weight — ~0.55+ similarity ≈ cast-level signal. */
const EMB_SCORE_WEIGHT = 14;

const arg = (name: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}`));
  if (!hit) return undefined;
  const eq = hit.indexOf('=');
  return eq === -1 ? 'true' : hit.slice(eq + 1);
};
const LIMIT = arg('limit') ? Number(arg('limit')) : Infinity;
const DRY = arg('dry') !== undefined;
const FOCUS = arg('film') || undefined; // --film= alone must not mean "all films"

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

const titleKey = (t: string | null) =>
  String(t ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();

function sameMovieTitle(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 8 && long.includes(short);
}

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

async function embeddingNeighbors(filmId: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const { data, error } = await supabase.rpc('match_related_by_embedding', {
      p_film_id: filmId,
      match_count: EMB_NEIGHBOR_N,
    });
    if (error) {
      // Table/RPC missing yet — related still works on cast/genre alone.
      if (!/does not exist|film_embeddings|match_related/i.test(error.message)) {
        console.warn(`emb neighbors ${filmId.slice(0, 8)}: ${error.message}`);
      }
      return map;
    }
    for (const row of data || []) {
      if (row?.film_id) map.set(row.film_id, Number(row.similarity) || 0);
    }
  } catch {
    // ignore
  }
  return map;
}

async function main() {
  console.log('Loading catalogue…');
  const films = await pageAll<Film>(
    'films',
    'id, title, year, language, content_type, series_id, view_count, liked_percent',
    (q) => q.eq('is_published', true),
  );
  console.log(`   ${films.length} published films`);

  const filmById = new Map(films.map((f) => [f.id, f]));
  const keyById = new Map(films.map((f) => [f.id, titleKey(f.title)]));

  console.log('Loading credits…');
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

  console.log('Loading genres…');
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
  const totalGenred = genresByFilm.size || 1;
  const genreIdf = new Map<number, number>();
  for (const [gid, freq] of genreFreq) genreIdf.set(gid, Math.log(totalGenred / freq));
  const rareGenres = new Set([...genreIdf].filter(([, idf]) => idf >= MIN_GENRE_IDF).map(([gid]) => gid));
  console.log(`   ${rareGenres.size}/${genreIdf.size} genres clear the IDF bar`);

  const genreRows = await pageAll<{ id: number; name: string }>('genres', 'id, name');
  const genreName = new Map(genreRows.map((g) => [g.id, g.name]));

  console.log('Loading person names…');
  const people = await pageAll<{ id: string; name: string }>('people', 'id, name');
  const personName = new Map(people.map((p) => [p.id, p.name]));

  const { count: embCount } = await supabase
    .from('film_embeddings')
    .select('film_id', { count: 'exact', head: true });
  console.log(`   ${embCount ?? 0} film embeddings available`);

  const pop = (f?: Film) =>
    (Math.log10((f?.view_count ?? 0) + 1) * 2) + ((f?.liked_percent ?? 0) / 100);

  const globalTop = [...films].sort((a, b) => pop(b) - pop(a)).slice(0, 120).map((f) => f.id);

  console.log(`\nScoring${DRY ? ' (dry run)' : ''}…`);
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
    const embSims = await embeddingNeighbors(film.id);

    const myTitleKey = keyById.get(film.id) ?? '';
    const cand = new Map<string, { sharedPeople: string[]; sharedGenres: number[]; embSim: number }>();
    const bump = (fid: string, kind: 'p' | 'g' | 'e', key: string | number, embSim = 0) => {
      if (fid === film.id || !filmById.has(fid)) return;
      if (sameMovieTitle(myTitleKey, keyById.get(fid) ?? '')) return;
      let e = cand.get(fid);
      if (!e) {
        e = { sharedPeople: [], sharedGenres: [], embSim: 0 };
        cand.set(fid, e);
      }
      if (kind === 'p') e.sharedPeople.push(key as string);
      else if (kind === 'g') e.sharedGenres.push(key as number);
      else e.embSim = Math.max(e.embSim, embSim);
    };
    for (const { person_id } of myPeople) for (const fid of filmsByPerson.get(person_id) ?? []) bump(fid, 'p', person_id);
    for (const gid of myGenres) {
      if (!rareGenres.has(gid)) continue;
      for (const fid of filmsByGenre.get(gid) ?? []) bump(fid, 'g', gid);
    }
    for (const [fid, sim] of embSims) bump(fid, 'e', fid, sim);

    let scored = [...cand.entries()].map(([fid, e]) => {
      const cf = filmById.get(fid)!;
      let castScore = 0;
      for (const _pid of e.sharedPeople) castScore += 6;
      let genreScore = 0;
      for (const gid of e.sharedGenres) genreScore += (genreIdf.get(gid) ?? 0) * 1.5;
      const candLang = String(cf.language ?? '').toLowerCase().trim();
      const langScore = langDiscriminates && candLang === myLang ? 4 : 0;
      const seriesScore = film.series_id && cf.series_id && film.series_id === cf.series_id ? 8 : 0;
      const yearScore = film.year && cf.year ? Math.max(0, 3 - Math.abs(film.year - cf.year) / 5) : 0;
      const typePenalty = film.content_type && cf.content_type && film.content_type !== cf.content_type ? -3 : 0;
      const embScore = e.embSim > 0.2 ? e.embSim * EMB_SCORE_WEIGHT : 0;

      const base = castScore + genreScore + langScore + seriesScore + yearScore + typePenalty + embScore;
      const score = base + pop(cf) * 0.5;
      return { fid, score, e, castScore, genreScore, langScore, seriesScore, embScore };
    });

    scored = scored
      .filter((s) => s.castScore > 0 || s.genreScore > 0 || s.seriesScore > 0 || s.langScore > 0 || s.embScore > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, CANDIDATE_CAP);

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

    if (top.length < TOP_N) {
      const have = new Set(top.map((t) => t.fid));
      const rareGid = myGenres.find((g) => rareGenres.has(g));
      const pool = (rareGid !== undefined
        ? [...(filmsByGenre.get(rareGid) ?? [])].sort((a, b) => pop(filmById.get(b)) - pop(filmById.get(a)))
        : globalTop
      ).filter((fid) => fid !== film.id && !have.has(fid) && filmById.has(fid));
      const filler = pool
        .slice(0, TOP_N - top.length)
        .map((fid) => ({
          fid,
          score: pop(filmById.get(fid)),
          e: { sharedPeople: [], sharedGenres: [], embSim: 0 },
          castScore: 0,
          genreScore: 0,
          langScore: 0,
          seriesScore: 0,
          embScore: 0,
        }));
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
    if (processed % 500 === 0) console.log(`   scored ${processed}/${targets.length}`);
  }

  console.log(`\nComputed ${rowsToWrite.length} related rows for ${processed} films`);

  if (DRY) {
    const titleById = new Map(films.map((f) => [f.id, f.title]));
    const byFilm = new Map<string, typeof rowsToWrite>();
    for (const r of rowsToWrite) (byFilm.get(r.film_id) ?? byFilm.set(r.film_id, []).get(r.film_id)!).push(r);

    const show = (fid: string) => {
      const rows = byFilm.get(fid) ?? [];
      console.log(`\n"${titleById.get(fid) ?? fid}"  (${fid.slice(0, 8)})`);
      rows.slice(0, 8).forEach((r) =>
        console.log(`   #${r.rank}  ${String(r.score).padEnd(7)} ${(r.reason ?? '·').padEnd(26)} → ${titleById.get(r.related_id) ?? r.related_id}`),
      );
    };

    if (FOCUS) show(FOCUS);
    else {
      const withReason = [...byFilm.keys()].filter((fid) => (byFilm.get(fid) ?? []).some((r) => r.reason));
      console.log(`\n--- DRY: ${withReason.length}/${byFilm.size} films have a reason ---`);
      withReason.slice(0, 4).forEach(show);
    }
    return;
  }

  console.log('\nWriting…');
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
  console.log('Done.');
}

function reasonFor(
  t: { castScore: number; genreScore: number; langScore: number; seriesScore: number; embScore: number; e: any },
  personName: Map<string, string>,
  genreName: Map<number, string>,
  candFilm?: Film,
): string | null {
  if (t.seriesScore > 0) return 'From the same series';
  if (t.castScore >= t.genreScore && t.castScore >= t.embScore && t.castScore > 0 && t.e?.sharedPeople?.length) {
    const nm = personName.get(t.e.sharedPeople[0]);
    if (nm) return `More with ${nm}`;
  }
  if (t.embScore >= t.genreScore && t.embScore > 0) return 'Similar story';
  if (t.genreScore > 0 && t.e?.sharedGenres?.length) {
    const rarest = t.e.sharedGenres[0];
    const gn = genreName.get(rarest);
    if (gn) return `More ${gn}`;
  }
  if (t.langScore > 0 && candFilm?.language) return `More ${candFilm.language} films`;
  return null;
}

main().catch((e) => {
  console.error('build_related_films failed:', e);
  process.exit(1);
});
