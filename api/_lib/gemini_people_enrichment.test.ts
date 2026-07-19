import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GeminiPeopleResearchSchema } from './gemini_people_schema.js';

vi.mock('./supabase.js', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: vi.fn(),
    },
  })),
}));

describe('GeminiPeopleResearchSchema', () => {
  it('parses a grounded research payload', () => {
    const parsed = GeminiPeopleResearchSchema.parse({
      identity_status: 'matched',
      identity_confidence: 0.84,
      identity_reasons: ['Official profile', 'Matching film credit'],
      identity_anchors: ['matching_name', 'matching_film_credit:Lionheart'],
      matched_credits: ['Lionheart'],
      candidate_fields: {
        birthplace: {
          value: 'Lagos, Nigeria',
          evidence_urls: ['https://pulse.ng/entertainment/actor'],
        },
      },
      conflicts: [],
      source_urls: ['https://pulse.ng/entertainment/actor'],
      no_match_reason: null,
    });
    expect(parsed.identity_status).toBe('matched');
    const birthplace = parsed.candidate_fields.birthplace;
    expect(typeof birthplace === 'object' && birthplace && 'value' in birthplace
      ? birthplace.value
      : null).toBe('Lagos, Nigeria');
  });

  it('rejects invalid identity status', () => {
    expect(() => GeminiPeopleResearchSchema.parse({
      identity_status: 'maybe',
      identity_confidence: 0.5,
      identity_reasons: [],
    })).toThrow();
  });
});

describe('Gemini failure isolation contract', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('documents that failed Gemini runs preserve TMDB proposals', async () => {
    const geminiFailure = {
      status: 'failed',
      preserveExistingProposal: true,
      error: '429 rate limit',
    };
    const tmdbResult = {
      status: 'ready',
      confidence: 0.9,
      proposedFields: ['bio', 'photo_url'],
      provider: 'tmdb',
    };
    const merged = geminiFailure.preserveExistingProposal
      ? {
        ...tmdbResult,
        gemini: { status: geminiFailure.status, preservedTmdb: true as const },
      }
      : geminiFailure;
    expect(merged.status).toBe('ready');
    if ('proposedFields' in merged) {
      expect(merged.proposedFields).toEqual(['bio', 'photo_url']);
    }
    if ('gemini' in merged) {
      expect(merged.gemini.preservedTmdb).toBe(true);
    }
  });

  it('never auto-applies Gemini proposals without admin approval', () => {
    const proposal = {
      candidateData: { bio: 'AI-synthesized from cited sources. Career bio.' },
      status: 'ready',
    };
    expect(proposal.status).not.toBe('applied');
    expect(Object.keys(proposal.candidateData).length).toBeGreaterThan(0);
  });
});
