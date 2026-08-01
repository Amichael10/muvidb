import { describe, expect, it } from 'vitest';
import {
  buildBirthdaySpotlightSnapshot,
  collectSnapshotWarnings,
  daysUntilBirthday,
} from './snapshots';

const person = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Ada Okoro',
  slug: 'ada-okoro',
  photo_url: 'https://example.test/ada.jpg',
  nationality: 'Nigerian',
  known_for_department: 'Acting',
  date_of_birth: '1990-08-01',
};

const credits = [
  { role: 'actor', films: { id: 'f1', title: 'Lisabi', slug: 'lisabi', year: 2024 } },
  { role: 'actor', films: { id: 'f2', title: 'Jagun Jagun', slug: 'jagun', year: 2023 } },
  { role: 'producer', films: { id: 'f3', title: 'Ayinla', slug: 'ayinla', year: 2021 } },
];

describe('daysUntilBirthday', () => {
  it('is 0 on the day itself', () => {
    expect(daysUntilBirthday('1990-08-01', '2026-08-01T09:00:00Z')).toBe(0);
  });

  it('counts forward within the same year', () => {
    expect(daysUntilBirthday('1967-08-22', '2026-08-01T00:00:00Z')).toBe(21);
  });

  it('rolls over to next year once the date has passed', () => {
    expect(daysUntilBirthday('1990-01-10', '2026-08-01T00:00:00Z')).toBeGreaterThan(150);
  });

  it('returns null for an unparseable date', () => {
    expect(daysUntilBirthday('not-a-date', '2026-08-01T00:00:00Z')).toBeNull();
  });
});

describe('buildBirthdaySpotlightSnapshot', () => {
  const snapshot = buildBirthdaySpotlightSnapshot({
    person,
    credits,
    capturedAt: '2026-08-01T09:00:00Z',
  });

  it('computes the age reached on the captured date', () => {
    expect(snapshot.age).toBe(36);
  });

  it('orders roles by how often the person is credited', () => {
    expect(snapshot.roles).toEqual(['Actor', 'Producer']);
  });

  it('omits the age when the year is not real', () => {
    const undated = buildBirthdaySpotlightSnapshot({
      person: { ...person, date_of_birth: '1000-08-01' },
      credits,
      capturedAt: '2026-08-01T09:00:00Z',
    });
    expect(undated.age).toBeNull();
  });

  it('does not warn when the birthday is today', () => {
    expect(collectSnapshotWarnings(snapshot).some(w => w.includes('days away'))).toBe(false);
  });

  it('warns when the card would greet someone on the wrong day', () => {
    // The worst failure this template has: a "Happy birthday" post three weeks
    // early. Reviewers must see it before approving.
    const early = buildBirthdaySpotlightSnapshot({
      person: { ...person, date_of_birth: '1967-08-22' },
      credits,
      capturedAt: '2026-08-01T09:00:00Z',
    });
    expect(collectSnapshotWarnings(early).some(w => w.includes('21 days away'))).toBe(true);
  });
});
