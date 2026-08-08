// src/services/rateMetrics.js
//
// PROTOTYPE — behind the `rateMetrics` feature flag, default OFF.
//
// Words per minute and keystroke savings: the two measures AAC intervention is
// actually evaluated on in clinic, and the two this app collects neither of.
// An SLT reviewing whether a communication aid is working asks "is this person
// saying more, faster, with less effort than before?" — and today nothing in
// the system can answer that.
//
// PRIVACY: this module records **counts and milliseconds only**. No word, no
// phrase, no utterance text ever enters it, and its output is safe to sync and
// safe to show a caregiver. That constraint is why it takes `wordCount` and
// `characterCount` rather than the words themselves — the shape of the API is
// the guarantee.

/**
 * Keystroke savings rate, the standard AAC efficiency measure.
 *
 * KSR = (charactersProduced - selectionsMade) / charactersProduced × 100
 *
 * "I want a drink" produced by tapping four symbol buttons is
 * (14 - 4) / 14 = 71.4% — the user produced 14 characters' worth of message
 * with 4 physical actions.
 *
 * @returns {number} percentage in [0, 100]
 */
export function keystrokeSavings(charactersProduced, selectionsMade) {
  if (!Number.isFinite(charactersProduced) || charactersProduced <= 0) return 0;
  if (!Number.isFinite(selectionsMade) || selectionsMade < 0) return 0;
  const saved = (charactersProduced - selectionsMade) / charactersProduced;
  return Math.max(0, Math.min(100, saved * 100));
}

/**
 * Words per minute for one composed utterance.
 *
 * Deliberately measured from first selection to the moment the utterance is
 * spoken, not to the last selection: the pause before committing is part of
 * the real communication rate, and excluding it would flatter the number.
 *
 * @returns {number} words per minute, 0 when the span is not measurable
 */
export function wordsPerMinute(wordCount, elapsedMs) {
  if (!Number.isFinite(wordCount) || wordCount <= 0) return 0;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return (wordCount / elapsedMs) * 60_000;
}

/**
 * Accumulates per-utterance samples into a session summary.
 *
 * Bounded: keeps a rolling window rather than every sample for the life of the
 * install. Unbounded accumulation is the failure class this codebase has
 * already hit twice (the log queue, the AI profile), and it is not worth
 * repeating for a metric.
 */
export function createRateTracker({ maxSamples = 200, now = () => Date.now() } = {}) {
  let samples = [];
  let startedAt = null;
  let selections = 0;

  return {
    /** Call on the first selection of a new utterance. */
    beginUtterance() {
      startedAt = now();
      selections = 0;
    },

    /** Call on each selection. Takes a count, never the word. */
    recordSelection() {
      if (startedAt === null) startedAt = now();
      selections += 1;
    },

    /**
     * Call when the utterance is spoken.
     * @param {number} wordCount how many words were spoken
     * @param {number} characterCount how many characters those words contain
     */
    completeUtterance(wordCount, characterCount) {
      if (startedAt === null) return null;
      const elapsedMs = Math.max(0, now() - startedAt);
      const sample = {
        wordCount,
        characterCount,
        selections,
        elapsedMs,
        wpm: wordsPerMinute(wordCount, elapsedMs),
        ksr: keystrokeSavings(characterCount, selections),
      };
      samples.push(sample);
      if (samples.length > maxSamples) samples = samples.slice(-maxSamples);
      startedAt = null;
      selections = 0;
      return sample;
    },

    /** Session summary. Safe to display to a caregiver and safe to sync. */
    summary() {
      if (samples.length === 0) {
        return { utterances: 0, meanWpm: 0, meanKsr: 0, totalWords: 0, totalSelections: 0 };
      }
      const total = samples.reduce(
        (acc, s) => ({
          wpm: acc.wpm + s.wpm,
          ksr: acc.ksr + s.ksr,
          words: acc.words + s.wordCount,
          selections: acc.selections + s.selections,
        }),
        { wpm: 0, ksr: 0, words: 0, selections: 0 },
      );
      return {
        utterances: samples.length,
        meanWpm: total.wpm / samples.length,
        meanKsr: total.ksr / samples.length,
        totalWords: total.words,
        totalSelections: total.selections,
      };
    },

    reset() {
      samples = [];
      startedAt = null;
      selections = 0;
    },
  };
}
