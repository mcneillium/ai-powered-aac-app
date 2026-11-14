// User control over learning (What Voice has learned) and carrying learning
// over from earlier versions.
import { createPredictor, getBaseModel } from '../services/prediction';
import { personalFromLegacyProfile, hasLegacyLearning } from '../services/prediction/legacyImport';
import { migrateLearning } from '../contexts/SettingsContext';

jest.mock('../../firebaseConfig', () => ({ db: null, auth: null, isFirebaseAvailable: () => false }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), onValue: jest.fn(), update: jest.fn(), set: jest.fn() }));
jest.mock('firebase/auth', () => ({ onAuthStateChanged: jest.fn(), signInAnonymously: jest.fn() }));

const T0 = Date.UTC(2026, 0, 5, 9);
const make = (extra = {}) => createPredictor({ base: getBaseModel(), now: () => T0, learningEnabled: true, ...extra });
const words = (list) => list.map((r) => r.word);

describe('What Voice has learned', () => {
  test('lists learned words, most used first, with display forms', () => {
    const p = make();
    for (let i = 0; i < 3; i++) p.learnFromSpokenSentence(['I', 'want', 'Grandma']);
    p.learnFromSpokenSentence(['I', 'want', 'juice']);
    const list = p.getLearnedWords(10);
    expect(list.map((x) => x.word)).toEqual(expect.arrayContaining(['grandma', 'juice', 'want']));
    expect(list.find((x) => x.word === 'grandma').display).toBe('Grandma');
    expect(list.findIndex((x) => x.word === 'grandma')).toBeLessThan(list.findIndex((x) => x.word === 'juice'));
  });

  test('forgetting a word removes it from suggestions and from everything learned', () => {
    const p = make();
    for (let i = 0; i < 6; i++) p.learnFromSpokenSentence(['I', 'want', 'Grandma']);
    expect(words(p.predict('I want', { k: 3 }))).toContain('grandma');
    expect(p.forgetLearnedWord('Grandma')).toBe(true);
    expect(words(p.predict('I want', { k: 6 }))).not.toContain('grandma');
    expect(p.getLearnedWords(50).map((x) => x.word)).not.toContain('grandma');
    const json = JSON.stringify(p.exportPersonal()).toLowerCase();
    expect(json).not.toContain('grandma');
    // the rest of what was learned stays
    expect(p.getLearnedWords(50).map((x) => x.word)).toContain('want');
  });

  test('forgetting works with learning paused', () => {
    const p = make();
    p.learnFromSpokenSentence(['call', 'Siobhan']);
    p.setLearningEnabled(false);
    expect(p.forgetLearnedWord('siobhan')).toBe(true);
    expect(p.getLearnedWords(50).map((x) => x.word)).not.toContain('siobhan');
  });

  test('a hidden suggestion is listed and can be undone', () => {
    const p = make();
    expect(words(p.predict('I want', { k: 6 }))).toContain('to');
    p.dismissSuggestion('to', ['I', 'want']);
    expect(words(p.predict('I want', { k: 6 }))).not.toContain('to');
    expect(p.getDismissed()).toEqual([{ prev: 'want', word: 'to' }]);
    expect(p.undismissSuggestion('want', 'to')).toBe(true);
    expect(p.getDismissed()).toEqual([]);
    expect(words(p.predict('I want', { k: 6 }))).toContain('to');
  });
});

describe('learning carried over from earlier versions', () => {
  const legacy = {
    version: 1,
    totalWordSelections: 40,
    wordFrequencies: { want: 10, coffee: 6 },
    bigrams: { 'want coffee': 6 },
    phraseFrequencies: { 'i want coffee': 6, 'i want coffee please': 3, 'just once': 1 },
    updatedAt: T0,
  };

  test('repeated phrases become the personal layer; one-offs are not imported', () => {
    expect(hasLegacyLearning(legacy)).toBe(true);
    const json = personalFromLegacyProfile(legacy, T0);
    expect(json).not.toBeNull();
    const p = make({ personal: json });
    expect(words(p.predict('I want', { k: 3 }))).toContain('coffee');
    expect(p.getLearnedWords(50).map((x) => x.word)).not.toContain('once');
  });

  test('nothing to carry over gives null', () => {
    expect(personalFromLegacyProfile({ phraseFrequencies: { 'only once': 1 } }, T0)).toBeNull();
    expect(personalFromLegacyProfile(null, T0)).toBeNull();
    expect(hasLegacyLearning({ totalWordSelections: 0 })).toBe(false);
  });

  test('settings: earlier learners keep learning, everyone else stays off', () => {
    expect(migrateLearning(null, true)).toEqual({ personalLearning: true, learningCarriedOver: true });
    expect(migrateLearning({ theme: 'dark' }, true)).toEqual({ personalLearning: true, learningCarriedOver: true });
    expect(migrateLearning({ aiPersonalisationEnabled: false }, true)).toEqual({ personalLearning: false });
    expect(migrateLearning(null, false)).toBeNull(); // new install: default (off)
    expect(migrateLearning({ personalLearning: false }, true)).toBeNull(); // explicit choice wins
  });
});
