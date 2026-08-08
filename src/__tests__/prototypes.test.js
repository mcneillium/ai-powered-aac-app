/**
 * The three Phase 6 prototypes. All ship behind flags defaulted OFF, so these
 * tests are the only thing exercising them until Paul turns one on.
 */

import {
  isFeatureEnabled,
  setFeatureFlag,
  resetFeatureFlags,
  listFeatureFlags,
  FEATURE_FLAG_DEFAULTS,
} from '../config/featureFlags';
import { createActivationGuard, DEFAULT_LOCKOUT_MS } from '../services/activationGuard';
import { keystrokeSavings, wordsPerMinute, createRateTracker } from '../services/rateMetrics';
import { saveDraft, flushDraft, loadDraft, clearDraft, DRAFT_TTL_MS } from '../services/utteranceRecovery';

// utteranceRecovery imports AsyncStorage for its production default; every test
// below injects its own storage, so this mock only has to exist, not work.
// (jest hoists jest.mock above the imports regardless of where it is written.)
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

afterEach(() => resetFeatureFlags());

describe('feature flags', () => {
  test('every flag ships OFF — this is the safety property of the whole phase', () => {
    for (const [name, value] of Object.entries(FEATURE_FLAG_DEFAULTS)) {
      expect({ name, value }).toEqual({ name, value: false });
    }
  });

  test('can be overridden at runtime and reset', () => {
    expect(isFeatureEnabled('rateMetrics')).toBe(false);
    setFeatureFlag('rateMetrics', true);
    expect(isFeatureEnabled('rateMetrics')).toBe(true);
    resetFeatureFlags();
    expect(isFeatureEnabled('rateMetrics')).toBe(false);
  });

  test('an unknown flag throws rather than silently reading false', () => {
    expect(() => setFeatureFlag('notAFlag', true)).toThrow(/Unknown feature flag/);
    expect(isFeatureEnabled('notAFlag')).toBe(false);
  });

  test('listFeatureFlags reports default, effective and overridden', () => {
    setFeatureFlag('utteranceRecovery', true);
    const row = listFeatureFlags().find((f) => f.name === 'utteranceRecovery');
    expect(row).toEqual({ name: 'utteranceRecovery', default: false, effective: true, overridden: true });
  });
});

describe('activationGuard — tremor double-fire protection', () => {
  let clock;
  const guardAt = (opts) => createActivationGuard({ now: () => clock, ...opts });

  beforeEach(() => { clock = 1_000; });

  test('the first press always fires immediately — latency is never traded away', () => {
    const g = guardAt();
    expect(g.shouldAccept('want')).toBe(true);
  });

  test('suppresses a second contact inside the lockout window', () => {
    const g = guardAt({ lockoutMs: 300 });
    expect(g.shouldAccept('want')).toBe(true);
    clock += 80;
    expect(g.shouldAccept('want')).toBe(false);
    expect(g.suppressedCount()).toBe(1);
  });

  test('allows a deliberate repeat once the window has passed', () => {
    const g = guardAt({ lockoutMs: 300 });
    g.shouldAccept('no');
    clock += 350;
    expect(g.shouldAccept('no')).toBe(true);
  });

  test('a different button is not blocked — "I want" must not become "I"', () => {
    const g = guardAt({ lockoutMs: 300 });
    expect(g.shouldAccept('I')).toBe(true);
    clock += 50;
    expect(g.shouldAccept('want')).toBe(true);
  });

  test('global scope blocks any button, for users who need it', () => {
    const g = guardAt({ lockoutMs: 300, scope: 'global' });
    expect(g.shouldAccept('I')).toBe(true);
    clock += 50;
    expect(g.shouldAccept('want')).toBe(false);
  });

  test('a zero window disables the guard entirely', () => {
    const g = guardAt({ lockoutMs: 0 });
    expect(g.shouldAccept('x')).toBe(true);
    expect(g.shouldAccept('x')).toBe(true);
  });

  test('clamps an absurd configured window', () => {
    expect(createActivationGuard({ lockoutMs: 999_999 }).lockoutMs).toBeLessThanOrEqual(3000);
    expect(createActivationGuard({ lockoutMs: -5 }).lockoutMs).toBeGreaterThanOrEqual(0);
    expect(createActivationGuard().lockoutMs).toBe(DEFAULT_LOCKOUT_MS);
  });
});

describe('rateMetrics', () => {
  test('keystroke savings matches the standard AAC formula', () => {
    // "I want a drink" = 14 characters, produced with 4 symbol taps.
    expect(keystrokeSavings(14, 4)).toBeCloseTo(71.43, 1);
  });

  test('is 0 rather than negative when selections exceed characters', () => {
    expect(keystrokeSavings(3, 10)).toBe(0);
  });

  test.each([[0, 4], [NaN, 1], [10, NaN], [-1, 1]])(
    'returns 0 for nonsense input (%p, %p)',
    (chars, sels) => expect(keystrokeSavings(chars, sels)).toBe(0),
  );

  test('words per minute', () => {
    expect(wordsPerMinute(4, 60_000)).toBeCloseTo(4, 5);
    expect(wordsPerMinute(4, 30_000)).toBeCloseTo(8, 5);
    expect(wordsPerMinute(0, 1000)).toBe(0);
    expect(wordsPerMinute(4, 0)).toBe(0);
  });

  test('tracks a whole utterance end to end', () => {
    let clock = 0;
    const t = createRateTracker({ now: () => clock });
    t.beginUtterance();
    for (let i = 0; i < 4; i++) { t.recordSelection(); clock += 5_000; }
    clock += 10_000; // the pause before committing counts, deliberately
    const sample = t.completeUtterance(4, 14);
    expect(sample.selections).toBe(4);
    expect(sample.elapsedMs).toBe(30_000);
    expect(sample.wpm).toBeCloseTo(8, 5);
    expect(sample.ksr).toBeCloseTo(71.43, 1);
  });

  test('summary averages across utterances', () => {
    let clock = 0;
    const t = createRateTracker({ now: () => clock });
    for (let i = 0; i < 3; i++) {
      t.beginUtterance();
      t.recordSelection(); t.recordSelection();
      clock += 60_000;
      t.completeUtterance(2, 10);
    }
    const s = t.summary();
    expect(s.utterances).toBe(3);
    expect(s.totalWords).toBe(6);
    expect(s.totalSelections).toBe(6);
    expect(s.meanWpm).toBeCloseTo(2, 5);
  });

  test('is bounded — the failure class this codebase has already hit twice', () => {
    let clock = 0;
    const t = createRateTracker({ maxSamples: 10, now: () => clock });
    for (let i = 0; i < 50; i++) {
      t.beginUtterance(); t.recordSelection(); clock += 1000; t.completeUtterance(1, 4);
    }
    expect(t.summary().utterances).toBe(10);
  });

  test('summary of an empty session is zeros, not NaN', () => {
    expect(createRateTracker().summary()).toEqual({
      utterances: 0, meanWpm: 0, meanKsr: 0, totalWords: 0, totalSelections: 0,
    });
  });
});

describe('utteranceRecovery', () => {
  const makeStorage = (initial = {}) => {
    const map = new Map(Object.entries(initial));
    return {
      map,
      getItem: jest.fn(async (k) => (map.has(k) ? map.get(k) : null)),
      setItem: jest.fn(async (k, v) => { map.set(k, v); }),
      removeItem: jest.fn(async (k) => { map.delete(k); }),
    };
  };

  test('round-trips an in-progress utterance', async () => {
    const storage = makeStorage();
    await flushDraft(['I', 'want', 'a', 'drink'], { storage, now: () => 1000 });
    expect(await loadDraft({ storage, now: () => 2000 })).toEqual(['I', 'want', 'a', 'drink']);
  });

  test('discards a draft older than the TTL rather than resurrecting it mid-conversation', async () => {
    const storage = makeStorage();
    await flushDraft(['I', 'need', 'the', 'toilet'], { storage, now: () => 0 });
    expect(await loadDraft({ storage, now: () => DRAFT_TTL_MS + 1 })).toBeNull();
    expect(storage.removeItem).toHaveBeenCalled();
  });

  test('returns null when there is nothing saved', async () => {
    expect(await loadDraft({ storage: makeStorage() })).toBeNull();
  });

  test('discards a corrupt draft instead of throwing — the board must always open', async () => {
    const storage = makeStorage({ '@aac_utterance_draft': 'not json{' });
    expect(await loadDraft({ storage })).toBeNull();
  });

  test('saving an empty utterance clears the draft', async () => {
    const storage = makeStorage();
    await flushDraft(['hello'], { storage, now: () => 1 });
    await saveDraft([], { storage });
    expect(await loadDraft({ storage, now: () => 2 })).toBeNull();
  });

  test('a storage failure is swallowed — never surfaced mid-sentence', async () => {
    const storage = makeStorage();
    storage.setItem = jest.fn(async () => { throw new Error('disk full'); });
    await expect(flushDraft(['hello'], { storage, now: () => 1 })).resolves.toBeUndefined();
  });

  test('caps the number of words persisted', async () => {
    const storage = makeStorage();
    const many = Array.from({ length: 500 }, (_, i) => `w${i}`);
    await flushDraft(many, { storage, now: () => 1 });
    const restored = await loadDraft({ storage, now: () => 2 });
    expect(restored.length).toBeLessThanOrEqual(100);
  });

  test('clearDraft removes it', async () => {
    const storage = makeStorage();
    await flushDraft(['a'], { storage, now: () => 1 });
    await clearDraft({ storage });
    expect(await loadDraft({ storage, now: () => 2 })).toBeNull();
  });
});
