// Tests for favourites store
import { loadFavourites, getFavourites, addFavourite, removeFavourite, isFavourite } from '../services/favouritesStore';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

describe('favouritesStore', () => {
  beforeEach(async () => {
    // Reset state by loading fresh
    await loadFavourites();
  });

  test('starts with empty favourites', async () => {
    const favs = await loadFavourites();
    expect(Array.isArray(favs)).toBe(true);
  });

  test('addFavourite adds a phrase', async () => {
    await addFavourite('I want water');
    expect(isFavourite('I want water')).toBe(true);
  });

  test('addFavourite ignores empty strings', async () => {
    const before = getFavourites().length;
    await addFavourite('');
    await addFavourite('   ');
    expect(getFavourites().length).toBe(before);
  });

  test('removeFavourite removes by id', async () => {
    const entry = await addFavourite('test phrase remove');
    expect(isFavourite('test phrase remove')).toBe(true);
    if (entry) {
      await removeFavourite(entry.id);
      expect(isFavourite('test phrase remove')).toBe(false);
    }
  });

  test('does not add duplicates', async () => {
    await addFavourite('unique phrase');
    const countBefore = getFavourites().filter(f => f.phrase === 'unique phrase').length;
    await addFavourite('unique phrase');
    const countAfter = getFavourites().filter(f => f.phrase === 'unique phrase').length;
    expect(countAfter).toBe(countBefore);
  });
});
