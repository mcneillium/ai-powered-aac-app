// A setting changed on a freshly signed-in device, before the first cloud
// snapshot arrives, must not replace the account's synced settings with this
// device's defaults: only the changed key is written (update, not set).
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('../../firebaseConfig', () => ({ db: { kind: 'db' }, auth: null, isFirebaseAvailable: () => true }));
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1', isAnonymous: false } }),
}));
jest.mock('firebase/database', () => ({
  ref: jest.fn((db, path) => ({ path })),
  onValue: jest.fn(() => () => {}), // no snapshot arrives during the test
  update: jest.fn(() => Promise.resolve()),
  set: jest.fn(() => Promise.resolve()),
}));

const fbdb = require('firebase/database');
const { SettingsProvider, useSettings, cloudPatchFor } = require('../contexts/SettingsContext');

describe('cloud settings writes', () => {
  test('cloudPatchFor keeps only changed, syncable keys', () => {
    expect(cloudPatchFor({ textScale: 1.5, compactLayout: true, speechVoice: 'v', x: undefined }))
      .toEqual({ textScale: 1.5 });
  });

  test('a change before the first snapshot writes only that key with update()', async () => {
    let ctx;
    const Probe = () => { ctx = useSettings(); return null; };
    await act(async () => {
      TestRenderer.create(<SettingsProvider><Probe /></SettingsProvider>);
    });
    await act(async () => { await ctx.updateSettings({ speechRate: 0.5 }); });

    expect(fbdb.set).not.toHaveBeenCalled();
    expect(fbdb.update).toHaveBeenCalledTimes(1);
    expect(fbdb.update.mock.calls[0][1]).toEqual({ speechRate: 0.5 });
    // Local state still has the full settings
    expect(ctx.settings.speechRate).toBe(0.5);
    expect(ctx.settings.theme).toBeDefined();
  });

  test('a device-only change writes nothing to the cloud', async () => {
    fbdb.update.mockClear();
    let ctx;
    const Probe = () => { ctx = useSettings(); return null; };
    await act(async () => {
      TestRenderer.create(<SettingsProvider><Probe /></SettingsProvider>);
    });
    await act(async () => { await ctx.updateSettings({ compactLayout: true }); });
    expect(fbdb.update).not.toHaveBeenCalled();
    expect(ctx.settings.compactLayout).toBe(true);
  });
});
