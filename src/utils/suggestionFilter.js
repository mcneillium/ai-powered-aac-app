// src/utils/suggestionFilter.js
//
// Decides whether a decoded model token is something it is safe to offer an AAC
// user as a tappable, speakable suggestion.
//
// This lives here, free of any TensorFlow import, so that it can be unit-tested
// without dragging the ESM-only `@tensorflow/tfjs-react-native` into the jest
// environment — and so both prediction paths can share one definition.
//
// The word prediction model was trained on CHILDES transcription data, whose
// token stream contains annotation markers as well as words. `xxx` is CHILDES
// for "unintelligible speech" and is one of the model's highest-probability
// classes, which meant a non-speaking user could be offered `xxx`, tap it, and
// have their device say it aloud. Punctuation tokens are the same class of
// problem: nobody wants a board button that speaks "question mark".
//
// The filter this replaces tested `word !== '[UNKNOWN]'` — a string that does
// not appear anywhere in tokenizer.json, so it matched nothing at all.

const NON_LEXICAL_TOKENS = new Set([
  // CHILDES annotation markers
  'xxx', 'yyy', 'www', 'xx', 'yy',
  // paralinguistic transcription
  'laughs', 'sings', 'babbles', 'coughs', 'cries', 'whispers', 'mumbles',
  // model / tokenizer sentinels
  '<pad>', '<unk>', '<sos>', '<eos>', '<start>', '<end>', '[unknown]', 'unk', 'pad',
]);

/**
 * @param {unknown} word A decoded token from the prediction model.
 * @returns {boolean} True when it is safe to show and speak.
 */
export function isSpeakableSuggestion(word) {
  if (typeof word !== 'string') return false;
  const trimmed = word.trim();
  if (!trimmed) return false;
  if (NON_LEXICAL_TOKENS.has(trimmed.toLowerCase())) return false;
  // Pure punctuation or symbols — no letters or digits anywhere.
  if (!/[\p{L}\p{N}]/u.test(trimmed)) return false;
  return true;
}

export const _NON_LEXICAL_TOKENS = NON_LEXICAL_TOKENS;
