// Tests for visionService — verifies fallback behavior and API call structure.

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(() => Promise.resolve('base64data')),
  EncodingType: { Base64: 'base64' },
}));

jest.mock('../services/hfImageCaption', () => ({
  getImageCaption: jest.fn(() => Promise.resolve('fallback caption')),
}));

describe('visionService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
    global.fetch = undefined;
  });

  test('falls back to HuggingFace when Vision API key is not set', async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_CLOUD_VISION_API_KEY;
    const { getVisionLabels } = require('../services/visionService');
    const result = await getVisionLabels('file:///test.jpg');
    expect(result).toBe('fallback caption');
  });

  test('calls Vision API when key is set', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_CLOUD_VISION_API_KEY = 'test-key';
    jest.resetModules();

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            responses: [
              {
                labelAnnotations: [{ description: 'dog' }, { description: 'pet' }],
                localizedObjectAnnotations: [{ name: 'Dog' }],
              },
            ],
          }),
      })
    );

    const { getVisionLabels } = require('../services/visionService');
    const result = await getVisionLabels('file:///test.jpg');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('vision.googleapis.com'),
      expect.any(Object)
    );
    expect(result).toContain('Dog');
  });
});
