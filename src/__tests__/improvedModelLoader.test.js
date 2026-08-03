// Tests for improvedModelLoader — the on-device word-prediction model.
// TensorFlow.js and the bundled model assets are mocked; these tests cover
// the module's public API shape and the pure prediction math paths.

jest.mock('@tensorflow/tfjs', () => ({
  ready: jest.fn(() => Promise.resolve()),
  loadLayersModel: jest.fn(() => Promise.resolve({
    predict: jest.fn(() => ({ dataSync: () => new Float32Array([0.1, 0.9, 0.5]), dispose: jest.fn() })),
  })),
  tensor2d: jest.fn(() => ({ dispose: jest.fn() })),
}));
jest.mock('@tensorflow/tfjs-react-native', () => ({ bundleResourceIO: jest.fn() }));
jest.mock('../../assets/tf_model/word_prediction_tfjs/model.json', () => ({}), { virtual: true });
jest.mock('../../assets/tf_model/word_prediction_tfjs/group1-shard1of1.bin', () => 1, { virtual: true });
jest.mock(
  '../../assets/tf_model/word_prediction_tfjs/tokenizer.json',
  () => ({ hello: 1, want: 2, more: 3 }),
  { virtual: true }
);

const loader = require('../services/improvedModelLoader');

describe('improvedModelLoader exports', () => {
  test('exposes the expected API', () => {
    expect(typeof loader.loadImprovedModel).toBe('function');
    expect(typeof loader.predictTopKWordsWithImprovedModel).toBe('function');
    expect(typeof loader.predictNextWordWithImprovedModel).toBe('function');
    expect(loader.modelReady).toBeInstanceOf(Promise);
  });

  test('predictTopKWordsWithImprovedModel returns top words by probability', async () => {
    const tok = { hello: 1, want: 2, more: 3 };
    const model = {
      predict: jest.fn(() => ({
        // index 2 highest, then 3, then 1, then 0
        dataSync: () => new Float32Array([0.05, 0.2, 0.9, 0.4]),
        dispose: jest.fn(),
      })),
    };
    const result = await loader.predictTopKWordsWithImprovedModel(model, tok, 'hello', 1.0, 4, 2);
    // Reverse tokenizer: 1→hello, 2→want, 3→more; index 0 has no word.
    expect(result).toEqual(['want', 'more']);
  });

  test('predictNextWordWithImprovedModel returns the single best word', async () => {
    const tok = { hello: 1, want: 2 };
    const model = {
      predict: jest.fn(() => ({
        dataSync: () => new Float32Array([0.1, 0.2, 0.9]),
        dispose: jest.fn(),
      })),
    };
    const result = await loader.predictNextWordWithImprovedModel(model, tok, 'hello', 1.0, 4);
    expect(result).toBe('want');
  });
});
