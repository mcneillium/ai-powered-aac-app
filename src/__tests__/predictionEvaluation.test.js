// Offline evaluation of the suggestion row (predictionEngine), on simulated
// 60-day message logs for a child and an adult (scripts/eval/aacCorpus.js).
//
// Method: messages are replayed in date order. Before each word, the 4 slots
// the user would see are computed; a "hit" means the word they were about to
// tap was already in a slot. History = first 70% of the log (learned only);
// test = last 30%, during which learning continues as it would in the app.
// "Off" is the same test with learning switched off (built-in suggestions).
//
// Run with EVAL_REPORT=1 to print the table used in docs/ai/prediction-evaluation.md.
import { rank, learn, emptyModel, placeInSlots } from '../services/predictionEngine';
import { corePages } from '../data/coreVocabulary';
import { CHILD, ADULT, expand } from '../../scripts/eval/aacCorpus';

const SLOTS = 4;

// Taps to reach a word on the board without a suggestion: 1 on Home, 3 on a
// sub-page (folder, word, back Home). Personal words are assumed to be custom
// Home buttons (1 tap).
const homeWords = new Set(corePages.home.buttons.filter(b => !b.navigateTo).flatMap(b => b.label.toLowerCase().split(' ')));
const otherWords = new Set(Object.values(corePages).filter(p => p.id !== 'home').flatMap(p => p.buttons.map(b => b.label.toLowerCase())));
const boardCost = (w) => (homeWords.has(w) ? 1 : otherWords.has(w) ? 3 : 1);

function evaluate(log, learning) {
  const model = emptyModel();
  const cut = Math.floor(log.length * 0.7);
  log.slice(0, cut).forEach(m => m.words.forEach((w, j) => learn(model, m.words.slice(0, j), w, m.t)));
  let words = 0; let hits = 0; let firstSlotHits = 0; let tapsBoard = 0; let tapsWithRow = 0;
  for (const m of log.slice(cut)) {
    let slots = new Array(SLOTS).fill(null);
    for (let j = 0; j < m.words.length; j++) {
      const target = m.words[j].toLowerCase();
      const ranked = rank({ context: m.words.slice(0, j), model, learning, now: m.t, limit: 8 });
      slots = placeInSlots(slots, ranked, SLOTS);
      const shown = slots.filter(Boolean).map(s => s.word);
      const cost = boardCost(target);
      words++;
      tapsBoard += cost;
      if (shown.includes(target)) {
        hits++;
        tapsWithRow += 1;
        if (ranked[0] && ranked[0].word === target) firstSlotHits++;
      } else {
        tapsWithRow += cost;
      }
      if (learning) learn(model, m.words.slice(0, j), m.words[j], m.t);
    }
  }
  return {
    words,
    hitRate: hits / words,
    topRate: firstSlotHits / words,
    tapsSaved: (tapsBoard - tapsWithRow) / tapsBoard,
  };
}

const pct = (x) => `${(x * 100).toFixed(1)}%`;

describe('prediction evaluation (simulated users)', () => {
  const results = {};
  [['Child', CHILD], ['Adult', ADULT]].forEach(([name, entries]) => {
    const log = expand(entries);
    results[name] = { off: evaluate(log, false), on: evaluate(log, true) };
  });

  afterAll(() => {
    if (!process.env.EVAL_REPORT) return;
    const rows = Object.entries(results).flatMap(([name, r]) => [
      `| ${name} | off (built-in only) | ${r.off.words} | ${pct(r.off.hitRate)} | ${pct(r.off.topRate)} | ${pct(r.off.tapsSaved)} |`,
      `| ${name} | on (learned on device) | ${r.on.words} | ${pct(r.on.hitRate)} | ${pct(r.on.topRate)} | ${pct(r.on.tapsSaved)} |`,
    ]);
    // eslint-disable-next-line no-console
    console.log(['| User | Learning | Words tested | Next word in the 4 slots | Best suggestion was the word | Taps saved |',
      '|---|---|---:|---:|---:|---:|', ...rows].join('\n'));
  });

  test('built-in suggestions already help without any learning', () => {
    Object.values(results).forEach(r => expect(r.off.hitRate).toBeGreaterThan(0.2));
  });

  test('learning on this device improves suggestions for both users', () => {
    Object.values(results).forEach(r => {
      expect(r.on.hitRate).toBeGreaterThan(r.off.hitRate + 0.05);
      // The single best suggestion is right far more often.
      expect(r.on.topRate).toBeGreaterThan(r.off.topRate * 2);
      expect(r.on.tapsSaved).toBeGreaterThan(r.off.tapsSaved);
    });
  });

  test('the adult user, whose words the built-in model knows less well, gains most', () => {
    expect(results.Adult.on.hitRate - results.Adult.off.hitRate).toBeGreaterThan(0.3);
  });
});
