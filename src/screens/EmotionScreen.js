// src/screens/EmotionScreen.js
// Emotion communication builder: feel → intensity → cause → need.
// Produces complete AAC sentences like:
//   "I feel frustrated a lot because it is loud. I need quiet."
//
// Design: step-by-step guided flow with big tappable cards.
// Each step is optional — user can speak at any point.
// Low cognitive load: calm colors, large targets, minimal text.

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, spacing, radii } from '../theme';
import { speak } from '../services/speechService';
import { addSentenceToHistory } from '../services/sentenceHistoryStore';
import { recordWordSelection } from '../services/aiProfileStore';
import DisplayMode from '../components/DisplayMode';
import { StatusBar } from 'expo-status-bar';

const EMOTIONS = [
  { id: 'happy', label: 'Happy', emoji: '😊', color: '#4CAF50' },
  { id: 'sad', label: 'Sad', emoji: '😢', color: '#5C6BC0' },
  { id: 'angry', label: 'Angry', emoji: '😠', color: '#E53935' },
  { id: 'worried', label: 'Worried', emoji: '😟', color: '#7E57C2' },
  { id: 'frustrated', label: 'Frustrated', emoji: '😤', color: '#FF7043' },
  { id: 'excited', label: 'Excited', emoji: '🤩', color: '#FFB300' },
  { id: 'overwhelmed', label: 'Overwhelmed', emoji: '😵', color: '#8D6E63' },
  { id: 'tired', label: 'Tired', emoji: '😴', color: '#78909C' },
  { id: 'lonely', label: 'Lonely', emoji: '😔', color: '#5C6BC0' },
  { id: 'proud', label: 'Proud', emoji: '😊', color: '#66BB6A' },
  { id: 'embarrassed', label: 'Embarrassed', emoji: '😳', color: '#EC407A' },
  { id: 'scared', label: 'Scared', emoji: '😱', color: '#7E57C2' },
  { id: 'calm', label: 'Calm', emoji: '😌', color: '#26A69A' },
  { id: 'sick', label: 'Sick', emoji: '🤢', color: '#8D6E63' },
  { id: 'in_pain', label: 'In pain', emoji: '😣', color: '#E53935' },
  { id: 'confused', label: 'Confused', emoji: '😕', color: '#FF7043' },
];

const INTENSITIES = [
  { id: 'little', label: 'A little', size: 28 },
  { id: 'medium', label: 'Medium', size: 36 },
  { id: 'lot', label: 'A lot', size: 44 },
  { id: 'worst', label: 'The worst', size: 52 },
];

const CAUSES = [
  { id: 'loud', label: 'It is loud' },
  { id: 'tired', label: 'I am tired' },
  { id: 'pain', label: 'I am in pain' },
  { id: 'no_understand', label: 'I do not understand' },
  { id: 'too_close', label: 'They are too close' },
  { id: 'need_break', label: 'I need a break' },
  { id: 'said_no', label: 'They said no' },
  { id: 'hungry', label: 'I am hungry' },
  { id: 'miss', label: 'I miss someone' },
  { id: 'excited_cause', label: 'I am excited' },
  { id: 'waiting', label: 'I am waiting' },
];

const NEEDS = [
  { id: 'help', label: 'Help', icon: 'hand-left-outline' },
  { id: 'break', label: 'Break', icon: 'pause-outline' },
  { id: 'quiet', label: 'Quiet', icon: 'volume-mute-outline' },
  { id: 'water', label: 'Water', icon: 'water-outline' },
  { id: 'toilet', label: 'Toilet', icon: 'navigate-outline' },
  { id: 'food', label: 'Food', icon: 'restaurant-outline' },
  { id: 'hug', label: 'Hug', icon: 'heart-outline' },
  { id: 'space', label: 'Space', icon: 'expand-outline' },
  { id: 'headphones', label: 'Headphones', icon: 'headset-outline' },
  { id: 'stop', label: 'Stop', icon: 'close-circle-outline' },
  { id: 'slower', label: 'Slower please', icon: 'speedometer-outline' },
  { id: 'explain', label: 'Explain again', icon: 'refresh-outline' },
  { id: 'breathe', label: 'Deep breaths', icon: 'leaf-outline' },
  { id: 'dark_room', label: 'Dark room', icon: 'moon-outline' },
  { id: 'medicine', label: 'Medicine', icon: 'medkit-outline' },
  { id: 'sensory', label: 'Sensory toy', icon: 'cube-outline' },
];

const REGULATION = [
  { id: 'breathe', label: 'Breathe', phrase: 'I need to breathe', icon: 'leaf-outline', color: '#26A69A' },
  { id: 'count', label: 'Count', phrase: 'I need to count', icon: 'calculator-outline', color: '#5C6BC0' },
  { id: 'squeeze', label: 'Squeeze', phrase: 'I need to squeeze something', icon: 'hand-left-outline', color: '#7E57C2' },
  { id: 'music', label: 'Music', phrase: 'I want to listen to music', icon: 'musical-notes-outline', color: '#42A5F5' },
  { id: 'quiet_time', label: 'Quiet time', phrase: 'I need quiet time', icon: 'volume-mute-outline', color: '#78909C' },
  { id: 'headphones', label: 'Headphones', phrase: 'I need my headphones', icon: 'headset-outline', color: '#5C6BC0' },
  { id: 'reg_break', label: 'Break', phrase: 'I need a break', icon: 'pause-outline', color: '#66BB6A' },
];

const CRISIS = [
  { id: 'help_now', label: 'HELP', phrase: 'I need help right now', icon: 'alert-circle', color: '#D32F2F' },
  { id: 'pain_now', label: 'PAIN', phrase: 'I am in pain', icon: 'medkit-outline', color: '#E53935' },
  { id: 'stop_now', label: 'STOP', phrase: 'Stop. Please stop.', icon: 'close-circle', color: '#C62828' },
  { id: 'cant_breathe', label: "CAN'T BREATHE", phrase: 'I cannot breathe', icon: 'alert-circle-outline', color: '#D32F2F' },
  { id: 'sick_now', label: 'SICK', phrase: 'I am going to be sick', icon: 'warning-outline', color: '#E65100' },
];

function buildSentence(emotion, intensity, cause, need) {
  let sentence = '';
  if (emotion) {
    sentence = `I feel ${emotion.label.toLowerCase()}`;
    if (intensity) sentence += ` ${intensity.label.toLowerCase()}`;
  }
  if (cause) {
    sentence += sentence ? ` because ${cause.label.toLowerCase()}` : cause.label;
  }
  if (need) {
    sentence += sentence ? `. I need ${need.label.toLowerCase()}` : `I need ${need.label.toLowerCase()}`;
  }
  return sentence || '';
}

export default function EmotionScreen() {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);
  const [emotion, setEmotion] = useState(null);
  const [intensity, setIntensity] = useState(null);
  const [cause, setCause] = useState(null);
  const [need, setNeed] = useState(null);
  const [showDisplay, setShowDisplay] = useState(false);

  const sentence = buildSentence(emotion, intensity, cause, need);

  const speakNow = useCallback(() => {
    if (!sentence) return;
    speak(sentence, {
      rate: settings.speechRate,
      pitch: settings.speechPitch,
      voice: settings.speechVoice,
    });
    // Save to sentence history so it appears in AAC Board history panel
    addSentenceToHistory(sentence).catch(() => {});
    // Track emotion word for AI profile learning
    if (emotion) {
      recordWordSelection(emotion.label.toLowerCase(), ['i', 'feel'], false).catch(() => {});
    }
  }, [sentence, settings, emotion]);

  const speakDirect = useCallback((phrase) => {
    speak(phrase, { rate: settings.speechRate, pitch: settings.speechPitch, voice: settings.speechVoice });
    addSentenceToHistory(phrase).catch(() => {});
  }, [settings]);

  const reset = () => {
    setEmotion(null);
    setIntensity(null);
    setCause(null);
    setNeed(null);
  };

  const numCols = settings.gridSize || 3;

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      {/* Sentence preview — always visible at top */}
      <View style={[styles.preview, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text
          style={[styles.previewText, { color: sentence ? palette.text : palette.textSecondary }]}
          numberOfLines={3}
        >
          {sentence || 'Tap below to say how you feel'}
        </Text>
        <View style={styles.previewActions}>
          <TouchableOpacity
            onPress={speakNow}
            style={[styles.speakBtn, { backgroundColor: palette.primary }]}
            disabled={!sentence}
            accessibilityRole="button"
            accessibilityLabel={sentence ? `Speak: ${sentence}` : 'Build a sentence first'}
          >
            <Ionicons name="volume-high" size={22} color={palette.buttonText} />
          </TouchableOpacity>
          {sentence ? (
            <>
              <TouchableOpacity
                onPress={() => setShowDisplay(true)}
                style={[styles.resetBtn, { backgroundColor: palette.chipBg }]}
                accessibilityRole="button"
                accessibilityLabel="Show on screen for conversation partner"
              >
                <Ionicons name="tv-outline" size={18} color={palette.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={reset}
                style={[styles.resetBtn, { backgroundColor: palette.chipBg }]}
                accessibilityRole="button"
                accessibilityLabel="Start over"
              >
                <Ionicons name="refresh" size={18} color={palette.text} />
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </View>

      <DisplayMode
        visible={showDisplay}
        onClose={() => setShowDisplay(false)}
        text={sentence}
        mode="display"
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Crisis — always at top, 1-tap emergency phrases */}
        <View style={styles.crisisRow}>
          {CRISIS.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.crisisBtn, { backgroundColor: c.color }]}
              onPress={() => speakDirect(c.phrase)}
              accessibilityRole="button"
              accessibilityLabel={c.phrase}
            >
              <Ionicons name={c.icon} size={20} color="#FFF" />
              <Text style={styles.crisisLabel}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Step 1: How do you feel? */}
        <Text style={[styles.stepLabel, { color: palette.text }]}>How do you feel?</Text>
        <View style={styles.chipGrid}>
          {EMOTIONS.map(e => {
            const sel = emotion?.id === e.id;
            return (
              <TouchableOpacity
                key={e.id}
                style={[
                  styles.emotionChip,
                  { backgroundColor: sel ? e.color : palette.cardBg, borderColor: e.color,
                    width: `${Math.floor(100 / numCols) - 2}%` },
                ]}
                onPress={() => { setEmotion(sel ? null : e); if (sel) { setIntensity(null); setCause(null); setNeed(null); } }}
                accessibilityRole="button"
                accessibilityLabel={`I feel ${e.label}`}
                accessibilityState={{ selected: sel }}
              >
                <Text style={styles.emotionEmoji}>{e.emoji}</Text>
                <Text style={[styles.emotionLabel, { color: sel ? '#FFF' : palette.text }]}>{e.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Step 2: How much? */}
        {emotion && (
          <>
            <Text style={[styles.stepLabel, { color: palette.text }]}>How much?</Text>
            <View style={styles.intensityRow}>
              {INTENSITIES.map(i => {
                const sel = intensity?.id === i.id;
                return (
                  <TouchableOpacity
                    key={i.id}
                    style={[styles.intensityChip, { backgroundColor: sel ? palette.primary : palette.cardBg, borderColor: palette.border }]}
                    onPress={() => setIntensity(sel ? null : i)}
                    accessibilityRole="button"
                    accessibilityLabel={i.label}
                    accessibilityState={{ selected: sel }}
                  >
                    <Text style={{ fontSize: i.size }}>{emotion.emoji}</Text>
                    <Text style={[styles.intensityLabel, { color: sel ? palette.buttonText : palette.text }]}>{i.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Step 3: Because... */}
        {emotion && (
          <>
            <Text style={[styles.stepLabel, { color: palette.text }]}>Because...</Text>
            <View style={styles.chipGrid}>
              {CAUSES.map(c => {
                const sel = cause?.id === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.causeChip, { backgroundColor: sel ? palette.primary : palette.cardBg, borderColor: palette.border }]}
                    onPress={() => setCause(sel ? null : c)}
                    accessibilityRole="button"
                    accessibilityLabel={`Because ${c.label.toLowerCase()}`}
                    accessibilityState={{ selected: sel }}
                  >
                    <Text style={[styles.causeText, { color: sel ? palette.buttonText : palette.text }]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Step 4: I need... */}
        <Text style={[styles.stepLabel, { color: palette.text }]}>
          {emotion ? 'I need...' : 'Or just say what you need:'}
        </Text>
        <View style={styles.chipGrid}>
          {NEEDS.map(n => {
            const sel = need?.id === n.id;
            return (
              <TouchableOpacity
                key={n.id}
                style={[
                  styles.needChip,
                  { backgroundColor: sel ? palette.primary : palette.cardBg, borderColor: palette.border,
                    width: `${Math.floor(100 / numCols) - 2}%` },
                ]}
                onPress={() => setNeed(sel ? null : n)}
                accessibilityRole="button"
                accessibilityLabel={`I need ${n.label.toLowerCase()}`}
                accessibilityState={{ selected: sel }}
              >
                <Ionicons name={n.icon} size={22} color={sel ? palette.buttonText : palette.text} />
                <Text style={[styles.needLabel, { color: sel ? palette.buttonText : palette.text }]}>{n.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Step 5: Coping / regulation */}
        <Text style={[styles.stepLabel, { color: palette.text }]}>To help me calm down:</Text>
        <View style={styles.chipGrid}>
          {REGULATION.map(r => (
            <TouchableOpacity
              key={r.id}
              style={[styles.regChip, { backgroundColor: r.color }]}
              onPress={() => speakDirect(r.phrase)}
              accessibilityRole="button"
              accessibilityLabel={`I want to ${r.label.toLowerCase()}`}
            >
              <Ionicons name={r.icon} size={22} color="#FFF" />
              <Text style={styles.regLabel}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <StatusBar style={settings.theme === 'dark' || settings.theme === 'highContrast' ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    minHeight: 56,
  },
  previewText: { flex: 1, fontSize: 18, fontWeight: '500' },
  previewActions: { flexDirection: 'row', gap: spacing.sm, marginLeft: spacing.sm },
  speakBtn: { padding: spacing.sm, borderRadius: radii.sm, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  resetBtn: { padding: spacing.sm, borderRadius: radii.sm, minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md },
  stepLabel: { fontSize: 16, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.sm },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  emotionChip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 2,
    marginBottom: spacing.sm,
    minHeight: 70,
  },
  emotionEmoji: { fontSize: 28 },
  emotionLabel: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  intensityRow: { flexDirection: 'row', gap: spacing.sm },
  intensityChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  intensityLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  causeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  causeText: { fontSize: 14, fontWeight: '500' },
  needChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    gap: spacing.xs,
    minHeight: 52,
  },
  needLabel: { fontSize: 13, fontWeight: '600' },
  regChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  regLabel: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  crisisRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  crisisBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    gap: spacing.xs,
    minHeight: 48,
  },
  crisisLabel: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
});
