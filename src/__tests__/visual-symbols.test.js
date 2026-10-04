import { localVisualSource, visualVocabulary, visualMessageTokens } from '../data/visualSymbols';

const rebuild = (tokens) => tokens.map((t) => t.prefix + t.text).join('');

describe('visual communication tokens', () => {
  test('preserves original words, punctuation, spacing and Unicode without adding meaning', () => {
    for (const message of ['I want water, please!', '  Not  that. 🐈', 'Siobhán’s café — tomorrow?', '...']) {
      expect(rebuild(visualMessageTokens(message))).toBe(message);
    }
  });
  test('uses longest matching personal phrase and keeps its photo identity', () => {
    const personal = { id: 'my-cup', label: 'my blue cup', imageUri: 'file:///private/cup.jpg' };
    const tokens = visualMessageTokens('Find my blue cup please', visualVocabulary([personal]));
    expect(tokens.find((t) => t.text === 'my blue cup').button).toBe(personal);
    expect(tokens.find((t) => t.text === 'please').emoji).toBeTruthy();
  });
  test('does not combine phrases across punctuation or match within words', () => {
    const buttons = [{ id: 'phrase', label: 'water please', emoji: '🥤' }];
    expect(visualMessageTokens('water, please', buttons).some((t) => t.button?.id === 'phrase')).toBe(false);
    expect(visualMessageTokens('watermelon', [{ id: 'water', label: 'water' }])[0].button.id).toBeUndefined();
  });
  test('unknown words remain text rather than an invented picture', () => {
    const [token] = visualMessageTokens('Blorplet');
    expect(token.text).toBe('Blorplet');
    expect(token.emoji).toBeNull();
  });
  test('ambiguous custom labels do not choose a random personal photo', () => {
    const vocabulary = visualVocabulary([{ id: 'a', label: 'Paul', imageUri: 'file:///a' }, { id: 'b', label: 'Paul', imageUri: 'file:///b' }]);
    expect(visualMessageTokens('Paul', vocabulary)[0].button.imageUri).toBeUndefined();
  });
  test('refuses remote, protocol-relative and data image sources', () => {
    for (const uri of ['https://example.com/photo', 'http://example.com/photo', '//example.com/photo', 'data:image/png;base64,x']) expect(localVisualSource({ uri })).toBeNull();
    expect(localVisualSource({ uri: 'file:///local/photo.png' })).toEqual({ uri: 'file:///local/photo.png' });
    expect(localVisualSource({ uri: 'content://media/1' })).toEqual({ uri: 'content://media/1' });
    expect(localVisualSource(23)).toBe(23);
  });
});
