// src/design/fitLabel.js
// Tile labels must never break inside a word ("bathr/oom") or lose words
// to an ellipsis: on narrow tiles or with large text that makes a word
// unreadable. fitLabelSize() picks the largest font size, up to the user's
// size, at which every word fits on one line and the label fits in
// `maxLines` lines. It is an estimate from per-character widths of the
// system font at weight 600 (checked against browser rendering of the core
// vocabulary: never under-estimates by more than ~3%; 5% margin added), so
// it needs no text measurement and works the same on every platform.

const NARROW = /[ijlI.,'!|:;]/;
const SLIM = /[ftr]/;
const WIDE = /[mwMW]/;
const ROUND = /[bdghnopqu?&]/;
const SPACE = 0.28;
const MARGIN = 1.05;

/** Estimated width of `text` in em (multiply by font size for px). */
export function textWidthEm(text) {
  let em = 0;
  for (const ch of String(text)) {
    if (NARROW.test(ch)) em += 0.28;
    else if (SLIM.test(ch)) em += 0.4;
    else if (WIDE.test(ch)) em += 0.9;
    else if (/[A-Z]/.test(ch)) em += 0.7;
    else if (ROUND.test(ch)) em += 0.62;
    else if (ch === ' ') em += SPACE;
    else em += 0.6;
  }
  return em * MARGIN;
}

/** Number of lines `label` wraps to at `size` px in `width` px, or Infinity if a word does not fit. */
export function linesAt(label, size, width) {
  const words = String(label).split(/\s+/).filter(Boolean);
  let lines = 1;
  let line = 0;
  for (const w of words) {
    const ww = textWidthEm(w) * size;
    if (ww > width) return Infinity;
    if (line === 0) line = ww;
    else if (line + SPACE * size + ww <= width) line += SPACE * size + ww;
    else { lines += 1; line = ww; }
  }
  return lines;
}

/**
 * Largest whole font size in [min, size] at which `label` fits `width`
 * without breaking a word, in at most `maxLines` lines. Returns `size`
 * unchanged when the width is not known yet. If nothing fits even at `min`,
 * returns `min` (the smallest readable size; the platform then wraps).
 */
export function fitLabelSize(label, size, width, { min = 12, maxLines = 2 } = {}) {
  if (!width || width <= 0) return size;
  for (let s = size; s > min; s -= 1) {
    if (linesAt(label, s, width) <= maxLines) return s;
  }
  return Math.min(size, min);
}
