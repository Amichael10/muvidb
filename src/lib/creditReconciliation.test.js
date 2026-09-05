import { describe, expect, it } from 'vitest';
import { candidateKey, duplicateCreditGroups, dedupeCreditCandidates, compareScreenshotCredits, groupCreditReadings } from './creditReconciliation';

const row = (id, name = 'Toyin Abraham', role = 'Mama', extra = {}) => ({ id, film_id: 'film', raw_name: name, role_or_character: role, credit_type: 'actor', status: 'pending', ...extra });

describe('credit reconciliation', () => {
  it('collapses repeated frames, punctuation and swapped names, keeping strongest evidence', () => {
    const rows = [row('1'), row('2', 'ABRAHAM, TOYIN', 'Mama.', { ocr_confidence: 0.95 })];
    expect(duplicateCreditGroups(rows)[0].map(item => item.id)).toEqual(['2', '1']);
    expect(dedupeCreditCandidates(rows).map(item => item.id)).toEqual(['2']);
    expect(candidateKey(rows[0])).toBe(candidateKey(rows[1]));
  });
  it('preserves genuine different characters, crew roles, films, and profile identities', () => {
    const rows = [row('1'), row('2', 'Toyin Abraham', 'Mama 2'), row('3', 'Toyin Abraham', 'Director', { credit_type: 'crew' }), row('4', 'Toyin Abraham', 'Mama', { film_id: 'other' })];
    expect(duplicateCreditGroups(rows)).toEqual([]);
    expect(duplicateCreditGroups([row('1', undefined, undefined, { matched_person_id: 'a' }), row('2', undefined, undefined, { matched_person_id: 'b' })])).toEqual([]);
  });
  it('groups repeated names for display while retaining every role reading', () => {
    const rows = [row('1'), row('2', 'Toyin Abraham', 'Manna'), row('3', 'Toyin Abraham', 'Producer', { credit_type: 'crew' })];
    const groups = groupCreditReadings(rows);
    expect(groups.map(items => items.length)).toEqual([2, 1]);
    expect(groups.flat()).toEqual(rows);
    expect(dedupeCreditCandidates(rows)).toHaveLength(3);
  });
  it('merges an alias and canonical name only when they link to the same person and role', () => {
    expect(duplicateCreditGroups([row('1', 'Itele', 'Oba', { matched_person_id: 'a' }), row('2', 'Ibrahim Yekini', 'Oba', { matched_person_id: 'a' })])).toHaveLength(1);
  });
  it('does not touch reviewed rows', () => {
    expect(duplicateCreditGroups([row('1'), row('2', undefined, undefined, { status: 'approved' })])).toEqual([]);
  });
  it('matches screenshot readings to existing rows and preselects only exact repeats', () => {
    const existing = [row('1'), row('2'), row('3', 'Toyin Abraham', 'Manna')];
    const [comparison] = compareScreenshotCredits(existing, [{ name: 'Toyin Abraham', role_or_character: 'Mama' }], 'cast');
    expect(comparison.targetId).toBe('1');
    expect(comparison.duplicateIds).toEqual(['2']);
    expect(comparison.matches).toHaveLength(3);
  });
  it('requires selection when a screenshot conflicts with multiple roles', () => {
    const [comparison] = compareScreenshotCredits([row('1'), row('2', 'Toyin Abraham', 'Manna')], [{ name: 'Toyin Abraham', role_or_character: 'Madam' }], 'actor');
    expect(comparison.targetId).toBe('');
    expect(comparison.duplicateIds).toEqual([]);
  });
  it('deduplicates screenshot readings without removing credits absent from the image', () => {
    const existing = [row('1')];
    const reading = { name: 'Murphy Afolabi', role_or_character: 'Oba' };
    const result = compareScreenshotCredits(existing, [reading, reading], 'actor');
    expect(result).toHaveLength(1);
    expect(result[0].targetId).toBe('__new__');
    expect(existing).toHaveLength(1);
  });
  it('shows AI/local disagreements rather than treating OCR confidence as proof', () => {
    const [comparison] = compareScreenshotCredits([row('1')], [{ name: 'Toyin Abraham', role_or_character: 'Mama' }], 'actor', [{ name: 'Toyin Abraham', role_or_character: 'Manna' }]);
    expect(comparison.localAgreement).toBe(false);
    expect(comparison.local).toHaveLength(1);
  });
});
