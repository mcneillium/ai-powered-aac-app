// Tests for core vocabulary data integrity
import { corePages, getPage, getHomePage, getPageIds } from '../data/coreVocabulary';

describe('coreVocabulary', () => {
  test('home page exists and has buttons', () => {
    const home = getHomePage();
    expect(home).toBeTruthy();
    expect(home.id).toBe('home');
    expect(home.buttons.length).toBeGreaterThan(0);
  });

  test('all pages referenced by navigation buttons exist', () => {
    const allButtons = Object.values(corePages).flatMap(page => page.buttons);
    const navButtons = allButtons.filter(b => b.navigateTo);
    navButtons.forEach(button => {
      const target = getPage(button.navigateTo);
      expect(target).toBeTruthy();
      expect(target.id).toBe(button.navigateTo);
    });
  });

  test('every button has a unique id within its page', () => {
    Object.values(corePages).forEach(page => {
      const ids = page.buttons.map(b => b.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });
  });

  test('every button has required fields', () => {
    Object.values(corePages).forEach(page => {
      page.buttons.forEach(button => {
        expect(button.id).toBeTruthy();
        expect(button.label).toBeTruthy();
        expect(button.category).toBeTruthy();
        expect(button.color).toBeTruthy();
        expect(button.textColor).toBeTruthy();
      });
    });
  });

  test('getPage returns null for unknown page', () => {
    expect(getPage('nonexistent')).toBeNull();
  });

  test('getPageIds returns all page keys', () => {
    const ids = getPageIds();
    expect(ids).toContain('home');
    expect(ids).toContain('people');
    expect(ids).toContain('food');
    expect(ids).toContain('feelings');
  });

  test('Fitzgerald Key categories are valid', () => {
    const validCategories = ['pronoun', 'verb', 'adjective', 'noun', 'social', 'important', 'misc', 'nav'];
    Object.values(corePages).forEach(page => {
      page.buttons.forEach(button => {
        expect(validCategories).toContain(button.category);
      });
    });
  });
});
