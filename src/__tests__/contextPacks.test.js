// Tests for context packs data
import { getContextPack, getContextPackIds, getAllContextPacks, contextPacks } from '../data/contextPacks';

describe('contextPacks', () => {
  test('has at least 6 context packs', () => {
    const ids = getContextPackIds();
    expect(ids.length).toBeGreaterThanOrEqual(6);
  });

  test('every pack has required fields', () => {
    const packs = getAllContextPacks();
    packs.forEach(pack => {
      expect(pack.id).toBeTruthy();
      expect(pack.label).toBeTruthy();
      expect(pack.icon).toBeTruthy();
      expect(pack.color).toBeTruthy();
      expect(Array.isArray(pack.phrases)).toBe(true);
      expect(pack.phrases.length).toBeGreaterThanOrEqual(8);
    });
  });

  test('every phrase has id, label, category', () => {
    const packs = getAllContextPacks();
    packs.forEach(pack => {
      pack.phrases.forEach(phrase => {
        expect(phrase.id).toBeTruthy();
        expect(phrase.label).toBeTruthy();
        expect(phrase.category).toBeTruthy();
      });
    });
  });

  test('getContextPack returns correct pack by id', () => {
    const home = getContextPack('home');
    expect(home).not.toBeNull();
    expect(home.label).toBe('Home');
  });

  test('getContextPack returns null for unknown id', () => {
    expect(getContextPack('nonexistent')).toBeNull();
  });

  test('emergency pack exists and has urgent phrases', () => {
    const emergency = getContextPack('emergency');
    expect(emergency).not.toBeNull();
    const urgentCount = emergency.phrases.filter(p => p.category === 'urgent').length;
    expect(urgentCount).toBeGreaterThanOrEqual(6);
  });

  test('no duplicate phrase ids within a pack', () => {
    const packs = getAllContextPacks();
    packs.forEach(pack => {
      const ids = pack.phrases.map(p => p.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });
  });
});
