import AsyncStorage from '@react-native-async-storage/async-storage';
import { runIsolatedLearningDemo, SYNTHETIC_TRAINING, SYNTHETIC_HELD_OUT, predictionModelInfo } from '../services/prediction/diagnostics';

describe('visible isolated prediction demonstration', () => {
  beforeEach(() => jest.clearAllMocks());

  it('adapts on held-out sentences with the shipped model and restores baseline on reset', () => {
    for (const row of SYNTHETIC_HELD_OUT) expect(SYNTHETIC_TRAINING).not.toContain(row.sentence);
    const result = runIsolatedLearningDemo();
    expect(result.ignoredWhileOff).toBe(true);
    expect(result.trainingStats.sentences).toBe(6);
    expect(result.hits.adapted).toBe(2);
    expect(result.hits.adapted).toBeGreaterThan(result.hits.baseline);
    expect(result.resetRestoredBaseline).toBe(true);
    expect(result.reset).toEqual(result.baseline);
    for (const row of result.adapted) {
      expect(row.suggestions.find(s => s.word === row.target).source).toBe('personal');
    }
  });

  it('never touches persistent user data and is reproducible', () => {
    const first = runIsolatedLearningDemo();
    expect(runIsolatedLearningDemo()).toEqual(first);
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    expect(AsyncStorage.multiRemove).not.toHaveBeenCalled();
  });

  it('labels synthetic evidence and the statistical algorithm accurately', () => {
    expect(predictionModelInfo().algorithm).toMatch(/n-gram.*linear/);
    expect(predictionModelInfo().baseWords).toBeGreaterThan(0);
    expect(runIsolatedLearningDemo().disclaimer).toMatch(/not real-world accuracy/);
  });
});
