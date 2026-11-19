import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractSocialIntake, publishIntakeEntity } from './social_intake_engine.js';

vi.mock('./supabase.js', () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: 'mock-person-id', error: null }),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          single: vi.fn().mockResolvedValue({ data: { id: 'mock-id', slug: 'mock-slug' } }),
        })),
        ilike: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({ data: [] }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        })),
        or: vi.fn(() => ({
          limit: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'person-123', name: 'Deyemi Okanlawon', slug: 'deyemi-okanlawon', photo_url: 'https://example.com/deyemi.jpg', known_for_department: 'Acting' }
            }),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { id: 'created-id', slug: 'created-slug' } }),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'created-asset-id' } }),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { id: 'upserted-id', slug: 'upserted-slug' } }),
        })),
      })),
    })),
  },
}));

vi.mock('./ai_service.js', () => ({
  generateAIContent: vi.fn().mockResolvedValue({
    text: JSON.stringify({
      film: {
        title: 'Lakatabu',
        year: 2024,
        release_date: '2024-06-21',
        synopsis: 'A high-octane action thriller about a formidable crime kingpin.',
        genres: ['Action', 'Thriller'],
        director: 'Odunlade Adekola',
        cast: [
          { name: 'Odunlade Adekola', character_name: 'Lakatabu' },
          { name: 'Eniola Ajao', character_name: 'Bidemi' },
        ],
        platform: 'Cinema',
        content_type: 'movie',
      },
      play: {
        title: 'Death and the King\'s Horseman',
        venue: 'Terra Kulture, Lagos',
        city: 'Lagos',
        country: 'Nigeria',
        run_start_date: '2026-12-20',
        run_end_date: '2026-12-25',
        playwright: 'Wole Soyinka',
        director: 'Bolanle Austen-Peters',
        genre: 'Drama',
        synopsis: 'Classic stage masterpiece.',
        status: 'upcoming',
      },
      review: {
        film_title: 'Lakatabu',
        critic_name: 'CinemaPointer',
        quote: 'A thrilling, non-stop adrenaline ride that Nollywood fans will adore.',
        rating: 8.5,
        rating_scale: 10,
      },
      social: {
        headline: 'Lakatabu lands in cinemas!',
        instagram_caption: 'Catch the unstoppable Lakatabu in cinemas now! #LakatabuMovie',
        facebook_caption: 'Lakatabu in cinemas nationwide.',
        threads_post: 'Lakatabu is showing nationwide.',
      },
    }),
  }),
  generateAIVisionContent: vi.fn().mockResolvedValue({
    text: JSON.stringify({
      rawText: 'LAKATABU\nStarring Odunlade Adekola as Lakatabu\nDirected by Odunlade Adekola',
      cast: [{ name: 'Odunlade Adekola', character_name: 'Lakatabu' }],
      crew: [{ role: 'Director', name: 'Odunlade Adekola' }],
    }),
  }),
  parseJSON: (text: string) => JSON.parse(text),
}));

vi.mock('./film_enrichment.js', () => ({
  attachGenresBatch: vi.fn().mockResolvedValue(2),
}));

describe('social_intake_engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts structured proposals from manual input and resolves @mentions', async () => {
    const caption = 'Big announcements coming! Starring @deyemitheactor and directed by @kunleafo. Get ready for fire!';
    const result = await extractSocialIntake({
      caption,
      images: ['https://example.com/poster.jpg'],
    });

    expect(result.success).toBe(true);
    expect(result.platform).toBe('manual');
    expect(result.mentions.length).toBeGreaterThan(0);

    const deyemi = result.mentions.find(m => m.handle === '@deyemitheactor');
    expect(deyemi).toBeDefined();
    expect(deyemi?.resolvedName).toBe('Deyemi Okanlawon');

    expect(result.suggestions.film.title).toBe('Lakatabu');
    expect(result.suggestions.play.title).toBe('Death and the King\'s Horseman');
    expect(result.suggestions.review.critic_name).toBe('CinemaPointer');
  });

  it('creates film entity with validated payload', async () => {
    const result = await publishIntakeEntity({
      entityType: 'film',
      payload: {
        title: 'New Nollywood Blockbuster',
        year: 2026,
        synopsis: 'A gripping tale of suspense and redemption in contemporary Lagos.',
        genres: ['Drama', 'Thriller'],
        director: 'Kunle Afolayan',
        cast: [{ name: 'Deyemi Okanlawon', character_name: 'Chief Adeleke' }],
      },
      actorId: 'admin-user-1',
    });

    expect(result.success).toBe(true);
    expect(result.entityType).toBe('film');
    expect(result.id).toBeDefined();
  });
});
