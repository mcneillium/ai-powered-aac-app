// src/services/caregiverAlerts.js
// Caregiver Alert System — distress detection, inactivity alerts,
// vocabulary gap alerts. Writes alerts to Firebase for dashboard consumption.
// All detection runs on-device; Firebase write is optional (requires auth).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFrequentFailedSearches } from './aiProfileStore';
import { getSentenceHistory } from './sentenceHistoryStore';
import { DB_PATHS, dbPath } from '../shared/schema';

const ALERT_STATE_KEY = '@aac_alert_state';
const DISTRESS_THRESHOLD = 3;
const INACTIVITY_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const VOCAB_GAP_THRESHOLD = 3;
const COOLDOWN_MS = 60 * 60 * 1000;

const NEGATIVE_EMOTIONS = new Set([
  'sad', 'angry', 'frustrated', 'scared', 'worried',
  'overwhelmed', 'lonely', 'embarrassed', 'in_pain', 'sick',
]);

const DISTRESS_PHRASES = [
  'help', 'stop', 'pain', 'hurt', 'scared', 'emergency',
  'can\'t breathe', 'feel sick', 'don\'t feel safe', 'something is wrong',
];

let alertState = null;

function createDefaultState() {
  return {
    recentEmotions: [],
    lastActivityTimestamp: Date.now(),
    lastDistressAlertAt: 0,
    lastInactivityAlertAt: 0,
    lastVocabGapAlertAt: 0,
  };
}

export async function loadAlertState() {
  try {
    const raw = await AsyncStorage.getItem(ALERT_STATE_KEY);
    alertState = raw ? JSON.parse(raw) : createDefaultState();
  } catch {
    alertState = createDefaultState();
  }
  return alertState;
}

async function saveState() {
  if (!alertState) return;
  try {
    await AsyncStorage.setItem(ALERT_STATE_KEY, JSON.stringify(alertState));
  } catch {}
}

export async function recordEmotionSelection(emotionId, intensity) {
  if (!alertState) await loadAlertState();
  alertState.lastActivityTimestamp = Date.now();

  alertState.recentEmotions.push({
    emotionId,
    intensity,
    timestamp: Date.now(),
  });

  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  alertState.recentEmotions = alertState.recentEmotions.filter(
    e => e.timestamp > fiveMinAgo
  );

  await saveState();
  return checkDistress();
}

export async function recordActivity() {
  if (!alertState) await loadAlertState();
  alertState.lastActivityTimestamp = Date.now();
  await saveState();
}

function checkDistress() {
  if (!alertState) return null;
  const now = Date.now();

  if (now - alertState.lastDistressAlertAt < COOLDOWN_MS) return null;

  const negativeCount = alertState.recentEmotions.filter(
    e => NEGATIVE_EMOTIONS.has(e.emotionId)
  ).length;

  const highIntensityNegative = alertState.recentEmotions.filter(
    e => NEGATIVE_EMOTIONS.has(e.emotionId) && (e.intensity === 'lot' || e.intensity === 'worst')
  ).length;

  if (negativeCount >= DISTRESS_THRESHOLD || highIntensityNegative >= 2) {
    alertState.lastDistressAlertAt = now;
    const topEmotions = alertState.recentEmotions
      .filter(e => NEGATIVE_EMOTIONS.has(e.emotionId))
      .map(e => e.emotionId);

    return {
      type: 'distress',
      severity: highIntensityNegative >= 2 ? 'high' : 'medium',
      emotions: [...new Set(topEmotions)],
      message: `User selected ${negativeCount} negative emotions in the last 5 minutes`,
      timestamp: now,
    };
  }

  return null;
}

export function checkPhraseDistress(spokenText) {
  if (!spokenText || !alertState) return null;
  const lower = spokenText.toLowerCase();
  const now = Date.now();

  if (now - alertState.lastDistressAlertAt < COOLDOWN_MS) return null;

  const matches = DISTRESS_PHRASES.filter(p => lower.includes(p));
  if (matches.length >= 2 || lower.includes('don\'t feel safe') || lower.includes('can\'t breathe')) {
    alertState.lastDistressAlertAt = now;
    return {
      type: 'distress',
      severity: 'high',
      phrases: matches,
      message: `User spoke distress phrases: ${matches.join(', ')}`,
      timestamp: now,
    };
  }

  return null;
}

export function checkInactivity() {
  if (!alertState) return null;
  const now = Date.now();

  if (now - alertState.lastInactivityAlertAt < COOLDOWN_MS) return null;

  const elapsed = now - alertState.lastActivityTimestamp;
  if (elapsed >= INACTIVITY_THRESHOLD_MS) {
    alertState.lastInactivityAlertAt = now;
    const hours = Math.round(elapsed / (60 * 60 * 1000));
    return {
      type: 'inactivity',
      severity: 'low',
      hoursInactive: hours,
      message: `No AAC activity for ${hours} hours`,
      timestamp: now,
    };
  }

  return null;
}

export function checkVocabularyGaps() {
  if (!alertState) return null;
  const now = Date.now();

  if (now - alertState.lastVocabGapAlertAt < 24 * 60 * 60 * 1000) return null;

  const gaps = getFrequentFailedSearches(VOCAB_GAP_THRESHOLD);
  if (gaps.length >= 3) {
    alertState.lastVocabGapAlertAt = now;
    return {
      type: 'vocabulary_gap',
      severity: 'low',
      missingWords: gaps.slice(0, 10).map(g => g.term),
      message: `User searched for ${gaps.length} words that aren't in their vocabulary`,
      timestamp: now,
    };
  }

  return null;
}

export async function writeAlertToFirebase(alert, caregiverId, database) {
  if (!alert || !caregiverId || !database) return false;
  try {
    const { ref, push, set } = await import('firebase/database');
    const alertRef = push(ref(database, dbPath(DB_PATHS.ALERTS, caregiverId)));
    await set(alertRef, {
      ...alert,
      read: false,
      createdAt: Date.now(),
    });
    return true;
  } catch {
    return false;
  }
}

export function runAllChecks() {
  const alerts = [];

  const distress = checkDistress();
  if (distress) alerts.push(distress);

  const inactivity = checkInactivity();
  if (inactivity) alerts.push(inactivity);

  const vocabGaps = checkVocabularyGaps();
  if (vocabGaps) alerts.push(vocabGaps);

  return alerts;
}
