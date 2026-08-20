import { describe, expect, it } from 'vitest';
import { derivePlayStatus } from './plays';

describe('derivePlayStatus', () => {
  const refDate = new Date('2026-08-20T12:00:00Z');

  it('marks play as upcoming when run_start_date is in the future', () => {
    const play = {
      run_start_date: '2026-09-01',
      run_end_date: '2026-09-10',
      status: 'upcoming',
    };
    expect(derivePlayStatus(play, refDate)).toBe('upcoming');
  });

  it('marks play as currently_running when today is between start and end dates', () => {
    const play = {
      run_start_date: '2026-08-15',
      run_end_date: '2026-08-25',
      status: 'upcoming',
    };
    expect(derivePlayStatus(play, refDate)).toBe('currently_running');
  });

  it('marks play as archived when run_end_date has passed', () => {
    const play = {
      run_start_date: '2026-08-01',
      run_end_date: '2026-08-15',
      status: 'upcoming', // Stale status in DB
    };
    expect(derivePlayStatus(play, refDate)).toBe('archived');
  });

  it('marks single-day play as archived when date has passed', () => {
    const play = {
      run_start_date: '2026-08-15',
      run_end_date: null,
      status: 'upcoming', // Stale status in DB
    };
    expect(derivePlayStatus(play, refDate)).toBe('archived');
  });

  it('marks single-day play as currently_running on event day', () => {
    const play = {
      run_start_date: '2026-08-20',
      run_end_date: null,
      status: 'upcoming',
    };
    expect(derivePlayStatus(play, refDate)).toBe('currently_running');
  });

  it('marks past years as archived when no exact dates exist', () => {
    const play = {
      year: 2021,
      run_start_date: null,
      run_end_date: null,
      status: 'upcoming',
    };
    expect(derivePlayStatus(play, refDate)).toBe('archived');
  });
});
