/* eslint-env node, jest */
// Firebase security rules: behaviour tests against the LOCAL emulators only.
//
// Run with `npm run test:rules` (needs JDK 21+). It starts the Realtime
// Database and Storage emulators for the project "demo-voice-rules". A
// "demo-" project id is local-only by design: the emulators never contact a
// real Firebase project and no credentials are used. The guard below refuses
// to run otherwise.
//
// Cases = docs/release/deployment-checklist.md §1a (database) and §1b
// (storage), plus the shapes the app actually writes, so a rules change that
// would reject the app's own data fails here before any deploy.

const { readFileSync } = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { ref, set, update, push, get } = require('firebase/database');
const { ref: storageRef, uploadBytes } = require('firebase/storage');

const PROJECT_ID = 'demo-voice-rules';
const ROOT = path.resolve(__dirname, '..');
const UID = 'alice';

function emulatorHost(variable, value) {
  if (!value) {
    throw new Error(`${variable} is not set. Run these tests with "npm run test:rules", which starts the local emulators.`);
  }
  const [host, port] = value.split(':');
  if (!/^(127\.0\.0\.1|localhost|::1)$/.test(host)) {
    throw new Error(`${variable}=${value} is not a local emulator; refusing to run.`);
  }
  return { host, port: Number(port) };
}

let env;
let alice;
let guest;
let signedOut;

beforeAll(async () => {
  if (!PROJECT_ID.startsWith('demo-')) throw new Error('Rules tests must use a demo- project.');
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    database: {
      rules: readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8'),
      ...emulatorHost('FIREBASE_DATABASE_EMULATOR_HOST', process.env.FIREBASE_DATABASE_EMULATOR_HOST),
    },
    storage: {
      rules: readFileSync(path.join(ROOT, 'storage.rules'), 'utf8'),
      ...emulatorHost('FIREBASE_STORAGE_EMULATOR_HOST', process.env.FIREBASE_STORAGE_EMULATOR_HOST),
    },
  });
  alice = env.authenticatedContext(UID, { firebase: { sign_in_provider: 'password' } });
  guest = env.authenticatedContext('guest1', { firebase: { sign_in_provider: 'anonymous' } });
  signedOut = env.unauthenticatedContext();
});

afterAll(async () => {
  if (env) await env.cleanup();
});

beforeEach(async () => {
  await env.clearDatabase();
});

const db = (ctx) => ctx.database();
const storage = (ctx) => ctx.storage(`${PROJECT_ID}.appspot.com`);
const bytes = (mb) => new Uint8Array(mb * 1024 * 1024);

const goodLog = {
  action: 'playground_test',
  timestamp: 1754300000000,
  level: 'INFO',
  sessionId: 'session_playground',
  carerId: UID,
  targetUserId: UID,
  deviceInfo: { platform: 'android', appVersion: '1.2.0' },
};

describe('database rules: checklist §1a', () => {
  test('userLogs: a whitelisted entry is allowed', async () => {
    await assertSucceeds(set(ref(db(alice), `userLogs/${UID}/testId`), goodLog));
  });

  test('userLogs: an unlisted field is denied', async () => {
    await assertFails(set(ref(db(alice), `userLogs/${UID}/t2`), { ...goodLog, junkField: 'should-be-rejected' }));
  });

  test('userLogs: an unlisted deviceInfo field is denied', async () => {
    await assertFails(set(ref(db(alice), `userLogs/${UID}/t3`), {
      action: 'playground_test',
      timestamp: 1754300000000,
      deviceInfo: { platform: 'android', appVersion: '1.2.0', imei: '123456' },
    }));
  });

  test('feedback: an entry is allowed', async () => {
    await assertSucceeds(set(ref(db(alice), `feedback/${UID}/e1`), { feedback: 'playground test', timestamp: 1754300000000 }));
  });

  test('feedback: an unlisted field is denied', async () => {
    await assertFails(set(ref(db(alice), `feedback/${UID}/e2`), { feedback: 'x', timestamp: 1, junkField: 'x' }));
  });
});

describe('database rules: what the app writes', () => {
  test('logEvent push with serverTimestamp is allowed', async () => {
    await assertSucceeds(push(ref(db(alice), `userLogs/${UID}`), { ...goodLog, serverTimestamp: { '.sv': 'timestamp' } }));
  });

  test('the logs_synced summary is allowed', async () => {
    await assertSucceeds(push(ref(db(alice), `userLogs/${UID}`), {
      action: 'logs_synced', count: 3, timestamp: 1, carerId: UID, serverTimestamp: { '.sv': 'timestamp' },
    }));
  });

  test('a settings patch with Voice 2 keys is allowed', async () => {
    await assertSucceeds(update(ref(db(alice), `userSettings/${UID}`), {
      uiMode: 'child',
      boardLayout: 'studio',
      personalLearning: true,
      modeProfiles: { child: { theme: 'light', symbolStyle: 'symbols' } },
      gridSize: 4,
      textScale: 1.25,
    }));
  });

  test('a custom word (own tile) is allowed', async () => {
    await assertSucceeds(set(ref(db(alice), `customVocab/${UID}`), {
      items: [{ id: '1', word: 'grandma', category: 'noun', source: 'manual', createdAt: 1, updatedAt: 1 }],
      deletedIds: { 9: 1 },
    }));
  });

  test('userSync lastActivity is allowed', async () => {
    await assertSucceeds(set(ref(db(alice), `userSync/${UID}`), { lastActivity: new Date(0).toISOString() }));
  });

  test("another user's logs are denied", async () => {
    await assertFails(set(ref(db(alice), 'userLogs/bob/x'), goodLog));
  });

  test('a signed-out write is denied', async () => {
    await assertFails(set(ref(db(signedOut), `userLogs/${UID}/x`), goodLog));
  });

  test('an unknown top-level path is denied', async () => {
    await assertFails(set(ref(db(alice), `sessions/${UID}/x`), { a: 1 }));
  });

  test('feedback cannot be read back', async () => {
    await assertFails(get(ref(db(alice), `feedback/${UID}`)));
  });
});

describe('storage rules: checklist §1b', () => {
  test('own 1 MB JPEG is allowed', async () => {
    await assertSucceeds(uploadBytes(storageRef(storage(alice), `users/${UID}/x.jpg`), bytes(1), { contentType: 'image/jpeg' }));
  });

  test('10 MB is denied (5 MB cap)', async () => {
    await assertFails(uploadBytes(storageRef(storage(alice), `users/${UID}/big.jpg`), bytes(10), { contentType: 'image/jpeg' }));
  });

  test('a PDF is denied (images only)', async () => {
    await assertFails(uploadBytes(storageRef(storage(alice), `users/${UID}/x.pdf`), bytes(1), { contentType: 'application/pdf' }));
  });

  test("someone else's folder is denied", async () => {
    await assertFails(uploadBytes(storageRef(storage(alice), 'users/someone-else/x.jpg'), bytes(1), { contentType: 'image/jpeg' }));
  });

  test('an anonymous (guest) upload is denied', async () => {
    await assertFails(uploadBytes(storageRef(storage(guest), 'users/guest1/x.jpg'), bytes(1), { contentType: 'image/jpeg' }));
  });
});
