import { describe, expect, it } from 'vitest';
import {
  buildInputFingerprint,
  extractGroundingCitationUrls,
  normalizeUrl,
  reconcileCitations,
  scoreGeminiIdentity,
  shouldRunGeminiAfterTmdb,
  validateGeminiPeoplePayload,
} from './geminiPeopleEnrichment.js';

describe('normalizeUrl', () => {
  it('strips tracking params and www', () => {
    expect(normalizeUrl('https://www.Example.com/path/?utm_source=x&id=1'))
      .toBe('https://example.com/path?id=1');
  });
});

describe('extractGroundingCitationUrls', () => {
  it('reads grounding chunks and url context only', () => {
    const urls = extractGroundingCitationUrls({
      groundingChunks: [
        { web: { uri: 'https://www.variety.com/article/actor' } },
        { web: { uri: 'https://instagram.com/actor/' } },
      ],
      webSearchQueries: ['Actor Nollywood'],
    }, {
      urlMetadata: [{ retrievedUrl: 'https://festival.ng/talent/actor' }],
    });
    expect(urls).toContain('https://variety.com/article/actor');
    expect(urls).toContain('https://instagram.com/actor');
    expect(urls).toContain('https://festival.ng/talent/actor');
  });
});

describe('reconcileCitations', () => {
  const grounding = {
    groundingChunks: [
      { web: { uri: 'https://www.pulse.ng/entertainment/actor-bio' } },
      { web: { uri: 'https://instagram.com/nollywoodstar' } },
    ],
  };

  it('removes uncited fields even when model invents URLs', () => {
    const result = reconcileCitations({
      candidate_fields: {
        birthplace: {
          value: 'Lagos, Nigeria',
          evidence_urls: ['https://totally-made-up.example/page'],
        },
        instagram_url: {
          value: 'https://instagram.com/nollywoodstar',
          evidence_urls: ['https://instagram.com/nollywoodstar'],
        },
      },
    }, grounding);

    expect(result.candidateFields.instagram_url).toContain('instagram.com/nollywoodstar');
    expect(result.candidateFields.birthplace).toBeUndefined();
    expect(result.rejected.some((row) => row.field === 'birthplace')).toBe(true);
  });

  it('keeps bio only when sentences map to grounding citations', () => {
    const result = reconcileCitations({
      candidate_fields: {
        bio: {
          value: 'She starred in progressive Nollywood features.',
          sentence_evidence: [{
            sentence: 'She starred in progressive Nollywood features.',
            evidence_urls: ['https://www.pulse.ng/entertainment/actor-bio'],
          }],
        },
      },
    }, grounding);

    expect(result.candidateFields.bio).toMatch(/^AI-synthesized from cited sources/);
    expect(result.evidence.length).toBeGreaterThan(0);
  });
});

describe('scoreGeminiIdentity', () => {
  it('rejects exact name alone', () => {
    const result = scoreGeminiIdentity({
      identityStatus: 'matched',
      identityConfidence: 0.9,
      identityReasons: ['Exact name'],
      identityAnchors: ['matching_name'],
      personName: 'Ada Okoro',
      proposedName: 'Ada Okoro',
    });
    expect(result.status).toBe('no_match');
  });

  it('accepts name + film credit anchors', () => {
    const result = scoreGeminiIdentity({
      identityStatus: 'matched',
      identityConfidence: 0.86,
      identityReasons: ['Official profile + credit'],
      identityAnchors: ['matching_name', 'matching_film_credit:The Wedding Party'],
      matchedCredits: ['The Wedding Party'],
      personName: 'Ada Okoro',
      proposedName: 'Ada Okoro',
    });
    expect(result.status).toBe('ready');
    expect(result.anchors.length).toBeGreaterThanOrEqual(2);
  });

  it('marks conflicting birth dates as needs_review', () => {
    const result = scoreGeminiIdentity({
      identityStatus: 'matched',
      identityConfidence: 0.9,
      identityAnchors: ['matching_name', 'matching_film_credit:Lionheart'],
      conflicts: [{ field: 'date_of_birth', values: ['1990-01-01', '1992-05-05'] }],
      personName: 'Ada Okoro',
      proposedName: 'Ada Okoro',
    });
    expect(result.status).toBe('needs_review');
  });

  it('returns no_match for ambiguous identical names without credits', () => {
    const result = scoreGeminiIdentity({
      identityStatus: 'needs_review',
      identityConfidence: 0.55,
      identityReasons: ['Multiple people share this name'],
      identityAnchors: ['matching_name'],
      personName: 'John Paul',
      proposedName: 'John Paul',
    });
    expect(result.status).toBe('no_match');
  });
});

describe('validateGeminiPeoplePayload', () => {
  it('accepts a valid payload shape', () => {
    const result = validateGeminiPeoplePayload({
      identity_status: 'matched',
      identity_confidence: 0.8,
      identity_reasons: ['Official page + credit'],
      candidate_fields: {},
      conflicts: [],
    });
    expect(result.ok).toBe(true);
  });

  it('rejects invalid confidence', () => {
    const result = validateGeminiPeoplePayload({
      identity_status: 'matched',
      identity_confidence: 1.4,
      identity_reasons: [],
    });
    expect(result.ok).toBe(false);
  });
});

describe('shouldRunGeminiAfterTmdb', () => {
  it('runs when TMDB has no match', () => {
    expect(shouldRunGeminiAfterTmdb({
      tmdbProposal: { status: 'no_match', candidateData: {} },
      person: { name: 'Rising Star', bio: null, photo_url: null },
    })).toBe(true);
  });

  it('skips when TMDB already filled important gaps', () => {
    expect(shouldRunGeminiAfterTmdb({
      tmdbProposal: {
        status: 'ready',
        candidateData: {
          bio: 'A bio',
          photo_url: 'https://image.tmdb.org/t/p/original/x.jpg',
          instagram_url: 'https://instagram.com/x',
        },
      },
      person: { bio: null, photo_url: null, instagram_url: null },
    })).toBe(false);
  });
});

describe('buildInputFingerprint', () => {
  it('is stable for unchanged profiles', () => {
    const left = buildInputFingerprint({
      name: 'Ada Okoro',
      creditTitles: ['Lionheart', 'The Wedding Party'],
      currentFields: { bio: null, photo_url: null },
    });
    const right = buildInputFingerprint({
      name: 'Ada Okoro',
      creditTitles: ['The Wedding Party', 'Lionheart'],
      currentFields: { bio: null, photo_url: null },
    });
    expect(left).toBe(right);
  });

  it('changes when credits or fields change', () => {
    const before = buildInputFingerprint({
      name: 'Ada Okoro',
      creditTitles: ['Lionheart'],
      currentFields: { bio: null },
    });
    const after = buildInputFingerprint({
      name: 'Ada Okoro',
      creditTitles: ['Lionheart'],
      currentFields: { bio: 'Now has a bio' },
    });
    expect(before).not.toBe(after);
  });
});
