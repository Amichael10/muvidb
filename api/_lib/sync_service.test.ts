import { describe, expect, it } from 'vitest';
import { channelVideoChanged } from './sync_service.js';

const FIELDS = ['title', 'thumbnail_url', 'duration_seconds', 'published_at'];

const stored = {
  title: 'Omoni Oboli - The Wedding Party',
  thumbnail_url: 'https://i.ytimg.com/vi/abc/hq.jpg',
  duration_seconds: 5400,
  // Postgres hands timestamps back with an explicit offset.
  published_at: '2024-01-05T10:30:00+00:00',
};

const fetched = {
  title: 'Omoni Oboli - The Wedding Party',
  thumbnail_url: 'https://i.ytimg.com/vi/abc/hq.jpg',
  duration_seconds: 5400,
  // The YouTube API sends Zulu notation for the same instant.
  published_at: '2024-01-05T10:30:00Z',
};

describe('channelVideoChanged', () => {
  it('treats a video it has never seen as changed', () => {
    expect(channelVideoChanged(undefined, fetched, FIELDS)).toBe(true);
  });

  it('does not rewrite an unchanged row', () => {
    expect(channelVideoChanged(stored, fetched, FIELDS)).toBe(false);
  });

  it('compares timestamps as instants, not strings', () => {
    // This is the whole point: `+00:00` and `Z` are the same moment. Comparing
    // them as text marks every row changed and silently defeats the filter.
    expect(stored.published_at).not.toBe(fetched.published_at);
    expect(channelVideoChanged(stored, fetched, ['published_at'])).toBe(false);
  });

  it('detects a genuinely different publish time', () => {
    const moved = { ...fetched, published_at: '2024-01-05T11:30:00Z' };
    expect(channelVideoChanged(stored, moved, FIELDS)).toBe(true);
  });

  it('detects a retitled video', () => {
    expect(channelVideoChanged(stored, { ...fetched, title: 'New Title' }, FIELDS)).toBe(true);
  });

  it('detects a swapped thumbnail', () => {
    const rethumbed = { ...fetched, thumbnail_url: 'https://i.ytimg.com/vi/abc/maxres.jpg' };
    expect(channelVideoChanged(stored, rethumbed, FIELDS)).toBe(true);
  });

  it('detects a corrected duration', () => {
    expect(channelVideoChanged(stored, { ...fetched, duration_seconds: 5401 }, FIELDS)).toBe(true);
  });

  it('treats null and undefined as the same absence', () => {
    // Postgres returns null where a mapper may leave the key off entirely;
    // that must not count as a change or nothing is ever skipped.
    const priorNull = { ...stored, thumbnail_url: null };
    const rowMissing: Record<string, any> = { ...fetched };
    delete rowMissing.thumbnail_url;
    expect(channelVideoChanged(priorNull, rowMissing, ['thumbnail_url'])).toBe(false);
  });

  it('only inspects the fields it is asked about', () => {
    const noisy = { ...fetched, some_other_column: 'ignored' };
    expect(channelVideoChanged(stored, noisy, FIELDS)).toBe(false);
  });
});
