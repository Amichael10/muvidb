import { describe, expect, it } from 'vitest';
import { synopsisNeedsRewrite } from './cohere_enrichment';

describe('synopsisNeedsRewrite', () => {
  it('flags missing and promotional YouTube descriptions', () => {
    expect(synopsisNeedsRewrite(null)).toBe(true);
    expect(synopsisNeedsRewrite('Watch the full movie now! Subscribe and click the link below.')).toBe(true);
    expect(synopsisNeedsRewrite('A royal secret changes everything. #Nollywood #LatestMovie')).toBe(true);
    expect(synopsisNeedsRewrite('More details at https://youtube.com/watch?v=abc')).toBe(true);
  });

  it('keeps a clean plot synopsis', () => {
    expect(synopsisNeedsRewrite(
      'After returning to her hometown, a young lawyer must choose between family loyalty and exposing a long-buried crime.',
    )).toBe(false);
  });
});
