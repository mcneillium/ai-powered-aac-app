// src/screens/OnboardingScreen.js
// First launch: choose who is using Voice (Child or Adult), learn that words
// stay where they are, and decide about learning (off unless chosen).
// Three short steps, all skippable; every choice can be changed in Settings.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../contexts/SettingsContext';
import { brand, getPalette, getExperience, fonts, radii, spacing } from '../theme';

const STEPS = ['who', 'stable', 'private'];

export default function OnboardingScreen({ onComplete }) {
  const { settings, updateSettings } = useSettings();
  const palette = getPalette(settings.theme);
  const experience = getExperience(settings.experience);
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem('hasLaunched', 'true');
    } catch (e) {
      // A storage failure must never trap the user in onboarding —
      // worst case they see it again next launch.
      console.warn('Failed to persist onboarding flag:', e.message);
    }
    if (onComplete) onComplete();
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else completeOnboarding();
  };
  const isLast = step === STEPS.length - 1;

  const modeCard = (id, emoji, blurb) => {
    const x = getExperience(id);
    const selected = (settings.experience || 'adult') === id;
    return (
      <TouchableOpacity
        key={id}
        onPress={() => updateSettings({ experience: id })}
        style={[
          styles.modeCard,
          {
            backgroundColor: selected ? palette.primaryMuted : palette.cardBg,
            borderColor: selected ? palette.primary : palette.tileBorder,
            borderRadius: x.tileRadius + 2,
          },
        ]}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`${x.label}. ${blurb}`}
      >
        <Text style={styles.modeEmoji} importantForAccessibility="no">{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.modeTitle, { color: palette.text, fontFamily: x.headlineFont }]}>{x.label}</Text>
          <Text style={[styles.body, { color: palette.textSecondary }]}>{blurb}</Text>
        </View>
        <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={26} color={selected ? palette.primary : palette.textSecondary} />
      </TouchableOpacity>
    );
  };

  let content;
  if (STEPS[step] === 'who') {
    content = (
      <>
        <Text style={[styles.kicker, { color: palette.primary }]}>{`WELCOME TO ${brand.name.toUpperCase()}`}</Text>
        <Text style={[styles.title, { color: palette.text, fontFamily: experience.headlineFont }]}>Who is using Voice?</Text>
        <Text style={[styles.body, { color: palette.textSecondary, marginBottom: spacing.lg }]}>
          This sets how Voice looks and talks. You can switch at any time in Settings.
        </Text>
        <View accessibilityRole="radiogroup" style={{ gap: spacing.md }}>
          {modeCard('child', '🧒', 'Pictures on words, bigger tiles, simple wording')}
          {modeCard('adult', '🧑', 'Clean and text-first, with more detail')}
        </View>
      </>
    );
  } else if (STEPS[step] === 'stable') {
    content = (
      <>
        <View style={[styles.iconCircle, { backgroundColor: palette.primaryMuted }]}>
          <Ionicons name="grid" size={56} color={palette.primary} />
        </View>
        <Text style={[styles.title, { color: palette.text, fontFamily: experience.headlineFont }]}>Your words stay put</Text>
        <Text style={[styles.body, { color: palette.textSecondary }]}>
          Every word keeps its place, so your hands can learn where it is. Suggestions appear in their own row above the board and never move it.
          {'\n\n'}Everything works offline.
        </Text>
      </>
    );
  } else {
    content = (
      <>
        <View style={[styles.iconCircle, { backgroundColor: palette.primaryMuted }]}>
          <Ionicons name="lock-closed" size={52} color={palette.primary} />
        </View>
        <Text style={[styles.title, { color: palette.text, fontFamily: experience.headlineFont }]}>Private by default</Text>
        <Text style={[styles.body, { color: palette.textSecondary, marginBottom: spacing.lg }]}>
          Voice can learn the words you use to make better suggestions. It only does this if you turn it on, and what it learns stays on this phone.
        </Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => updateSettings({ localLearning: settings.localLearning !== true })}
          style={[styles.learnRow, { backgroundColor: palette.cardBg, borderColor: palette.tileBorder }]}
          accessible
          accessibilityRole="switch"
          accessibilityLabel="Learn from my words"
          accessibilityState={{ checked: settings.localLearning === true }}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.modeTitle, { color: palette.text, fontSize: 18 }]}>Learn from my words</Text>
            <Text style={[styles.body, { color: palette.textSecondary, fontSize: 15 }]}>You can see and clear it any time.</Text>
          </View>
          <Switch
            value={settings.localLearning === true}
            onValueChange={(v) => updateSettings({ localLearning: v })}
            trackColor={{ true: palette.primary, false: palette.border }}
            thumbColor={palette.cardBg}
          />
        </TouchableOpacity>
      </>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.topBar}>
        <Text style={[styles.brand, { color: palette.text, fontFamily: experience.headlineFont }]}>{brand.name}</Text>
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={completeOnboarding}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
        >
          <Text style={[styles.skipText, { color: palette.textSecondary }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.slide}>{content}</ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {STEPS.map((s, i) => (
            <View
              key={s}
              style={[styles.dot, { backgroundColor: i === step ? palette.primary : palette.border }, i === step && styles.dotActive]}
              importantForAccessibility="no"
            />
          ))}
        </View>
        <View style={styles.buttons}>
          {step > 0 && (
            <TouchableOpacity
              style={[styles.backBtn, { backgroundColor: palette.surface }]}
              onPress={() => setStep(step - 1)}
              accessibilityRole="button"
              accessibilityLabel="Previous step"
            >
              <Ionicons name="arrow-back" size={22} color={palette.text} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: palette.primary }]}
            onPress={next}
            accessibilityRole="button"
            accessibilityLabel={isLast ? 'Get started' : 'Next slide'}
          >
            <Text style={[styles.nextText, { color: palette.buttonText }]}>{isLast ? 'Start talking' : 'Next'}</Text>
            <Ionicons name={isLast ? 'chatbubble-ellipses' : 'arrow-forward'} size={20} color={palette.buttonText} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  brand: { fontSize: 26, flex: 1 },
  skipBtn: { minHeight: 48, minWidth: 64, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontSize: 17, fontFamily: fonts.bold },
  slide: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  kicker: { fontSize: 13, fontFamily: fonts.bold, letterSpacing: 1.2, marginBottom: spacing.sm },
  title: { fontSize: 32, marginBottom: spacing.md, lineHeight: 38 },
  body: { fontSize: 17, fontFamily: fonts.regular, lineHeight: 24 },
  iconCircle: { width: 112, height: 112, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xl },
  modeCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderWidth: 2, minHeight: 96 },
  modeEmoji: { fontSize: 40 },
  modeTitle: { fontSize: 22, marginBottom: 2, fontFamily: fonts.bold },
  learnRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderWidth: 1, borderRadius: radii.xl },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, alignItems: 'center' },
  dots: { flexDirection: 'row', marginBottom: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: spacing.xs },
  dotActive: { width: 24 },
  buttons: { flexDirection: 'row', gap: spacing.md, alignSelf: 'stretch' },
  backBtn: { width: 56, height: 56, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  nextBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 56, borderRadius: radii.lg, gap: spacing.sm,
  },
  nextText: { fontSize: 18, fontFamily: fonts.bold },
});
