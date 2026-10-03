// Typing: the partial word is completed from the board's own engine; typed
// words never touch the message until the user adds them.
import { splitTyping } from '../utils/typing';
import { suggestNext } from '../services/suggestionEngine';

describe('splitTyping', () => {
  test('separates finished words from the word being typed', () => {
    expect(splitTyping('I want wa', ['hello'])).toEqual({ context: ['hello', 'I', 'want'], partial: 'wa', done: ['I', 'want'] });
  });
  test('a trailing space means no partial word', () => {
    expect(splitTyping('I want ', [])).toEqual({ context: ['I', 'want'], partial: '', done: ['I', 'want'] });
  });
  test('empty text', () => {
    expect(splitTyping('', ['a'])).toEqual({ context: ['a'], partial: '', done: [] });
  });
});

describe('word completion', () => {
  test('every completion starts with what was typed', () => {
    const out = suggestNext(['i', 'want'], { prefix: 'wa', k: 6 });
    expect(out.length).toBeGreaterThan(0);
    out.forEach((s) => expect(s.word.toLowerCase().startsWith('wa')).toBe(true));
  });
  test('board words can be completed even without context', () => {
    expect(suggestNext([], { prefix: 'thir', k: 6 }).map((s) => s.word.toLowerCase())).toContain('thirsty');
  });
});
