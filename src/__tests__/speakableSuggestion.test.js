/**
 * Non-lexical tokens must never reach a suggestion chip.
 *
 * The model is trained on CHILDES transcription data, whose token stream
 * includes annotation markers. `xxx` — CHILDES for "unintelligible speech" —
 * is one of its highest-probability classes, so it was reachable as a tappable,
 * speakable suggestion. The previous filter tested `word !== '[UNKNOWN]'`, a
 * string that does not appear anywhere in tokenizer.json, so it matched nothing.
 */

import { isSpeakableSuggestion } from '../utils/suggestionFilter';

describe('isSpeakableSuggestion', () => {
  test.each(['xxx', 'yyy', 'www', 'XXX', ' xxx '])('rejects the CHILDES marker %p', (token) => {
    expect(isSpeakableSuggestion(token)).toBe(false);
  });

  test.each(['.', '?', '!', '...', '—', '“”'])('rejects pure punctuation %p', (token) => {
    expect(isSpeakableSuggestion(token)).toBe(false);
  });

  test.each(['<pad>', '<unk>', '[unknown]', 'UNK'])('rejects the sentinel %p', (token) => {
    expect(isSpeakableSuggestion(token)).toBe(false);
  });

  test.each(['laughs', 'sings', 'coughs'])('rejects the paralinguistic marker %p', (token) => {
    expect(isSpeakableSuggestion(token)).toBe(false);
  });

  test.each(['you', 'water', 'more', 'I', 'no', "don't", 'well-done', '2'])(
    'accepts the real word %p',
    (token) => {
      expect(isSpeakableSuggestion(token)).toBe(true);
    },
  );

  test.each([null, undefined, '', '   ', 42, {}])('rejects the non-word %p', (token) => {
    expect(isSpeakableSuggestion(token)).toBe(false);
  });
});
