import {
  rank, learn, forget, emptyModel, placeInSlots, decayed, displayForm, modelFromLegacyProfile,
} from '../services/predictionEngine';

const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 3);

function teach(model, sentences, times = 1, now = NOW) {
  for (let i = 0; i < times; i++) {
    sentences.forEach((s) => {
      const words = s.split(' ');
      words.forEach((w, j) => learn(model, words.slice(0, j), w, now));
    });
  }
  return model;
}

describe('rank', () => {
  test('built-in suggestions work with no learning at all', () => {
    const r = rank({ context: [], now: NOW });
    expect(r.length).toBeGreaterThan(3);
    expect(r[0].source).toBe('seed');
    const afterFeel = rank({ context: ['I', 'feel'], now: NOW }).map(x => x.word);
    expect(afterFeel).toEqual(expect.arrayContaining(['happy', 'sad', 'tired']));
  });

  test('learned words are ignored while learning is off', () => {
    const m = teach(emptyModel(), ['I want pizza'], 5);
    const off = rank({ context: ['I', 'want'], model: m, learning: false, now: NOW }).map(x => x.word);
    expect(off).not.toContain('pizza');
    const on = rank({ context: ['I', 'want'], model: m, learning: true, now: NOW });
    expect(on[0].word).toBe('pizza');
    expect(on[0].source).toBe('personal');
    expect(on[0].reason).toBe('you said this before');
  });

  test('context matters: the same user gets different words after different words', () => {
    const m = teach(emptyModel(), ['I want juice', 'I feel tired'], 3);
    expect(rank({ context: ['I', 'want'], model: m, learning: true, now: NOW })[0].word).toBe('juice');
    expect(rank({ context: ['I', 'feel'], model: m, learning: true, now: NOW })[0].word).toBe('tired');
  });

  test('old habits fade: a recent pattern beats an old one used as often', () => {
    const m = emptyModel();
    teach(m, ['go park'], 4, NOW - 120 * DAY);
    teach(m, ['go swim'], 4, NOW - 1 * DAY);
    const top = rank({ context: ['go'], model: m, learning: true, now: NOW }).map(x => x.word);
    expect(top.indexOf('swim')).toBeLessThan(top.indexOf('park'));
  });

  test('blocked words are never suggested, and the last word is not repeated', () => {
    const m = teach(emptyModel(), ['I want pizza'], 5);
    const r = rank({ context: ['I', 'want'], model: m, learning: true, blocked: ['Pizza'], now: NOW }).map(x => x.word);
    expect(r).not.toContain('pizza');
    expect(r).not.toContain('want');
  });

  test('neural model words are kept only if they are real vocabulary', () => {
    const r = rank({ context: ['I'], modelWords: ['xxx', 'sr', 'dog'], vocabulary: ['dog', 'cat'], now: NOW }).map(x => x.word);
    expect(r).toContain('dog');
    expect(r).not.toContain('xxx');
    expect(r).not.toContain('sr');
  });

  test('a finished sentence starts a new one', () => {
    const fresh = rank({ context: [], now: NOW }).map(x => x.word);
    const afterStop = rank({ context: ['It', 'started', 'today.'], now: NOW }).map(x => x.word);
    expect(afterStop).toEqual(fresh);
  });

  test('ranking is deterministic', () => {
    const a = rank({ context: ['I'], now: NOW });
    const b = rank({ context: ['I'], now: NOW });
    expect(a).toEqual(b);
  });
});

describe('learn / forget', () => {
  test('counts words, pairs and triples with the start of message', () => {
    const m = teach(emptyModel(), ['I want more']);
    expect(m.uni.more.c).toBeCloseTo(1);
    expect(m.seq2['<s>|i'].c).toBeCloseTo(1);
    expect(m.seq2['want|more'].c).toBeCloseTo(1);
    expect(m.seq3['i|want|more'].c).toBeCloseTo(1);
    expect(m.seq3['<s>|i|want'].c).toBeCloseTo(1);
  });

  test('forget removes a word everywhere it is predicted', () => {
    const m = teach(emptyModel(), ['I want pizza', 'pizza please']);
    forget(m, 'Pizza');
    expect(m.uni.pizza).toBeUndefined();
    expect(Object.keys(m.seq2).some(k => k.endsWith('|pizza'))).toBe(false);
    expect(Object.keys(m.seq3).some(k => k.endsWith('|pizza'))).toBe(false);
    // pairs that merely start with it are harmless and kept
    expect(m.uni.please).toBeDefined();
  });

  test('decay halves a count every 30 days', () => {
    expect(decayed({ c: 4, t: NOW - 30 * DAY }, NOW)).toBeCloseTo(2);
    expect(decayed({ c: 4, t: NOW }, NOW)).toBeCloseTo(4);
    expect(decayed(null, NOW)).toBe(0);
  });
});

describe('placeInSlots (fixed suggestion area)', () => {
  const r = (...w) => w.map(word => ({ word }));

  test('always returns exactly n slots, empty ones as null', () => {
    expect(placeInSlots([], r('a', 'b'), 4)).toEqual([{ word: 'a' }, { word: 'b' }, null, null]);
    expect(placeInSlots([], [], 4)).toEqual([null, null, null, null]);
  });

  test('a word that is still suggested keeps its slot', () => {
    const prev = placeInSlots([], r('a', 'b', 'c', 'd'), 4);
    const next = placeInSlots(prev, r('c', 'x', 'a', 'y'), 4);
    expect(next[0].word).toBe('a');
    expect(next[2].word).toBe('c');
    expect([next[1].word, next[3].word]).toEqual(['x', 'y']);
  });
});

describe('display and migration', () => {
  test('board spelling is used for display', () => {
    const casing = new Map([['i', 'I'], ['tv', 'TV']]);
    expect(displayForm('i', casing)).toBe('I');
    expect(displayForm('pizza', casing)).toBe('pizza');
  });

  test('earlier profiles become a personal model without losing counts', () => {
    const m = modelFromLegacyProfile({
      wordFrequencies: { go: 5, home: 3 },
      wordRecency: { go: NOW, home: NOW },
      bigrams: { 'go home': 3, 'bad key': 0 },
    }, NOW);
    expect(m.uni.go.c).toBe(5);
    expect(m.seq2['go|home'].c).toBe(3);
    expect(m.seq2['bad|key']).toBeUndefined();
    const top = rank({ context: ['go'], model: m, learning: true, now: NOW });
    expect(top[0].word).toBe('home');
  });
});
