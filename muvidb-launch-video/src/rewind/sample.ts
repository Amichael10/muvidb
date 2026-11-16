/**
 * Studio default props.
 *
 * Placeholder people only — no real actor from the database appears in a
 * committed file. The render job passes a real public.rewind_2026 row via
 * --props at render time.
 *
 * The two fixtures are deliberately the awkward cases from the acceptance
 * checks: a full 14-poster deck with a short name, and a 3-credit actor with a
 * 38-character name and no billing data.
 */
import type { RewindRow } from '../../../src/lib/rewind';

/** Empty srcs fall through to SafePoster's branded tiles in the Studio. */
const blankPosters = (n: number): string[] => Array.from({ length: n }, () => '');

export const sampleFull: RewindRow = {
  slug: 'test-performer',
  display_name: 'Test Performer',
  portrait_url: null,
  films_count: 14,
  plays_count: 1,
  lead_count: 9,
  support_count: 5,
  lead_known_count: 14,
  total_views: 48_200_000,
  hours_on_screen: 31,
  top_film_title: 'Placeholder Film',
  top_film_views: 9_600_000,
  top_play_title: 'Placeholder Play',
  box_office_total: 3_207_600_000,
  box_office_currency: 'NGN',
  top_costar_name: 'Second Performer',
  top_costar_films: 6,
  top_director_name: 'Third Performer',
  top_director_films: 4,
  followers: 1240,
  percentile: 97,
  archetype: 'The Workhorse',
  archetype_line: 'More films released this year than 97% of actors on MuviDB.',
  poster_urls: blankPosters(14),
};

/** 38 characters, three credits, no usable billing_order. */
export const sampleMinimal: RewindRow = {
  slug: 'placeholder-long-name',
  display_name: 'Aaaa Bbbbbbbbbbb Cccccc (Dddddd Ee)',
  portrait_url: null,
  films_count: 3,
  plays_count: 0,
  lead_count: 0,
  support_count: 0,
  lead_known_count: 0,
  total_views: 8_400,
  hours_on_screen: 5,
  top_film_title: 'Placeholder Film Two',
  top_film_views: 4_200,
  top_play_title: null,
  box_office_total: null,
  box_office_currency: null,
  top_costar_name: null,
  top_costar_films: null,
  top_director_name: null,
  top_director_films: null,
  followers: 0,
  percentile: 86,
  archetype: 'The Ensemble Player',
  archetype_line: '3 films and 5 hours on screen in one year.',
  poster_urls: blankPosters(3),
};
