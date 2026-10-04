// Tests for AsyncStorage persistence of the personal prediction layer.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createPersistentPredictor, personalKey } from '../services/prediction';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  console.warn.mockRestore();
});

const opts = (extra = {}) => ({ debounceMs: 60000, ...extra });

describe('personal prediction storage', () => {
  it('stores nothing while learning is off', async () => {
    const p = await createPersistentPredictor(opts({ learningEnabled: false }));
    p.learnFromSpokenSentence('I want to see Grandma');
    p.dismissSuggestion('to', 'I want');
    await p.flush();
    const keys = await AsyncStorage.getAllKeys();
    expect(keys.filter(k => k.startsWith('@voice_prediction_personal_v1'))).toEqual([]);
  });

  it('persists learning (debounced) and reloads it', async () => {
    // The jest AsyncStorage mock's setItem is already a jest.fn; count calls.
    const writes = () => AsyncStorage.setItem.mock.calls.length;
    const p = await createPersistentPredictor(opts({ learningEnabled: true }));
    const before = writes();
    for (let i = 0; i < 3; i++) p.learnFromSpokenSentence('I want to see Grandma');
    expect(writes()).toBe(before); // debounced
    await p.flush();
    expect(writes()).toBe(before + 1);

    const again = await createPersistentPredictor(opts());
    expect(again.predict('I want to see', { k: 1 })[0].word).toBe('grandma');
  });

  it('keeps profiles separate', async () => {
    const a = await createPersistentPredictor(opts({ profileId: 'alex', learningEnabled: true }));
    a.learnFromSpokenSentence('I want my dinosaur');
    await a.flush();
    const b = await createPersistentPredictor(opts({ profileId: 'sam', learningEnabled: true }));
    expect(b.getPersonalStats().sentences).toBe(0);
    expect(personalKey('alex')).not.toBe(personalKey('sam'));
    expect(await AsyncStorage.getItem(personalKey('sam'))).toBeNull();
    expect(await AsyncStorage.getItem(personalKey('alex'))).not.toBeNull();
  });

  it('recovers from corrupt data and keeps a backup', async () => {
    await AsyncStorage.setItem(personalKey('default'), '{not json');
    const p = await createPersistentPredictor(opts());
    expect(p.getPersonalStats().sentences).toBe(0);
    expect(p.predict('I want').length).toBeGreaterThan(0);
    expect(await AsyncStorage.getItem(`${personalKey('default')}__corrupt`)).toBe('{not json');
  });

  it('reset clears memory and storage', async () => {
    const p = await createPersistentPredictor(opts({ learningEnabled: true }));
    p.learnFromSpokenSentence('I want my dinosaur');
    await p.flush();
    await p.resetPersonal();
    expect(p.getPersonalStats().storedItems).toBe(0);
    expect(await AsyncStorage.getItem(personalKey('default'))).toBeNull();
    await p.flush();
    expect(await AsyncStorage.getItem(personalKey('default'))).toBeNull();
  });
});
