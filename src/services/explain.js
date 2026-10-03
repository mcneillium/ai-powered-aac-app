// src/services/explain.js
// "Help me explain": repair phrases and alternative wordings of the current
// message. Deterministic and offline — simple, predictable rules, so the
// options never add meaning the user did not choose. Nothing here replaces
// the message: the screen previews an option and asks before replacing,
// and the original stays available through Undo.

/** Phrases for repairing a misunderstanding, spoken as-is. */
export const REPAIR_PHRASES = [
  { id: 'not_meant', text: "That's not what I meant" },
  { id: 'try_again', text: 'Let me try again' },
  { id: 'wait', text: 'Please wait, I am still typing' },
  { id: 'read', text: 'Please read my screen' },
  { id: 'yes_no', text: 'Ask me yes or no questions' },
  { id: 'about', text: "It's about something else" },
  { id: 'nearly', text: "You're close" },
  { id: 'show', text: 'I will show you' },
];

const normalise = (s) => s.replace(/\s+/g, ' ').trim();
const capitalise = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const stripEnd = (s) => s.replace(/[.!?,\s]+$/, '');
const FILLER = new Set(['the', 'a', 'an', 'is', 'am', 'are', 'to', 'very', 'really', 'just']);

/**
 * Alternative wordings for a message. Each option: { id, label, text }.
 * Only rules that apply are returned; the original is never included.
 */
export function rephraseOptions(message) {
  const original = normalise(message || '');
  if (!original) return [];
  const base = stripEnd(original);
  const lower = base.toLowerCase();
  const out = [];
  const add = (id, label, text) => {
    const t = normalise(text);
    if (t && t.toLowerCase() !== original.toLowerCase() && !out.some((o) => o.text.toLowerCase() === t.toLowerCase())) {
      out.push({ id, label, text: t });
    }
  };

  // "I want X" → polite request and question form.
  const want = lower.match(/^i (want|need) (.+)$/);
  if (want && want[1] === 'want') {
    const rest = base.slice(base.length - want[2].length);
    add('polite', 'More polite', `I would like ${rest}, please.`);
    add('question', 'As a question', `Can I have ${rest}?`);
  } else if (want) {
    // "need" is kept: softening it to "would like" would change the meaning.
    add('polite', 'More polite', `${capitalise(base)}, please.`);
  } else if (!/\bplease\b/i.test(base)) {
    add('polite', 'More polite', `${capitalise(base)}, please.`);
  }

  // "can i ..." → make sure it reads as a question.
  if (/^(can|could|may) i\b/.test(lower) && !/\?$/.test(original)) {
    add('question', 'As a question', `${capitalise(base)}?`);
  }

  // Short form: drop filler words, keep the user's own content words.
  const words = base.split(' ');
  const short = words.filter((w) => !FILLER.has(w.toLowerCase()));
  if (short.length >= 1 && short.length < words.length) add('shorter', 'Shorter', capitalise(short.join(' ')));

  // Emphasis without adding new information.
  add('important', 'This is important', `${capitalise(base)}. This is important.`);

  // Refusals: a clearer, firmer form.
  if (/^(no|not|stop|don't|dont)\b/.test(lower)) {
    add('firm', 'Firmer', `${capitalise(base)}. I mean it.`);
  }

  // Ask the listener to check understanding.
  add('check', 'Check they understood', `${capitalise(base)}. Did you understand?`);

  return out;
}
