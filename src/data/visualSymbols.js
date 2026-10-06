// Local-only visual vocabulary matching. Labels and punctuation are never rewritten.
import { corePages } from './coreVocabulary';
import { symbolFor } from './symbols';

const EXTRA = {
  toilet: '🚽', bathroom: '🚽', quiet: '🤫', break: '⏸️', question: '❓',
  again: '🔁', pain: '🤕', outside: '🌳', kitchen: '🍽️', classroom: '🏫',
  university: '🎓', work: '💼', shopping: '🛒', appointment: '📅', time: '🕒',
  help: '🆘', wait: '⏳', stop: '✋', yes: '✅', no: '❌',
  mum: '👩', mom: '👩', dad: '👨', family: '👪', friend: '🤝',
  water: '🚰', food: '🍽️', drink: '🥤', music: '🎵',
};
const normalise = (text) => String(text || '').toLocaleLowerCase().replace(/[’]/g, "'").trim();
const words = (text) => String(text || '').match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || [];

/** Sources used here must not trigger a remote image request. */
export function localVisualSource(source) {
  if (typeof source === 'number') return source;
  if (source && typeof source.uri === 'string' && /^(file|content):\/\//i.test(source.uri)) return source;
  return null;
}

export function visualVocabulary(customButtons = []) {
  const all = Object.values(corePages).flatMap((page) => page.buttons).filter((b) => !b.navigateTo);
  // Unique custom labels can supply a personal photo. Ambiguous duplicate labels
  // cannot reliably identify a selected tile in the legacy string-only sentence.
  const custom = new Map();
  for (const button of customButtons) {
    const key = normalise(button.label);
    custom.set(key, custom.has(key) ? null : button);
  }
  return [...all.filter((b) => !custom.get(normalise(b.label))), ...[...custom.values()].filter(Boolean)];
}

/** Match longest known vocabulary label. Preserve every original character. */
export function visualMessageTokens(text, buttons = visualVocabulary()) {
  const input = String(text || '');
  const matches = [...input.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)];
  const entries = buttons.map((button) => ({ button, parts: words(button.label).map(normalise) }))
    .filter((entry) => entry.parts.length > 0).sort((a, b) => b.parts.length - a.parts.length);
  const output = [];
  let cursor = 0;
  for (let i = 0; i < matches.length;) {
    const entry = entries.find(({ parts }) => parts.every((part, j) => {
      const match = matches[i + j];
      if (!match || normalise(match[0]) !== part) return false;
      // Do not combine distinct phrases across punctuation.
      return j === 0 || /^\s+$/.test(input.slice(matches[i + j - 1].index + matches[i + j - 1][0].length, match.index));
    }));
    const count = entry ? entry.parts.length : 1;
    const last = matches[i + count - 1];
    const end = last.index + last[0].length;
    const label = input.slice(matches[i].index, end);
    const button = entry?.button || { label };
    output.push({ prefix: input.slice(cursor, matches[i].index), text: label, button,
      emoji: symbolFor(button) || EXTRA[normalise(label)] || null });
    cursor = end;
    i += count;
  }
  if (cursor < input.length) output.push({ prefix: '', text: input.slice(cursor), button: null, emoji: null });
  return output;
}
