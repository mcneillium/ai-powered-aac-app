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

// Hyphenation. A word wider than the tile at the 12 px minimum is wrapped
// with a visible hyphen ("bath-" / "room") rather than drawn smaller than
// 12 px, drawn over the tile's category stripe or broken by the platform at
// an arbitrary letter. Break points are chosen deterministically: fewest
// pieces first, then (cheapest first) between two consonants with a vowel
// starting the next piece, never inside th/sh/ch/ph/wh/ck/ng/qu/gh or an
// onset like br/st, at least 3 letters per piece, and balanced pieces.
const VOWEL = /[aeiouy]/i;
const LETTER = /[a-z]/i;
const DIGRAPHS = new Set(['th', 'sh', 'ch', 'ph', 'wh', 'ck', 'ng', 'qu', 'gh']);
const ONSETS = new Set(['bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'sc', 'sk', 'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'tr', 'tw']);

const fitsWidth = (text, size, width) => textWidthEm(text) * size <= width;

/** Cost of breaking `word` before index j (lower is better). */
function breakCost(word, j) {
  const a = word[j - 1];
  const b = word[j];
  if (a === '-') return 0; // existing hyphen: break after it, add none
  if (!LETTER.test(a) || !LETTER.test(b)) return 3;
  const pair = (a + b).toLowerCase();
  if (DIGRAPHS.has(pair)) return 8;
  if (ONSETS.has(pair)) return 4;
  let cost = VOWEL.test(a) || VOWEL.test(b) ? 3 : 0;
  // The next piece should start like a syllable: consonant(s) then vowel.
  const onset = (b + (word[j + 1] || '')).toLowerCase();
  const nextVowel = DIGRAPHS.has(onset) || ONSETS.has(onset) ? word[j + 2] : word[j + 1];
  if (!nextVowel || !VOWEL.test(nextVowel)) cost += 1;
  return cost;
}

// Piece word[i, j) is acceptable in "good" mode.
const okBreak = (word, i, j) => j === word.length ? (j - i >= 3 || i === 0) : (j - i >= 3 && word.length - j >= 3 && breakCost(word, j) <= GOOD);

const piece = (word, i, j) => word.slice(i, j) + (j < word.length && word[j - 1] !== '-' ? '-' : '');

// A "good" break: between consonants, the next piece starting like a
// syllable, at least 3 letters per piece (bath-room, tooth-brush).
const GOOD = 0;

/**
 * Splits one word into the fewest pieces that each fit `width` at `size`
 * (every piece but the last ends with a hyphen), choosing the cheapest
 * break points. With `good`, only good breaks are allowed. Returns null
 * when no split fits (even one letter plus hyphen is too wide).
 */
export function splitWord(word, size, width, { good = false } = {}) {
  const n = word.length;
  if (fitsWidth(word, size, width)) return [word];
  // Fewest pieces: dynamic programming over end positions.
  const best = new Array(n + 1).fill(null); // best[i] = { pieces, cost, next }
  best[n] = { pieces: 0, cost: 0, next: n };
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = i + 1; j <= n; j += 1) {
      if (!fitsWidth(piece(word, i, j), size, width)) break;
      const rest = best[j];
      if (!rest || (good && !okBreak(word, i, j))) continue;
      const short = j - i < 3 ? 20 : 0;
      const cost = rest.cost + short + (j < n ? breakCost(word, j) : 0);
      const pieces = rest.pieces + 1;
      const cur = best[i];
      if (!cur || pieces < cur.pieces || (pieces === cur.pieces && cost < cur.cost - 1e-9)) {
        best[i] = { pieces, cost, next: j };
      }
    }
  }
  if (!best[0]) return null;
  // Among splits with the fewest pieces and the cheapest breaks, prefer the
  // most balanced one (second pass with a small balance term).
  const k = best[0].pieces;
  const ideal = n / k;
  const memo = new Map();
  const solve = (i, left) => {
    if (i === n) return left === 0 ? { cost: 0, cuts: [] } : null;
    if (left === 0) return null;
    const key = `${i}:${left}`;
    if (memo.has(key)) return memo.get(key);
    let out = null;
    for (let j = i + 1; j <= n; j += 1) {
      if (!fitsWidth(piece(word, i, j), size, width)) break;
      const rest = solve(j, left - 1);
      if (!rest || (good && !okBreak(word, i, j))) continue;
      const cost = rest.cost + (j - i < 3 ? 20 : 0) + (j < n ? breakCost(word, j) : 0) + 0.1 * Math.abs(j - i - ideal);
      if (!out || cost < out.cost - 1e-9) out = { cost, cuts: [j, ...rest.cuts] };
    }
    memo.set(key, out);
    return out;
  };
  const sol = solve(0, k);
  const pieces = [];
  let i = 0;
  sol.cuts.forEach((j) => { pieces.push(piece(word, i, j)); i = j; });
  return pieces;
}

/** Lines of `label` at `size` in `width` wrapping at spaces only, or null if a word does not fit. */
export function wordLines(label, size, width) {
  const lines = [];
  for (const w of String(label).split(/\s+/).filter(Boolean)) {
    if (!fitsWidth(w, size, width)) return null;
    const last = lines.length - 1;
    if (last >= 0 && fitsWidth(`${lines[last]} ${w}`, size, width)) lines[last] += ` ${w}`;
    else lines.push(w);
  }
  return lines;
}

/**
 * Lines of `label` at `size` in `width`: wrapped at spaces first, and a word
 * that does not fit on a line of its own is split with visible hyphens.
 * Returns null only if a single letter does not fit.
 */
export function hyphenateLabel(label, size, width, opts) {
  const lines = [];
  let open = false; // last line may take more words
  for (const w of String(label).split(/\s+/).filter(Boolean)) {
    const last = lines.length - 1;
    if (open && fitsWidth(`${lines[last]} ${w}`, size, width)) { lines[last] += ` ${w}`; continue; }
    const pieces = splitWord(w, size, width, opts);
    if (!pieces) return null;
    lines.push(...pieces);
    open = true;
  }
  return lines;
}

/**
 * Fits a tile label into the tile's content box. The left edge of the box
 * never moves (the label keeps the left padding, so it is always clear of
 * the category stripe, which sits inside the border on the left) and the
 * size never goes below `min` (12 px). In order of preference:
 *   1. whole words, up to 2 lines, then up to `maxLines` (3) lines when the
 *      height allows, at the largest size from `size` down to `min`;
 *   2. the same using `pad` px of the right-hand padding (`wide`), for a
 *      word slightly wider than the box at `min`;
 *   3. a word too wide even then is hyphenated ("bath-" / "room"), in the
 *      wide box: up to 2, then up to `maxLines` lines, largest size first;
 *      good break points (bath-room) first, then any (Overw-helmed);
 * each first with the picture (at its smallest) and then without it.
 * `fits` is false only when nothing fits in `maxLines` lines and the
 * height even without the picture; the label is then hyphenated at `min`
 * on as many lines as it needs and may be clipped by a short tile.
 *
 * @param {string} label
 * @param {number} size     wanted size in px (user text size x system font size)
 * @param {object} box
 *   width:  label width in px inside padding and the widest border
 *   height: content height in px inside padding and the widest border
 *   symbol: height the smallest picture needs (incl. gap), 0 for none
 *   pad:    extra width available from the right-hand padding
 * @returns {{ size, lines, lineHeight, text, hyphenated, wide, symbol, fits }}
 *   text: the label to draw. The label itself unless hyphenated; then the
 *   explicit lines joined by "\n" (the accessible name stays the label).
 */
export function fitTileLabel(label, size, { width, height = Infinity, symbol = 0, pad = 0, min = 12, maxLines = 3 }) {
  const text = String(label);
  if (!width || width <= 0) {
    // Width not known yet: assume one line and keep the height.
    let s = size;
    while (s > min && lineHeightFor(s) + symbol > height) s -= 1;
    return { size: s, lines: 1, lineHeight: lineHeightFor(s), text, hyphenated: false, wide: false, symbol: symbol > 0, fits: true };
  }
  const lo = Math.min(size, min);
  const passes = [
    [false, 2, false], [false, maxLines, false],
    ...(pad > 0 ? [[false, 2, true], [false, maxLines, true]] : []),
    [true, 2, pad > 0, true], [true, maxLines, pad > 0, true],
    [true, 2, pad > 0, false], [true, maxLines, pad > 0, false],
  ];
  for (const keep of symbol > 0 ? [true, false] : [false]) {
    const h = height - (keep ? symbol : 0);
    for (const [hyphen, most, wide, good] of passes) {
      const w = wide ? width + pad : width;
      for (let s = size; s >= lo; s -= 1) {
        const lines = hyphen ? hyphenateLabel(text, s, w, { good }) : wordLines(text, s, w);
        if (lines && lines.length <= most && lines.length * lineHeightFor(s) <= h) {
          const hyphenated = hyphen && lines.some((l) => l.endsWith('-') && !text.includes(l));
          return {
            size: s, lines: lines.length, lineHeight: lineHeightFor(s), text: hyphenated ? lines.join('\n') : text,
            hyphenated, wide, symbol: keep, fits: true,
          };
        }
      }
    }
  }
  // Nothing fits within `maxLines`: draw every line at `min` (more lines,
  // never smaller or ellipsised), keeping the picture if there is room.
  const lines = hyphenateLabel(text, lo, width + pad) || [text];
  const need = lines.length * lineHeightFor(lo);
  return {
    size: lo, lines: lines.length, lineHeight: lineHeightFor(lo), text: lines.length > 1 ? lines.join('\n') : text,
    hyphenated: lines.some((l) => l.endsWith('-')), wide: pad > 0, symbol: symbol > 0 && need + symbol <= height, fits: false,
  };
}
