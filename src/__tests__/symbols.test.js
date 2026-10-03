import { symbolFor, SYMBOL_IDS } from '../data/symbols';
import { corePages } from '../data/coreVocabulary';

describe('symbols', () => {
  const ids = new Set(Object.values(corePages).flatMap(p => p.buttons.map(b => b.id)));

  test('every mapped id is a real vocabulary button (no dead entries)', () => {
    SYMBOL_IDS.forEach(id => expect({ id, real: ids.has(id) }).toEqual({ id, real: true }));
  });

  test('all navigation folders and all nouns have a picture', () => {
    Object.values(corePages).flatMap(p => p.buttons)
      .filter(b => b.navigateTo || b.category === 'noun')
      .forEach(b => expect({ id: b.id, pic: !!symbolFor(b) }).toEqual({ id: b.id, pic: true }));
  });

  test('little words stay text-only, custom words can match by label', () => {
    expect(symbolFor({ id: 'the', label: 'the' })).toBeNull();
    expect(symbolFor({ id: 'custom_1', label: 'Dog' })).toBe('🐶');
    expect(symbolFor({ id: 'x', label: 'x', emoji: '🎈' })).toBe('🎈');
    expect(symbolFor(null)).toBeNull();
  });
});
