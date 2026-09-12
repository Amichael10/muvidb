import { describe, expect, it } from 'vitest';
import { pickAutoMatch } from './personNameMatch';

describe('separate person aliases in OCR matching', () => {
  const person = { id: '1', name: 'Ibrahim Yekini', aliases: ['Itele', 'Itele D Icon'] };

  it('links a stage name to its canonical person', () => {
    expect(pickAutoMatch('ITELE', [person])).toBe(person);
    expect(pickAutoMatch('Itele D-Icon', [person])).toBe(person);
  });

  it('does not automatically link a partial alias', () => {
    expect(pickAutoMatch('Itel', [person])).toBeNull();
  });

  it('requires review when an alias belongs to multiple people', () => {
    expect(pickAutoMatch('Itele', [person, { id: '2', name: 'Someone Else', aliases: ['Itele'], film_count: 100 }])).toBeNull();
  });

  it('preserves canonical and reordered name matching', () => {
    expect(pickAutoMatch('Ibrahim Yekini', [person])).toBe(person);
    expect(pickAutoMatch('Yekini Ibrahim', [person])).toBe(person);
  });

  it('matches composite identities across name and aliases (e.g. Ibrahim Bakare Itele)', () => {
    const actor = {
      id: '1',
      name: 'Ibrahim Yekini',
      film_count: 107,
      aliases: ['Itele', 'Itele D Icon', 'Ibrahim Yekini Bakare', 'Ibrahim Yekini Itele', 'Kesari'],
    };
    expect(pickAutoMatch('Ibrahim Bakare Itele', [actor])).toBe(actor);
    expect(pickAutoMatch("Itele D'Icon", [actor])).toBe(actor);
  });

  it('matches Yoruba theophoric stem variations (e.g. Oluwakemi Apesin -> Kemi Apesin)', () => {
    const actress = {
      id: '2',
      name: 'Kemi Apesin Ariyo',
      film_count: 88,
      aliases: ['Kemity', 'Kemi Ariyo', 'Kemi Apesin'],
    };
    expect(pickAutoMatch('Oluwakemi Apesin', [actress])).toBe(actress);
    expect(pickAutoMatch('Kemi Apesin', [actress])).toBe(actress);
  });
});
