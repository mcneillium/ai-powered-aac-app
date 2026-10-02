/* eslint-env jest, node */
// Regression: on a native Android build (Expo SDK 54, expo-file-system 19)
// every camera or gallery photo failed with "Could not process this image",
// because readAsStringAsync/EncodingType were imported from 'expo-file-system',
// where they now throw. Device log: "[Camera] base64 read failed: Cannot read
// property 'Base64' of undefined".
const fs = require('fs');
const path = require('path');

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
}));

const FileSystem = require('expo-file-system/legacy');
const { readImageBase64 } = require('../services/imageFile');

describe('readImageBase64', () => {
  beforeEach(() => {
    FileSystem.readAsStringAsync.mockReset();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.useRealTimers();
    console.warn.mockRestore();
  });

  test('reads the photo through the legacy API as base64', async () => {
    FileSystem.readAsStringAsync.mockResolvedValue('QUJD');
    await expect(readImageBase64('file:///photo.jpg')).resolves.toBe('QUJD');
    expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith('file:///photo.jpg', { encoding: 'base64' });
  });

  test('returns null when the read fails', async () => {
    FileSystem.readAsStringAsync.mockRejectedValue(new Error('no such file'));
    await expect(readImageBase64('file:///missing.jpg')).resolves.toBeNull();
  });

  test('returns null when the read never finishes', async () => {
    jest.useFakeTimers();
    FileSystem.readAsStringAsync.mockReturnValue(new Promise(() => {}));
    const result = readImageBase64('file:///slow.jpg', 1000);
    jest.advanceTimersByTime(1001);
    await expect(result).resolves.toBeNull();
  });
});

describe('expo-file-system imports', () => {
  // These exist only on 'expo-file-system/legacy' in SDK 54+.
  const LEGACY_ONLY = /\b(readAsStringAsync|writeAsStringAsync|getInfoAsync|deleteAsync|moveAsync|copyAsync|makeDirectoryAsync|readDirectoryAsync|downloadAsync|EncodingType|documentDirectory|cacheDirectory)\b/;

  function sourceFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === '__tests__' ? [] : sourceFiles(p);
      return /\.(js|jsx|ts|tsx)$/.test(e.name) ? [p] : [];
    });
  }

  test('no app code uses legacy-only APIs from the main expo-file-system entry', () => {
    const root = path.join(__dirname, '..', '..');
    const files = [...sourceFiles(path.join(root, 'src')), path.join(root, 'App.js')];
    const offenders = files.filter((f) => {
      const src = fs.readFileSync(f, 'utf8');
      const importsMain = /(^|\n)\s*import\s[^;]*?from\s*['"]expo-file-system['"]|require\(\s*['"]expo-file-system['"]\s*\)/.test(src);
      return importsMain && LEGACY_ONLY.test(src);
    });
    expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
  });
});
