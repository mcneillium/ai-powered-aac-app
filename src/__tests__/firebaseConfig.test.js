// firebaseConfig must never throw: missing or invalid cloud configuration
// disables cloud features but leaves local communication working.

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
  getApp: jest.fn(),
}));
jest.mock('firebase/database', () => ({
  getDatabase: jest.fn(() => ({ kind: 'db' })),
}));
jest.mock('firebase/auth', () => ({
  initializeAuth: jest.fn(() => ({ kind: 'auth' })),
  getAuth: jest.fn(() => ({ kind: 'auth' })),
  getReactNativePersistence: jest.fn(() => ({})),
}));

const FULL_ENV = {
  EXPO_PUBLIC_FIREBASE_API_KEY: 'key',
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
  EXPO_PUBLIC_FIREBASE_DATABASE_URL: 'https://demo-default-rtdb.firebaseio.com',
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'demo',
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo.appspot.com',
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '1',
  EXPO_PUBLIC_FIREBASE_APP_ID: '1:1:web:1',
};

describe('firebaseConfig', () => {
  const originalEnv = { ...process.env };
  let errorSpy;

  beforeEach(() => {
    jest.resetModules();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    errorSpy.mockRestore();
  });

  function load(env) {
    process.env = { ...originalEnv };
    Object.keys(FULL_ENV).forEach(k => delete process.env[k]);
    Object.assign(process.env, env);
    return require('../../firebaseConfig');
  }

  test('missing env vars: does not throw, cloud disabled, Firebase never initialised', () => {
    const cfg = load({});
    expect(cfg.db).toBeNull();
    expect(cfg.auth).toBeNull();
    expect(cfg.isFirebaseAvailable()).toBe(false);
    expect(cfg.firebaseStatus.reason).toBe('not-configured');
    expect(require('firebase/app').initializeApp).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('missing env vars'));
  });

  test('malformed databaseURL is treated as not configured', () => {
    const cfg = load({ ...FULL_ENV, EXPO_PUBLIC_FIREBASE_DATABASE_URL: 'not a url' });
    expect(cfg.isFirebaseAvailable()).toBe(false);
    expect(cfg.db).toBeNull();
  });

  test('initialisation that throws is caught and isolated', () => {
    require('firebase/database').getDatabase.mockImplementationOnce(() => {
      throw new Error("FIREBASE FATAL ERROR: Can't determine Firebase Database URL");
    });
    let cfg;
    expect(() => { cfg = load(FULL_ENV); }).not.toThrow();
    expect(cfg.isFirebaseAvailable()).toBe(false);
    expect(cfg.firebaseStatus.reason).toBe('init-failed');
    expect(cfg.db).toBeNull();
    expect(cfg.auth).toBeNull();
  });

  test('valid config initialises db and auth', () => {
    const cfg = load(FULL_ENV);
    expect(cfg.isFirebaseAvailable()).toBe(true);
    expect(cfg.db).toEqual({ kind: 'db' });
    expect(cfg.auth).toEqual({ kind: 'auth' });
  });
});
