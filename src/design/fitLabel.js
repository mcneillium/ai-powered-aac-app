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

/** Line height used for tile labels at `size` px. */
export function lineHeightFor(size) {
  return Math.round(size * 1.25);
}

/**
 * Largest whole font size in [min, size] at which `label` fits `width`
 * without breaking a word, in at most `maxLines` lines and, when
 * `maxHeight` is given, with lines x line height <= maxHeight. Returns
 * `size` unchanged when the width is not known yet. If nothing fits even at
 * `min`, returns `min` (the smallest readable size).
 */
export function fitLabelSize(label, size, width, { min = 12, maxLines = 2, maxHeight = Infinity } = {}) {
  if (!width || width <= 0) return size;
  const fits = (s) => {
    const n = linesAt(label, s, width);
    return n <= maxLines && n * lineHeightFor(s) <= maxHeight;
  };
  for (let s = size; s > min; s -= 1) {
    if (fits(s)) return s;
  }
  return Math.min(size, min);
}

/**
 * Fits a tile label into the tile's content box, in this order of
 * preference: the user's size; a smaller size (down to `min`) with the
 * picture kept; the label using the side padding (`pad`) and then `floor`
 * px when a single word is wider than the box at `min`; and finally the
 * picture dropped. A word is never broken or cut off while any of these
 * fit; `fits` is false only when even `floor` px on one line is too wide.
 *
 * @param {string} label
 * @param {number} size     wanted size in px (user text size x system font size)
 * @param {object} box
 *   width:  label width in px inside padding and the widest border
 *   height: content height in px inside padding and the widest border
 *   symbol: height the smallest picture needs (incl. gap), 0 for none
 *   pad:    extra width available by using the side padding
 * @returns {{ size, lines, lineHeight, wide, symbol, fits }}
 */
export function fitTileLabel(label, size, { width, height = Infinity, symbol = 0, pad = 0, min = 12, floor = 11 }) {
  if (!width || width <= 0) {
    // Width not known yet: assume one line and keep the height.
    let s = size;
    while (s > min && lineHeightFor(s) + symbol > height) s -= 1;
    return { size: s, lines: 1, lineHeight: lineHeightFor(s), wide: false, symbol: symbol > 0, fits: true };
  }
  const options = [{ w: width, m: min, wide: false }, { w: width + pad, m: min, wide: true }, { w: width + pad, m: floor, wide: true }];
  const opt = options.find((o) => linesAt(label, Math.min(size, o.m), o.w) <= 2) || null;
  const result = (s, w, wide, keep, fits) => {
    const lines = Math.min(2, linesAt(label, s, w));
    return { size: s, lines, lineHeight: lineHeightFor(s), wide, symbol: keep, fits };
  };
  if (!opt) return result(Math.min(size, floor), width + pad, pad > 0, symbol > 0 && 2 * lineHeightFor(floor) + symbol <= height, false);
  const m = Math.min(size, opt.m);
  const fitsIn = (h) => fitLabelSize(label, size, opt.w, { min: m, maxHeight: h });
  const ok = (s, h) => linesAt(label, s, opt.w) * lineHeightFor(s) <= h;
  if (symbol > 0) {
    const s = fitsIn(height - symbol);
    if (ok(s, height - symbol)) return result(s, opt.w, opt.wide, true, true);
  }
  const s = fitsIn(height);
  return result(s, opt.w, opt.wide, false, ok(s, height));
}
