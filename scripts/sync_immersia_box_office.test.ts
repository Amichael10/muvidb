import { describe, it, expect } from 'vitest';
import { parseImmersiaShowMetrics, type ImmersiaShow } from './sync_immersia_box_office';

describe('Immersia Box Office Parser', () => {
  it('correctly calculates gross domestic revenue and admissions from ticket types', () => {
    const mockShow: ImmersiaShow = {
      _id: 'show-1',
      publicId: 'test-public-id',
      title: 'The Island Of No Return',
      description: 'An interactive stage adventure.',
      venue: 'Anthill Immersia Theater',
      dates: [
        {
          date: '2026-12-12T00:00:00.000Z',
          timeSlots: [
            { time: '15:30', capacity: 200, sold: 10 },
            { time: '18:30', capacity: 200, sold: 5 },
          ],
        },
      ],
      ticketTypes: [
        { type: 'Regular', price: 2500000, sold: 7, groupSize: 1 }, // 7 * 25,000 = 175,000
        { type: 'VIP', price: 5000000, sold: 3, groupSize: 1 },     // 3 * 50,000 = 150,000
        { type: 'Group of 3', price: 6500000, sold: 3, groupSize: 3 }, // 3 * 65,000 = 195,000
        { type: 'Student', price: 2000000, sold: 0, groupSize: 1 },
      ],
    };

    const metrics = parseImmersiaShowMetrics(mockShow);

    // Gross: 175,000 + 150,000 + 195,000 = 520,000 NGN
    expect(metrics.grossDomesticNgn).toBe(520000);
    // Tickets: 7 + 3 + 3 = 13
    expect(metrics.ticketsSold).toBe(13);
    // Dates
    expect(metrics.runStartDate).toBe('2026-12-12');
    expect(metrics.runEndDate).toBe('2026-12-12');
    // Performance time format
    expect(metrics.performanceTime).toContain('3:30 PM');
    expect(metrics.performanceTime).toContain('6:30 PM');
    // Metrics payload
    expect(metrics.boxOfficeMetrics.tier_breakdown).toHaveLength(4);
    expect(metrics.boxOfficeMetrics.tier_breakdown[0]).toEqual({
      type: 'Regular',
      priceNgn: 25000,
      priceKobo: 2500000,
      sold: 7,
      grossNgn: 175000,
      groupSize: 1,
    });
    expect(metrics.boxOfficeMetrics.total_capacity).toBe(400);
    expect(metrics.boxOfficeMetrics.total_slot_seats_sold).toBe(15);
  });

  it('determines dates and status across multi-day performance runs', () => {
    const mockShow: ImmersiaShow = {
      _id: 'show-past',
      title: 'The Valley of Hidden Treasures',
      dates: [
        { date: '2024-01-05T00:00:00.000Z', timeSlots: [{ time: '14:00', capacity: 100, sold: 100 }] },
        { date: '2024-01-10T00:00:00.000Z', timeSlots: [{ time: '17:00', capacity: 100, sold: 100 }] },
      ],
      ticketTypes: [
        { type: 'Regular', price: 1850000, sold: 50 },
      ],
    };

    const metrics = parseImmersiaShowMetrics(mockShow);
    expect(metrics.runStartDate).toBe('2024-01-05');
    expect(metrics.runEndDate).toBe('2024-01-10');
    expect(metrics.status).toBe('archived');
  });

  it('handles empty dates or ticket types gracefully without throwing', () => {
    const mockShow: ImmersiaShow = {
      _id: 'show-empty',
      title: 'Empty Show',
    };

    const metrics = parseImmersiaShowMetrics(mockShow);
    expect(metrics.grossDomesticNgn).toBe(0);
    expect(metrics.ticketsSold).toBe(0);
    expect(metrics.runStartDate).toBeNull();
    expect(metrics.runEndDate).toBeNull();
    expect(metrics.performanceTime).toBeNull();
    expect(metrics.status).toBe('archived');
  });
});
