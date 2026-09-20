import { describe, expect, it, vi } from 'vitest';
import {
  areGeneratedVariationsGrounded,
  generateAICaptions,
  generateGroundedFallbackCaptions,
  type AICopyRequest,
  type AICopyVariation,
} from './social_copy_ai.js';

vi.mock('../ai_service.js', () => ({
  generateAIContent: vi.fn().mockRejectedValue(new Error('AI simulated failure')),
  parseJSON: (x: string) => { try { return JSON.parse(x); } catch { return null; } },
}));

function variations(text: string): AICopyVariation[] {
  return ['A', 'B', 'C'].map((key, index) => ({
    key: key as 'A' | 'B' | 'C',
    label: ['Informative', 'Editorial', 'Conversational'][index] as AICopyVariation['label'],
    captions: { instagram: text, threads: text, facebook: text, tiktok: text },
  }));
}

describe('generated social copy grounding', () => {
  it('rejects streaming claims for an upcoming release', () => {
    const req: AICopyRequest = {
      candidate: { id: '1', type: 'movie', name: 'Future Film', data: { lifecycle: 'upcoming' } },
      series: { slug: 'new_and_upcoming' },
    };
    expect(areGeneratedVariationsGrounded(req, variations('Future Film is now streaming.'))).toBe(false);
    expect(areGeneratedVariationsGrounded(req, variations('Future Film is coming soon.'))).toBe(true);
  });

  it('requires the verified destination in every Where to Watch caption', () => {
    const req: AICopyRequest = {
      candidate: { id: '2', type: 'movie', name: 'Live Film', data: { lifecycle: 'now_streaming', platformDisplayName: 'NolliStream' } },
      series: { slug: 'where_to_watch' },
    };
    expect(areGeneratedVariationsGrounded(req, variations('Live Film is available to watch.'))).toBe(false);
    expect(areGeneratedVariationsGrounded(req, variations('Live Film is now on NolliStream.'))).toBe(true);
  });

  it('rejects unresolved Copy Vault placeholders', () => {
    const req: AICopyRequest = { candidate: { id: '3', name: 'Film' }, series: { slug: 'film_conversation' } };
    expect(areGeneratedVariationsGrounded(req, variations('Watch [FILM] on [PLATFORM].'))).toBe(false);
  });

  it('uses a resolved vault starter in the local fallback', () => {
    const req: AICopyRequest = {
      candidate: { id: '4', type: 'movie', name: 'Example Film', data: { lifecycle: 'now_streaming', platformDisplayName: 'Docuth' } },
      series: { slug: 'where_to_watch' },
    };
    const fallback = generateGroundedFallbackCaptions(req);
    expect(fallback).toHaveLength(3);
    expect(fallback.every(variation => !Object.values(variation.captions).some(caption => /\[[^\]]+\]/.test(caption)))).toBe(true);
    expect(fallback.every(variation => Object.values(variation.captions).every(caption => caption.includes('Docuth')))).toBe(true);
  });

  it('enforces a linked YouTube channel and verified Instagram credit tags in fallback copy', () => {
    const req: AICopyRequest = {
      candidate: {
        id: 'youtube-film',
        type: 'movie',
        name: 'Direct Release',
        data: {
          lifecycle: 'now_streaming',
          platformDisplayName: 'YouTube',
          youtubeChannelName: 'Example Pictures',
          creditedPeople: [
            { name: 'Actor One', role: 'actor', handle: '@actor.one' },
            { name: 'Director One', role: 'director', handle: '@director.one' },
          ],
        },
      },
      series: { slug: 'where_to_watch' },
    };

    const fallback = generateGroundedFallbackCaptions(req);
    expect(fallback.every(variation => Object.values(variation.captions).every(caption => caption.includes('Example Pictures')))).toBe(true);
    expect(fallback.every(variation => variation.captions.instagram.includes('@actor.one') && variation.captions.instagram.includes('@director.one'))).toBe(true);
    expect(areGeneratedVariationsGrounded(req, fallback)).toBe(true);
  });

  it('returns usable fallback copy when candidate metadata is malformed', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const response = await generateAICaptions({
      candidate: {
        id: '5',
        type: 'movie',
        name: 'Resilient Film',
        data: {
          lifecycle: 'upcoming',
          topCast: { invalid: true },
          synopsis: { invalid: true },
        },
      },
      series: { slug: 'new_and_upcoming' },
    });

    expect(response.success).toBe(true);
    expect(response.engine).toBe('muvidb_clean_fallback');
    expect(response.variations).toHaveLength(3);
    expect(response.variations.every(variation => Object.values(variation.captions).every(Boolean))).toBe(true);
    warning.mockRestore();
  });

  it('generates story-first copy for talent spotlight across Career Story, Why Now, and Discovery angles without CMS metadata dumping', () => {
    const req: AICopyRequest = {
      candidate: {
        id: 'sanusi-person',
        type: 'person',
        name: 'Sanusi Izihaq',
        data: {
          film_count: 5,
          why_now: 'Connected to the recent project Lagbondoko',
          knownFor: [
            { title: 'Lagbondoko', year: 2025 },
            { title: 'Gen Z School', year: 2026 },
            { title: 'Gen Z School 2', year: 2026 },
          ],
        },
      },
      series: { slug: 'you_know_the_face', name: 'Craft Spotlight' },
    };

    const variations = generateGroundedFallbackCaptions(req);
    expect(variations).toHaveLength(3);

    const [optionA, optionB, optionC] = variations;
    expect(optionA.label).toBe('Career Story');
    expect(optionB.label).toBe('Why Now');
    expect(optionC.label).toBe('Discovery');

    // Option A: Career Story traces journey and progression
    expect(optionA.captions.instagram).toContain('Sanusi Izihaq is building their credits one project at a time');
    expect(optionA.captions.instagram).toContain('Lagbondoko in 2025');
    expect(optionA.captions.instagram).toContain('Gen Z School and Gen Z School 2 in 2026');
    expect(optionA.captions.instagram).toContain('5 verified credits currently documented on MuviDB');

    // Option B: Why Now hooks into the recent project
    expect(optionB.captions.instagram).toContain('You may have come across Sanusi Izihaq through Lagbondoko');
    expect(optionB.captions.instagram).toContain('Gen Z School and Gen Z School 2');

    // Option C: Discovery is conversational and radar-focused
    expect(optionC.captions.instagram).toContain('One name you might want to remember: Sanusi Izihaq');
    expect(optionC.captions.instagram).toContain('5 verified credits');

    // Banned CMS language must NOT exist anywhere in any caption
    const allText = variations.flatMap(v => Object.values(v.captions)).join('\n');
    expect(allText).not.toContain('The Filmography:');
    expect(allText).not.toContain('Editing credit spotlight:');
    expect(allText).not.toContain('Notable credits across African cinema:');
    expect(allText).not.toContain('🎬 Lagbondoko (2025)');

    // Grounding check passes
    expect(areGeneratedVariationsGrounded(req, variations)).toBe(true);
  });
});
