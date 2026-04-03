// src/components/SmartSuggestionsPanel.js
// Surfaces personalized learning insights as actionable AAC shortcuts.
// Reads from existing stores (aiProfileStore, sentenceHistoryStore, favouritesStore)
// and presents suggestions the user can act on immediately.
//
// Every suggestion has an explainable reason. User-controlled throughout.
// Dismissals persist locally so suggestions don't reappear after panel close.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing } from '../theme';
import { getFrequentSentences } from '../services/sentenceHistoryStore';
import {
  getRepeatedPhrases, getFrequentFailedSearches, getFrequentStarters,
} from '../services/aiProfileStore';
import { isFavourite, addFavourite, getFavourites } from '../services/favouritesStore';
import { speak } from '../services/speechService';
import { addSentenceToHistory } from '../services/sentenceHistoryStore';
import { quickPageTemplates } from '../data/quickPageTemplates';
import {
  saveCustomQuickPage, getCustomQuickPages, loadCustomQuickPages,
} from '../services/customQuickPageStore';

const DISMISSED_KEY = '@aac_smart_dismissed';

// ── Category guessing for missing words ──
// Simple keyword-based heuristic — no AI needed.
const CATEGORY_HINTS = {
  // Verbs / actions
  verb: ['go', 'come', 'eat', 'drink', 'play', 'run', 'walk', 'sit', 'stand', 'sleep',
    'read', 'write', 'draw', 'sing', 'dance', 'swim', 'jump', 'push', 'pull', 'open',
    'close', 'wash', 'brush', 'cook', 'clean', 'give', 'take', 'put', 'get', 'make',
    'watch', 'listen', 'wait', 'try', 'finish', 'start', 'stop', 'help', 'share', 'hug'],
  // Adjectives / descriptions
  adjective: ['big', 'small', 'hot', 'cold', 'loud', 'quiet', 'fast', 'slow', 'hard',
    'soft', 'new', 'old', 'good', 'bad', 'nice', 'mean', 'funny', 'scary', 'pretty',
    'ugly', 'happy', 'sad', 'angry', 'tired', 'hungry', 'thirsty', 'sick', 'sore',
    'wet', 'dry', 'clean', 'dirty', 'full', 'empty', 'light', 'dark', 'heavy', 'easy'],
  // Social / pragmatic
  social: ['hello', 'hi', 'bye', 'thanks', 'sorry', 'please', 'excuse', 'welcome',
    'congratulations', 'cheers', 'wow', 'cool', 'awesome', 'oops', 'uh-oh', 'yay'],
  // Pronouns / people
  pronoun: ['he', 'she', 'they', 'we', 'you', 'me', 'him', 'her', 'them', 'us',
    'mum', 'dad', 'mom', 'teacher', 'friend', 'brother', 'sister', 'grandma', 'grandpa'],
  // Important / high-priority
  important: ['stop', 'help', 'hurt', 'pain', 'emergency', 'danger', 'medicine',
    'toilet', 'bathroom', 'doctor', 'nurse', 'hospital', 'ambulance', 'fire', 'police'],
};

function guessCategory(word) {
  const w = word.toLowerCase().trim();
  for (const [category, words] of Object.entries(CATEGORY_HINTS)) {
    if (words.includes(w)) return category;
  }
  // Fallback heuristics
  if (w.endsWith('ing') || w.endsWith('ed')) return 'verb';
  if (w.endsWith('ly')) return 'adjective';
  if (w.endsWith('er') || w.endsWith('est')) return 'adjective';
  return 'noun'; // safe default
}

// ── Topic name normalization ──
// Strips common decorations so "Dentist", "My Dentist", "Dentist Visit",
// "Dentist Page", "Dentist (2)" all match the same core topic.
const STRIP_WORDS = new Set(['my', 'the', 'a', 'visit', 'page', 'trip', 'day', 'time', 'learned', 'custom', 'new']);
function normalizeTopic(label) {
  if (!label) return '';
  return label
    .toLowerCase()
    .replace(/\s*\(\d+\)\s*$/, '') // strip trailing (2), (3), etc
    .replace(/\s*-\s*\w+$/, '')     // strip trailing "- learned", "- updated" etc
    .split(/\s+/)
    .filter(w => !STRIP_WORDS.has(w))
    .join(' ')
    .trim();
}

// ── Unique page label ──
// If "Dentist" exists, returns "Dentist (2)", then "Dentist (3)", etc.
function uniquePageLabel(baseLabel, existingPages) {
  const labels = new Set(existingPages.map(p => p.label?.toLowerCase()));
  if (!labels.has(baseLabel.toLowerCase())) return baseLabel;
  for (let i = 2; i <= 20; i++) {
    const candidate = `${baseLabel} (${i})`;
    if (!labels.has(candidate.toLowerCase())) return candidate;
  }
  return `${baseLabel} (${Date.now()})`;
}

// ── Topic detection for quick page suggestions ──
// Match user's frequent phrases against known situation keywords.
const TOPIC_KEYWORDS = {
  dentist:    ['dentist', 'teeth', 'tooth', 'mouth', 'numb', 'drill', 'filling', 'bite', 'rinse', 'spit'],
  restaurant: ['menu', 'order', 'waiter', 'food', 'bill', 'table', 'chef', 'dish', 'meal', 'dessert', 'restaurant'],
  hospital:   ['hospital', 'nurse', 'doctor', 'medicine', 'injection', 'blood', 'scan', 'ward', 'bed', 'drip'],
  school:     ['teacher', 'homework', 'class', 'lesson', 'break', 'playground', 'assembly', 'test', 'exam', 'desk'],
  birthday:   ['birthday', 'party', 'cake', 'present', 'candle', 'balloon', 'gift', 'invite'],
  haircut:    ['hair', 'haircut', 'scissors', 'barber', 'trim', 'shampoo', 'mirror', 'comb'],
  bus:        ['bus', 'train', 'ticket', 'seat', 'station', 'stop', 'driver', 'platform', 'track'],
  playground: ['slide', 'swing', 'climb', 'sand', 'seesaw', 'roundabout', 'ball', 'race', 'tag'],
  shopping:   ['shop', 'buy', 'pay', 'money', 'price', 'bag', 'checkout', 'trolley', 'aisle'],
};

function detectTopicSuggestions(frequentPhrases) {
  const phraseList = frequentPhrases.map(p => p.text || p.phrase || '');
  const allText = phraseList.map(p => p.toLowerCase()).join(' ');
  const matches = [];

  for (const [topicId, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    const hits = keywords.filter(kw => allText.includes(kw));
    if (hits.length >= 2) {
      const template = quickPageTemplates.find(t => t.id === topicId);

      // Collect the user's actual phrases that contain any matching keyword
      const userPhrases = [];
      for (const phrase of phraseList) {
        const lower = phrase.toLowerCase();
        if (keywords.some(kw => lower.includes(kw)) && !userPhrases.includes(phrase)) {
          userPhrases.push(phrase);
        }
      }

      matches.push({
        topicId,
        label: template?.label || topicId,
        hitCount: hits.length,
        keywords: hits.slice(0, 3),
        userPhrases: userPhrases.slice(0, 6), // cap at 6 user phrases
        templatePhrases: template?.phrases || [],
      });
    }
  }

  return matches.sort((a, b) => b.hitCount - a.hitCount).slice(0, 2);
}

// ── Persistent dismissals ──
let dismissedCache = null;

async function loadDismissed() {
  if (dismissedCache) return dismissedCache;
  try {
    const raw = await AsyncStorage.getItem(DISMISSED_KEY);
    dismissedCache = raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    dismissedCache = new Set();
  }
  return dismissedCache;
}

async function saveDismissed(dismissed) {
  dismissedCache = dismissed;
  try {
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]));
  } catch {}
}

/**
 * Clear all dismissed smart suggestions so they reappear.
 * Called from Settings when user wants a fresh set of suggestions.
 */
export async function clearDismissedSuggestions() {
  dismissedCache = new Set();
  try {
    await AsyncStorage.removeItem(DISMISSED_KEY);
  } catch {}
}

/**
 * Build a ranked list of smart suggestions from existing user data.
 */
function buildSuggestions(dismissed) {
  const suggestions = [];
  const seen = new Set();

  // 1. Frequent full sentences not yet in favourites
  const frequent = getFrequentSentences(20);
  for (const item of frequent) {
    if (item.speakCount >= 3 && !isFavourite(item.text) && !seen.has(item.text) && !dismissed.has(item.text)) {
      suggestions.push({
        text: item.text,
        reason: `Spoken ${item.speakCount} times`,
        type: 'frequent_phrase',
        icon: 'repeat-outline',
        color: '#FF9800',
      });
      seen.add(item.text);
    }
  }

  // 2. Repeated starters — learned communication patterns
  const starters = getFrequentStarters(4, 6);
  for (const item of starters) {
    if (!seen.has(item.starter) && !dismissed.has(item.starter)) {
      suggestions.push({
        text: item.starter,
        reason: `Repeated starter — used ${item.count} times`,
        type: 'starter',
        icon: 'arrow-forward-outline',
        color: '#00BCD4',
      });
      seen.add(item.starter);
    }
  }

  // 3. Repeated multi-word phrases from AI profile
  const repeated = getRepeatedPhrases(3, 10);
  for (const item of repeated) {
    if (!isFavourite(item.phrase) && !seen.has(item.phrase) && !dismissed.has(item.phrase)) {
      suggestions.push({
        text: item.phrase,
        reason: `Used ${item.count} times`,
        type: 'repeated_pattern',
        icon: 'trending-up-outline',
        color: '#7C4DFF',
      });
      seen.add(item.phrase);
    }
  }

  // 4. Topic suggestions — detect if phrases cluster around a known situation
  const allPhrases = [...frequent.map(f => ({ text: f.text })), ...repeated.map(r => ({ phrase: r.phrase }))];
  const topics = detectTopicSuggestions(allPhrases);
  for (const topic of topics) {
    const key = `topic:${topic.topicId}`;
    if (!dismissed.has(key)) {
      suggestions.push({
        text: `Create "${topic.label}" Quick Page`,
        reason: `Related phrases used often (${topic.keywords.join(', ')})`,
        type: 'topic_suggestion',
        icon: 'flash-outline',
        color: '#FF6D00',
        topicId: topic.topicId,
        topicLabel: topic.label,
        userPhrases: topic.userPhrases,
        templatePhrases: topic.templatePhrases,
      });
    }
  }

  // 5. Failed searches — with smart category guess
  const gaps = getFrequentFailedSearches(2);
  for (const item of gaps) {
    if (!seen.has(item.term) && !dismissed.has(item.term)) {
      const category = guessCategory(item.term);
      suggestions.push({
        text: item.term,
        reason: `Searched ${item.count} times but not found`,
        type: 'missing_word',
        icon: 'search-outline',
        color: '#F44336',
        guessedCategory: category,
      });
      seen.add(item.term);
    }
  }

  // Sort: missing words and topics float up, then by type priority
  const typePriority = { missing_word: 0, topic_suggestion: 1, starter: 2, frequent_phrase: 3, repeated_pattern: 4 };
  suggestions.sort((a, b) => (typePriority[a.type] ?? 5) - (typePriority[b.type] ?? 5));

  return suggestions.slice(0, 10);
}

export default function SmartSuggestionsPanel({
  visible,
  palette,
  settings,
  onSpeakPhrase,
  onAddWord,     // (word, category) => void
  onCreateQuickPage, // (page) => void — called after page is created and saved
  onRefresh,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());
  const loaded = useRef(false);

  // Load persistent dismissals once
  useEffect(() => {
    loadDismissed().then(d => {
      setDismissed(d);
      loaded.current = true;
    });
  }, []);

  // Rebuild suggestions when panel opens (after dismissals loaded)
  useEffect(() => {
    if (visible && loaded.current) {
      setSuggestions(buildSuggestions(dismissed));
    }
  }, [visible, dismissed]);

  const handleSpeak = useCallback((text) => {
    speak(text, {
      rate: settings.speechRate,
      pitch: settings.speechPitch,
      voice: settings.speechVoice,
    });
    addSentenceToHistory(text).catch(() => {});
    if (onSpeakPhrase) onSpeakPhrase(text);
  }, [settings, onSpeakPhrase]);

  const handleSaveToFavourites = useCallback(async (text) => {
    await addFavourite(text);
    setSuggestions(prev => prev.map(s =>
      s.text === text ? { ...s, saved: true } : s
    ));
    if (onRefresh) onRefresh();
  }, [onRefresh]);

  const handleDismiss = useCallback(async (key) => {
    const next = new Set([...dismissed, key]);
    setDismissed(next);
    await saveDismissed(next);
  }, [dismissed]);

  const handleAddWord = useCallback((item) => {
    if (onAddWord) onAddWord(item.text, item.guessedCategory || 'noun');
    handleDismiss(item.text);
  }, [onAddWord, handleDismiss]);

  const handleTopicAction = useCallback(async (item) => {
    // Build the phrase list: user's own phrases first, then fill from template
    const seen = new Set();
    const newPhrases = [];

    // User's actual learned phrases (these are the whole point)
    for (const text of (item.userPhrases || [])) {
      const trimmed = text.trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        newPhrases.push({ id: `lrn_${newPhrases.length}`, label: trimmed, category: 'request' });
        seen.add(trimmed.toLowerCase());
      }
    }

    // Fill remaining slots from the built-in template (up to 12 total)
    for (const tp of (item.templatePhrases || [])) {
      if (newPhrases.length >= 12) break;
      if (!seen.has(tp.label.toLowerCase())) {
        newPhrases.push({ ...tp, id: `tpl_${newPhrases.length}` });
        seen.add(tp.label.toLowerCase());
      }
    }

    if (newPhrases.length === 0) return;

    // Check for existing custom page with same topic
    // Normalized matching: strip common suffixes/prefixes, compare core word
    await loadCustomQuickPages();
    const existingPages = getCustomQuickPages();
    const topicCore = normalizeTopic(item.topicLabel);
    const existing = existingPages.find(p =>
      normalizeTopic(p.label) === topicCore ||
      (p.isLearned && p.id?.includes(item.topicId))
    );

    if (existing) {
      // Compute what's new vs already present
      const existingLabels = new Set(existing.phrases.map(p => p.label.toLowerCase()));
      const genuinelyNew = newPhrases.filter(p => !existingLabels.has(p.label.toLowerCase()));

      if (genuinelyNew.length === 0) {
        Alert.alert(
          `"${item.topicLabel}" page is up to date`,
          `Your existing "${existing.label}" page already contains all the relevant phrases.`,
          [{ text: 'OK' }]
        );
        await handleDismiss(`topic:${item.topicId}`);
        return;
      }

      const previewLines = genuinelyNew.slice(0, 4).map(p => `• ${p.label}`).join('\n');
      const moreText = genuinelyNew.length > 4 ? `\n...and ${genuinelyNew.length - 4} more` : '';

      Alert.alert(
        `"${existing.label}" page already exists`,
        `${genuinelyNew.length} new phrase${genuinelyNew.length === 1 ? '' : 's'} from your recent usage:\n\n${previewLines}${moreText}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Update existing',
            onPress: async () => {
              // Merge new phrases into existing page (user phrases first, cap at 12)
              const mergedSeen = new Set();
              const merged = [];

              // New learned phrases first (highest priority)
              for (const p of genuinelyNew) {
                if (merged.length >= 12) break;
                if (!mergedSeen.has(p.label.toLowerCase())) {
                  merged.push({ ...p, id: `lrn_${Date.now()}_${merged.length}` });
                  mergedSeen.add(p.label.toLowerCase());
                }
              }

              // Then existing phrases
              for (const p of existing.phrases) {
                if (merged.length >= 12) break;
                if (!mergedSeen.has(p.label.toLowerCase())) {
                  merged.push(p);
                  mergedSeen.add(p.label.toLowerCase());
                }
              }

              const updated = { ...existing, phrases: merged };
              await saveCustomQuickPage(updated);
              await handleDismiss(`topic:${item.topicId}`);
              if (onCreateQuickPage) onCreateQuickPage(updated);
            },
          },
          {
            text: 'Create separate',
            onPress: async () => {
              await createNewTopicPage(item, newPhrases);
            },
          },
        ]
      );
    } else {
      // No existing page — simple creation flow
      const userCount = (item.userPhrases || []).length;
      const templateCount = newPhrases.length - userCount;
      const previewLines = newPhrases.slice(0, 5).map(p => `• ${p.label}`).join('\n');
      const moreText = newPhrases.length > 5 ? `\n...and ${newPhrases.length - 5} more` : '';

      Alert.alert(
        `Create "${item.topicLabel}" page?`,
        `${userCount} phrases from your usage${templateCount > 0 ? ` + ${templateCount} suggested` : ''}:\n\n${previewLines}${moreText}`,
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Create page',
            onPress: async () => {
              await createNewTopicPage(item, newPhrases);
            },
          },
        ]
      );
    }

    async function createNewTopicPage(topicItem, phrases) {
      const template = quickPageTemplates.find(t => t.id === topicItem.topicId);
      const label = uniquePageLabel(topicItem.topicLabel, getCustomQuickPages());
      const page = {
        id: `learned_${topicItem.topicId}_${Date.now()}`,
        label,
        icon: template?.icon || 'create-outline',
        color: template?.color || '#FF6D00',
        isCustom: true,
        isLearned: true,
        phrases,
      };

      await saveCustomQuickPage(page);
      await handleDismiss(`topic:${topicItem.topicId}`);
      if (onCreateQuickPage) onCreateQuickPage(page);
    }
  }, [onCreateQuickPage, handleDismiss]);

  if (!visible) return null;

  const visibleSuggestions = suggestions.filter(s => {
    const key = s.type === 'topic_suggestion' ? `topic:${s.topicId}` : s.text;
    return !dismissed.has(key);
  });

  if (visibleSuggestions.length === 0) {
    return (
      <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={styles.panelHeader}>
          <Ionicons name="bulb-outline" size={16} color={palette.textSecondary} />
          <Text style={[styles.panelTitle, { color: palette.textSecondary }]}>Smart Suggestions</Text>
        </View>
        <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
          Keep communicating — suggestions appear as you use the app more.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.panelHeader}>
        <Ionicons name="bulb-outline" size={16} color={palette.warning} />
        <Text style={[styles.panelTitle, { color: palette.textSecondary }]}>Smart Suggestions</Text>
      </View>
      <ScrollView style={styles.scrollArea} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {visibleSuggestions.map((item, idx) => (
          <View key={`${item.type}-${item.text}-${idx}`} style={[styles.suggestionRow, { backgroundColor: palette.cardBg }]}>
            <TouchableOpacity
              style={styles.suggestionMain}
              onPress={() => {
                if (item.type === 'topic_suggestion') handleTopicAction(item);
                else handleSpeak(item.text);
              }}
              accessibilityRole="button"
              accessibilityLabel={
                item.type === 'topic_suggestion'
                  ? `${item.text}. ${item.reason}`
                  : `Say: ${item.text}. ${item.reason}`
              }
            >
              <Ionicons name={item.icon} size={16} color={item.color} />
              <View style={styles.suggestionTextArea}>
                <Text style={[styles.suggestionText, { color: palette.text }]} numberOfLines={1}>
                  {item.text}
                </Text>
                <Text style={[styles.suggestionReason, { color: palette.textSecondary }]}>
                  {item.reason}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.suggestionActions}>
              {/* Favourite action — for speakable items */}
              {item.type !== 'missing_word' && item.type !== 'topic_suggestion' && !item.saved && (
                <TouchableOpacity
                  onPress={() => handleSaveToFavourites(item.text)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Save "${item.text}" to favourites`}
                >
                  <Ionicons name="star-outline" size={18} color={palette.warning} />
                </TouchableOpacity>
              )}
              {item.saved && (
                <Ionicons name="star" size={18} color={palette.warning} />
              )}

              {/* Add to vocab — for missing words with smart category */}
              {item.type === 'missing_word' && onAddWord && (
                <TouchableOpacity
                  onPress={() => handleAddWord(item)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Add "${item.text}" as ${item.guessedCategory}`}
                >
                  <Ionicons name="add-circle-outline" size={18} color={palette.success} />
                </TouchableOpacity>
              )}

              {/* Dismiss */}
              <TouchableOpacity
                onPress={() => handleDismiss(item.type === 'topic_suggestion' ? `topic:${item.topicId}` : item.text)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel={`Dismiss suggestion: ${item.text}`}
              >
                <Ionicons name="close" size={16} color={palette.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 240,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: spacing.xs,
  },
  scrollArea: {
    flexGrow: 0,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  suggestionMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  suggestionTextArea: {
    flex: 1,
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  suggestionReason: {
    fontSize: 11,
    marginTop: 1,
  },
  suggestionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginLeft: spacing.sm,
  },
});
