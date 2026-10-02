// Fits a suggestion chip into the fixed-height suggestion strip.
//
// The strip has a fixed height so the grid never moves when suggestions
// appear. That height follows the in-app button text size, but not the
// Android/iOS system font size, so at a large system font the chip text was
// cut in half (native test, font scale 2.0: the "used often" line clipped).
// Instead of growing the strip (which would move every board button), the
// chip drops its secondary reason line when it can't fit (the reason stays in
// the accessibility label) and caps the word's own scaling to what fits.

export const STRIP_BASE = 56; // strip height at text scale 1
const STRIP_PADDING = 8; // suggestionsBar paddingVertical * 2
const CHIP_CHROME = 14; // chip paddingVertical * 2 + border * 2
const WORD_LINE = 20; // line height of the 15px word at text scale 1
export const REASON_LINE = 14; // 10px reason line (12) + its top margin, rounded up

export function stripHeight(textScale = 1) {
  return Math.round(STRIP_BASE * Math.min(textScale, 1.25));
}

export function wordLineHeight(textScale = 1) {
  return Math.round(WORD_LINE * textScale);
}

/**
 * @param {{ textScale?: number, fontScale?: number }} opts
 *   textScale: the app's button text size (1, 1.25, 1.5)
 *   fontScale: the system font scale (useWindowDimensions().fontScale)
 * @returns {{ showReason: boolean, wordMaxMultiplier: number, wordLineHeight: number }}
 */
export function suggestionChipFit({ textScale = 1, fontScale = 1 } = {}) {
  const budget = stripHeight(textScale) - STRIP_PADDING - CHIP_CHROME;
  const word = wordLineHeight(textScale);
  const showReason = (word + REASON_LINE) * fontScale <= budget;
  const room = showReason ? budget - REASON_LINE * fontScale : budget;
  // Floor to 2 decimals so rounding never pushes the text past the budget.
  const wordMaxMultiplier = Math.max(1, Math.floor((room / word) * 100) / 100);
  return { showReason, wordMaxMultiplier, wordLineHeight: word };
}
