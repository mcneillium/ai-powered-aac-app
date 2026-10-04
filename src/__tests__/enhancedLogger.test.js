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

// The logger reads the signed-in user from firebaseConfig (null when cloud is
// not configured), so the sync tests need a signed-in, non-anonymous user here.
jest.mock('../../firebaseConfig', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-user', isAnonymous: false } },
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
    const entry = await logEvent('test_action', { error: 'auth/wrong-password' });

    expect(entry).toBeDefined();
    expect(entry.action).toBe('test_action');
    expect(entry.error).toBe('auth/wrong-password');
    expect(entry.timestamp).toBeDefined();
    expect(entry.level).toBe('INFO');
  });

  // database.rules.json ends userLogs/$uid/$logId with `"$other": false`, so an
  // unlisted field makes the write fail — and syncLogsToFirebase only clears
  // AsyncStorage after every entry resolves, so one such entry wedges sync
  // permanently. logEvent must drop unknown metadata keys before they get there.
  test('logEvent drops metadata keys the database rules do not whitelist', async () => {
    const { logEvent } = require('../utils/enhancedLogger');
    const entry = await logEvent('test_action', {
      error: 'auth/wrong-password',
      count: 3,
      extra: 'data',
      screen: 'Login',
    });

    expect(entry.error).toBe('auth/wrong-password');
    expect(entry.count).toBe(3);
    expect(entry.extra).toBeUndefined();
    expect(entry.screen).toBeUndefined();
  });

  // Metadata is spread before the fields logEvent owns, so a caller cannot
  // replace them with a value the rules' type validators would reject.
  test('logEvent metadata cannot override its own authoritative fields', async () => {
    const { logEvent } = require('../utils/enhancedLogger');
    const entry = await logEvent('real_action', {
      action: 'spoofed_action',
      timestamp: 1,
      deviceInfo: { imei: '123456' },
    });

    expect(entry.action).toBe('real_action');
    expect(entry.timestamp).not.toBe(1);
    expect(entry.deviceInfo.imei).toBeUndefined();
    expect(entry.deviceInfo.platform).toBeDefined();
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

  // A write the rules reject fails identically forever. syncLogsToFirebase used
  // to await Promise.all and only clear AsyncStorage on total success, so one
  // rejected entry blocked every later sync on that device permanently.
  test('syncLogsToFirebase drops entries rejected by the database rules', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const database = require('firebase/database');
    await AsyncStorage.setItem('userInteractionLog', JSON.stringify([
      { action: 'good_entry', timestamp: 100 },
      { action: 'poison_entry', timestamp: 200 },
    ]));

    database.set.mockImplementation((_ref, value) => {
      if (value.action === 'poison_entry') {
        const err = new Error('PERMISSION_DENIED: Permission denied');
        err.code = 'PERMISSION_DENIED';
        return Promise.reject(err);
      }
      return Promise.resolve();
    });

    const { syncLogsToFirebase } = require('../utils/enhancedLogger');
    const result = await syncLogsToFirebase();

    expect(result).toBe(true);
    const remaining = JSON.parse(await AsyncStorage.getItem('userInteractionLog'));
    expect(remaining).toHaveLength(0);
  });

  // The opposite case: a transient failure must not lose the entry.
  test('syncLogsToFirebase keeps entries that failed for transient reasons', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const database = require('firebase/database');
    await AsyncStorage.setItem('userInteractionLog', JSON.stringify([
      { action: 'good_entry', timestamp: 100 },
      { action: 'flaky_entry', timestamp: 200 },
    ]));

    database.set.mockImplementation((_ref, value) => {
      if (value.action === 'flaky_entry') {
        return Promise.reject(new Error('Network request failed'));
      }
      return Promise.resolve();
    });

    const { syncLogsToFirebase } = require('../utils/enhancedLogger');
    const result = await syncLogsToFirebase();

    expect(result).toBe(false);
    const remaining = JSON.parse(await AsyncStorage.getItem('userInteractionLog'));
    expect(remaining).toHaveLength(1);
    expect(remaining[0].action).toBe('flaky_entry');
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
