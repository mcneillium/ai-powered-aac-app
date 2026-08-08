/**
 * Shared setup for the Realtime Database rules suite.
 *
 * Every test goes through the emulator with the *real* `database.rules.json`.
 * That is the point: a rules test that runs against a paraphrase of the rules
 * tests the paraphrase.
 */

const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');

const RULES_PATH = path.resolve(__dirname, '..', '..', 'database.rules.json');

/** Stable uids so a failing test names a recognisable actor. */
const UIDS = {
  alice: 'uid-alice-owner',
  bob: 'uid-bob-stranger',
  carer: 'uid-carer-linked',
  unlinkedCarer: 'uid-carer-unlinked',
};

async function makeTestEnv() {
  return initializeTestEnvironment({
    projectId: 'commai-rules-test',
    database: {
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 9000,
    },
  });
}

/** A log entry that satisfies every validator in the rules. The happy path. */
function validLogEntry(overrides = {}) {
  return {
    action: 'board_tap',
    timestamp: 1_754_300_000_000,
    level: 'INFO',
    sessionId: 'session_test',
    targetUserId: UIDS.alice,
    carerId: UIDS.carer,
    deviceInfo: { platform: 'android', appVersion: '1.2.0' },
    ...overrides,
  };
}

function validFeedbackEntry(overrides = {}) {
  return {
    feedback: 'the board is good',
    timestamp: 1_754_300_000_000,
    ...overrides,
  };
}

function validVocabItem(overrides = {}) {
  return {
    id: 'item-1',
    word: 'biscuit',
    category: 'noun',
    source: 'custom',
    createdAt: 1_754_300_000_000,
    updatedAt: 1_754_300_000_000,
    ...overrides,
  };
}

module.exports = { makeTestEnv, UIDS, validLogEntry, validFeedbackEntry, validVocabItem, RULES_PATH };
