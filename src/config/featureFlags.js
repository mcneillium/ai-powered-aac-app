// src/config/featureFlags.js
//
// Feature flags for work that ships dark.
//
// Every flag here defaults to **false**. A prototype that is on by default is
// not a prototype, it is a change — and in an AAC product a change to the
// communication surface without a device test is not a trade worth making.
//
// There was no flag infrastructure before this. It is deliberately the smallest
// thing that works: a frozen object of booleans, overridable at runtime for
// tests and for a future debug screen. No remote config, no network, no
// dependency — an AAC device must behave identically offline, so a flag that
// could change underneath the user would be a liability rather than a feature.
//
// To turn one on for a build: edit the default below and rebuild. To try one
// without a rebuild: call `setFeatureFlag(name, true)` from a dev build.

const DEFAULTS = Object.freeze({
  /**
   * Persist the in-progress utterance so it survives an app kill.
   *
   * Why it matters here specifically: composing a sentence can take a
   * non-speaking user several minutes. Losing it to a crash, a low-memory kill,
   * or an accidental app switch is not a minor annoyance — it is losing what
   * they were in the middle of saying, mid-conversation.
   * Prototype: src/services/utteranceRecovery.js
   */
  utteranceRecovery: false,

  /**
   * Track words-per-minute and keystroke savings.
   *
   * These are the measures AAC is clinically evaluated on, and the app collects
   * neither. Counts and milliseconds only — never utterance content.
   * Prototype: src/services/rateMetrics.js
   */
  rateMetrics: false,

  /**
   * Post-activation lockout, so a tremor cannot double-fire a word.
   *
   * The board currently has a bare onPress with no debounce: two involuntary
   * taps append the word twice and speak it twice. This is the single most
   * requested motor-access affordance in AAC and the app has none of the four
   * (dwell, hold-to-select, release-to-activate, lockout) except the one
   * TouchableOpacity gives for free.
   * Prototype: src/services/activationGuard.js
   */
  activationLockout: false,
});

const overrides = new Map();

/** @param {keyof typeof DEFAULTS} name */
export function isFeatureEnabled(name) {
  if (overrides.has(name)) return overrides.get(name);
  return DEFAULTS[name] ?? false;
}

/**
 * Runtime override. Intended for tests and a dev-build debug screen; there is
 * deliberately no persistence, so a flag flipped at runtime does not survive a
 * restart and cannot strand a user in an experimental state.
 */
export function setFeatureFlag(name, value) {
  if (!(name in DEFAULTS)) {
    throw new Error(`Unknown feature flag: ${name}`);
  }
  overrides.set(name, Boolean(value));
}

export function resetFeatureFlags() {
  overrides.clear();
}

export function listFeatureFlags() {
  return Object.keys(DEFAULTS).map((name) => ({
    name,
    default: DEFAULTS[name],
    effective: isFeatureEnabled(name),
    overridden: overrides.has(name),
  }));
}

export const FEATURE_FLAG_DEFAULTS = DEFAULTS;
