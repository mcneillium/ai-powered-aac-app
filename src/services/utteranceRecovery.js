// src/services/utteranceRecovery.js
//
// PROTOTYPE — behind the `utteranceRecovery` feature flag, default OFF.
//
// Persists the in-progress utterance so it survives an app kill.
//
// Composing a sentence can take a non-speaking user several minutes. Losing it
// to a crash, an Android low-memory kill, or an accidental app switch is not a
// minor annoyance — it is losing what they were in the middle of saying, in the
// middle of a conversation with someone who is waiting.
//
// Design notes:
//   - Writes are debounced and fire-and-forget. Nothing here may ever delay a
//     tap: the whole value of the board is that speech is instant.
//   - A draft expires. Restoring "I need the toilet" from three days ago into a
//     live conversation would be worse than losing it, so anything older than
//     the TTL is discarded on read.
//   - The draft is device-local (AsyncStorage) and never synced. An
//     in-progress, unspoken utterance is the most private thing in the app —
//     it is a thought the user has not yet chosen to say out loud.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@aac_utterance_draft';
export const DRAFT_TTL_MS = 30 * 60_000; // 30 minutes
const DEBOUNCE_MS = 400;
const MAX_WORDS = 100;

let pendingTimer = null;

/**
 * Save the current words. Debounced; safe to call on every tap.
 * @param {string[]} words
 */
export function saveDraft(words, { storage = AsyncStorage, now = () => Date.now() } = {}) {
  if (pendingTimer) clearTimeout(pendingTimer);
  if (!Array.isArray(words) || words.length === 0) {
    return clearDraft({ storage });
  }
  const payload = JSON.stringify({
    words: words.slice(0, MAX_WORDS),
    savedAt: now(),
  });
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    storage.setItem(STORAGE_KEY, payload).catch(() => {
      // A failed draft save must never surface to the user. Losing the draft is
      // the failure this feature exists to reduce, not one to interrupt them
      // about mid-sentence.
    });
  }, DEBOUNCE_MS);
  return Promise.resolve();
}

/** Flush any debounced write immediately — call on AppState background. */
export async function flushDraft(words, { storage = AsyncStorage, now = () => Date.now() } = {}) {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  if (!Array.isArray(words) || words.length === 0) return clearDraft({ storage });
  try {
    await storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ words: words.slice(0, MAX_WORDS), savedAt: now() }),
    );
  } catch {
    /* see saveDraft */
  }
}

/**
 * @returns {Promise<string[]|null>} the recovered words, or null if there is
 * nothing to recover or the draft has expired.
 */
export async function loadDraft({ storage = AsyncStorage, now = () => Date.now(), ttlMs = DRAFT_TTL_MS } = {}) {
  try {
    const raw = await storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.words) || parsed.words.length === 0) return null;
    if (!Number.isFinite(parsed.savedAt)) return null;
    if (now() - parsed.savedAt > ttlMs) {
      await clearDraft({ storage });
      return null;
    }
    return parsed.words.filter((w) => typeof w === 'string' && w.length > 0);
  } catch {
    // Corrupt draft: discard it rather than propagate. There is no scenario
    // where failing to restore a draft should stop the board from opening.
    await clearDraft({ storage });
    return null;
  }
}

export async function clearDraft({ storage = AsyncStorage } = {}) {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  try {
    await storage.removeItem(STORAGE_KEY);
  } catch {
    /* see saveDraft */
  }
}

export const _STORAGE_KEY = STORAGE_KEY;
