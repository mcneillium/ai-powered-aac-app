// Personal learning: migration from earlier versions, user control
// (forget / don't suggest / clear) and the settings migration.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateSettings, toCloudSettings } from '../contexts/SettingsContext';
import {
  loadAIProfile, recordWordSelection, getPersonalModel, forgetLearnedWord,
  blockSuggestion, unblockSuggestion, getBlockedSuggestions, resetAIProfile,
  getLearnedSummary, hasStoredLearning, flushAIProfile,
} from '../services/aiProfileStore';

// Hoisted above the imports by babel-jest.
jest.mock('../../firebaseConfig', () => ({ db: null, auth: null, isFirebaseAvailable: () => false }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), onValue: jest.fn(), update: jest.fn() }));
jest.mock('firebase/auth', () => ({ onAuthStateChanged: jest.fn(), signInAnonymously: jest.fn() }));

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('settings migration', () => {
  test('new installs start with learning off', () => {
    expect(migrateSettings(null, { hadLearning: false }).settings.localLearning).toBe(false);
  });

  test('someone who was already learning keeps it on', () => {
    const { settings, changed } = migrateSettings({ theme: 'dark' }, { hadLearning: true });
    expect(settings.localLearning).toBe(true);
    expect(settings.theme).toBe('dark');
    expect(changed).toBe(true);
  });

  test('someone who had switched learning off stays off', () => {
    expect(migrateSettings({ aiPersonalisationEnabled: false }, { hadLearning: true }).settings.localLearning).toBe(false);
  });

  test('an explicit choice is never overridden', () => {
    const r = migrateSettings({ localLearning: false }, { hadLearning: true });
    expect(r.settings.localLearning).toBe(false);
    expect(r.changed).toBe(false);
  });

  test('the learning switch is never synced to the cloud', () => {
    expect(toCloudSettings({ localLearning: true, experience: 'child' })).toEqual({ experience: 'child' });
  });
});

describe('earlier versions’ learned data', () => {
  test('is kept and becomes the personal model', async () => {
    await AsyncStorage.setItem('@aac_ai_profile', JSON.stringify({
      version: 1,
      wordFrequencies: { go: 4, home: 2 },
      wordRecency: { go: Date.now(), home: Date.now() },
      bigrams: { 'go home': 2 },
      phraseFrequencies: { 'go home': 2 },
      failedSearches: {},
      hourlyActivity: {},
      totalWordSelections: 6,
      totalSentencesSpoken: 2,
      totalSessions: 3,
      suggestionsShown: 0,
      suggestionsAccepted: 0,
    }));
    expect(await hasStoredLearning()).toBe(true);
    const p = await loadAIProfile();
    expect(p.wordFrequencies.go).toBe(4); // original fields untouched
    expect(p.bigrams['go home']).toBe(2);
    expect(getPersonalModel().seq2['go|home'].c).toBe(2);
    expect(getPersonalModel().uni.go.c).toBe(4);
  });
});

describe('user control', () => {
  test('forgetting a word removes it from suggestions, counts and phrases', async () => {
    await loadAIProfile();
    await recordWordSelection('I', []);
    await recordWordSelection('want', ['I']);
    await recordWordSelection('pizza', ['I', 'want']);
    expect(getPersonalModel().uni.pizza).toBeDefined();
    await forgetLearnedWord('Pizza');
    expect(getPersonalModel().uni.pizza).toBeUndefined();
    expect(getLearnedSummary().words.map(w => w.word)).not.toContain('pizza');
    // the rest of what was learned stays
    expect(getPersonalModel().uni.want).toBeDefined();
  });

  test("don't suggest is saved, undoable, and survives clearing learned data", async () => {
    await loadAIProfile();
    await blockSuggestion('Juice');
    expect(getBlockedSuggestions()).toEqual(['juice']);
    await recordWordSelection('juice', []);
    await resetAIProfile();
    expect(getBlockedSuggestions()).toEqual(['juice']);
    expect(getLearnedSummary().wordCount).toBe(0);
    await unblockSuggestion('juice');
    expect(getBlockedSuggestions()).toEqual([]);
  });

  test('learned data is saved on this device and reloads', async () => {
    await loadAIProfile();
    await recordWordSelection('swim', []);
    await flushAIProfile();
    const raw = JSON.parse(await AsyncStorage.getItem('@aac_ai_profile'));
    expect(raw.learning.uni.swim.c).toBeGreaterThan(0);
  });
});
