// Simulated message logs for evaluating suggestions (predictionEvaluation).
// Two invented users. Messages are written the way they are built on the
// board: starters such as "I want" become two words, and each user has
// personal words the built-in model cannot know (names, interests, routines).
// Each entry is [message, times it is said over the 60 days].

export const CHILD = [
  ['I want juice', 6], ['I want more juice', 3], ['I want to play outside', 4],
  ['can I play Lego', 6], ['can I play dinosaurs', 4], ['I want Bella', 5],
  ['where is Bella', 3], ['I feel tired', 4], ['I feel happy', 3], ['I need the bathroom', 6],
  ['go home now', 3], ['I want mom', 4], ['hi teacher', 3], ['more please', 5],
  ['I want swim', 4], ['can I go swim', 3], ['I want snack', 4], ['no thank you', 3],
  ['stop it', 2], ['I feel sad', 2], ['I need help', 4], ['I like dinosaurs', 4],
  ['I like Lego', 3], ['look dinosaur', 2], ['I want iPad', 5], ['can I have iPad', 4],
  ['I want bubbles', 3], ['all done', 4], ['yes please', 4], ['I love Bella', 2],
];

export const ADULT = [
  ['I need my medicine', 5], ['I want coffee please', 6], ['can you help me', 5],
  ['I feel sick', 3], ['turn the TV on', 4], ['turn the TV off', 3], ['call my sister', 4],
  ['call Siobhan', 4], ['I am in pain', 3], ['thank you', 6], ['I want to go outside', 3],
  ['I need the bathroom', 5], ['open the window please', 3], ['I feel tired', 4],
  ['can I have water', 4], ['I want tea please', 4], ['where is my phone', 4],
  ['put the radio on', 3], ['I want to watch football', 4], ['I need to rest', 3],
  ['I like that', 2], ['not now', 3], ['I am cold', 3], ['I am hot', 2],
  ['please wait', 3], ['see you later', 3], ['I love you', 3], ['I need my glasses', 3],
  ['call my daughter', 3], ['I want to go home', 3],
];

/**
 * Expand to a dated log over `days`, interleaved deterministically (no
 * randomness, so results are reproducible).
 */
export function expand(entries, { days = 60, start = Date.UTC(2026, 7, 1) } = {}) {
  const list = [];
  entries.forEach(([text, n], i) => {
    for (let k = 0; k < n; k++) list.push({ text, key: ((k + 1) * 7919 + i * 104729) % 1000003 });
  });
  list.sort((a, b) => a.key - b.key);
  const step = (days * 86400000) / list.length;
  return list.map((m, i) => ({ words: m.text.split(' '), t: start + Math.round(i * step) }));
}
