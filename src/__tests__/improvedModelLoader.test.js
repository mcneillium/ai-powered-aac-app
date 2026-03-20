// Tests for the prediction re-export in improvedModelLoader.
// Verifies that improvedModelLoader properly re-exports from localPredictor.

describe('improvedModelLoader exports', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('re-exports ensureImprovedModelLoaded from localPredictor', () => {
    // Mock localPredictor before importing
    jest.mock('../services/localPredictor', () => ({
      ensureImprovedModelLoaded: jest.fn(() => Promise.resolve(true)),
      predictTopKWordsWithImprovedModel: jest.fn(() => Promise.resolve(['hello'])),
    }));

    const loader = require('../services/improvedModelLoader');
    expect(typeof loader.ensureImprovedModelLoaded).toBe('function');
    expect(typeof loader.loadImprovedModel).toBe('function');
    expect(typeof loader.predictTopKWordsWithImprovedModel).toBe('function');

    // loadImprovedModel should be the same function as ensureImprovedModelLoaded
    expect(loader.loadImprovedModel).toBe(loader.ensureImprovedModelLoaded);
  });

  test('predictTopKWordsWithImprovedModel delegates to localPredictor', async () => {
    const mockPredict = jest.fn(() => Promise.resolve(['want', 'go', 'help']));
    jest.mock('../services/localPredictor', () => ({
      ensureImprovedModelLoaded: jest.fn(() => Promise.resolve(true)),
      predictTopKWordsWithImprovedModel: mockPredict,
    }));

    const { predictTopKWordsWithImprovedModel } = require('../services/improvedModelLoader');
    const result = await predictTopKWordsWithImprovedModel('I want to', 5);

    expect(mockPredict).toHaveBeenCalledWith('I want to', 5);
    expect(result).toEqual(['want', 'go', 'help']);
  });
});
