import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase.js', () => ({ supabase: {} }));
vi.mock('./threads_oauth.js', () => ({ decryptThreadsToken: () => ({ accessToken: 'x' }) }));

import { normalizeInstagramHandle, nameLooksUsable } from './instagram_person_lookup';

describe('normalizeInstagramHandle', () => {
  it('accepts the forms an admin actually pastes', () => {
    for (const input of [
      'rinaboyxx',
      '@rinaboyxx',
      'instagram.com/rinaboyxx',
      'https://instagram.com/rinaboyxx',
      'https://www.instagram.com/rinaboyxx/',
      'https://instagram.com/rinaboyxx?igsh=abc123',
      'https://instagram.com/rinaboyxx/#profile',
    ]) {
      expect(normalizeInstagramHandle(input)).toBe('rinaboyxx');
    }
  });

  it('keeps dots and underscores, which are legal in handles', () => {
    expect(normalizeInstagramHandle('@funke.akindele_')).toBe('funke.akindele_');
  });

  it('lowercases so the same account is never stored twice', () => {
    expect(normalizeInstagramHandle('@RinaBoyXX')).toBe('rinaboyxx');
  });

  it('rejects anything that is not a handle', () => {
    for (const bad of ['', '   ', '@', 'two words', 'has/slash', 'a'.repeat(31), null, undefined]) {
      expect(normalizeInstagramHandle(bad as any)).toBeNull();
    }
  });

  it('does not mistake another site for Instagram', () => {
    expect(normalizeInstagramHandle('https://twitter.com/someone')).toBeNull();
  });
});

describe('nameLooksUsable', () => {
  it('accepts real names', () => {
    for (const name of ['Olufunke Akindele', 'Kemi Adetiba', 'Ramsey Nouah Jr']) {
      expect(nameLooksUsable(name)).toBe(true);
    }
  });

  it('rejects promo copy that Instagram display names are full of', () => {
    for (const junk of [
      'BOOKINGS DM ONLY',
      'Official Page',
      'Contact my manager',
      'Link in bio',
      'CEO Brand Ambassador',
    ]) {
      expect(nameLooksUsable(junk)).toBe(false);
    }
  });

  it('rejects a single word, which is a stage name not a full name', () => {
    expect(nameLooksUsable('Rinaboy')).toBe(false);
  });

  it('rejects emoji-dominated display names', () => {
    expect(nameLooksUsable('🔥🔥 Rina 🔥🔥✨💯')).toBe(false);
  });

  it('rejects empty and overlong values', () => {
    expect(nameLooksUsable('')).toBe(false);
    expect(nameLooksUsable(null)).toBe(false);
    expect(nameLooksUsable('A very long display name '.repeat(5))).toBe(false);
  });
});

describe('stored handles are compared exactly, not by substring', () => {
  // A LIKE of %/instagram% matched every person in the table, because every
  // stored value contains "instagram.com/". The live probe reported the handle
  // "instagram" as already belonging to an unrelated actor.
  it('does not treat the host as part of the handle', () => {
    expect(normalizeInstagramHandle('https://instagram.com/eluke_adaeze')).toBe('eluke_adaeze');
    expect(normalizeInstagramHandle('https://instagram.com/eluke_adaeze')).not.toBe('instagram');
  });

  it('distinguishes handles that share a prefix', () => {
    expect(normalizeInstagramHandle('https://instagram.com/rinaboy')).toBe('rinaboy');
    expect(normalizeInstagramHandle('https://instagram.com/rinaboyxx')).toBe('rinaboyxx');
  });
});
