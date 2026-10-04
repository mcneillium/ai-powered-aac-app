// "Help me explain" offers rewordings; it must not change the user's meaning
// or invent content, and must never return the original as an "alternative".
import { rephraseOptions, REPAIR_PHRASES } from '../services/explain';

const contentWords = (s) => s.toLowerCase().replace(/[^a-z' ]/g, '').split(' ').filter(Boolean);

describe('rephraseOptions', () => {
  test('empty message → no options', () => {
    expect(rephraseOptions('')).toEqual([]);
    expect(rephraseOptions('   ')).toEqual([]);
  });

  test('requests get polite and question forms that keep the object', () => {
    const opts = rephraseOptions('I want more juice');
    expect(opts.find((o) => o.id === 'polite').text).toBe('I would like more juice, please.');
    expect(opts.find((o) => o.id === 'question').text).toBe('Can I have more juice?');
  });

  test('never repeats the original', () => {
    const msg = 'Help me please';
    rephraseOptions(msg).forEach((o) => expect(o.text.toLowerCase()).not.toBe(msg.toLowerCase()));
  });

  test('every option keeps all of the user\'s content words (shorter drops only fillers)', () => {
    const msg = 'I need to go to the doctor';
    const keep = contentWords(msg).filter((w) => !['to', 'the'].includes(w));
    rephraseOptions(msg).forEach((o) => {
      const got = contentWords(o.text);
      keep.forEach((w) => expect(got).toContain(w));
    });
  });

  test('refusals can be made firmer, not softened away', () => {
    const opts = rephraseOptions('no thank you');
    expect(opts.some((o) => o.id === 'firm')).toBe(true);
    opts.forEach((o) => expect(o.text.toLowerCase()).toContain('no'));
  });

  test('repair phrases exist and are unique', () => {
    const texts = REPAIR_PHRASES.map((p) => p.text);
    expect(new Set(texts).size).toBe(texts.length);
    expect(texts.length).toBeGreaterThanOrEqual(6);
  });
});
