// src/services/prediction/tokenize.js
// Text normalisation shared by the prediction engine, the model builder and
// the offline evaluation. Pure JS (runs in Hermes, Node and Jest).
//
// Rules:
// - lower-case everything; curly apostrophes become straight ones
// - keep apostrophes inside words ("don't", "i'm"), drop all other punctuation
// - multi-word board labels ("thank you", "I want") split into words
// - placeholders like <UNK> / [UNKNOWN] are removed whole, never learned

export const BOS = '<s>'; // sentence-start marker used inside the model only

const APOSTROPHES = /[\u2018\u2019\u02BC`]/g;
const PLACEHOLDER = /<[^>\s]*>|\[[^\]\s]*\]/g;
// Word characters: ASCII letters/digits plus Latin accented, Greek and
// Cyrillic letters. Explicit ranges (not \p{L}) keep this portable across
// JS engines and Babel configs.
const WORD_CHARS = 'A-Za-z0-9\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u024F\\u1E00-\\u1EFF\\u0370-\\u03FF\\u0400-\\u04FF';
// Anything that is not a word character, apostrophe or whitespace is a separator.
const NON_WORD = new RegExp(`[^${WORD_CHARS}'\\s]+`, 'g');
const NON_WORD_OR_SPACE = new RegExp(`[^${WORD_CHARS}']`, 'g');
const HAS_WORD_CHAR = new RegExp(`[${WORD_CHARS}]`);

/**
 * Split text (or an array of words/labels) into normalised tokens.
 * @param {string|string[]} input
 * @returns {string[]}
 */
export function tokenize(input) {
  if (input == null) return [];
  const text = Array.isArray(input) ? input.join(' ') : String(input);
  const out = [];
  const parts = text.replace(PLACEHOLDER, ' ').toLowerCase().replace(APOSTROPHES, "'").replace(NON_WORD, ' ').split(/\s+/);
  for (const raw of parts) {
    // Trim stray leading/trailing apostrophes ("'cause" stays "cause")
    const w = raw.replace(/^'+|'+$/g, '');
    if (isPredictableWord(w)) out.push(w);
  }
  return out;
}

/**
 * True for tokens the engine may store or suggest. Rejects empty strings,
 * sentence markers, <UNK>-style placeholders and anything without a letter
 * or digit (pure punctuation).
 */
export function isPredictableWord(w) {
  if (typeof w !== 'string' || w.length === 0 || w.length > 40) return false;
  if (w.startsWith('<') || w.startsWith('[')) return false;
  if (w.includes(' ')) return false;
  return HAS_WORD_CHAR.test(w);
}

/** Remove everything except word characters and apostrophes ("Grandma!" → "Grandma"). */
export function stripNonWord(s) {
  return String(s).replace(NON_WORD_OR_SPACE, '');
}

// Display forms for words the board shows with capitals.
const DISPLAY_OVERRIDES = { i: 'I', "i'm": "I'm", "i'll": "I'll", "i'd": "I'd", "i've": "I've", tv: 'TV', ok: 'OK' };

/**
 * Display form of a normalised word ("i" → "I", "tv" → "TV").
 * Proper nouns learned from the user keep the casing they were spoken with
 * when the caller passes it via `known` (word → display form).
 */
export function displayWord(word, known) {
  if (known && known[word]) return known[word];
  return DISPLAY_OVERRIDES[word] || word;
}
