/**
 * Splits credit-roll lines where the actor and the character ended up in one
 * string, e.g. "Odunlade Adekola Saamu" -> { name: "Odunlade Adekola",
 * character: "Saamu" }.
 *
 * WHY THIS EXISTS
 * PaddleOCR returns a whole text region as a single box, not word boxes. When a
 * film's cast columns sit close together the OCR emits "ACTOR CHARACTER" as one
 * string, so credit_roll_parser's geometric column splitting has no inter-word
 * gap to measure and the pair arrives glued. Deciding which tokens are the
 * person and which are the role is a language judgement, not a spatial one.
 *
 * ORDER OF ATTACK:
 *   1. <= 2 tokens -> nothing to split.
 *   2. Cohere chooses the split POINT.
 *   3. The `people` directory corroborates it: it confirms the name half, and
 *      may move a misplaced point, but ONLY on lines the model agreed contain a
 *      character at all.
 *
 * WHY NOT THE DIRECTORY FIRST
 * It looks cheaper and more trustworthy, and it is neither. "Odunlade Adekola
 * Saamu" (name + character) and "Mercy Johnson Okojie" (a married name, no
 * character) are indistinguishable to the DB: in both cases only the two-word
 * prefix is a row in `people`. Letting a prefix match pick the point therefore
 * commits the surname "Okojie" as a character name. Whether a trailing word is
 * a surname or a role is a language judgement, so the model has to make it.
 *
 * SAFETY: a split is accepted only if it is a faithful partition of the
 * original words, in order, with nothing added, dropped or respelled. The model
 * may therefore only choose a split POINT; it can never invent a character
 * name, which is the failure mode that makes bad data indistinguishable from
 * good.
 */
import { supabase } from './db';

export type SplitSource = 'single' | 'ai' | 'ai+db' | 'db' | 'unsplit';

export type SplitResult = {
  raw: string;
  name: string;
  characterName: string | null;
  source: SplitSource;
};

function tokens(value: string): string[] {
  return String(value || '').trim().split(/\s+/).filter(Boolean);
}

/**
 * True when `name` + `characterName` reproduce `raw` exactly: same words, same
 * order, nothing invented. Comparison ignores case and punctuation only.
 */
export function isFaithfulPartition(raw: string, name: string, characterName: string): boolean {
  const flat = (value: string) => tokens(value)
    .map((t) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
    .join(' ');
  return flat(`${name} ${characterName}`) === flat(raw);
}

/** Every way to cut `raw` into a >=2-word name and a >=1-word character. */
function candidateSplits(raw: string): Array<{ name: string; characterName: string }> {
  const parts = tokens(raw);
  const out: Array<{ name: string; characterName: string }> = [];
  for (let k = 2; k <= parts.length - 1; k++) {
    out.push({
      name: parts.slice(0, k).join(' '),
      characterName: parts.slice(k).join(' '),
    });
  }
  return out;
}

const AI_SYSTEM_PROMPT = `You split Nollywood end-credit lines where an actor's name and their character name were run together by OCR.

You are given lines such as "Odunlade Adekola Saamu" or "Shirly Oaikhenan Gbariye".
Return where the PERSON's name ends and the CHARACTER's name begins.

HARD RULES:
1. You may ONLY choose a split point. Never add, remove, translate, reorder or respell any word. "name" + " " + "character" must equal the input exactly.
2. Nigerian personal names are commonly 2 or 3 words (e.g. "Quadry Abimbola Grace", "Mercy Johnson Okojie"). Characters are usually 1-2 words and are often Yoruba/Igbo given names, nicknames, or titles ("Saamu", "Madam", "Baba Risi", "Iyawo").
3. If the whole line is just a person's name with NO character, set "character" to null.
4. If you are not confident, set "character" to null rather than guessing. A missing character is recoverable; a wrong one is not.

Return JSON only:
{"results":[{"raw":"<input line>","name":"<person part>","character":"<character part or null>"}]}`;

/** Look up many candidate person names in one round trip. */
async function knownPeople(names: string[]): Promise<Map<string, number>> {
  const found = new Map<string, number>();
  const unique = [...new Set(names)].filter(Boolean);
  for (let i = 0; i < unique.length; i += 150) {
    const chunk = unique.slice(i, i + 150);
    const { data } = await supabase
      .from('people')
      .select('name, film_count')
      .in('name', chunk);
    for (const row of (data || []) as any[]) {
      const key = String(row.name).toLowerCase();
      found.set(key, Math.max(found.get(key) ?? 0, row.film_count || 0));
    }
  }
  return found;
}


/** Ask the model where the person's name ends. Returns only faithful splits. */
async function proposeSplits(
  filmTitle: string,
  raws: string[],
): Promise<Map<string, { name: string; characterName: string | null }>> {
  const out = new Map<string, { name: string; characterName: string | null }>();
  const { generateAIContent, parseJSON } = await import('../../api/_lib/ai_service.js');
  const BATCH = 20;

  for (let i = 0; i < raws.length; i += BATCH) {
    const batch = raws.slice(i, i + BATCH);
    const prompt = `${AI_SYSTEM_PROMPT}\n\nFilm: "${filmTitle}"\nLines:\n${JSON.stringify(batch, null, 2)}`;
    try {
      // This timeout has to cover the WHOLE provider chain, not one provider.
      // `preferredProvider` only reorders the chain, so when Cohere hangs
      // ai_service still has to fall through to Gemini/OpenAI/Groq. At 25s the
      // race rejected before the second provider was ever tried, and because
      // the model now chooses every split point that silently returned zero
      // characters for the entire film. One healthy provider alone can take
      // ~18s. This is a background job, so buy the chain real room.
      const response: any = await Promise.race([
        generateAIContent(prompt, { preferredProvider: 'cohere' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('AI split timeout (120s)')), 120_000)),
      ]);
      const parsed = parseJSON(response.text);
      const list: any[] = Array.isArray(parsed) ? parsed : (parsed?.results || []);

      for (const item of list) {
        const raw = String(item?.raw || '').trim();
        if (!raw || !batch.includes(raw) || out.has(raw)) continue;
        const name = String(item?.name || '').trim();
        const character = item?.character ? String(item.character).trim() : '';

        // Reject anything that is not a faithful partition of the input, so the
        // model can only ever have chosen a split POINT.
        if (name && character && isFaithfulPartition(raw, name, character)) {
          out.set(raw, { name, characterName: character });
        } else if (name && !character && isFaithfulPartition(raw, name, '')) {
          out.set(raw, { name, characterName: null });
        }
      }
    } catch (err: any) {
      console.warn(`      ⚠️ AI split skipped (${err?.message}). Leaving these lines unsplit.`);
    }
  }
  return out;
}

/**
 * Split a batch of glued credit strings. Never throws: anything it cannot
 * resolve comes back as `unsplit` with the original string and a null
 * character, which is the safe outcome.
 */
export async function splitCreditNames(
  filmTitle: string,
  raws: string[],
): Promise<Map<string, SplitResult>> {
  const results = new Map<string, SplitResult>();
  const unique = [...new Set(raws.map((r) => String(r || '').trim()).filter(Boolean))];
  if (!unique.length) return results;

  // 1. Nothing to split.
  const splittable: string[] = [];
  for (const raw of unique) {
    if (tokens(raw).length <= 2) {
      results.set(raw, { raw, name: raw, characterName: null, source: 'single' });
    } else {
      splittable.push(raw);
    }
  }
  if (!splittable.length) return results;

  // 2. The model chooses the split point. It must go first: a directory prefix
  //    match cannot tell "Odunlade Adekola | Saamu" from "Mercy Johnson Okojie",
  //    where the leftover is a surname and there is no character at all. Both
  //    look identical to the DB — only "Mercy Johnson" is a row in `people` in
  //    either case — so letting the directory pick the point commits the
  //    surname as a character. Deciding that is a language judgement.
  const proposals = await proposeSplits(filmTitle, splittable);

  // 3. Corroborate against the person directory. One lookup covers the names
  //    the model proposed plus, for lines it DID split, the other possible name
  //    halves, so a well-established person can correct a misplaced point.
  const lookups: string[] = [];
  for (const raw of splittable) {
    const proposed = proposals.get(raw);
    if (!proposed) continue;
    lookups.push(proposed.name);
    if (proposed.characterName) {
      lookups.push(...candidateSplits(raw).map((c) => c.name));
    }
  }

  let directory = new Map<string, number>();
  if (lookups.length) {
    try {
      directory = await knownPeople(lookups);
    } catch (err: any) {
      console.warn(`      ⚠️ Person-directory lookup failed (${err?.message}); accepting AI splits as-is.`);
    }
  }

  for (const raw of splittable) {
    const proposed = proposals.get(raw);

    // 3a. No usable answer -> keep the line whole. A missing character is
    //     recoverable; an invented one is not.
    if (!proposed) {
      results.set(raw, { raw, name: raw, characterName: null, source: 'unsplit' });
      continue;
    }

    // 3b. The model judged the whole line to be a personal name. Never override
    //     this with a directory prefix match — that is the bug described above.
    if (!proposed.characterName) {
      results.set(raw, { raw, name: proposed.name, characterName: null, source: 'ai' });
      continue;
    }

    // 3c. The model split it and the name half is a known person: strongest case.
    if (directory.has(proposed.name.toLowerCase())) {
      results.set(raw, {
        raw,
        name: proposed.name,
        characterName: proposed.characterName,
        source: 'ai+db',
      });
      continue;
    }

    // 3d. The model split it, but a DIFFERENT name half is an established
    //     person. The model agrees a character exists, so only the point is in
    //     question and confirmed data should win it.
    const better = candidateSplits(raw)
      .map((c) => ({ ...c, films: directory.get(c.name.toLowerCase()) }))
      .filter((c) => c.films !== undefined)
      .sort((a, b) => (b.films! - a.films!) || (b.name.length - a.name.length))[0];

    if (better && isFaithfulPartition(raw, better.name, better.characterName)) {
      results.set(raw, {
        raw,
        name: better.name,
        characterName: better.characterName,
        source: 'db',
      });
      continue;
    }

    // 3e. Nobody in the directory yet — which is normal for a newly harvested
    //     person. The split is already a faithful partition, so take it.
    results.set(raw, {
      raw,
      name: proposed.name,
      characterName: proposed.characterName,
      source: 'ai',
    });
  }

  return results;
}
