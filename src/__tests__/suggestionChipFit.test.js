/* eslint-env jest */
// Regression (native Android, system font scale 2.0): the second line of each
// suggestion chip ("used often") was cut off by the fixed-height strip.
import { suggestionChipFit, stripHeight, wordLineHeight, REASON_LINE } from '../utils/suggestionChipFit';

const INNER_BUDGET = (textScale) => stripHeight(textScale) - 8 - 14;

describe('suggestionChipFit', () => {
  test('default sizes are unchanged: reason shown, no extra word cap', () => {
    expect(suggestionChipFit({ textScale: 1, fontScale: 1 })).toEqual({
      showReason: true, wordMaxMultiplier: 1, wordLineHeight: 20,
    });
  });

  test('the strip height is the same as before for every in-app text size', () => {
    expect([1, 1.25, 1.5].map(stripHeight)).toEqual([56, 70, 70]);
  });

  test.each([1, 1.15, 1.3, 1.5, 1.8, 2.0])('system font %f: chip content always fits the strip', (fontScale) => {
    for (const textScale of [1, 1.25, 1.5]) {
      const fit = suggestionChipFit({ textScale, fontScale });
      const wordScale = Math.min(fontScale, fit.wordMaxMultiplier);
      const used = wordLineHeight(textScale) * wordScale + (fit.showReason ? REASON_LINE * fontScale : 0);
      expect({ textScale, fontScale, fits: used <= INNER_BUDGET(textScale) + 0.01 })
        .toEqual({ textScale, fontScale, fits: true });
    }
  });

  test('at font scale 2.0 the reason line is dropped and the word is capped', () => {
    const fit = suggestionChipFit({ textScale: 1, fontScale: 2 });
    expect(fit.showReason).toBe(false);
    expect(fit.wordMaxMultiplier).toBeLessThan(2);
    expect(fit.wordMaxMultiplier).toBeGreaterThan(1.5);
  });

  test('never caps the word below normal size', () => {
    expect(suggestionChipFit({ textScale: 1.5, fontScale: 3 }).wordMaxMultiplier).toBeGreaterThanOrEqual(1);
  });
});
