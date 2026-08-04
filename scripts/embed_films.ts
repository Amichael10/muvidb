/**
 * Embed published films (title + synopsis) with Cohere → film_embeddings.
 *
 *   npx tsx scripts/embed_films.ts                 # full (skip unchanged hashes)
 *   npx tsx scripts/embed_films.ts --limit=200
 *   npx tsx scripts/embed_films.ts --force         # re-embed even if hash matches
 *   npx tsx scripts/embed_films.ts --dry
 */
import { createHash } from 'crypto';
import { embedWithCohere, hasCohere } from '../api/_lib/ai_service';
import { supabase } from './lib/db';

const BATCH = 96; // Cohere embed max texts per call
const UPSERT_CHUNK = 16; // smaller writes — HNSW index updates time out at 96
const PAGE = 1000;

const arg = (name: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}`));
  if (!hit) return undefined;
  const eq = hit.indexOf('=');
  return eq === -1 ? 'true' : hit.slice(eq + 1);
};

const LIMIT = arg('limit') ? Number(arg('limit')) : Infinity;
const FORCE = arg('force') !== undefined;
const DRY = arg('dry') !== undefined;
const MODEL = process.env.COHERE_EMBED_MODEL || 'embed-v4.0';

type FilmRow = { id: string; title: string | null; synopsis: string | null };

function embedText(f: FilmRow): string {
  const title = String(f.title || '').trim();
  const synopsis = String(f.synopsis || '').replace(/\s+/g, ' ').trim();
  if (synopsis) return `${title}. ${synopsis}`.slice(0, 8000);
  return title.slice(0, 2000);
}

function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 32);
}

function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

async function pageFilms(): Promise<FilmRow[]> {
  const out: FilmRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('films')
      .select('id, title, synopsis')
      .eq('is_published', true)
      .not('title', 'is', null)
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`films: ${error.message}`);
    if (!data?.length) break;
    out.push(...(data as FilmRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
    if (out.length >= LIMIT) break;
  }
  return out.slice(0, LIMIT === Infinity ? out.length : LIMIT);
}

async function loadExistingHashes(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let from = 0;
  for (;;) {
    let data: { film_id: string; content_hash: string }[] | null = null;
    let lastErr: string | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await supabase
        .from('film_embeddings')
        .select('film_id, content_hash')
        .order('film_id')
        .range(from, from + PAGE - 1);
      if (!res.error) {
        data = res.data as any;
        lastErr = null;
        break;
      }
      lastErr = res.error.message;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
    if (lastErr) throw new Error(`film_embeddings: ${lastErr}`);
    if (!data?.length) break;
    for (const row of data) map.set(row.film_id, row.content_hash);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return map;
}

async function main() {
  if (!hasCohere()) {
    console.error('COHERE_API_KEY is not set (.env / .env.local)');
    process.exit(1);
  }

  console.log('Loading published films…');
  const films = await pageFilms();
  console.log(`  ${films.length} films`);

  const existing = FORCE ? new Map<string, string>() : await loadExistingHashes();
  console.log(`  ${existing.size} existing embeddings${!FORCE ? ' (will skip unchanged)' : ''}`);

  const work: { film: FilmRow; text: string; hash: string }[] = [];
  let skippedEmpty = 0;
  let skippedHash = 0;
  for (const film of films) {
    const text = embedText(film);
    if (!text.trim()) {
      skippedEmpty++;
      continue;
    }
    const hash = contentHash(`${MODEL}\n${text}`);
    if (!FORCE && existing.get(film.id) === hash) {
      skippedHash++;
      continue;
    }
    work.push({ film, text, hash });
  }

  console.log(`\nTo embed: ${work.length}  (skip empty=${skippedEmpty}, unchanged=${skippedHash})${DRY ? ' [dry]' : ''}`);
  if (!work.length || DRY) {
    if (DRY && work.length) {
      console.log('Sample texts:');
      work.slice(0, 3).forEach((w) => console.log(`  - ${w.text.slice(0, 100)}…`));
    }
    return;
  }

  let embedded = 0;
  let failed = 0;
  for (let i = 0; i < work.length; i += BATCH) {
    const batch = work.slice(i, i + BATCH);
    try {
      const vectors = await embedWithCohere(
        batch.map((b) => b.text),
        { inputType: 'search_document' }
      );
      if (vectors.length !== batch.length) {
        throw new Error(`embed count mismatch: got ${vectors.length}, expected ${batch.length}`);
      }

      const rows = batch.map((b, idx) => ({
        film_id: b.film.id,
        embedding: toVectorLiteral(vectors[idx]),
        model: MODEL,
        content_hash: b.hash,
        updated_at: new Date().toISOString(),
      }));

      for (let u = 0; u < rows.length; u += UPSERT_CHUNK) {
        const slice = rows.slice(u, u + UPSERT_CHUNK);
        let lastErr: string | null = null;
        for (let attempt = 0; attempt < 4; attempt++) {
          const { error } = await supabase.from('film_embeddings').upsert(slice, { onConflict: 'film_id' });
          if (!error) {
            lastErr = null;
            break;
          }
          lastErr = error.message;
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        }
        if (lastErr) throw new Error(`upsert: ${lastErr}`);
      }

      embedded += batch.length;
      console.log(`  embedded ${embedded}/${work.length}`);
    } catch (err: any) {
      failed += batch.length;
      console.error(`  batch @${i} failed:`, err?.message || err);
      // brief pause then continue — one bad batch shouldn't kill the job
      await new Promise((r) => setTimeout(r, 2000));
    }
    // polite pacing for rate limits
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nDone. embedded=${embedded} failed=${failed}`);
  if (LIMIT === Infinity && embedded > 0) {
    console.log(`
Next (if you dropped the HNSW index for bulk load):
  npx supabase db query --linked "create index if not exists film_embeddings_hnsw_idx on public.film_embeddings using hnsw (embedding vector_cosine_ops);"
Then rebuild related rails:
  npm run related:build
`);
  }
}

main().catch((e) => {
  console.error('embed_films failed:', e);
  process.exit(1);
});
