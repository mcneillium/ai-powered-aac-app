// Tests for enhancedLogger — offline-first logging with Firebase sync.

jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key) => Promise.resolve(store[key] || null)),
      setItem: jest.fn((key, value) => {
        store[key] = value;
        return Promise.resolve();
      }),
    },
    _reset: () => { store = {}; },
  };
});

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: { uid: 'test-user' } })),
}));

jest.mock('firebase/database', () => ({
  ref: jest.fn(() => ({})),
  push: jest.fn(() => ({})),
  set: jest.fn(() => Promise.resolve()),
  serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
}));

jest.mock('../../firebaseConfig', () => ({
  db: {},
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
}));

describe('enhancedLogger', () => {
  beforeEach(() => {
    jest.resetModules();
    require('@react-native-async-storage/async-storage')._reset();
  });

  test('logEvent creates a log entry with required fields', async () => {
    const { logEvent } = require('../utils/enhancedLogger');
    const entry = await logEvent('test_action', { extra: 'data' });

    expect(entry).toBeDefined();
    expect(entry.action).toBe('test_action');
    expect(entry.extra).toBe('data');
    expect(entry.timestamp).toBeDefined();
    expect(entry.level).toBe('INFO');
  });

  test('logEvent respects log level filtering', async () => {
    const { logEvent, setLogLevel } = require('../utils/enhancedLogger');
    setLogLevel('error');

    // Info-level log should be filtered out
    const entry = await logEvent('info_action', {}, 'info');
    expect(entry).toBeNull();

    // Error-level log should pass through
    const errorEntry = await logEvent('error_action', {}, 'error');
    expect(errorEntry).toBeDefined();
    expect(errorEntry.action).toBe('error_action');
  });

  test('getLocalLogs returns stored logs', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const logs = [
      { action: 'action1', timestamp: 100, level: 'INFO' },
      { action: 'action2', timestamp: 200, level: 'ERROR' },
    ];
    await AsyncStorage.setItem('userInteractionLog', JSON.stringify(logs));

    const { getLocalLogs } = require('../utils/enhancedLogger');
    const result = await getLocalLogs(100);

    expect(result).toHaveLength(2);
    // Should be sorted by timestamp descending
    expect(result[0].timestamp).toBe(200);
  });

  test('clearLocalLogs empties the log store', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem('userInteractionLog', JSON.stringify([{ action: 'test' }]));

    const { clearLocalLogs, getLocalLogs } = require('../utils/enhancedLogger');
    await clearLocalLogs();

    const result = await getLocalLogs();
    expect(result).toHaveLength(0);
  });
});
