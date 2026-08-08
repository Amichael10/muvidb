/**
 * Classifying whether a catalogue row is actually a film.
 *
 * The catalogue is harvested from YouTube, so it collects trailers, interviews,
 * behind-the-scenes clips and compilations alongside real films. The existing
 * defence is a regex over the title (`copy-quality.ts`), which cannot use
 * duration or channel and misfires in both directions — 387 rows were removed by
 * hand on 2026-08-01 after it let them through.
 *
 * This module holds the parts that must be correct regardless of which model
 * answers: the prompt, and the parsing of what comes back. Nothing here calls an
 * AI provider, so it is testable without one.
 */

export const FILM_KINDS = [
  'film',
  'trailer',
  'interview',
  'clip',
  'compilation',
  'unclear',
] as const;

export type FilmKind = (typeof FILM_KINDS)[number];

export function isFilmKind(value: unknown): value is FilmKind {
  return typeof value === 'string' && (FILM_KINDS as readonly string[]).includes(value);
}

export type KindCandidate = {
  id: string;
  title: string;
  channel?: string | null;
  runtimeMinutes?: number | null;
};

export type KindVerdict = {
  id: string;
  kind: FilmKind;
  confidence: number;
  reason: string | null;
};

/**
 * Duration is the strongest single signal and the model is told so explicitly:
 * a 90-minute upload is almost never a trailer, and a 2-minute one is almost
 * never a feature. Titles alone cannot settle either case.
 */
export function buildKindPrompt(candidates: KindCandidate[]): string {
  const rows = candidates.map(candidate => ({
    id: candidate.id,
    title: candidate.title,
    channel: candidate.channel ?? null,
    runtime_minutes: candidate.runtimeMinutes ?? null,
  }));

  return [
    'You are cataloguing an African film database sourced largely from YouTube.',
    'For each row decide what the upload actually IS.',
    '',
    'Categories:',
    '- film: a complete movie or a full episode of a series',
    '- trailer: a trailer, teaser or promo',
    '- interview: an interview, press junket or panel',
    '- clip: a scene, behind-the-scenes, bloopers, reaction or vlog',
    '- compilation: a mashup, "best of", or several films in one upload',
    '- unclear: genuinely cannot tell from the information given',
    '',
    'Rules:',
    '1. runtime_minutes is the strongest signal. Over 45 minutes is almost',
    '   always a film even if the title shouts marketing words. Under 5 minutes',
    '   is almost never a film.',
    '2. Marketing noise ("LATEST", "FULL HD", "2024", cast lists after a pipe)',
    '   does NOT make something a trailer. Nollywood titles them that way.',
    '3. When runtime is null and the title is ambiguous, answer "unclear"',
    '   rather than guessing. A wrong "trailer" verdict removes a real film.',
    '4. confidence is 0 to 1. Use below 0.7 whenever you are unsure.',
    '',
    'Return ONLY a JSON array, no prose:',
    '[{"id":"...","kind":"film","confidence":0.0,"reason":"short reason"}]',
    '',
    `Rows: ${JSON.stringify(rows)}`,
  ].join('\n');
}

/**
 * Parses a model response into verdicts.
 *
 * Anything malformed is dropped rather than guessed at, and ids that were not
 * asked about are discarded — a model that invents an id would otherwise have
 * its verdict written onto an unrelated film.
 */
export function parseKindVerdicts(parsed: unknown, requestedIds: string[]): KindVerdict[] {
  if (!Array.isArray(parsed)) return [];

  const allowed = new Set(requestedIds);
  const seen = new Set<string>();
  const verdicts: KindVerdict[] = [];

  for (const row of parsed) {
    if (!row || typeof row !== 'object') continue;

    const entry = row as Record<string, unknown>;
    const id = typeof entry.id === 'string' ? entry.id : null;
    if (!id || !allowed.has(id) || seen.has(id)) continue;
    if (!isFilmKind(entry.kind)) continue;

    const rawConfidence = Number(entry.confidence);
    // An absent or non-numeric confidence is treated as maximum uncertainty, so
    // it can never clear the action threshold by accident.
    const confidence = Number.isFinite(rawConfidence)
      ? Math.min(1, Math.max(0, rawConfidence))
      : 0;

    const reason = typeof entry.reason === 'string' && entry.reason.trim()
      ? entry.reason.trim().slice(0, 200)
      : null;

    seen.add(id);
    verdicts.push({ id, kind: entry.kind, confidence, reason });
  }

  return verdicts;
}

/**
 * Whether a verdict is strong enough to act on.
 *
 * Deliberately one-sided: this only ever proposes *hiding* something, and the
 * cost of hiding a real film is far higher than leaving a trailer visible, so
 * `film` and `unclear` never qualify no matter how confident the model sounds.
 */
export function isActionableVerdict(verdict: KindVerdict, threshold = 0.85): boolean {
  if (verdict.kind === 'film' || verdict.kind === 'unclear') return false;
  return verdict.confidence >= threshold;
}

/**
 * Duration facts the model cannot be allowed to override.
 *
 * A feature-length upload is not a trailer, whatever the title says. This
 * guards against the single most damaging failure: a confident wrong verdict
 * hiding a real film.
 */
export function contradictsRuntime(verdict: KindVerdict, runtimeMinutes: number | null): boolean {
  if (runtimeMinutes === null || !Number.isFinite(runtimeMinutes)) return false;
  return runtimeMinutes >= 45 && (verdict.kind === 'trailer' || verdict.kind === 'clip');
}
