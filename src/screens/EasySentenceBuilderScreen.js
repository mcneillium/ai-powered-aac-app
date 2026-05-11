// src/screens/EasySentenceBuilderScreen.js
// Sentence template builder: pre-built sentence frames with fill-in-the-blank slots.
// Child-friendly: large cards, pictograms, minimal text, one-tap speak.

import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, spacing, radii } from '../theme';
import { speak } from '../services/speechService';
import { addSentenceToHistory } from '../services/sentenceHistoryStore';
import { recordSentenceSpoken } from '../services/aiProfileStore';
import SymbolImage from '../components/SymbolImage';
import {
  getTemplateCategories, getTemplatesForCategory,
  getSlotSuggestions, fillTemplate, isTemplateComplete,
} from '../services/sentenceTemplateService';

function CategoryCard({ category, active, onPress }) {
  return (
    <TouchableOpacity
      style={[
        styles.catCard,
        { backgroundColor: active ? category.color : '#FFF', borderColor: category.color },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${category.label} templates`}
      accessibilityState={{ selected: active }}
    >
      <SymbolImage hexcode={category.hexcode} size={36} />
      <Text style={[styles.catLabel, { color: active ? '#FFF' : '#333' }]}>{category.label}</Text>
    </TouchableOpacity>
  );
}

function TemplateCard({ template, active, onPress, palette, filledSlots }) {
  const display = fillTemplate(template, filledSlots);
  const complete = isTemplateComplete(template, filledSlots);

  return (
    <TouchableOpacity
      style={[
        styles.templateCard,
        { backgroundColor: active ? palette.primary + '15' : palette.cardBg, borderColor: active ? palette.primary : palette.border },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Template: ${template.frame}`}
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.templateFrame, { color: palette.text }]}>
        {display.split(' ').map((word, i) => (
          <Text key={i}>
            {word === '___' ? (
              <Text style={{ color: palette.primary, fontWeight: '800' }}>{'___'}</Text>
            ) : word}
            {i < display.split(' ').length - 1 ? ' ' : ''}
          </Text>
        ))}
      </Text>
      {complete && <Ionicons name="checkmark-circle" size={20} color={palette.success || '#66BB6A'} />}
    </TouchableOpacity>
  );
}

function SlotWordButton({ suggestion, onPress, palette }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.1, duration: 75, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1.0, duration: 75, useNativeDriver: true }),
    ]).start();
    onPress(suggestion.word);
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.slotWord, { backgroundColor: palette.cardBg, borderColor: palette.border }]}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`Fill with ${suggestion.word}`}
      >
        <SymbolImage word={suggestion.word} size={36} fallbackLabel={suggestion.word} />
        <Text style={[styles.slotWordLabel, { color: palette.text }]}>{suggestion.word}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function EasySentenceBuilderScreen() {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);
  const categories = getTemplateCategories();

  const [activeCategory, setActiveCategory] = useState('wants');
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const [filledSlots, setFilledSlots] = useState({});

  const templates = getTemplatesForCategory(activeCategory);
  const suggestions = activeTemplate ? getSlotSuggestions(activeTemplate, activeSlotIndex, filledSlots) : [];
  const currentSentence = activeTemplate ? fillTemplate(activeTemplate, filledSlots) : '';
  const isComplete = activeTemplate ? isTemplateComplete(activeTemplate, filledSlots) : false;

  const selectCategory = useCallback((catId) => {
    setActiveCategory(catId);
    setActiveTemplate(null);
    setActiveSlotIndex(0);
    setFilledSlots({});
  }, []);

  const selectTemplate = useCallback((template) => {
    setActiveTemplate(template);
    setActiveSlotIndex(0);
    setFilledSlots({});
  }, []);

  const fillSlot = useCallback((word) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const next = { ...filledSlots, [activeSlotIndex]: word };
    setFilledSlots(next);
    speak(word, { rate: settings.speechRate, pitch: settings.speechPitch, voice: settings.speechVoice });

    if (activeTemplate && activeSlotIndex < activeTemplate.slots.length - 1) {
      setActiveSlotIndex(activeSlotIndex + 1);
    }
  }, [filledSlots, activeSlotIndex, activeTemplate, settings]);

  const speakSentence = useCallback(() => {
    if (!currentSentence || currentSentence.includes('___')) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    speak(currentSentence, { rate: settings.speechRate, pitch: settings.speechPitch, voice: settings.speechVoice });
    addSentenceToHistory(currentSentence).catch(() => {});
    const words = currentSentence.split(' ').filter(Boolean);
    recordSentenceSpoken(words).catch(() => {});
  }, [currentSentence, settings]);

  const reset = useCallback(() => {
    setActiveTemplate(null);
    setActiveSlotIndex(0);
    setFilledSlots({});
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      {/* Sentence preview bar */}
      <View style={[styles.preview, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text
          style={[styles.previewText, { color: currentSentence ? palette.text : palette.textSecondary }]}
          numberOfLines={2}
        >
          {currentSentence || 'Pick a sentence to start'}
        </Text>
        <View style={styles.previewActions}>
          <TouchableOpacity
            onPress={speakSentence}
            style={[styles.speakBtn, { backgroundColor: isComplete ? palette.primary : palette.chipBg }]}
            disabled={!isComplete}
            accessibilityRole="button"
            accessibilityLabel={isComplete ? `Speak: ${currentSentence}` : 'Fill all blanks first'}
            accessibilityHint="Reads the completed sentence aloud"
          >
            <Ionicons name="volume-high" size={24} color={isComplete ? '#FFF' : palette.textSecondary} />
          </TouchableOpacity>
          {activeTemplate && (
            <TouchableOpacity
              onPress={reset}
              style={[styles.actionBtn, { backgroundColor: palette.chipBg }]}
              accessibilityRole="button"
              accessibilityLabel="Start over"
            >
              <Ionicons name="refresh" size={20} color={palette.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Category tabs */}
        <View style={styles.catRow}>
          {categories.map(cat => (
            <CategoryCard
              key={cat.id}
              category={cat}
              active={activeCategory === cat.id}
              onPress={() => selectCategory(cat.id)}
            />
          ))}
        </View>

        {/* Template list */}
        {!activeTemplate && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: palette.textSecondary }]}>Pick a sentence:</Text>
            {templates.map(t => (
              <TemplateCard
                key={t.id}
                template={t}
                active={false}
                onPress={() => selectTemplate(t)}
                palette={palette}
                filledSlots={{}}
              />
            ))}
          </View>
        )}

        {/* Active template with slot filling */}
        {activeTemplate && (
          <>
            <TemplateCard
              template={activeTemplate}
              active={true}
              onPress={() => {}}
              palette={palette}
              filledSlots={filledSlots}
            />

            {/* Slot indicator */}
            {!isComplete && (
              <View style={styles.slotIndicator}>
                <Ionicons name="arrow-down" size={20} color={palette.primary} />
                <Text style={[styles.slotHint, { color: palette.primary }]}>
                  {activeTemplate.slots.length > 1
                    ? `Fill blank ${activeSlotIndex + 1} of ${activeTemplate.slots.length}`
                    : 'Pick a word:'}
                </Text>
              </View>
            )}

            {/* Slot word suggestions */}
            {!isComplete && (
              <View style={styles.slotGrid}>
                {suggestions.map((sug, i) => (
                  <SlotWordButton
                    key={`${sug.word}-${i}`}
                    suggestion={sug}
                    onPress={fillSlot}
                    palette={palette}
                  />
                ))}
              </View>
            )}

            {/* Complete — big speak button */}
            {isComplete && (
              <TouchableOpacity
                style={[styles.bigSpeakBtn, { backgroundColor: palette.primary }]}
                onPress={speakSentence}
                accessibilityRole="button"
                accessibilityLabel={`Speak: ${currentSentence}`}
              >
                <Ionicons name="volume-high" size={32} color="#FFF" />
                <Text style={styles.bigSpeakText}>Speak</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <StatusBar style={settings.theme === 'dark' || settings.theme === 'highContrast' ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  preview: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 2, minHeight: 60,
  },
  previewText: { flex: 1, fontSize: 20, fontWeight: '600' },
  previewActions: { flexDirection: 'row', gap: spacing.sm, marginLeft: spacing.sm },
  speakBtn: {
    padding: spacing.md, borderRadius: radii.lg,
    minWidth: 52, minHeight: 52, alignItems: 'center', justifyContent: 'center',
  },
  actionBtn: {
    padding: spacing.sm, borderRadius: radii.md,
    minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md },
  catRow: {
    flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg,
  },
  catCard: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.md,
    borderRadius: radii.lg, borderWidth: 2, gap: 4, minHeight: 80, justifyContent: 'center',
  },
  catLabel: { fontSize: 12, fontWeight: '700' },
  section: { marginBottom: spacing.lg },
  sectionLabel: { fontSize: 14, fontWeight: '600', marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  templateCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.lg, borderRadius: radii.lg, borderWidth: 2,
    marginBottom: spacing.sm, minHeight: 56,
  },
  templateFrame: { fontSize: 18, fontWeight: '600', flex: 1 },
  slotIndicator: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, marginVertical: spacing.md,
  },
  slotHint: { fontSize: 15, fontWeight: '600' },
  slotGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
  },
  slotWord: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.md, paddingHorizontal: spacing.sm,
    borderRadius: radii.lg, borderWidth: 2, width: 100, minHeight: 80, gap: 4,
  },
  slotWordLabel: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  bigSpeakBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 20, borderRadius: radii.xl, gap: spacing.md,
    marginTop: spacing.xl,
  },
  bigSpeakText: { color: '#FFF', fontSize: 24, fontWeight: '800' },
});
