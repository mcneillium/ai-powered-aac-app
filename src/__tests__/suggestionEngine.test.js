// The app-level bridge: suggestions work before any learning, learning only
// happens after opt-in, and reset returns to the starting suggestions.
import {
  suggestNext, learnFromSpoken, setLearningEnabled, resetLearning, getLearningStats, dismissSuggestion,
} from '../services/suggestionEngine';

const words = (ws) => suggestNext(ws, { k: 6 }).map((s) => s.word.toLowerCase());
const PERSONAL = ['i', 'want', 'to', 'see', 'grandma', 'zebedee'];

describe('suggestionEngine', () => {
  afterEach(async () => { setLearningEnabled(false); await resetLearning(); });

  test('useful suggestions with no personal data', () => {
    expect(words([]).length).toBeGreaterThan(0);
    expect(words(['i', 'want']).length).toBeGreaterThan(0);
  });

  test('never suggests punctuation or empty strings', () => {
    [[], ['i'], ['can', 'i'], ['the']].forEach((ctx) => {
      words(ctx).forEach((w) => expect(w).toMatch(/[a-z]/));
    });
  });

  test('with learning off, speaking a message teaches nothing', () => {
    const before = words(['see', 'grandma']);
    for (let i = 0; i < 5; i++) learnFromSpoken(PERSONAL);
    expect(words(['see', 'grandma'])).toEqual(before);
    expect(getLearningStats().sentences).toBe(0);
  });

  test('with learning on, a repeated personal phrase is suggested; reset removes it', async () => {
    setLearningEnabled(true);
    for (let i = 0; i < 5; i++) learnFromSpoken(PERSONAL);
    expect(words(['see', 'grandma'])).toContain('zebedee');
    expect(getLearningStats().sentences).toBe(5);
    await resetLearning();
    expect(words(['see', 'grandma'])).not.toContain('zebedee');
    expect(getLearningStats().sentences).toBe(0);
  });

  test('a dismissed suggestion disappears after that word', () => {
    const ctx = ['i', 'want'];
    const first = words(ctx)[0];
    dismissSuggestion(first, ctx);
    expect(words(ctx)).not.toContain(first);
  });
});
