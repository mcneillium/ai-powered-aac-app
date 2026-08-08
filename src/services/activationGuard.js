// src/services/activationGuard.js
//
// PROTOTYPE — behind the `activationLockout` feature flag, default OFF.
//
// Post-activation lockout: after a button fires, ignore further activations of
// the board for a short window so an involuntary second contact cannot append
// and speak the same word twice.
//
// Why this and not a generic debounce: a debounce delays the *first* press,
// which is exactly wrong here — the first press must be instant, because
// perceived latency between tap and speech is what makes an AAC device feel
// like a voice rather than a form. This fires immediately and suppresses only
// what follows.
//
// The window is per-target by default. A user with a tremor who genuinely wants
// "no no no" should be able to say it; what they should not get is one press
// producing two words. Suppressing only repeats of the *same* target preserves
// deliberate repetition on a different button while catching the common case.
// `scope: 'global'` is available for users whose movement pattern needs it.

/** Sensible default. Clinical dwell/lockout settings commonly sit in 200–800ms. */
export const DEFAULT_LOCKOUT_MS = 350;
const MIN_LOCKOUT_MS = 0;
const MAX_LOCKOUT_MS = 3000;

export function createActivationGuard({
  lockoutMs = DEFAULT_LOCKOUT_MS,
  scope = 'target',
  now = () => Date.now(),
} = {}) {
  const window = Math.min(MAX_LOCKOUT_MS, Math.max(MIN_LOCKOUT_MS, lockoutMs));
  const lastByTarget = new Map();
  let lastGlobal = -Infinity;
  let suppressed = 0;

  return {
    /**
     * @param {string} targetId Stable id of the control being activated.
     * @returns {boolean} true if the activation should proceed.
     */
    shouldAccept(targetId = '*') {
      if (window === 0) return true;
      const t = now();
      const last = scope === 'global' ? lastGlobal : lastByTarget.get(targetId) ?? -Infinity;
      if (t - last < window) {
        suppressed += 1;
        return false;
      }
      lastGlobal = t;
      lastByTarget.set(targetId, t);
      return true;
    },

    /** Count of activations suppressed. For the debug screen; never logged with content. */
    suppressedCount() {
      return suppressed;
    },

    reset() {
      lastByTarget.clear();
      lastGlobal = -Infinity;
      suppressed = 0;
    },

    lockoutMs: window,
    scope,
  };
}
