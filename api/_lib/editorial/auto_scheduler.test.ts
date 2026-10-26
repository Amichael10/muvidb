import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../supabase.js', () => {
  const queryBuilder: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  };
  return {
    supabase: {
      from: vi.fn(() => queryBuilder),
    },
  };
});

vi.mock('../social_studio.js', () => ({
  approveEditorialSlot: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('./candidate_service.js', () => ({
  fetchSeriesCandidates: vi.fn(),
}));

vi.mock('./social_preflight.js', () => ({
  preflightFilm: vi.fn(),
}));

import { autoScheduleDueCalendarSlots } from './auto_scheduler.js';
import { fetchSeriesCandidates } from './candidate_service.js';
import { preflightFilm } from './social_preflight.js';
import { approveEditorialSlot } from '../social_studio.js';
import { supabase } from '../supabase.js';

describe('autoScheduleDueCalendarSlots candidate fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('replaces an invalid pre-assigned candidate (missing crew) with the next eligible candidate instead of skipping the slot', async () => {
    // 1. Mock slots query to return one slot with an invalid movie
    const mockSlot = {
      id: 'slot-1',
      scheduled_date: '2026-10-26',
      scheduled_time: '08:00:00',
      status: 'planned',
      priority: 'urgent',
      subject_entity_type: 'movie',
      subject_entity_id: 'film-invalid-crew',
      planner_key: 'release:film-invalid-crew:2026-10-26',
      social_content_series: { id: 's-1', name: 'New & Upcoming', slug: 'new_and_upcoming' },
    };

    const fromMock = vi.mocked(supabase.from);
    fromMock.mockImplementation((table: string) => {
      if (table === 'social_calendar') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [mockSlot], error: null }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        } as any;
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any;
    });

    // 2. Mock preflight: film-invalid-crew fails with missing crew
    // replacement candidate film-valid passes!
    vi.mocked(preflightFilm).mockImplementation(async (filmId: string) => {
      if (filmId === 'film-invalid-crew') {
        return {
          ready: false,
          reasons: ['missing_director_or_crew'],
          artwork: { orientation: 'portrait' as const },
        } as any;
      }
      if (filmId === 'film-landscape') {
        return {
          ready: true,
          reasons: [],
          artwork: { orientation: 'landscape' as const },
        } as any;
      }
      if (filmId === 'film-valid') {
        return {
          ready: true,
          reasons: [],
          artwork: { orientation: 'portrait' as const },
          title: 'Qualified Nollywood Hit',
        } as any;
      }
      return { ready: false, reasons: ['not_found'] } as any;
    });

    // 3. Mock candidate_service returning a list where first is landscape, second is valid
    vi.mocked(fetchSeriesCandidates).mockResolvedValue([
      {
        id: 'film-landscape',
        type: 'movie',
        name: 'Landscape Movie',
        imageUrl: 'https://example.com/landscape.jpg',
        completenessScore: 0.9,
        data: {},
      },
      {
        id: 'film-valid',
        type: 'movie',
        name: 'Qualified Nollywood Hit',
        imageUrl: 'https://example.com/portrait.jpg',
        completenessScore: 0.95,
        data: {},
      },
    ]);

    const result = await autoScheduleDueCalendarSlots(new Date('2026-10-26T07:00:00Z'));

    // The slot should NOT be skipped!
    expect(result.skipped).toHaveLength(0);
    expect(result.scheduled).toContain('slot-1');

    // approveEditorialSlot should have been called with film-valid
    expect(approveEditorialSlot).toHaveBeenCalledWith(
      expect.objectContaining({
        slotId: 'slot-1',
        candidateId: 'film-valid',
        candidateType: 'movie',
      }),
      expect.any(Object),
    );
  });
});
