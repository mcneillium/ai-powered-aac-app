// Tests for the prediction utility functions in improvedModelLoader.
// Model loading itself is tested via integration; here we test the
// prediction logic with a mock model.

jest.mock('@tensorflow/tfjs', () => ({
  ready: jest.fn(() => Promise.resolve()),
  loadLayersModel: jest.fn(),
  tensor2d: jest.fn(() => ({
    dispose: jest.fn(),
  })),
}));
jest.mock('@tensorflow/tfjs-react-native', () => ({
  bundleResourceIO: jest.fn(),
}));

// Mock asset requires
jest.mock('../../assets/tf_model/word_prediction_tfjs/model.json', () => ({}), { virtual: true });
jest.mock('../../assets/tf_model/word_prediction_tfjs/group1-shard1of1.bin', () => ({}), { virtual: true });
jest.mock('../../assets/tf_model/word_prediction_tfjs/tokenizer.json', () => ({
  hello: 1,
  world: 2,
  how: 3,
  are: 4,
  you: 5,
}), { virtual: true });

describe('predictNextWordWithImprovedModel', () => {
  test('returns a word from the tokenizer', async () => {
    const { predictNextWordWithImprovedModel } = require('../services/improvedModelLoader');

    const mockModel = {
      predict: jest.fn(() => ({
        dataSync: () => new Float32Array([0.1, 0.9, 0.05, 0.02, 0.01, 0.01]),
        dispose: jest.fn(),
      })),
    };
    const tokenizer = { hello: 1, world: 2, how: 3, are: 4, you: 5 };

    const result = await predictNextWordWithImprovedModel(
      mockModel,
      tokenizer,
      'hello how are',
      1.0,
      4
    );

    expect(typeof result).toBe('string');
    expect(mockModel.predict).toHaveBeenCalled();
  });
});
