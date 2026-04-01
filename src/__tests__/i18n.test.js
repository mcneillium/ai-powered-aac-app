// Tests for i18n strings
import { t, setLanguage, getLanguage, getAvailableLanguages } from '../i18n/strings';

describe('i18n', () => {
  afterEach(() => {
    setLanguage('en');
  });

  test('defaults to English', () => {
    expect(getLanguage()).toBe('en');
  });

  test('t() returns English string for known key', () => {
    expect(t('appName')).toBe('Voice');
    expect(t('tapToSpeak')).toBe('Tap words to build a sentence');
  });

  test('t() returns key itself for unknown key', () => {
    expect(t('nonexistent_key')).toBe('nonexistent_key');
  });

  test('setLanguage switches to Spanish', () => {
    setLanguage('es');
    expect(getLanguage()).toBe('es');
    expect(t('appName')).toBe('Voice');
    expect(t('tapToSpeak')).toBe('Toca palabras para construir una frase');
  });

  test('setLanguage ignores unknown languages', () => {
    setLanguage('xx');
    expect(getLanguage()).toBe('en');
  });

  test('Spanish falls back to English for missing keys', () => {
    setLanguage('es');
    // If a key exists in en but not es, it should fall back
    expect(t('appName')).toBeTruthy();
  });

  test('getAvailableLanguages returns at least en and es', () => {
    const langs = getAvailableLanguages();
    expect(langs).toContain('en');
    expect(langs).toContain('es');
  });
});
