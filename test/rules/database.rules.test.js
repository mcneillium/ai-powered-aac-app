/**
 * Realtime Database security rules — behavioural tests against the emulator.
 *
 * Replaces the manual Rules Playground checklist in
 * docs/release/deployment-checklist.md §1a. Manual clicking does not survive
 * contact with a busy week; this does.
 *
 * The ALLOW control cases come first, deliberately. A DENY case that passes
 * means nothing until you have proven that something is allowed — otherwise
 * you are only observing that everything is denied, which a syntax error would
 * also produce.
 */

const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { makeTestEnv, UIDS, validLogEntry, validFeedbackEntry, validVocabItem } = require('./helpers');

let testEnv;

beforeAll(async () => {
  testEnv = await makeTestEnv();
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  if (testEnv) await testEnv.clearDatabase();
});

const asAlice = () => testEnv.authenticatedContext(UIDS.alice).database();
const asBob = () => testEnv.authenticatedContext(UIDS.bob).database();
const asCarer = () => testEnv.authenticatedContext(UIDS.carer).database();
const asGuest = () => testEnv.unauthenticatedContext().database();

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONTROL CASES — something must be allowed, or nothing below means anything
// ─────────────────────────────────────────────────────────────────────────────

describe('control: an owner can use their own data', () => {
  test('alice writes and reads her own profile', async () => {
    const db = asAlice();
    await assertSucceeds(
      db.ref(`users/${UIDS.alice}`).set({
        name: 'Alice',
        email: 'alice@example.test',
        role: 'user',
        createdAt: 1_754_300_000_000,
      }),
    );
    await assertSucceeds(db.ref(`users/${UIDS.alice}`).get());
  });

  test('alice writes a well-formed log entry', async () => {
    await assertSucceeds(asAlice().ref(`userLogs/${UIDS.alice}/log1`).set(validLogEntry()));
  });

  test('alice writes her own settings', async () => {
    await assertSucceeds(
      asAlice().ref(`userSettings/${UIDS.alice}`).set({ theme: 'dark', gridSize: 3 }),
    );
  });

  test('alice writes a well-formed custom vocab item', async () => {
    await assertSucceeds(
      asAlice().ref(`customVocab/${UIDS.alice}/items/0`).set(validVocabItem()),
    );
  });

  test('alice submits feedback', async () => {
    await assertSucceeds(
      asAlice().ref(`feedback/${UIDS.alice}/entry1`).set(validFeedbackEntry()),
    );
  });

  test('alice writes her sync heartbeat', async () => {
    await assertSucceeds(
      asAlice().ref(`userSync/${UIDS.alice}/lastActivity`).set('2026-08-08T22:00:00.000Z'),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. UNAUTHENTICATED ACCESS — every top-level node
// ─────────────────────────────────────────────────────────────────────────────

describe('unauthenticated access is denied everywhere', () => {
  const NODES = [
    'users',
    'userSettings',
    'customVocab',
    'vocabRequests',
    'userSync',
    'userLogs',
    'feedback',
    'sessions',
    'fineTuneMetrics',
  ];

  test.each(NODES)('cannot read /%s/{uid}', async (node) => {
    await assertFails(asGuest().ref(`${node}/${UIDS.alice}`).get());
  });

  test.each(NODES)('cannot write /%s/{uid}', async (node) => {
    await assertFails(asGuest().ref(`${node}/${UIDS.alice}`).set({ x: 1 }));
  });

  test('cannot read the database root', async () => {
    await assertFails(asGuest().ref('/').get());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. CROSS-USER ACCESS — the boundary that matters most
// ─────────────────────────────────────────────────────────────────────────────

describe('one signed-in user cannot reach another user', () => {
  const OWNED = ['users', 'userSettings', 'customVocab', 'vocabRequests', 'userSync', 'userLogs'];

  test.each(OWNED)('bob cannot read alice /%s', async (node) => {
    await assertFails(asBob().ref(`${node}/${UIDS.alice}`).get());
  });

  test.each(OWNED)('bob cannot write alice /%s', async (node) => {
    await assertFails(asBob().ref(`${node}/${UIDS.alice}`).set({ x: 1 }));
  });

  test('bob cannot write a log entry attributed to alice', async () => {
    await assertFails(asBob().ref(`userLogs/${UIDS.alice}/log1`).set(validLogEntry()));
  });

  test('nobody can read feedback, not even its author', async () => {
    // `.read: false` on feedback/$uid is deliberate — feedback is drained
    // server-side. This test exists so that if someone loosens it, they have to
    // do it on purpose.
    await assertSucceeds(asAlice().ref(`feedback/${UIDS.alice}/e1`).set(validFeedbackEntry()));
    await assertFails(asAlice().ref(`feedback/${UIDS.alice}`).get());
  });

  test('the database root is not readable by a signed-in user', async () => {
    await assertFails(asAlice().ref('/').get());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. CAREGIVER ACCESS
//
// These tests encode what the rules ACTUALLY do today, which is: a caregiver
// has no more access than any other stranger. The dashboard's caregiver views
// therefore cannot read a linked user's data directly through these rules.
// If caregiver access is later added, `linked caregiver` must flip to
// assertSucceeds and `unlinked caregiver` must stay assertFails — that pair is
// the whole point of the boundary.
// ─────────────────────────────────────────────────────────────────────────────

describe('caregiver boundary', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.database();
      await db.ref(`users/${UIDS.alice}`).set({
        name: 'Alice',
        email: 'alice@example.test',
        role: 'user',
        createdAt: 1,
        caregiverId: UIDS.carer,
      });
      await db.ref(`userLogs/${UIDS.alice}/log1`).set(validLogEntry());
    });
  });

  test('an UNLINKED caregiver cannot read the user (must always deny)', async () => {
    await assertFails(testEnv.authenticatedContext(UIDS.unlinkedCarer).database()
      .ref(`userLogs/${UIDS.alice}`).get());
  });

  test('a LINKED caregiver also cannot read the user — no caregiver rule exists', async () => {
    // Documents current behaviour, and pins it. See BACKLOG: the dashboard
    // caregiver views depend on access this rules file does not grant.
    await assertFails(asCarer().ref(`userLogs/${UIDS.alice}`).get());
  });

  test('a caregiver cannot write into a linked user (must always deny)', async () => {
    await assertFails(asCarer().ref(`userSettings/${UIDS.alice}`).set({ theme: 'dark' }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. SHAPE VALIDATION — malformed writes must be rejected, not just unowned ones
// ─────────────────────────────────────────────────────────────────────────────

describe('userLogs validation', () => {
  test('rejects an unknown top-level field', async () => {
    await assertFails(
      asAlice().ref(`userLogs/${UIDS.alice}/log1`).set(validLogEntry({ junkField: 'nope' })),
    );
  });

  test('rejects an unknown nested deviceInfo field', async () => {
    await assertFails(
      asAlice().ref(`userLogs/${UIDS.alice}/log1`).set(
        validLogEntry({ deviceInfo: { platform: 'android', appVersion: '1.2.0', imei: '123456' } }),
      ),
    );
  });

  test('rejects a missing required field (action)', async () => {
    const entry = validLogEntry();
    delete entry.action;
    await assertFails(asAlice().ref(`userLogs/${UIDS.alice}/log1`).set(entry));
  });

  test('rejects a missing required field (timestamp)', async () => {
    const entry = validLogEntry();
    delete entry.timestamp;
    await assertFails(asAlice().ref(`userLogs/${UIDS.alice}/log1`).set(entry));
  });

  test('rejects a non-numeric timestamp', async () => {
    await assertFails(
      asAlice().ref(`userLogs/${UIDS.alice}/log1`).set(validLogEntry({ timestamp: 'yesterday' })),
    );
  });

  test('rejects an over-long action string', async () => {
    await assertFails(
      asAlice().ref(`userLogs/${UIDS.alice}/log1`).set(validLogEntry({ action: 'x'.repeat(201) })),
    );
  });

  test('rejects utterance content smuggled into an unlisted field', async () => {
    // The failure this guards against: a well-meaning caller adding
    // `{ utterance: 'I need the toilet' }` to a log payload.
    await assertFails(
      asAlice().ref(`userLogs/${UIDS.alice}/log1`).set(
        validLogEntry({ utterance: 'I need the toilet' }),
      ),
    );
  });
});

describe('feedback validation', () => {
  test('rejects an unknown field', async () => {
    await assertFails(
      asAlice().ref(`feedback/${UIDS.alice}/e1`).set(validFeedbackEntry({ junkField: 'x' })),
    );
  });

  test('rejects empty feedback text', async () => {
    await assertFails(
      asAlice().ref(`feedback/${UIDS.alice}/e1`).set(validFeedbackEntry({ feedback: '' })),
    );
  });

  test('rejects feedback over 5000 characters', async () => {
    await assertFails(
      asAlice().ref(`feedback/${UIDS.alice}/e1`).set(validFeedbackEntry({ feedback: 'x'.repeat(5001) })),
    );
  });
});

describe('customVocab validation', () => {
  test('rejects an item with an unknown category', async () => {
    await assertFails(
      asAlice().ref(`customVocab/${UIDS.alice}/items/0`).set(validVocabItem({ category: 'weapon' })),
    );
  });

  test('rejects an item missing required children', async () => {
    await assertFails(asAlice().ref(`customVocab/${UIDS.alice}/items/0`).set({ word: 'biscuit' }));
  });

  test('rejects an empty word', async () => {
    await assertFails(
      asAlice().ref(`customVocab/${UIDS.alice}/items/0`).set(validVocabItem({ word: '' })),
    );
  });

  test('rejects a word over 100 characters', async () => {
    await assertFails(
      asAlice().ref(`customVocab/${UIDS.alice}/items/0`).set(validVocabItem({ word: 'x'.repeat(101) })),
    );
  });
});

describe('users validation', () => {
  test('rejects a role outside the allowed set', async () => {
    await assertFails(
      asAlice().ref(`users/${UIDS.alice}/role`).set('superadmin'),
    );
  });

  test("rejects 'admin' — the rules only permit user|caregiver", async () => {
    // schema.js ROLES exports ADMIN: 'admin', but no client can ever write it.
    // Pinned so the mismatch is visible rather than mysterious.
    await assertFails(asAlice().ref(`users/${UIDS.alice}/role`).set('admin'));
  });

  test('rejects a name over 100 characters', async () => {
    await assertFails(asAlice().ref(`users/${UIDS.alice}/name`).set('x'.repeat(101)));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. PATHS WITH NO RULE — must fall through to the deny-all catch-all
// ─────────────────────────────────────────────────────────────────────────────

describe('unruled paths fall through to $other deny-all', () => {
  // schema.js documents both of these as live paths. Neither has a rule, so
  // both are denied to every client. The dashboard has a FineTuneMetrics page.
  test.each(['sessions', 'fineTuneMetrics', 'alerts', 'customBoards', 'favorites', 'systemConfig'])(
    'authenticated user cannot read /%s',
    async (node) => {
      await assertFails(asAlice().ref(`${node}/${UIDS.alice}`).get());
    },
  );

  test('authenticated user cannot write an arbitrary new top-level node', async () => {
    await assertFails(asAlice().ref('somethingNew/x').set({ a: 1 }));
  });
});
