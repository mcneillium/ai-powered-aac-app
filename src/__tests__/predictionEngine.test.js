// Tests for the pure prediction engine (src/services/prediction/predictor.js).
import { createPredictor, getBaseModel, getRankerWeights } from '../services/prediction';

const DAY = 86400000;
const T0 = Date.UTC(2026, 0, 5, 9);

function make(extra = {}) {
  let clock = T0;
  const p = createPredictor({ base: getBaseModel(), now: () => clock, ...extra });
  return { p, setClock: (t) => { clock = t; }, advance: (ms) => { clock += ms; } };
}

const words = (list) => list.map(r => r.word);

describe('base model', () => {
  it('predicts sensible next words with no personal data', () => {
    const { p } = make();
    expect(words(p.predict('I want', { k: 6 }))).toContain('to');
    expect(words(p.predict('I need the', { k: 3 }))).toContain('toilet');
    expect(p.predict('I', { k: 6 }).every(r => r.source === 'base')).toBe(true);
  });

  it('suggests sentence starters for an empty sentence', () => {
    const { p } = make();
    expect(words(p.predict([], { k: 3 }))).toContain('i');
    expect(p.predict([], { k: 3 })[0].label).toBe('I');
  });

  it('is deterministic', () => {
    const a = make().p;
    const b = make().p;
    for (const ctx of ['', 'I', 'can we', 'no thank']) {
      expect(a.predict(ctx)).toEqual(b.predict(ctx));
      expect(a.predict(ctx)).toEqual(a.predict(ctx));
    }
  });

  it('finds board words by prefix even when the corpus never uses them', () => {
    const { p } = make();
    // "thirsty" is a board word; prefix completion must reach it
    expect(words(p.predict('I am', { prefix: 'thir' }))).toContain('thirsty');
  });
});

describe('never returns junk', () => {
  it('no punctuation, placeholders, empty strings or duplicates', () => {
    const { p } = make({ learningEnabled: true });
    p.learnFromSpokenSentence('<UNK> ? !!! . , I want [UNKNOWN] juice ...');
    p.learnFromSpokenSentence(['', '?', 'I', 'want', 'JUICE', 'Juice!']);
    for (const ctx of ['', 'I', 'I want', 'want', '?', '<UNK>', 'xyzzy plugh']) {
      const out = p.predict(ctx, { k: 10 });
      const seen = new Set();
      for (const r of out) {
        expect(r.word).toMatch(/[\p{L}\p{N}]/u);
        expect(r.word).not.toMatch(/^[<[]|\s/);
        expect(r.word).toBe(r.word.toLowerCase());
        expect(seen.has(r.word)).toBe(false);
        seen.add(r.word);
      }
    }
    const exported = p.exportPersonal();
    expect(Object.keys(exported.uni).sort()).toEqual(['i', 'juice', 'want']);
  });
});

describe('personal learning', () => {
  it('learning off: nothing is learned or reported', () => {
    const onChange = jest.fn();
    const { p } = make({ learningEnabled: false, onPersonalChange: onChange });
    expect(p.learnFromSpokenSentence('I want to see Grandma')).toBe(false);
    expect(p.recordSuggestionAccepted('Grandma', 'I want to see')).toBe(false);
    p.dismissSuggestion('to', 'I want');
    expect(onChange).not.toHaveBeenCalled();
    expect(p.getPersonalStats()).toMatchObject({ sentences: 0, storedItems: 0 });
  });

  it('a spoken persona phrase moves up the ranking', () => {
    const { p, advance } = make({ learningEnabled: true });
    expect(words(p.predict('I want to see', { k: 3 }))).not.toContain('grandma');
    for (let i = 0; i < 3; i++) {
      p.learnFromSpokenSentence('I want to see Grandma');
      advance(3600000);
    }
    const top = p.predict('I want to see', { k: 3 })[0];
    expect(top).toMatchObject({ word: 'grandma', label: 'Grandma', source: 'personal' });
    expect(p.getPersonalStats().summary).toBe('Learned from 3 sentences, 4 word pairs.');
  });

  it('taps that were deleted before Speak never train', () => {
    const { p } = make({ learningEnabled: true });
    // The UI only calls learnFromSpokenSentence with what was finally spoken.
    // Simulated sentence editing: tapped "I want dinosaur", deleted
    // "dinosaur", then spoke "I want juice".
    const spoken = ['I', 'want', 'juice'];
    p.learnFromSpokenSentence(spoken);
    expect(p.exportPersonal().uni.dinosaur).toBeUndefined();
    expect(words(p.predict('I want', { k: 20 }))).not.toContain('dinosaur');
  });

  it('dismissal hides a word in that context only, then decays', () => {
    const { p, advance } = make({ learningEnabled: true });
    for (let i = 0; i < 3; i++) p.learnFromSpokenSentence('I want to see Grandma');
    p.learnFromSpokenSentence('I love Grandma');
    expect(words(p.predict('I love', { k: 3 }))).toContain('grandma');

    p.dismissSuggestion('Grandma', 'I want to see');
    expect(words(p.predict('I want to see', { k: 10 }))).not.toContain('grandma');
    expect(words(p.predict('I love', { k: 3 }))).toContain('grandma');

    advance(13 * DAY);
    expect(words(p.predict('I want to see', { k: 10 }))).not.toContain('grandma');
    advance(30 * DAY);
    expect(words(p.predict('I want to see', { k: 10 }))).toContain('grandma');
  });

  it('accepting a suggestion clears an earlier dismissal in that context', () => {
    const { p } = make({ learningEnabled: true });
    p.dismissSuggestion('to', 'I want');
    expect(words(p.predict('I want', { k: 10 }))).not.toContain('to');
    p.recordSuggestionAccepted('to', 'I want');
    expect(words(p.predict('I want', { k: 10 }))).toContain('to');
  });

  it('dismissals are bounded', () => {
    const { p } = make({ learningEnabled: true, limits: { maxFeedback: 50 } });
    for (let i = 0; i < 200; i++) p.dismissSuggestion(`word${i}`, 'I want');
    expect(p.getPersonalStats().dismissed).toBeLessThanOrEqual(50);
  });

  it('n-gram storage cap is enforced', () => {
    const { p, advance } = make({ learningEnabled: true, limits: { maxGrams: 200 } });
    const vocab = getBaseModel().vocab.slice(1, 300);
    for (let i = 0; i < 300; i++) {
      p.learnFromSpokenSentence([vocab[i % 299], vocab[(i * 7) % 299], vocab[(i * 13) % 299], vocab[(i * 31) % 299]]);
      advance(60000);
    }
    expect(p.getPersonalStats().storedItems).toBeLessThanOrEqual(200);
    // The most recent sentence survives pruning
    expect(p.exportPersonal().uni[vocab[299 % 299]]).toBeDefined();
  });

  it('reset returns predictions to the base model', () => {
    const { p } = make({ learningEnabled: true });
    const fresh = make().p;
    for (let i = 0; i < 5; i++) p.learnFromSpokenSentence('I want my dinosaur');
    expect(p.predict('I want my')).not.toEqual(fresh.predict('I want my'));
    p.resetPersonal();
    expect(p.getPersonalStats().storedItems).toBe(0);
    for (const ctx of ['', 'I want', 'I want my']) expect(p.predict(ctx)).toEqual(fresh.predict(ctx));
  });

  it('export / import round-trips and rejects junk', () => {
    const { p } = make({ learningEnabled: true });
    p.learnFromSpokenSentence('I want to see Grandma');
    const copy = make().p;
    expect(copy.importPersonal(JSON.stringify(p.exportPersonal()))).toBe(true);
    expect(copy.predict('I want to see')).toEqual(p.predict('I want to see'));
    expect(copy.importPersonal('{nope')).toBe(false);
    expect(copy.importPersonal({ format: 'something-else' })).toBe(false);
  });

  it('phrase completions come only from sentences said repeatedly', () => {
    const { p } = make({ learningEnabled: true });
    p.learnFromSpokenSentence('I want to see Grandma');
    expect(p.predictPhrases('I want')).toEqual([]);
    p.learnFromSpokenSentence('I want to see Grandma');
    expect(p.predictPhrases('I want')[0]).toMatchObject({ completion: 'to see Grandma', source: 'phrase' });
  });

  it('mode and topic bias never remove vocabulary', () => {
    const { p } = make();
    const plain = new Set(words(p.predict('', { prefix: 'd', k: 1000 })));
    const biased = new Set(words(p.predict('', { prefix: 'd', k: 1000, mode: 'child', context: 'work' })));
    expect([...plain].sort()).toEqual([...biased].sort());
  });

  it('shipped ranker keeps cold-start order identical to interpolation', () => {
    const plain = make().p;
    const ranked = make({ ranker: getRankerWeights() }).p;
    for (const ctx of ['', 'I', 'I want to', 'can we']) {
      expect(words(ranked.predict(ctx))).toEqual(words(plain.predict(ctx)));
    }
  });

  it('predicts quickly', () => {
    const { p } = make({ learningEnabled: true });
    for (let i = 0; i < 50; i++) p.learnFromSpokenSentence(`I want to see Grandma ${i}`);
    const start = Date.now();
    for (let i = 0; i < 200; i++) p.predict('I want to', { k: 6 });
    // Generous bound for slow CI machines; typical is ~0.1 ms per call.
    expect((Date.now() - start) / 200).toBeLessThan(5);
  });
});
