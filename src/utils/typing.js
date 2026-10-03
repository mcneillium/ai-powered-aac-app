// src/utils/typing.js
// Helpers for the Type sheet (pure, unit-tested).

/** Split typed text into the finished words and the word being typed. */
export function splitTyping(text, messageWords = []) {
  const endsWithSpace = /\s$/.test(text);
  const parts = text.trim() ? text.trim().split(/\s+/) : [];
  const partial = endsWithSpace ? '' : (parts.pop() || '');
  return { context: [...messageWords, ...parts], partial, done: parts };
}
