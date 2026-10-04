// Audit reproducers for the on-device learning path (consent, deletion,
// pending writes, legacy carry-over). All sentences are artificial.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createPersistentPredictor, personalKey } from '../services/prediction';
import { personalFromLegacyProfile } from '../services/prediction/legacyImport';
import { CORRUPT_SUFFIX } from '../utils/safeStorage';
import {
  loadAIProfile, resetAIProfile, recordWordSelection, recordSentenceSpoken, flushAIProfile,
} from '../services/aiProfileStore';

const T0 = Date.UTC(2026, 0, 5, 9);
const KEY = personalKey('default');
const opts = (extra = {}) => ({ debounceMs: 60000, now: () => T0, ...extra });
const stored = async (key = KEY) => {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { console.warn.mockRestore(); });

// How earlier builds filled '@aac_ai_profile' while learning was on: every
// tap recorded a window of up to 4 words, and Speak recorded the sentence.
async function oldBuildTaps(words) {
  for (let i = 0; i < words.length; i++) await recordWordSelection(words[i], words.slice(0, i), false);
}
async function oldBuildProfile(run) {
  await AsyncStorage.removeItem('@aac_ai_profile');
  await resetAIProfile();
  await loadAIProfile();
  await run();
  await flushAIProfile();
  return JSON.parse(await AsyncStorage.getItem('@aac_ai_profile'));
}

describe('legacy carry-over imports repeated spoken phrases only', () => {
  test('a short message spoken ONCE is not imported (tap window + Speak double count)', async () => {
    const profile = await oldBuildProfile(async () => {
      await oldBuildTaps(['i', 'want', 'quokka']);
      await recordSentenceSpoken(['i', 'want', 'quokka']);
    });
    // One utterance already reaches the "used at least twice" threshold.
    expect(profile.phraseFrequencies['i want quokka']).toBe(2);
    expect(personalFromLegacyProfile(profile, T0)).toBeNull();
  });

  test('words tapped and deleted twice (never spoken) are not imported', async () => {
    const profile = await oldBuildProfile(async () => {
      await oldBuildTaps(['i', 'want', 'quokka']);
      await oldBuildTaps(['i', 'want', 'quokka']);
    });
    expect(profile.totalSentencesSpoken).toBe(0);
    expect(personalFromLegacyProfile(profile, T0)).toBeNull();
  });

  test('a message spoken twice is still carried over', async () => {
    const profile = await oldBuildProfile(async () => {
      for (let n = 0; n < 2; n++) {
        await oldBuildTaps(['i', 'want', 'quokka']);
        await recordSentenceSpoken(['i', 'want', 'quokka']);
      }
    });
    const json = personalFromLegacyProfile(profile, T0);
    expect(json).not.toBeNull();
    expect(json.phrases['i want quokka']).toBeDefined();
    // Sub-windows that were only ever partial taps are not whole sentences.
    expect(json.phrases['i want']).toBeUndefined();
    expect(json.sentences).toBe(2);
  });
});

describe('deletion and pending writes', () => {
  test('reset also removes the backup copy kept from corrupt data', async () => {
    await AsyncStorage.setItem(KEY, '{"format":"voice-personal","uni":{"quokka"');
    const p = await createPersistentPredictor(opts({ learningEnabled: true }));
    expect(await AsyncStorage.getItem(`${KEY}${CORRUPT_SUFFIX}`)).not.toBeNull();
    await p.resetPersonal();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
    expect(await AsyncStorage.getItem(`${KEY}${CORRUPT_SUFFIX}`)).toBeNull();
  });

  test('a stored file from another format version is backed up, not silently overwritten', async () => {
    const future = { format: 'voice-personal', version: 2, sentences: 3, uni: { quokka: [3, T0] } };
    await AsyncStorage.setItem(KEY, JSON.stringify(future));
    const p = await createPersistentPredictor(opts({ learningEnabled: true }));
    p.learnFromSpokenSentence('I want juice');
    await p.flush();
    expect(JSON.parse(await AsyncStorage.getItem(`${KEY}${CORRUPT_SUFFIX}`))).toEqual(future);
  });

  test('a failed read does not lead to the stored data being overwritten', async () => {
    const p0 = await createPersistentPredictor(opts({ learningEnabled: true }));
    for (let i = 0; i < 3; i++) p0.learnFromSpokenSentence('I want quokka');
    await p0.flush();
    const before = await stored();

    AsyncStorage.getItem.mockImplementationOnce(() => Promise.reject(new Error('read failed')));
    let p = null;
    try { p = await createPersistentPredictor(opts({ learningEnabled: true })); } catch { p = null; }
    if (p) {
      p.learnFromSpokenSentence('I want juice');
      await p.flush();
    }
    expect(await stored()).toEqual(before);
  });

  test('with learning paused, Forget does not persist session-only dismissals', async () => {
    const p0 = await createPersistentPredictor(opts({ learningEnabled: true }));
    for (let i = 0; i < 3; i++) p0.learnFromSpokenSentence('I want quokka');
    await p0.flush();

    const p = await createPersistentPredictor(opts({ learningEnabled: false }));
    p.dismissSuggestion('juice', 'I want'); // session only while paused
    await p.forgetLearnedWord('quokka');
    const after = await stored();
    expect(after.uni.quokka).toBeUndefined();
    expect(Object.keys(after.dismissed)).toEqual([]);

    // Undo of a stored dismissal is saved; the session-only one still is not.
    p.dismissSuggestion('tea', 'I want');
    await p.undismissSuggestion('want', 'juice');
    expect(Object.keys((await stored()).dismissed)).toEqual([]);
  });

  test('forget is saved and survives a debounced save already scheduled', async () => {
    const p = await createPersistentPredictor(opts({ learningEnabled: true }));
    for (let i = 0; i < 3; i++) p.learnFromSpokenSentence('I want quokka please');
    await p.forgetLearnedWord('quokka');
    p.learnFromSpokenSentence('I want juice');
    await p.flush();
    const s = await stored();
    expect(Object.keys(s.uni)).not.toContain('quokka');
    expect(Object.keys(s.bi).some((k) => k.split(' ').includes('quokka'))).toBe(false);
    expect(Object.keys(s.tri).some((k) => k.split(' ').includes('quokka'))).toBe(false);
    expect(Object.keys(s.phrases).some((k) => k.split(' ').includes('quokka'))).toBe(false);
    const again = await createPersistentPredictor(opts());
    expect(again.predict('I want', { k: 10 }).map((r) => r.word)).not.toContain('quokka');
    expect(again.predictPhrases('I', { k: 5 }).map((r) => r.phrase.toLowerCase()).join('|')).not.toMatch(/quokka/);
  });

  test('reset after a flushed-but-unfinished save leaves nothing learned in storage', async () => {
    const p = await createPersistentPredictor(opts({ learningEnabled: true }));
    for (let i = 0; i < 3; i++) p.learnFromSpokenSentence('I want quokka');
    const pending = p.flush(); // e.g. app went to background
    p.learnFromSpokenSentence('I want quokka');
    const reset = p.resetPersonal();
    await Promise.all([pending, reset, p.flush()]);
    const s = await stored();
    expect(s === null || Object.keys(s.uni).length === 0).toBe(true);
  });
});

describe('suggestionEngine init race', () => {
  test('delete-learning while stored data is still loading does not bring it back', async () => {
    const p0 = await createPersistentPredictor(opts({ learningEnabled: true }));
    for (let i = 0; i < 3; i++) p0.learnFromSpokenSentence('I want quokka');
    await p0.flush();

    let engine;
    jest.isolateModules(() => { engine = require('../services/suggestionEngine'); });
    const init = engine.initPrediction();           // App.js starts this at launch
    await engine.resetLearning();                    // user deletes before it finishes
    await init;
    expect(engine.getLearningStats().sentences).toBe(0);
    expect(engine.getLearnedWords().map((w) => w.word)).not.toContain('quokka');
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  test('legacy import never runs into a store that already has learning', async () => {
    const p0 = await createPersistentPredictor(opts({ learningEnabled: true }));
    p0.learnFromSpokenSentence('I want juice');
    await p0.flush();
    let engine;
    jest.isolateModules(() => { engine = require('../services/suggestionEngine'); });
    const legacy = { totalWordSelections: 9, phraseFrequencies: { 'i want quokka': 8 } };
    expect(await engine.importLegacyLearning(legacy)).toBe(false);
    expect(engine.getLearnedWords().map((w) => w.word)).not.toContain('quokka');
    // and a second run after a successful import is also refused
    await engine.resetLearning();
    expect(await engine.importLegacyLearning(legacy)).toBe(true);
    expect(await engine.importLegacyLearning({ phraseFrequencies: { 'we like tea': 8 } })).toBe(false);
  });
});
