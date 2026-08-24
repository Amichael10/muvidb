import { describe, expect, it } from 'vitest';
import {
  buildActorSpotlightSnapshot,
  buildUpcomingMovieSnapshot,
  collectSnapshotWarnings,
} from './snapshots';

const CAPTURED_AT = '2026-07-30T21:00:00.000Z';

describe('buildActorSpotlightSnapshot', () => {
  it('normalizes blank strings to null', () => {
    const snapshot = buildActorSpotlightSnapshot({
      capturedAt: CAPTURED_AT,
      person: { id: 'p1', name: 'Jane Doe', photo_url: '   ', nationality: '', bio: null },
    });

    expect(snapshot.photoUrl).toBeNull();
    expect(snapshot.nationality).toBeNull();
    expect(snapshot.bio).toBeNull();
  });

  it('caps known-for entries and skips credits with no film', () => {
    const snapshot = buildActorSpotlightSnapshot({
      capturedAt: CAPTURED_AT,
      knownForLimit: 2,
      person: { id: 'p1', name: 'Jane Doe' },
      credits: [
        { films: { id: 'f1', title: 'One' } },
        { films: null },
        { films: { id: 'f2', title: 'Two' } },
        { films: { id: 'f3', title: 'Three' } },
      ],
    });

    expect(snapshot.knownFor.map(f => f.title)).toEqual(['One', 'Two']);
    expect(snapshot.creditCount).toBe(4);
  });

  it('derives the year from release_date when year is absent', () => {
    const snapshot = buildActorSpotlightSnapshot({
      capturedAt: CAPTURED_AT,
      person: { id: 'p1', name: 'Jane Doe' },
      credits: [{ films: { id: 'f1', title: 'One', release_date: '2019-04-02' } }],
    });

    expect(snapshot.knownFor[0].year).toBe(2019);
  });
});

describe('buildUpcomingMovieSnapshot', () => {
  it('dedupes array fields and drops blanks', () => {
    const snapshot = buildUpcomingMovieSnapshot({
      capturedAt: CAPTURED_AT,
      film: { id: 'f1', title: 'Film', genres: ['Action', 'Action', '  ', 'Drama'], countries: null },
    });

    expect(snapshot.genres).toEqual(['Action', 'Drama']);
    expect(snapshot.countries).toEqual([]);
  });

  it('keeps a zero liked_percent distinct from missing', () => {
    expect(buildUpcomingMovieSnapshot({ capturedAt: CAPTURED_AT, film: { id: 'f', title: 'T', liked_percent: 0 } }).likedPercent).toBe(0);
    expect(buildUpcomingMovieSnapshot({ capturedAt: CAPTURED_AT, film: { id: 'f', title: 'T' } }).likedPercent).toBeNull();
  });

  it('falls back to the legacy backdrop column', () => {
    const snapshot = buildUpcomingMovieSnapshot({
      capturedAt: CAPTURED_AT,
      film: { id: 'f', title: 'T', backdrop_url: null, backdrop: 'https://cdn.example/b.jpg' },
    });

    expect(snapshot.backdropUrl).toBe('https://cdn.example/b.jpg');
  });

  it('captures the linked YouTube channel and only verified Instagram credit handles', () => {
    const snapshot = buildUpcomingMovieSnapshot({
      capturedAt: CAPTURED_AT,
      film: {
        id: 'f',
        title: 'YouTube Film',
        youtube_watch_url: 'https://youtube.com/watch?v=abc',
        youtube_channel_name: 'Example Pictures',
        youtube_channel_handle: '@examplepictures',
      },
      credits: [
        { role: 'actor', people: { id: 'p1', name: 'Actor One', instagram_url: 'https://instagram.com/actor.one/' } },
        { role: 'director', people: { id: 'p2', name: 'Director Two', instagram_url: '@director.two' } },
        { role: 'producer', people: { id: 'p3', name: 'Producer Three', twitter_url: 'https://x.com/producer3' } },
      ],
    });

    expect(snapshot.watchAvailability).toContain('YouTube via Example Pictures');
    expect(snapshot.youtubeChannelName).toBe('Example Pictures');
    expect(snapshot.topCast[0].handle).toBe('@actor.one');
    expect(snapshot.creditedPeople.map(person => person.instagramHandle)).toEqual(['@actor.one', '@director.two']);
  });
});

describe('collectSnapshotWarnings', () => {
  it('flags a person with no photo or credits', () => {
    const warnings = collectSnapshotWarnings(
      buildActorSpotlightSnapshot({ capturedAt: CAPTURED_AT, person: { id: 'p', name: 'Jane Doe' } }),
    );

    expect(warnings).toHaveLength(2);
    expect(warnings.join(' ')).toContain('photo_url');
  });

  it('returns nothing for a complete film', () => {
    const warnings = collectSnapshotWarnings(
      buildUpcomingMovieSnapshot({
        capturedAt: CAPTURED_AT,
        film: {
          id: 'f',
          title: 'T',
          poster_url: 'https://cdn.example/p.jpg',
          synopsis: 'A retired warrior is pulled back into a fight he swore to leave behind.',
          is_published: true,
          release_date: '2026-09-01',
        },
      }),
    );

    expect(warnings).toEqual([]);
  });
});
