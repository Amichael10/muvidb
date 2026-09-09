import { describe, it, expect } from 'vitest';
import { extractInstagramHandle } from './outreach_generator';

describe('outreach_generator', () => {
  it('extracts clean instagram handles from diverse URLs and raw strings', () => {
    expect(extractInstagramHandle('https://www.instagram.com/shammugah/')).toBe('@shammugah');
    expect(extractInstagramHandle('https://instagram.com/king_ybmm?igshid=123')).toBe('@king_ybmm');
    expect(extractInstagramHandle('http://instagram.com/realleoewuzie/?hl=en')).toBe('@realleoewuzie');
    expect(extractInstagramHandle('@sonnymcdon')).toBe('@sonnymcdon');
    expect(extractInstagramHandle('sonnymcdon')).toBe('@sonnymcdon');
    expect(extractInstagramHandle('')).toBe('');
  });

  it('generates personalized pitch containing profile link and claim URL', async () => {
    const { generatePersonalizedPitch } = await import('./outreach_generator');
    const pitch = await generatePersonalizedPitch({
      name: 'Shammah Agah',
      department: 'Actor',
      highlightFilms: ['The Bride Price', 'Blood Sister'],
      profileUrl: 'https://muvidb.com/people/shammah-agah',
      claimUrl: 'https://muvidb.com/claim/shammah-agah',
    });

    expect(pitch).toBeDefined();
    expect(pitch.length).toBeGreaterThan(30);
    expect(pitch.toLowerCase()).toContain('shammah');
  }, 20000);
});
