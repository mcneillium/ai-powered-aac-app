import { findRelatedVocabulary } from '../data/conceptSearch';
import { corePages, searchVocabulary } from '../data/coreVocabulary';

jest.mock('../services/customVocabStore', () => ({ getCustomButtons: () => [{ id: 'personal-1', label: 'Nana', category: 'noun' }] }));

describe('offline related-word finder', () => {
  test('offers words for an indirect request with page destinations', () => {
    const results = findRelatedVocabulary('something to drink');
    expect(results.some(r => r.button.label === 'water' && r.pageId === 'food' && r.related)).toBe(true);
  });
  test('preserves direct results first and includes personal words', () => {
    const direct = searchVocabulary('drink');
    expect(findRelatedVocabulary('drink').slice(0, direct.length).map(r => r.button.id)).toEqual(direct.map(r => r.button.id));
    expect(findRelatedVocabulary('Nana')[0].button.id).toBe('personal-1');
  });
  test('does not fabricate missing words or mutate vocabulary positions', () => {
    const before = JSON.stringify(corePages);
    expect(findRelatedVocabulary('nonsensezzzz')).toEqual([]);
    const results = findRelatedVocabulary('overwhelmed');
    expect(results.some(r => r.button.label === 'stop')).toBe(true);
    expect(results.every(r => !r.button.navigateTo)).toBe(true);
    expect(new Set(results.map(r => `${r.pageId}:${r.button.id}`)).size).toBe(results.length);
    expect(JSON.stringify(corePages)).toBe(before);
  });
  test('handles empty input and result limits', () => {
    expect(findRelatedVocabulary(null)).toEqual([]);
    expect(findRelatedVocabulary('family', 2)).toHaveLength(2);
    expect(findRelatedVocabulary('family', 0)).toEqual([]);
  });
});
