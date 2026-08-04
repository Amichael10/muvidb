import { describe, expect, it } from 'vitest';
import {
  PLATFORM_CAPTION_LIMITS,
  buildVariantContent,
  renderFullCaption,
  toHashtag,
  truncateAtWord,
} from './caption-builder';
import { buildActorSpotlightSnapshot, buildUpcomingMovieSnapshot } from './snapshots';
import { SOCIAL_PLATFORMS } from '../domain/platform-types';

const CAPTURED_AT = '2026-07-30T21:00:00.000Z';

const actorSnapshot = buildActorSpotlightSnapshot({
  capturedAt: CAPTURED_AT,
  person: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Adésúwà Etomi',
    slug: 'adesuwa-etomi',
    photo_url: 'https://cdn.example/p.jpg',
    nationality: 'Nigerian',
    known_for_department: 'Acting',
    bio: 'An award-winning actress.',
  },
  credits: [
    { character_name: 'Ada', films: { id: 'f1', title: 'King of Boys', slug: 'king-of-boys', year: 2018 } },
    { character_name: null, films: { id: 'f2', title: 'The Wedding Party', slug: 'twp', release_date: '2016-12-16' } },
  ],
});

const movieSnapshot = buildUpcomingMovieSnapshot({
  capturedAt: CAPTURED_AT,
  film: {
    id: '22222222-2222-4222-8222-222222222222',
    title: 'Jagun Jagun',
    slug: 'jagun-jagun',
    poster_url: 'https://cdn.example/poster.jpg',
    release_date: '2026-09-01',
    tagline: 'A warrior never kneels.',
    genres: ['Action', 'Drama'],
    coming_soon: true,
    is_published: true,
  },
  credits: [{ character_name: 'Ogundiji', people: { id: 'p1', name: 'Femi Adebayo' } }],
});

describe('toHashtag', () => {
  it('folds accents rather than splitting the word', () => {
    expect(toHashtag('Adésúwà Etomi')).toBe('AdesuwaEtomi');
  });

  it('strips punctuation and pascal-cases', () => {
    expect(toHashtag('the wedding party!')).toBe('TheWeddingParty');
  });

  it('rejects tags that would start with a digit', () => {
    expect(toHashtag('93 Days')).toBeNull();
  });

  it('rejects empty and symbol-only input', () => {
    expect(toHashtag('   ')).toBeNull();
    expect(toHashtag('!!!')).toBeNull();
  });
});

describe('truncateAtWord', () => {
  it('leaves short strings untouched', () => {
    expect(truncateAtWord('short', 20)).toBe('short');
  });

  it('never exceeds the limit', () => {
    const out = truncateAtWord('a'.repeat(50), 10);
    expect(out.length).toBeLessThanOrEqual(10);
  });

  it('breaks on a word boundary and trims trailing punctuation', () => {
    expect(truncateAtWord('the quick brown fox jumps', 16)).toBe('the quick brown…');
  });
});

describe('buildVariantContent', () => {
  it('builds an actor spotlight caption from the snapshot', () => {
    const content = buildVariantContent({ snapshot: actorSnapshot, platform: 'instagram' });
    expect(content.caption).toContain('Spotlight: Adésúwà Etomi — Nigerian Acting.');
    expect(content.caption).toContain('Known for King of Boys and The Wedding Party.');
    expect(content.hashtags).toContain('MuviDB');
    expect(content.hashtags).toContain('AdesuwaEtomi');
  });

  it('builds an upcoming movie caption with cast and tagline', () => {
    const content = buildVariantContent({ snapshot: movieSnapshot, platform: 'instagram' });
    expect(content.caption).toContain('Coming soon: Jagun Jagun (2026)');
    expect(content.caption).toContain('A warrior never kneels.');
    expect(content.caption).toContain('Starring Femi Adebayo.');
    expect(content.hashtags).toContain('ComingSoon');
  });

  it('only sets a title for TikTok', () => {
    expect(buildVariantContent({ snapshot: movieSnapshot, platform: 'tiktok' }).title).toBe('Jagun Jagun');
    expect(buildVariantContent({ snapshot: movieSnapshot, platform: 'instagram' }).title).toBeNull();
  });

  it('keeps the rendered caption within every platform limit', () => {
    const longSnapshot = buildUpcomingMovieSnapshot({
      capturedAt: CAPTURED_AT,
      film: {
        id: '33333333-3333-4333-8333-333333333333',
        title: 'A Very Long Film',
        tagline: 'word '.repeat(400),
        genres: ['Action', 'Drama', 'Thriller', 'Romance'],
        coming_soon: true,
      },
      credits: [],
    });

    for (const platform of SOCIAL_PLATFORMS) {
      const content = buildVariantContent({ snapshot: longSnapshot, platform });
      expect(renderFullCaption(content).length).toBeLessThanOrEqual(PLATFORM_CAPTION_LIMITS[platform].captionLimit);
    }
  });

  it('preserves the hashtag block when the body is truncated', () => {
    const content = buildVariantContent({
      snapshot: buildUpcomingMovieSnapshot({
        capturedAt: CAPTURED_AT,
        film: { id: 'f', title: 'Threads Test', tagline: 'word '.repeat(300), genres: ['Action'], coming_soon: true },
        credits: [],
      }),
      platform: 'threads',
    });

    expect(content.hashtags.length).toBeGreaterThan(0);
    expect(renderFullCaption(content)).toContain(`#${content.hashtags[0]}`);
  });

  it('respects each platform hashtag ceiling', () => {
    for (const platform of SOCIAL_PLATFORMS) {
      const content = buildVariantContent({ snapshot: movieSnapshot, platform });
      expect(content.hashtags.length).toBeLessThanOrEqual(PLATFORM_CAPTION_LIMITS[platform].hashtagLimit);
    }
  });

  it('does not repeat a hashtag', () => {
    const content = buildVariantContent({ snapshot: actorSnapshot, platform: 'instagram' });
    const lowered = content.hashtags.map(tag => tag.toLowerCase());
    expect(new Set(lowered).size).toBe(lowered.length);
  });
});
