import { describe, expect, it } from 'vitest';
import {
  buildRolePills,
  buildStatRows,
  fitDisplaySize,
  formatCount,
  formatMoney,
  formatViews,
  posterBurstRamp,
  splitDisplayName,
  topPercentLabel,
  type RewindRow,
} from './rewind';

/** Placeholder only — never put a real actor in a committed fixture. */
const row = (over: Partial<RewindRow> = {}): RewindRow => ({
  slug: 'test-performer',
  display_name: 'Test Performer',
  portrait_url: 'https://example.test/portrait.jpg',
  films_count: 6,
  plays_count: 0,
  lead_count: 4,
  support_count: 2,
  lead_known_count: 6,
  total_views: 48_200_000,
  hours_on_screen: 31,
  top_film_title: 'Placeholder Film',
  top_film_views: 9_600_000,
  top_play_title: null,
  box_office_total: null,
  box_office_currency: null,
  top_costar_name: 'Second Performer',
  top_costar_films: 6,
  top_director_name: 'Third Performer',
  top_director_films: 4,
  followers: 0,
  percentile: 97,
  archetype: 'The Workhorse',
  archetype_line: 'More films released this year than 97% of actors on MuviDB.',
  poster_urls: Array.from({ length: 14 }, (_, i) => `https://example.test/p${i}.jpg`),
  ...over,
});

describe('formatViews', () => {
  it('matches the three shapes the brief specifies', () => {
    expect(formatViews(48_200_000)).toBe('48.2M');
    expect(formatViews(920_000)).toBe('920K');
    expect(formatViews(8_400)).toBe('8,400');
  });

  it('promotes just-under-a-million rather than saying 1000K', () => {
    expect(formatViews(999_999)).toBe('1.0M');
    expect(formatViews(999_499)).toBe('999K');
  });

  it('holds the K/comma boundary at 10,000', () => {
    expect(formatViews(9_999)).toBe('9,999');
    expect(formatViews(10_000)).toBe('10K');
  });

  it('returns null for missing values so the caller hides the row', () => {
    expect(formatViews(null)).toBeNull();
    expect(formatViews(undefined)).toBeNull();
    expect(formatViews(Number.NaN)).toBeNull();
  });

  it('never renders a negative count', () => {
    expect(formatViews(-5)).toBe('0');
  });
});

describe('formatMoney', () => {
  it('scales naira to billions and millions', () => {
    expect(formatMoney(3_207_600_000, 'NGN')).toBe('₦3.21bn');
    expect(formatMoney(45_000_000, 'NGN')).toBe('₦45.0m');
    expect(formatMoney(820_000, 'NGN')).toBe('₦820,000');
  });

  it('falls back to a currency code it does not know', () => {
    expect(formatMoney(2_000_000, 'USD')).toBe('USD 2.0m');
  });

  it('treats zero and null as absent', () => {
    expect(formatMoney(0, 'NGN')).toBeNull();
    expect(formatMoney(null, 'NGN')).toBeNull();
  });
});

describe('splitDisplayName', () => {
  it('leaves a single word on one line', () => {
    expect(splitDisplayName('Placeholder')).toEqual(['Placeholder']);
  });

  it('balances two lines on a word boundary', () => {
    expect(splitDisplayName('Test Performer')).toEqual(['Test', 'Performer']);
  });

  it('balances a long name rather than splitting down the middle', () => {
    // 38 characters, the longest shape in the real snapshot.
    const lines = splitDisplayName('Aaaa Bbbbbbbbbbb Cccccc (Dddddd Eeeee)');
    expect(lines).toHaveLength(2);
    expect(Math.abs(lines[0].length - lines[1].length)).toBeLessThanOrEqual(6);
    expect(lines.join(' ')).toBe('Aaaa Bbbbbbbbbbb Cccccc (Dddddd Eeeee)');
  });

  it('collapses stray whitespace instead of producing empty lines', () => {
    expect(splitDisplayName('  Test   Performer  ')).toEqual(['Test', 'Performer']);
  });

  it('survives an empty name', () => {
    expect(splitDisplayName('')).toEqual(['']);
  });
});

describe('fitDisplaySize', () => {
  it('leaves a short name at full size', () => {
    expect(fitDisplaySize(['Test'], 968, 250)).toBe(250);
  });

  it('shrinks a long line to fit instead of clipping', () => {
    const size = fitDisplaySize(['Bbbbbbbbbbb Cccccc'], 968, 250);
    expect(size).toBeLessThan(250);
    expect(size * 18 * 0.46).toBeLessThanOrEqual(968);
  });

  it('sizes to the longest line, not the first', () => {
    const a = fitDisplaySize(['Aa', 'Bbbbbbbbbbbbbbbbbbbbbbbb'], 968, 250);
    const b = fitDisplaySize(['Bbbbbbbbbbbbbbbbbbbbbbbb'], 968, 250);
    expect(a).toBe(b);
  });
});

describe('posterBurstRamp', () => {
  it('uses the full window for a full deck', () => {
    expect(posterBurstRamp(14)).toBeCloseTo(2.2, 5);
  });

  it('shortens the ramp for a thin deck so it does not crawl', () => {
    expect(posterBurstRamp(3)).toBeLessThan(2.2);
    expect(posterBurstRamp(3)).toBeGreaterThanOrEqual(0.9);
  });

  it('is monotonic in the number of posters', () => {
    for (let n = 1; n < 20; n++) {
      expect(posterBurstRamp(n + 1)).toBeGreaterThanOrEqual(posterBurstRamp(n));
    }
  });

  it('never exceeds the scene window', () => {
    expect(posterBurstRamp(100)).toBeLessThanOrEqual(2.2);
  });
});

describe('buildStatRows', () => {
  it('builds the reference card rows', () => {
    expect(buildStatRows(row())).toEqual([
      { label: 'Hours on screen', value: '31' },
      { label: 'Biggest film', value: 'Placeholder Film · 9.6M views' },
      { label: 'Most frequent co-star', value: 'Second Performer · 6 films' },
      { label: 'Most frequent director', value: 'Third Performer · 4 films' },
    ]);
  });

  it('drops every row whose value is missing rather than blanking it', () => {
    const rows = buildStatRows(
      row({
        hours_on_screen: 0,
        top_film_title: null,
        top_film_views: null,
        top_costar_name: null,
        top_costar_films: null,
        top_director_name: null,
        top_director_films: null,
      })
    );
    expect(rows).toEqual([]);
  });

  it('includes stage work and box office when present', () => {
    const rows = buildStatRows(
      row({ plays_count: 2, top_play_title: 'Placeholder Play', box_office_total: 3_207_600_000, box_office_currency: 'NGN' }),
      7
    );
    expect(rows).toContainEqual({ label: 'On stage', value: 'Placeholder Play · 2 productions' });
    expect(rows).toContainEqual({ label: 'Box office', value: '₦3.21bn' });
  });

  it('gives the last slot to box office rather than stage work', () => {
    const rows = buildStatRows(
      row({ plays_count: 2, top_play_title: 'Placeholder Play', box_office_total: 3_207_600_000, box_office_currency: 'NGN' })
    );
    expect(rows).toHaveLength(5);
    expect(rows[4]).toEqual({ label: 'Box office', value: '₦3.21bn' });
    expect(rows.some((r) => r.label === 'On stage')).toBe(false);
  });

  it('singularises a lone stage production', () => {
    const rows = buildStatRows(row({ plays_count: 1, top_play_title: 'Placeholder Play' }), 7);
    expect(rows).toContainEqual({ label: 'On stage', value: 'Placeholder Play · 1 production' });
  });

  it('hides the follower row when nobody follows them', () => {
    const rows = buildStatRows(row({ followers: 0 }));
    expect(rows.some((r) => r.label === 'Fans following on MuviDB')).toBe(false);
  });

  it('never returns more rows than the card can hold', () => {
    const rows = buildStatRows(
      row({
        plays_count: 2,
        top_play_title: 'Placeholder Play',
        box_office_total: 3_207_600_000,
        box_office_currency: 'NGN',
        followers: 1240,
      })
    );
    expect(rows).toHaveLength(5);
  });

  it('keeps the biggest film even without a view count', () => {
    const rows = buildStatRows(row({ top_film_views: null }));
    expect(rows).toContainEqual({ label: 'Biggest film', value: 'Placeholder Film' });
  });

  it('drops a "most frequent" collaborator seen only once', () => {
    // One film together is not a pattern, and it rendered as "1 films".
    const rows = buildStatRows(row({ top_costar_films: 1, top_director_films: 1 }));
    expect(rows.some((r) => r.label === 'Most frequent co-star')).toBe(false);
    expect(rows.some((r) => r.label === 'Most frequent director')).toBe(false);
  });
});

describe('buildRolePills', () => {
  it('shows both pills when billing is known', () => {
    expect(buildRolePills(row({ lead_count: 9, support_count: 5, lead_known_count: 14 }))).toEqual([
      '9 lead roles',
      '5 supporting',
    ]);
  });

  it('singularises a lone lead role', () => {
    expect(buildRolePills(row({ lead_count: 1, support_count: 0, lead_known_count: 1 }))).toEqual([
      '1 lead role',
    ]);
  });

  it('shows nothing when no credit has usable billing', () => {
    // Half of 2026 actor credits store the sentinel 99, so this is common.
    expect(buildRolePills(row({ lead_count: 0, support_count: 0, lead_known_count: 0 }))).toEqual([]);
  });
});

describe('topPercentLabel', () => {
  it('inverts the percentile into a top-N badge', () => {
    expect(topPercentLabel(97)).toBe('Top 3%');
  });

  it('never claims Top 0%', () => {
    expect(topPercentLabel(100)).toBe('Top 1%');
  });

  it('returns null when the percentile is missing', () => {
    expect(topPercentLabel(null)).toBeNull();
  });
});

describe('formatCount', () => {
  it('groups thousands', () => {
    expect(formatCount(1240)).toBe('1,240');
  });

  it('returns null for missing values', () => {
    expect(formatCount(null)).toBeNull();
  });
});
