import { word2idx, idx2word } from '../utils/vocab';

describe('vocab', () => {
  it('maps <PAD> to index 0', () => {
    expect(word2idx['<PAD>']).toBe(0);
  });

  it('maps <UNK> to index 1', () => {
    expect(word2idx['<UNK>']).toBe(1);
  });

  it('has a reverse mapping for every forward mapping', () => {
    for (const [word, idx] of Object.entries(word2idx)) {
      expect(idx2word[idx]).toBe(word);
    }
  });

  it('contains common AAC words', () => {
    const expectedWords = ['I', 'you', 'want', 'need', 'help', 'food', 'water', 'happy', 'sad'];
    for (const word of expectedWords) {
      expect(word2idx[word]).toBeDefined();
    }
  });

  it('has no duplicate indices', () => {
    const indices = Object.values(word2idx);
    const uniqueIndices = new Set(indices);
    expect(uniqueIndices.size).toBe(indices.length);
  });
});
