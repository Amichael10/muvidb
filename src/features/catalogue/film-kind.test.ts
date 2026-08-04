import { describe, expect, it } from 'vitest';
import {
  buildKindPrompt,
  contradictsRuntime,
  isActionableVerdict,
  parseKindVerdicts,
} from './film-kind';

const IDS = ['a1', 'b2', 'c3'];

describe('parseKindVerdicts', () => {
  it('keeps well-formed verdicts', () => {
    const out = parseKindVerdicts(
      [{ id: 'a1', kind: 'trailer', confidence: 0.9, reason: 'says teaser' }],
      IDS,
    );
    expect(out).toEqual([{ id: 'a1', kind: 'trailer', confidence: 0.9, reason: 'says teaser' }]);
  });

  it('drops ids that were never asked about', () => {
    // A hallucinated id would otherwise write a verdict onto an unrelated film.
    const out = parseKindVerdicts([{ id: 'not-requested', kind: 'trailer', confidence: 1 }], IDS);
    expect(out).toEqual([]);
  });

  it('drops unknown categories', () => {
    expect(parseKindVerdicts([{ id: 'a1', kind: 'documentary', confidence: 1 }], IDS)).toEqual([]);
  });

  it('treats a missing confidence as maximum uncertainty', () => {
    const [v] = parseKindVerdicts([{ id: 'a1', kind: 'trailer' }], IDS);
    expect(v.confidence).toBe(0);
    expect(isActionableVerdict(v)).toBe(false);
  });

  it('clamps out-of-range confidence', () => {
    expect(parseKindVerdicts([{ id: 'a1', kind: 'clip', confidence: 7 }], IDS)[0].confidence).toBe(1);
    expect(parseKindVerdicts([{ id: 'b2', kind: 'clip', confidence: -3 }], IDS)[0].confidence).toBe(0);
  });

  it('keeps only the first verdict per id', () => {
    const out = parseKindVerdicts(
      [{ id: 'a1', kind: 'trailer', confidence: 0.9 }, { id: 'a1', kind: 'film', confidence: 0.9 }],
      IDS,
    );
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('trailer');
  });

  it('survives junk input', () => {
    expect(parseKindVerdicts(null, IDS)).toEqual([]);
    expect(parseKindVerdicts('nope', IDS)).toEqual([]);
    expect(parseKindVerdicts([null, 3, 'x'], IDS)).toEqual([]);
  });
});

describe('isActionableVerdict', () => {
  it('never acts on film or unclear, however confident', () => {
    expect(isActionableVerdict({ id: 'a1', kind: 'film', confidence: 1, reason: null })).toBe(false);
    expect(isActionableVerdict({ id: 'a1', kind: 'unclear', confidence: 1, reason: null })).toBe(false);
  });

  it('requires high confidence to act', () => {
    expect(isActionableVerdict({ id: 'a1', kind: 'trailer', confidence: 0.84, reason: null })).toBe(false);
    expect(isActionableVerdict({ id: 'a1', kind: 'trailer', confidence: 0.86, reason: null })).toBe(true);
  });
});

describe('contradictsRuntime', () => {
  it('rejects a trailer verdict on a feature-length upload', () => {
    // The failure that matters: a confident wrong verdict hiding a real film.
    expect(contradictsRuntime({ id: 'a1', kind: 'trailer', confidence: 1, reason: null }, 96)).toBe(true);
    expect(contradictsRuntime({ id: 'a1', kind: 'clip', confidence: 1, reason: null }, 96)).toBe(true);
  });

  it('allows a trailer verdict on a short upload', () => {
    expect(contradictsRuntime({ id: 'a1', kind: 'trailer', confidence: 1, reason: null }, 2)).toBe(false);
  });

  it('does not fire when runtime is unknown', () => {
    expect(contradictsRuntime({ id: 'a1', kind: 'trailer', confidence: 1, reason: null }, null)).toBe(false);
  });

  it('does not block interview or compilation verdicts on long uploads', () => {
    // Those genuinely can run long — only trailer/clip are runtime-contradicted.
    expect(contradictsRuntime({ id: 'a1', kind: 'interview', confidence: 1, reason: null }, 96)).toBe(false);
  });
});

describe('buildKindPrompt', () => {
  it('includes the rows and asks for JSON only', () => {
    const prompt = buildKindPrompt([{ id: 'a1', title: 'Otiti', channel: 'Nollywood', runtimeMinutes: 92 }]);
    expect(prompt).toContain('Otiti');
    expect(prompt).toContain('"runtime_minutes":92');
    expect(prompt).toContain('Return ONLY a JSON array');
  });

  it('sends nulls rather than omitting unknown fields', () => {
    const prompt = buildKindPrompt([{ id: 'a1', title: 'Mystery' }]);
    expect(prompt).toContain('"channel":null');
    expect(prompt).toContain('"runtime_minutes":null');
  });
});
