// Tests that firebaseConfig validates env vars at import time.
// We mock Firebase modules to avoid actual SDK initialization.

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
  getApp: jest.fn(),
}));
jest.mock('firebase/database', () => ({
  getDatabase: jest.fn(() => ({})),
}));
jest.mock('firebase/auth', () => ({
  initializeAuth: jest.fn(() => ({})),
  getAuth: jest.fn(() => ({})),
  getReactNativePersistence: jest.fn(() => ({})),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {},
}));

describe('firebaseConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  test('logs error when env vars are missing', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    delete process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
    delete process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

    require('../../firebaseConfig');

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('missing env vars')
    );
    spy.mockRestore();
  });
});
