// src/contexts/experience.js
// Child and Adult experiences, and the board layout choice.
//
// A mode is a presentation and workflow choice made explicitly by the user
// (or someone supporting them). It is never inferred, and it is not an
// assessment of ability: every word, setting and feature is available in both.
//
// Each mode keeps its own copy of a few presentation settings
// (PER_MODE_KEYS). Everything else — vocabulary, favourites, history,
// pronunciations, voice, scanning, learning — is shared, so switching mode
// never loses anything.
//
// Pure functions only (no React), so they can be unit-tested.

export const MODES = ['child', 'adult'];

// Presentation settings that each mode keeps separately.
export const PER_MODE_KEYS = [
  'theme',
  'textScale',
  'gridSize',
  'symbolStyle',      // 'symbols' | 'mixed' | 'text'
  'speakWordsOnTap',
  'predictionEnabled',
  'showVoiceStyles',
];

// Starting values for a mode the first time it is used. The user's own
// accessibility choices (theme, text size, speech on tap, suggestions) are
// carried over; only layout density and symbol emphasis differ.
export const MODE_DEFAULTS = {
  child: { gridSize: 3, symbolStyle: 'symbols', showVoiceStyles: false },
  adult: { gridSize: 4, symbolStyle: 'mixed', showVoiceStyles: false },
};

const CARRIED_KEYS = ['theme', 'textScale', 'speakWordsOnTap', 'predictionEnabled'];

/** Values a mode starts with, based on the current (flat) settings. */
export function initialModeProfile(mode, flat) {
  const carried = {};
  CARRIED_KEYS.forEach((k) => { if (flat[k] !== undefined) carried[k] = flat[k]; });
  return { ...carried, ...(MODE_DEFAULTS[mode] || {}) };
}

/**
 * The settings every screen reads: stored (flat) settings with the active
 * mode's own presentation settings on top. Without a chosen mode (existing
 * users who have not opted in) the stored settings are returned unchanged.
 */
export function effectiveSettings(stored) {
  const mode = stored && stored.uiMode;
  if (!MODES.includes(mode)) return stored;
  const profile = (stored.modeProfiles && stored.modeProfiles[mode]) || null;
  if (!profile) return stored;
  return { ...stored, ...profile };
}

/**
 * Turn a settings update into the patch to store. Per-mode keys go into the
 * active mode's profile; switching mode creates the target profile the first
 * time, so the user's current choices carry over and nothing is reset.
 */
export function routeSettingsUpdate(stored, updates) {
  const next = { ...stored };
  const updatesCopy = { ...updates };

  if (updatesCopy.uiMode !== undefined && MODES.includes(updatesCopy.uiMode)) {
    const target = updatesCopy.uiMode;
    const profiles = { ...(next.modeProfiles || {}) };
    if (!profiles[target]) profiles[target] = initialModeProfile(target, effectiveSettings(stored));
    next.modeProfiles = profiles;
    next.uiMode = target;
    delete updatesCopy.uiMode;
  }

  const mode = next.uiMode;
  const hasProfile = MODES.includes(mode) && next.modeProfiles && next.modeProfiles[mode];
  for (const [key, value] of Object.entries(updatesCopy)) {
    if (hasProfile && PER_MODE_KEYS.includes(key)) {
      next.modeProfiles = {
        ...next.modeProfiles,
        [mode]: { ...next.modeProfiles[mode], [key]: value },
      };
    } else {
      next[key] = value;
    }
  }
  return next;
}

/**
 * One-time migration when settings are first read by this version.
 * Existing users keep the familiar Classic board until they choose the new
 * one; new installs start with the new board. `isExistingInstall` is true
 * when the app has run before (onboarding finished or settings saved).
 * Returns null when nothing needs to change.
 */
export function migrateExperience(stored, isExistingInstall) {
  if (stored && stored.boardLayout) return null;
  return isExistingInstall
    ? { boardLayout: 'classic' }
    : { boardLayout: 'studio' };
}

/** What each mode changes, in plain language (shown in the mode preview). */
export const MODE_DESCRIPTIONS = {
  child: {
    title: 'Child',
    summary: 'Warm colours, larger picture symbols and roomier tiles.',
    details: [
      'Bigger tiles (3 across) with picture symbols first',
      'Soft colour for each kind of word',
      'Optional modelling for a parent or teacher to show words',
    ],
  },
  adult: {
    title: 'Adult',
    summary: 'Calm, text-first design with symbols beside the words.',
    details: [
      'More words per screen (4 across)',
      'Small symbols with clear text labels',
      'Phrases for work, university, appointments and social life',
    ],
  },
};
