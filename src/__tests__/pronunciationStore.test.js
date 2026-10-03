jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

import {
  applyPronunciations, setPronunciation, removePronunciation,
  getPronunciations, _resetPronunciationsForTests,
} from '../services/pronunciationStore';

beforeEach(() => _resetPronunciationsForTests([]));

describe('pronunciationStore', () => {
  test('replaces whole words case-insensitively', async () => {
    await setPronunciation('Niamh', 'Neeve');
    expect(applyPronunciations('niamh is here')).toBe('Neeve is here');
    expect(applyPronunciations('Hi Niamh!')).toBe('Hi Neeve!');
  });

  test('does not replace inside other words', async () => {
    await setPronunciation('read', 'red');
    expect(applyPronunciations('I already read it')).toBe('I already red it');
    expect(applyPronunciations('bread')).toBe('bread');
  });

  test('handles repeated and multi-word entries, longest first', async () => {
    await setPronunciation('GP', 'gee pee');
    await setPronunciation('GP surgery', 'doctor surgery');
    expect(applyPronunciations('GP GP')).toBe('gee pee gee pee');
    expect(applyPronunciations('go to GP surgery')).toBe('go to doctor surgery');
  });

  test('treats regex characters literally', async () => {
    await setPronunciation('C++', 'see plus plus');
    expect(applyPronunciations('I like C++ code')).toBe('I like see plus plus code');
  });

  test('updates an existing entry instead of duplicating it', async () => {
    await setPronunciation('Aoife', 'Eefa');
    await setPronunciation('aoife', 'Ee-fa');
    expect(getPronunciations()).toHaveLength(1);
    expect(applyPronunciations('Aoife')).toBe('Ee-fa');
  });

  test('rejects empty entries and removes by id', async () => {
    expect(await setPronunciation('', 'x')).toBeNull();
    expect(await setPronunciation('x', '  ')).toBeNull();
    const e = await setPronunciation('Eoin', 'Owen');
    await removePronunciation(e.id);
    expect(applyPronunciations('Eoin')).toBe('Eoin');
  });
});
