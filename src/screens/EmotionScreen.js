// src/screens/EmotionScreen.js
// Emotion communication: big OpenMoji faces in a visual grid.
// Tap an emotion → speak it immediately via TTS.
// Guided flow: feel → intensity → cause → need → speak full sentence.

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, spacing, radii, EMOTION_COLORS } from '../theme';
import { speak } from '../services/speechService';
import { addSentenceToHistory } from '../services/sentenceHistoryStore';
import { recordWordSelection } from '../services/aiProfileStore';
import { recordEmotionSelection } from '../services/caregiverAlerts';
import SymbolImage from '../components/SymbolImage';
import DisplayMode from '../components/DisplayMode';
import { StatusBar } from 'expo-status-bar';
import { emotionToHexcode } from '../data/symbolAssetMap';
import {
  setScanItems, setScanMode, setScanSpeed,
  onScanChange, onScanSelect, startScan, stopScan,
  cleanup as cleanupScan,
} from '../services/switchScanService';

const EMOTIONS = [
  { id: 'happy', label: 'Happy', color: '#4CAF50', bg: EMOTION_COLORS.happy },
  { id: 'sad', label: 'Sad', color: '#5C6BC0', bg: EMOTION_COLORS.sad },
  { id: 'angry', label: 'Angry', color: '#E53935', bg: EMOTION_COLORS.angry },
  { id: 'scared', label: 'Scared', color: '#7E57C2', bg: EMOTION_COLORS.scared },
  { id: 'excited', label: 'Excited', color: '#FFB300', bg: EMOTION_COLORS.excited },
  { id: 'tired', label: 'Tired', color: '#78909C', bg: EMOTION_COLORS.tired },
  { id: 'confused', label: 'Confused', color: '#FF7043', bg: EMOTION_COLORS.confused },
  { id: 'sick', label: 'Sick', color: '#8D6E63', bg: EMOTION_COLORS.sick },
];

const EMOTIONS_EXTENDED = [
  { id: 'worried', label: 'Worried', color: '#7E57C2', bg: EMOTION_COLORS.worried },
  { id: 'frustrated', label: 'Frustrated', color: '#FF7043', bg: EMOTION_COLORS.frustrated },
  { id: 'overwhelmed', label: 'Overwhelmed', color: '#8D6E63', bg: EMOTION_COLORS.overwhelmed },
  { id: 'lonely', label: 'Lonely', color: '#5C6BC0', bg: EMOTION_COLORS.lonely },
  { id: 'proud', label: 'Proud', color: '#66BB6A', bg: EMOTION_COLORS.proud },
  { id: 'embarrassed', label: 'Embarrassed', color: '#EC407A', bg: EMOTION_COLORS.embarrassed },
  { id: 'calm', label: 'Calm', color: '#26A69A', bg: EMOTION_COLORS.calm },
  { id: 'in_pain', label: 'In pain', color: '#E53935', bg: EMOTION_COLORS.in_pain },
];

const INTENSITIES = [
  { id: 'little', label: 'A little', scale: 0.6 },
  { id: 'medium', label: 'Medium', scale: 0.8 },
  { id: 'lot', label: 'A lot', scale: 1.0 },
];

const CAUSES = [
  { id: 'loud', label: 'It is loud', icon: '1F50A' },
  { id: 'tired', label: 'I am tired', icon: '1F634' },
  { id: 'pain', label: 'I am in pain', icon: '1F915' },
  { id: 'no_understand', label: "Don't understand", icon: '1F615' },
  { id: 'too_close', label: 'Too close', icon: null },
  { id: 'need_break', label: 'Need a break', icon: null },
  { id: 'said_no', label: 'They said no', icon: '1F44E' },
  { id: 'hungry', label: 'I am hungry', icon: null },
  { id: 'miss', label: 'I miss someone', icon: '1F614' },
  { id: 'waiting', label: 'I am waiting', icon: '23F0' },
];

const NEEDS = [
  { id: 'help', label: 'Help', icon: 'hand-left-outline', color: '#E53935' },
  { id: 'break', label: 'Break', icon: 'pause-outline', color: '#66BB6A' },
  { id: 'quiet', label: 'Quiet', icon: 'volume-mute-outline', color: '#78909C' },
  { id: 'water', label: 'Water', icon: 'water-outline', color: '#42A5F5' },
  { id: 'toilet', label: 'Toilet', icon: 'navigate-outline', color: '#8D6E63' },
  { id: 'food', label: 'Food', icon: 'restaurant-outline', color: '#FFA726' },
  { id: 'hug', label: 'Hug', icon: 'heart-outline', color: '#EC407A' },
  { id: 'space', label: 'Space', icon: 'expand-outline', color: '#78909C' },
  { id: 'headphones', label: 'Headphones', icon: 'headset-outline', color: '#5C6BC0' },
  { id: 'stop', label: 'Stop', icon: 'close-circle-outline', color: '#E53935' },
  { id: 'medicine', label: 'Medicine', icon: 'medkit-outline', color: '#D32F2F' },
  { id: 'breathe', label: 'Breathe', icon: 'leaf-outline', color: '#26A69A' },
];

const BODY_LOCATIONS = [
  { id: 'head', label: 'Head', icon: 'ellipse-outline' },
  { id: 'mouth', label: 'Mouth', icon: 'nutrition-outline', spoken: 'mouth' },
  { id: 'throat', label: 'Throat', icon: 'mic-outline' },
  { id: 'chest', label: 'Chest', icon: 'heart-outline' },
  { id: 'stomach', label: 'Stomach', icon: 'ellipse-outline' },
  { id: 'back', label: 'Back', icon: 'body-outline' },
  { id: 'arm', label: 'Arm', icon: 'hand-left-outline' },
  { id: 'leg', label: 'Leg', icon: 'walk-outline' },
  { id: 'foot', label: 'Foot', icon: 'footsteps-outline' },
  { id: 'everywhere', label: 'Everywhere', icon: 'body-outline' },
];

const PAIN_INTENSITIES = [
  { id: 1, label: 'A little', spoken: 'It hurts a little', bars: 1, color: '#66BB6A' },
  { id: 2, label: 'Medium', spoken: 'It hurts moderately', bars: 2, color: '#FFB300' },
  { id: 3, label: 'A lot', spoken: 'It hurts a lot', bars: 3, color: '#FF9800' },
  { id: 4, label: 'Very bad', spoken: 'It is really bad', bars: 4, color: '#F4511E' },
  { id: 5, label: 'The worst', spoken: 'It is the worst pain', bars: 5, color: '#D32F2F' },
];

const PAIN_NEEDS = [
  { id: 'medicine', label: 'Medicine', icon: 'medkit-outline', color: '#E53935', spoken: 'my medicine' },
  { id: 'doctor', label: 'Doctor', icon: 'medical-outline', color: '#D32F2F', spoken: 'a doctor' },
  { id: 'rest', label: 'Lie down', icon: 'bed-outline', color: '#5C6BC0', spoken: 'to lie down' },
  { id: 'water', label: 'Water', icon: 'water-outline', color: '#42A5F5' },
  { id: 'help', label: 'Help', icon: 'hand-left-outline', color: '#E53935' },
  { id: 'home', label: 'Go home', icon: 'home-outline', color: '#5D4037', spoken: 'to go home' },
  { id: 'hospital', label: 'Hospital', icon: 'fitness-outline', color: '#D32F2F', spoken: 'to go to hospital' },
];

const CRISIS = [
  { id: 'help_now', label: 'HELP', phrase: 'I need help right now', icon: 'alert-circle', color: '#D32F2F' },
  { id: 'pain_now', label: 'PAIN', phrase: 'I am in pain', icon: 'medkit-outline', color: '#E53935' },
  { id: 'stop_now', label: 'STOP', phrase: 'Stop. Please stop.', icon: 'close-circle', color: '#C62828' },
  { id: 'cant_breathe', label: "CAN'T BREATHE", phrase: 'I cannot breathe', icon: 'alert-circle-outline', color: '#D32F2F' },
  { id: 'sick_now', label: 'SICK', phrase: 'I am going to be sick', icon: 'warning-outline', color: '#E65100' },
];

const REGULATION = [
  { id: 'breathe', label: 'Breathe', phrase: 'I need to breathe', icon: 'leaf-outline', color: '#26A69A' },
  { id: 'count', label: 'Count', phrase: 'I need to count', icon: 'calculator-outline', color: '#5C6BC0' },
  { id: 'squeeze', label: 'Squeeze', phrase: 'I need to squeeze something', icon: 'hand-left-outline', color: '#7E57C2' },
  { id: 'music', label: 'Music', phrase: 'I want to listen to music', icon: 'musical-notes-outline', color: '#42A5F5' },
  { id: 'quiet_time', label: 'Quiet', phrase: 'I need quiet time', icon: 'volume-mute-outline', color: '#78909C' },
  { id: 'reg_break', label: 'Break', phrase: 'I need a break', icon: 'pause-outline', color: '#66BB6A' },
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

function buildPainSentence(location, painIntensity, painNeed) {
  const parts = [];
  if (location) {
    if (location.id === 'everywhere') {
      parts.push('I hurt everywhere');
    } else {
      parts.push(`My ${(location.spoken || location.label).toLowerCase()} hurts`);
    }
  }
  if (painIntensity) parts.push(painIntensity.spoken);
  if (painNeed) {
    const needWord = (painNeed.spoken || painNeed.label).toLowerCase();
    parts.push(`I need ${needWord}`);
  }
  return parts.join('. ') + (parts.length > 0 ? '.' : '');
}

function EmotionCell({ emotion, selected, onPress, size, scanFocused, palette }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const hex = emotionToHexcode[emotion.id];

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.15, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1.0, duration: 100, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[
          styles.emotionCell,
          {
            backgroundColor: emotion.bg,
            borderColor: scanFocused ? '#FF6600' : (selected ? emotion.color : 'transparent'),
            borderWidth: (scanFocused || selected) ? 4 : 0,
            width: size,
            height: size,
          },
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`I feel ${emotion.label}`}
        accessibilityState={{ selected }}
      >
        <SymbolImage hexcode={hex} size={size * 0.55} />
        <Text style={[styles.emotionCellLabel, palette && { color: palette.text }]} numberOfLines={1}>
          {emotion.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function EmotionScreen() {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);
  const [emotion, setEmotion] = useState(null);
  const [intensity, setIntensity] = useState(null);
  const [cause, setCause] = useState(null);
  const [need, setNeed] = useState(null);
  const [showMore, setShowMore] = useState(false);
  const [showDisplay, setShowDisplay] = useState(false);

  // Pain flow
  const [bodyLocation, setBodyLocation] = useState(null);
  const [painIntensity, setPainIntensity] = useState(null);
  const [painNeed, setPainNeed] = useState(null);

  // Switch scanning
  const [scanActive, setScanActive] = useState(false);
  const [scanFocusIndex, setScanFocusIndex] = useState(-1);
  const scanItemsRef = useRef([]);

  useEffect(() => {
    const allEmotions = showMore ? [...EMOTIONS, ...EMOTIONS_EXTENDED] : EMOTIONS;
    const emotionItems = allEmotions.map(e => ({ type: 'emotion', id: e.id, emotion: e, label: e.label }));
    const crisisItems = CRISIS.map(c => ({ type: 'crisis', id: c.id, crisis: c, label: c.label }));
    const actionItems = [{ type: 'action', id: 'speak', label: 'Speak' }];
    scanItemsRef.current = [...crisisItems, ...emotionItems, ...actionItems];
    if (scanActive) setScanItems(scanItemsRef.current);
  }, [showMore, scanActive]);

  useEffect(() => {
    onScanChange(({ currentIndex, isRunning }) => setScanFocusIndex(isRunning ? currentIndex : -1));
    onScanSelect(({ item }) => {
      if (!item) return;
      if (item.type === 'emotion') handleEmotionTap(item.emotion);
      else if (item.type === 'crisis') speakDirect(item.crisis.phrase);
      else if (item.type === 'action' && item.id === 'speak') speakNow();
    });
    return () => cleanupScan();
  }, []);

  useEffect(() => {
    if (settings.scanMode) setScanMode(settings.scanMode);
    if (settings.scanSpeed) setScanSpeed(settings.scanSpeed);
  }, []);

  const toggleScan = useCallback(() => {
    if (scanActive) { stopScan(); setScanActive(false); }
    else {
      setScanMode(settings.scanMode || 'auto');
      setScanSpeed(settings.scanSpeed || 1500);
      setScanItems(scanItemsRef.current);
      startScan();
      setScanActive(true);
    }
  }, [scanActive, settings.scanMode, settings.scanSpeed]);

  const isScanFocused = useCallback((type, id) => {
    if (!scanActive || scanFocusIndex < 0) return false;
    const focused = scanItemsRef.current[scanFocusIndex];
    return focused && focused.type === type && focused.id === id;
  }, [scanActive, scanFocusIndex]);

  const isPainMode = emotion?.id === 'in_pain' || emotion?.id === 'sick';
  const sentence = isPainMode
    ? buildPainSentence(bodyLocation, painIntensity, painNeed)
    : buildSentence(emotion, intensity, cause, need);

  const speakNow = useCallback(() => {
    if (!sentence) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    speak(sentence, {
      rate: settings.speechRate,
      pitch: settings.speechPitch,
      voice: settings.speechVoice,
      language: settings.communicationLanguage,
    });
    addSentenceToHistory(sentence).catch(() => {});
    if (emotion) {
      recordWordSelection(emotion.label.toLowerCase(), ['i', 'feel'], false).catch(() => {});
    }
  }, [sentence, settings, emotion]);

  const speakDirect = useCallback((phrase) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    speak(phrase, { rate: settings.speechRate, pitch: settings.speechPitch, voice: settings.speechVoice });
    addSentenceToHistory(phrase).catch(() => {});
  }, [settings]);

  const reset = () => {
    setEmotion(null);
    setIntensity(null);
    setCause(null);
    setNeed(null);
    setBodyLocation(null);
    setPainIntensity(null);
    setPainNeed(null);
  };

  const handleEmotionTap = (e) => {
    const alreadySelected = emotion?.id === e.id;
    if (alreadySelected) {
      setEmotion(null);
      setIntensity(null);
      setCause(null);
      setNeed(null);
      setBodyLocation(null);
      setPainIntensity(null);
      setPainNeed(null);
    } else {
      setEmotion(e);
      recordEmotionSelection(e.id, null).catch(() => {});
      speak(`I feel ${e.label.toLowerCase()}`, {
        rate: settings.speechRate,
        pitch: settings.speechPitch,
        voice: settings.speechVoice,
      });
    }
  };

  const cellSize = 140;

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      {/* Sentence preview bar */}
      <View style={[styles.preview, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text
          style={[styles.previewText, { color: sentence ? palette.text : palette.textSecondary }]}
          numberOfLines={2}
        >
          {sentence || 'How do you feel?'}
        </Text>
        <View style={styles.previewActions}>
          <TouchableOpacity
            onPress={speakNow}
            style={[styles.speakBtn, { backgroundColor: palette.primary }]}
            disabled={!sentence}
            accessibilityRole="button"
            accessibilityLabel={sentence ? `Speak: ${sentence}` : 'Build a sentence first'}
            accessibilityHint="Reads aloud how you feel"
          >
            <Ionicons name="volume-high" size={24} color={palette.buttonText} />
          </TouchableOpacity>
          {sentence ? (
            <>
              <TouchableOpacity
                onPress={() => setShowDisplay(true)}
                style={[styles.actionBtn, { backgroundColor: palette.chipBg }]}
                accessibilityRole="button"
                accessibilityLabel="Show on screen"
              >
                <Ionicons name="tv-outline" size={20} color={palette.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={reset}
                style={[styles.actionBtn, { backgroundColor: palette.chipBg }]}
                accessibilityRole="button"
                accessibilityLabel="Start over"
              >
                <Ionicons name="refresh" size={20} color={palette.text} />
              </TouchableOpacity>
            </>
          ) : null}
          <TouchableOpacity
            onPress={toggleScan}
            style={[styles.actionBtn, { backgroundColor: scanActive ? '#FF6600' : palette.chipBg }]}
            accessibilityRole="button"
            accessibilityLabel={scanActive ? 'Stop scanning' : 'Start scanning'}
          >
            <Ionicons name={scanActive ? 'stop' : 'scan-outline'} size={20} color={scanActive ? '#FFF' : palette.text} />
          </TouchableOpacity>
        </View>
      </View>

      <DisplayMode
        visible={showDisplay}
        onClose={() => setShowDisplay(false)}
        text={sentence}
        mode="display"
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Crisis buttons — always visible */}
        <View style={styles.crisisRow}>
          {CRISIS.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.crisisBtn, { backgroundColor: c.color }]}
              onPress={() => speakDirect(c.phrase)}
              accessibilityRole="button"
              accessibilityLabel={c.phrase}
            >
              <Ionicons name={c.icon} size={22} color="#FFF" />
              <Text style={styles.crisisLabel}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Main emotion grid — big OpenMoji faces */}
        <View style={styles.emotionGrid}>
          {EMOTIONS.map(e => (
            <EmotionCell
              key={e.id}
              emotion={e}
              selected={emotion?.id === e.id}
              onPress={() => handleEmotionTap(e)}
              size={cellSize}
              scanFocused={isScanFocused('emotion', e.id)}
              palette={palette}
            />
          ))}
        </View>

        {/* "More feelings" toggle */}
        <TouchableOpacity
          style={[styles.moreBtn, { backgroundColor: palette.chipBg }]}
          onPress={() => setShowMore(!showMore)}
          accessibilityRole="button"
          accessibilityLabel={showMore ? 'Show fewer feelings' : 'Show more feelings'}
        >
          <Ionicons name={showMore ? 'chevron-up' : 'chevron-down'} size={20} color={palette.text} />
          <Text style={[styles.moreBtnText, { color: palette.text }]}>
            {showMore ? 'Less' : 'More'}
          </Text>
        </TouchableOpacity>

        {showMore && (
          <View style={styles.emotionGrid}>
            {EMOTIONS_EXTENDED.map(e => (
              <EmotionCell
                key={e.id}
                emotion={e}
                selected={emotion?.id === e.id}
                onPress={() => handleEmotionTap(e)}
                size={cellSize}
                scanFocused={isScanFocused('emotion', e.id)}
                palette={palette}
              />
            ))}
          </View>
        )}

        {/* Pain / body flow */}
        {isPainMode && (
          <>
            <Text style={[styles.stepLabel, { color: palette.text }]}>Where?</Text>
            <View style={styles.chipGrid}>
              {BODY_LOCATIONS.map(loc => {
                const sel = bodyLocation?.id === loc.id;
                return (
                  <TouchableOpacity
                    key={loc.id}
                    style={[
                      styles.needChip,
                      { backgroundColor: sel ? '#E53935' : palette.cardBg, borderColor: sel ? '#E53935' : palette.border },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setBodyLocation(sel ? null : loc);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={loc.id === 'everywhere' ? 'I hurt everywhere' : `My ${loc.label.toLowerCase()} hurts`}
                    accessibilityState={{ selected: sel }}
                  >
                    <Ionicons name={loc.icon} size={24} color={sel ? '#FFF' : palette.text} />
                    <Text style={[styles.needLabel, { color: sel ? '#FFF' : palette.text }]}>{loc.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.stepLabel, { color: palette.text }]}>How bad?</Text>
            <View style={styles.intensityRow}>
              {PAIN_INTENSITIES.map(pi => {
                const sel = painIntensity?.id === pi.id;
                return (
                  <TouchableOpacity
                    key={pi.id}
                    style={[styles.intensityChip, { backgroundColor: sel ? pi.color : palette.cardBg, borderColor: sel ? pi.color : palette.border }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setPainIntensity(sel ? null : pi);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Pain is ${pi.label.toLowerCase()}`}
                    accessibilityState={{ selected: sel }}
                  >
                    <View style={{ flexDirection: 'row', gap: 2 }}>
                      {Array.from({ length: pi.bars }).map((_, idx) => (
                        <View key={idx} style={{ width: 7, height: 16 + idx * 4, backgroundColor: sel ? '#FFF' : pi.color, borderRadius: 2 }} />
                      ))}
                    </View>
                    <Text style={[styles.intensityLabel, { color: sel ? '#FFF' : palette.text }]}>{pi.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.stepLabel, { color: palette.text }]}>I need...</Text>
            <View style={styles.chipGrid}>
              {PAIN_NEEDS.map(pn => {
                const sel = painNeed?.id === pn.id;
                return (
                  <TouchableOpacity
                    key={pn.id}
                    style={[
                      styles.needChip,
                      { backgroundColor: sel ? pn.color : palette.cardBg, borderColor: sel ? pn.color : palette.border },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setPainNeed(sel ? null : pn);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`I need ${pn.label.toLowerCase()}`}
                    accessibilityState={{ selected: sel }}
                  >
                    <Ionicons name={pn.icon} size={24} color={sel ? '#FFF' : palette.text} />
                    <Text style={[styles.needLabel, { color: sel ? '#FFF' : palette.text }]}>{pn.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Standard emotion flow */}
        {emotion && !isPainMode && (
          <>
            {/* How much? — 3 sizes of the same emoji */}
            <Text style={[styles.stepLabel, { color: palette.text }]}>How much?</Text>
            <View style={styles.intensityRow}>
              {INTENSITIES.map(i => {
                const sel = intensity?.id === i.id;
                const hex = emotionToHexcode[emotion.id];
                return (
                  <TouchableOpacity
                    key={i.id}
                    style={[styles.intensityChip, { backgroundColor: sel ? palette.primary : palette.cardBg, borderColor: palette.border }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setIntensity(sel ? null : i);
                      if (!sel) recordEmotionSelection(emotion.id, i.id).catch(() => {});
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={i.label}
                    accessibilityState={{ selected: sel }}
                  >
                    <SymbolImage hexcode={hex} size={40 * i.scale} />
                    <Text style={[styles.intensityLabel, { color: sel ? palette.buttonText : palette.text }]}>{i.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Because... */}
            <Text style={[styles.stepLabel, { color: palette.text }]}>Because...</Text>
            <View style={styles.chipGrid}>
              {CAUSES.map(c => {
                const sel = cause?.id === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.causeChip, { backgroundColor: sel ? palette.primary : palette.cardBg, borderColor: palette.border }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setCause(sel ? null : c);
                    }}
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

        {/* I need... (general) */}
        {!isPainMode && (
          <>
            <Text style={[styles.stepLabel, { color: palette.text }]}>
              {emotion ? 'I need...' : 'What do you need?'}
            </Text>
            <View style={styles.chipGrid}>
              {NEEDS.map(n => {
                const sel = need?.id === n.id;
                return (
                  <TouchableOpacity
                    key={n.id}
                    style={[
                      styles.needChip,
                      { backgroundColor: sel ? n.color : palette.cardBg, borderColor: sel ? n.color : palette.border },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setNeed(sel ? null : n);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`I need ${n.label.toLowerCase()}`}
                    accessibilityState={{ selected: sel }}
                  >
                    <Ionicons name={n.icon} size={24} color={sel ? '#FFF' : n.color} />
                    <Text style={[styles.needLabel, { color: sel ? '#FFF' : palette.text }]}>{n.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Coping / regulation */}
        <Text style={[styles.stepLabel, { color: palette.text }]}>To calm down:</Text>
        <View style={styles.chipGrid}>
          {REGULATION.map(r => (
            <TouchableOpacity
              key={r.id}
              style={[styles.regChip, { backgroundColor: r.color }]}
              onPress={() => speakDirect(r.phrase)}
              accessibilityRole="button"
              accessibilityLabel={r.phrase}
            >
              <Ionicons name={r.icon} size={24} color="#FFF" />
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
    minHeight: 60,
  },
  previewText: { flex: 1, fontSize: 20, fontWeight: '600' },
  previewActions: { flexDirection: 'row', gap: spacing.sm, marginLeft: spacing.sm },
  speakBtn: {
    padding: spacing.md,
    borderRadius: radii.lg,
    minWidth: 52,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    padding: spacing.sm,
    borderRadius: radii.md,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md },
  crisisRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  crisisBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    gap: spacing.xs,
    minHeight: 52,
  },
  crisisLabel: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  emotionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  emotionCell: {
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  emotionCellLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    borderRadius: radii.pill,
    alignSelf: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  moreBtnText: { fontSize: 15, fontWeight: '600' },
  stepLabel: { fontSize: 18, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.sm },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  intensityRow: { flexDirection: 'row', gap: spacing.sm },
  intensityChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 2,
    minHeight: 80,
    justifyContent: 'center',
  },
  intensityLabel: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  causeChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 2,
    minHeight: 48,
    justifyContent: 'center',
  },
  causeText: { fontSize: 15, fontWeight: '600' },
  needChip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 2,
    width: '30%',
    minHeight: 80,
    gap: spacing.xs,
  },
  needLabel: { fontSize: 13, fontWeight: '700' },
  regChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    gap: spacing.sm,
    marginBottom: spacing.sm,
    minHeight: 52,
  },
  regLabel: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
