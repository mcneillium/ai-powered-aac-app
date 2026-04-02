// src/screens/SocialScreen.js
// Dedicated social and conversational phrases for real human interaction.
// Designed to feel natural and age-appropriate — not childish.
// Categories: Greetings, Small Talk, Reactions, Conversation, Humour, Boundaries.
// Tap any phrase to speak immediately. Long press to save to favourites.

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, spacing, radii } from '../theme';
import { speak } from '../services/speechService';
import { addSentenceToHistory, loadSentenceHistory } from '../services/sentenceHistoryStore';
import { addFavourite, isFavourite, loadFavourites } from '../services/favouritesStore';
import { StatusBar } from 'expo-status-bar';

// Pre-load stores
loadSentenceHistory().catch(() => {});
loadFavourites().catch(() => {});

const SOCIAL_CATEGORIES = [
  {
    id: 'greetings',
    label: 'Greetings',
    icon: 'hand-right-outline',
    color: '#4CAF50',
    phrases: [
      'Hi',
      'Hello',
      'Hey, how are you?',
      'Good morning',
      'Good afternoon',
      'Nice to see you',
      'How have you been?',
      'Bye',
      'See you later',
      'Have a good day',
      'It was nice talking to you',
    ],
  },
  {
    id: 'small_talk',
    label: 'Small Talk',
    icon: 'chatbubbles-outline',
    color: '#2979FF',
    phrases: [
      'How are you?',
      'I am good, thanks',
      'What have you been up to?',
      'Nice weather today',
      'Did you have a good weekend?',
      'What are you doing later?',
      'I had a good day',
      'I had a tough day',
      'Anything new?',
      'Not much, you?',
    ],
  },
  {
    id: 'reactions',
    label: 'Reactions',
    icon: 'sparkles-outline',
    color: '#FF9800',
    phrases: [
      "That's funny",
      "That's cool",
      "That's interesting",
      'No way!',
      'Really?',
      'Wow',
      'I agree',
      'I disagree',
      'Same here',
      "I didn't know that",
      'Good for you',
      "That's not fair",
      "I'm happy for you",
      "I'm sorry to hear that",
    ],
  },
  {
    id: 'conversation',
    label: 'Conversation',
    icon: 'swap-horizontal-outline',
    color: '#7C4DFF',
    phrases: [
      'My turn',
      'Can I say something?',
      'Tell me more',
      'What do you think?',
      'I want to add something',
      'Can you repeat that?',
      'I need a moment to think',
      'Let me finish',
      'Go on',
      'I was going to say...',
      'Can we change the subject?',
      'I have something to share',
    ],
  },
  {
    id: 'humour',
    label: 'Humour',
    icon: 'happy-outline',
    color: '#FF5722',
    phrases: [
      'Just kidding',
      'You crack me up',
      'That made my day',
      'Very funny',
      'I was being sarcastic',
      'Guess what?',
      'Want to hear something funny?',
      'Good one',
      'Ha ha',
      'You are hilarious',
    ],
  },
  {
    id: 'polite',
    label: 'Polite',
    icon: 'heart-outline',
    color: '#E91E63',
    phrases: [
      'Thank you',
      'Please',
      'Excuse me',
      'Sorry',
      'No problem',
      'You are welcome',
      "That's really kind",
      'I appreciate that',
      'After you',
      "Congratulations",
      "I'm proud of you",
      'Well done',
    ],
  },
  {
    id: 'boundaries',
    label: 'Boundaries',
    icon: 'shield-outline',
    color: '#607D8B',
    phrases: [
      'I need a break',
      "I'd rather not say",
      "That's private",
      'Not right now',
      'Can we talk later?',
      'I need some space',
      'Please stop',
      "I don't want to talk about that",
      "I'm not comfortable with that",
      'Give me a moment',
    ],
  },
];

export default function SocialScreen() {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);
  const [expandedCategory, setExpandedCategory] = useState('greetings');
  const [saveMenu, setSaveMenu] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = React.useRef(null);

  const speakPhrase = useCallback((text) => {
    speak(text, {
      rate: settings.speechRate,
      pitch: settings.speechPitch,
      voice: settings.speechVoice,
    });
    addSentenceToHistory(text).catch(() => {});
  }, [settings]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  const handleLongPress = useCallback((phrase) => {
    setSaveMenu({ phrase, alreadyFav: isFavourite(phrase) });
  }, []);

  const handleSaveToFavourites = useCallback(async () => {
    if (!saveMenu) return;
    await addFavourite(saveMenu.phrase);
    speakPhrase(saveMenu.phrase);
    setSaveMenu(null);
    showToast('Added to favourites \u2605');
  }, [saveMenu, speakPhrase, showToast]);

  const toggleCategory = useCallback((id) => {
    setExpandedCategory(prev => prev === id ? null : id);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.heading, { color: palette.text }]}>
          Social & Conversation
        </Text>
        <Text style={[styles.subheading, { color: palette.textSecondary }]}>
          Tap to speak. Long press to save.
        </Text>

        {SOCIAL_CATEGORIES.map((category) => {
          const isExpanded = expandedCategory === category.id;
          return (
            <View key={category.id} style={[styles.categoryCard, { backgroundColor: palette.cardBg }]}>
              {/* Category header — tap to expand/collapse */}
              <TouchableOpacity
                style={styles.categoryHeader}
                onPress={() => toggleCategory(category.id)}
                accessibilityRole="button"
                accessibilityLabel={`${category.label} phrases. ${isExpanded ? 'Collapse' : 'Expand'}`}
                accessibilityState={{ expanded: isExpanded }}
              >
                <View style={[styles.categoryIcon, { backgroundColor: category.color }]}>
                  <Ionicons name={category.icon} size={20} color="#FFFFFF" />
                </View>
                <Text style={[styles.categoryLabel, { color: palette.text }]}>{category.label}</Text>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={palette.textSecondary}
                />
              </TouchableOpacity>

              {/* Phrase chips */}
              {isExpanded && (
                <View style={styles.phrasesRow}>
                  {category.phrases.map((phrase, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.phraseChip, { backgroundColor: category.color }]}
                      onPress={() => speakPhrase(phrase)}
                      onLongPress={() => handleLongPress(phrase)}
                      delayLongPress={400}
                      accessibilityRole="button"
                      accessibilityLabel={`Say: ${phrase}. Long press to save.`}
                    >
                      <Text style={styles.phraseChipText}>{phrase}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Save to favourites modal */}
      <Modal visible={!!saveMenu} transparent animationType="fade" onRequestClose={() => setSaveMenu(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSaveMenu(null)}>
          <View style={[styles.saveMenuCard, { backgroundColor: palette.cardBg }]}>
            <Text style={[styles.saveMenuPhrase, { color: palette.text }]} numberOfLines={3}>
              "{saveMenu?.phrase}"
            </Text>
            {!saveMenu?.alreadyFav ? (
              <TouchableOpacity
                style={[styles.saveMenuBtn, { backgroundColor: palette.warning }]}
                onPress={handleSaveToFavourites}
                accessibilityRole="button"
                accessibilityLabel="Add to favourites and speak"
              >
                <Ionicons name="star" size={18} color="#FFF" />
                <Text style={styles.saveMenuBtnText}>Add to favourites</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.saveMenuNote, { color: palette.textSecondary }]}>
                Already in favourites
              </Text>
            )}
            <TouchableOpacity
              style={[styles.saveMenuBtn, { backgroundColor: palette.chipBg }]}
              onPress={() => setSaveMenu(null)}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[styles.saveMenuBtnTextDark, { color: palette.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Toast */}
      {toast && (
        <View style={[styles.toast, { backgroundColor: palette.text }]} pointerEvents="none">
          <Text style={[styles.toastText, { color: palette.background }]}>{toast}</Text>
        </View>
      )}

      <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: 100 },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subheading: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  categoryCard: {
    borderRadius: radii.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
  },
  phrasesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  phraseChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  phraseChipText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  // Save modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  saveMenuCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  saveMenuPhrase: {
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  saveMenuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    gap: spacing.sm,
  },
  saveMenuBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  saveMenuBtnTextDark: {
    fontSize: 15,
    fontWeight: '600',
  },
  saveMenuNote: {
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  toast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    opacity: 0.9,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
