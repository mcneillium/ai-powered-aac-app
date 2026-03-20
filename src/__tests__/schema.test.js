// Tests for shared schema — ensures schema constants are correct
// and helper functions work as expected across app and dashboard.

describe('shared/schema', () => {
  const schema = require('../shared/schema');

  test('DB_PATHS has all required paths', () => {
    expect(schema.DB_PATHS.USERS).toBe('users');
    expect(schema.DB_PATHS.USER_SETTINGS).toBe('userSettings');
    expect(schema.DB_PATHS.USER_LOGS).toBe('userLogs');
    expect(schema.DB_PATHS.SESSIONS).toBe('sessions');
    expect(schema.DB_PATHS.FEEDBACK).toBe('feedback');
    expect(schema.DB_PATHS.FINE_TUNE_METRICS).toBe('fineTuneMetrics');
  });

  test('COLLECTIONS is an alias for DB_PATHS', () => {
    expect(schema.COLLECTIONS).toBe(schema.DB_PATHS);
  });

  test('dbPath joins segments correctly', () => {
    expect(schema.dbPath('users', 'abc123')).toBe('users/abc123');
    expect(schema.dbPath('userSettings', 'uid', 'theme')).toBe('userSettings/uid/theme');
  });

  test('getUserDisplayName returns name or email fallback', () => {
    expect(schema.getUserDisplayName({ name: 'Alice', email: 'a@b.com' })).toBe('Alice');
    expect(schema.getUserDisplayName({ email: 'bob@test.com' })).toBe('bob@test.com');
    expect(schema.getUserDisplayName({})).toBe('Unknown User');
  });

  test('isCaregiver checks role correctly', () => {
    expect(schema.isCaregiver({ role: 'caregiver' })).toBe(true);
    expect(schema.isCaregiver({ role: 'admin' })).toBe(true);
    expect(schema.isCaregiver({ role: 'user' })).toBe(false);
    expect(schema.isCaregiver({})).toBe(false);
  });

  test('getLogUserId extracts user ID from log entry', () => {
    expect(schema.getLogUserId({ targetUserId: 'uid1' })).toBe('uid1');
    expect(schema.getLogUserId({ userId: 'uid2' })).toBe('uid2');
    expect(schema.getLogUserId({})).toBeFalsy();
  });

  test('ROLES has all expected roles', () => {
    expect(schema.ROLES.USER).toBe('user');
    expect(schema.ROLES.CAREGIVER).toBe('caregiver');
    expect(schema.ROLES.ADMIN).toBe('admin');
  });
});
