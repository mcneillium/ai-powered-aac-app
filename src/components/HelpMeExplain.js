// src/components/HelpMeExplain.js
// Step-by-step message builder for things that are hard to say word by word.
// Tap a topic, answer a few questions by tapping (each after the first can
// be skipped), check the preview, then put it in the message bar. It is never
// spoken automatically, and nothing leaves the device.

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Sheet, { useAfterClose } from './Sheet';
import { TOPICS, getTopic, composeExplanation } from '../services/explainComposer';
import { fonts, radii, spacing } from '../theme';

export default function HelpMeExplain({ visible, onClose, palette, experience, onUse, onSpeak }) {
  const x = experience.id === 'child' ? 'child' : 'adult';
  const [topicId, setTopicId] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [choices, setChoices] = useState({});
  const { closeThen, onDismiss } = useAfterClose(onClose);

  useEffect(() => {
    if (!visible) {
      setTopicId(null);
      setStepIndex(0);
      setChoices({});
    }
  }, [visible]);

  const topic = topicId ? getTopic(topicId) : null;
  const step = topic ? topic.steps[stepIndex] : null;
  const done = topic && stepIndex >= topic.steps.length;
  const preview = topic ? composeExplanation(topicId, choices, x) : '';

  const choose = (optionId) => {
    setChoices((c) => ({ ...c, [step.id]: optionId }));
    setStepIndex((i) => i + 1);
  };
  const back = () => {
    if (!topic) return;
    if (stepIndex === 0) { setTopicId(null); setChoices({}); return; }
    const prevStep = topic.steps[stepIndex - 1];
    setChoices((c) => { const n = { ...c }; delete n[prevStep.id]; return n; });
    setStepIndex((i) => i - 1);
  };

  const title = topic ? topic.title[x] : 'Help me explain';

  const footer = topic && preview ? (
    <View style={[styles.preview, { backgroundColor: palette.cardBg, borderColor: palette.tileBorder }]}>
      <Text style={[styles.previewLabel, { color: palette.textSecondary }]}>Your message</Text>
      <Text style={[styles.previewText, { color: palette.text }]} accessibilityLiveRegion="polite">{preview}</Text>
      <View style={styles.previewActions}>
        <TouchableOpacity
          onPress={() => closeThen(() => onUse(preview))}
          style={[styles.useBtn, { backgroundColor: palette.primary }]}
          accessibilityRole="button"
          accessibilityLabel={`Put in message bar: ${preview}`}
        >
          <Ionicons name="arrow-up-circle-outline" size={22} color={palette.buttonText} />
          <Text style={[styles.useText, { color: palette.buttonText }]}>Use</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => closeThen(() => onSpeak(preview))}
          style={[styles.useBtn, { backgroundColor: palette.surface }]}
          accessibilityRole="button"
          accessibilityLabel={`Use and speak now: ${preview}`}
        >
          <Ionicons name="volume-high" size={22} color={palette.text} />
          <Text style={[styles.useText, { color: palette.text }]}>{experience.speakLabel} now</Text>
        </TouchableOpacity>
      </View>
    </View>
  ) : null;

  return (
    <Sheet visible={visible} onClose={onClose} onDismiss={onDismiss} title={title} icon={topic ? topic.emoji : '🧩'} tall footer={footer}>
      {!topic ? (
        <ScrollView contentContainerStyle={styles.topics}>
          <Text style={[styles.lead, { color: palette.textSecondary }]}>
            {x === 'child' ? 'What do you want to tell someone?' : 'Build a clear message in a few taps. Nothing is said until you choose.'}
          </Text>
          {TOPICS.map((tp) => (
            <TouchableOpacity
              key={tp.id}
              onPress={() => { setTopicId(tp.id); setStepIndex(0); setChoices({}); }}
              style={[styles.topic, { backgroundColor: palette.cardBg, borderColor: palette.tileBorder, borderRadius: experience.tileRadius }]}
              accessibilityRole="button"
              accessibilityLabel={tp.title[x]}
            >
              <Text style={styles.topicEmoji} importantForAccessibility="no">{tp.emoji}</Text>
              <Text style={[styles.topicText, { color: palette.text, fontFamily: experience.headlineFont }]}>{tp.title[x]}</Text>
              <Ionicons name="chevron-forward" size={20} color={palette.textSecondary} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={{ flexShrink: 1 }}>
          <View style={styles.stepHeader}>
            <TouchableOpacity
              onPress={back}
              style={[styles.navBtn, { backgroundColor: palette.surface }]}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={22} color={palette.text} />
            </TouchableOpacity>
            <View style={styles.progress} accessibilityLabel={`Step ${Math.min(stepIndex + 1, topic.steps.length)} of ${topic.steps.length}`}>
              {topic.steps.map((s, i) => (
                <View key={s.id} style={[styles.pip, { backgroundColor: i < stepIndex ? palette.primary : (i === stepIndex ? palette.text : palette.border) }]} />
              ))}
            </View>
            {step && stepIndex > 0 ? (
              <TouchableOpacity
                onPress={() => setStepIndex((i) => i + 1)}
                style={[styles.skip, { backgroundColor: palette.surface }]}
                accessibilityRole="button"
                accessibilityLabel="Skip this question"
              >
                <Text style={[styles.skipText, { color: palette.text }]}>Skip</Text>
              </TouchableOpacity>
            ) : <View style={styles.skipSpacer} />}
          </View>
          {step && !done ? (
            <>
              <Text style={[styles.question, { color: palette.text, fontFamily: experience.headlineFont }]} accessibilityRole="header">
                {step.question[x]}
              </Text>
              <ScrollView contentContainerStyle={styles.options}>
                {step.options.map((o) => (
                  <TouchableOpacity
                    key={o.id}
                    onPress={() => choose(o.id)}
                    style={[styles.option, { backgroundColor: palette.cardBg, borderColor: palette.tileBorder, borderRadius: experience.chipRadius }]}
                    accessibilityRole="button"
                    accessibilityLabel={o[x]}
                  >
                    {o.emoji ? <Text style={styles.optionEmoji} importantForAccessibility="no">{o.emoji}</Text> : null}
                    <Text style={[styles.optionText, { color: palette.text }]} numberOfLines={2}>{o[x]}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          ) : (
            <Text style={[styles.lead, { color: palette.textSecondary }]}>
              {x === 'child' ? 'All done! Check your message below.' : 'Check the message below, then use it or speak it.'}
            </Text>
          )}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  topics: { gap: spacing.sm, paddingBottom: spacing.lg },
  lead: { fontSize: 16, fontFamily: fonts.regular, lineHeight: 22, marginBottom: spacing.sm },
  topic: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, paddingHorizontal: spacing.md, borderWidth: 1 },
  topicEmoji: { fontSize: 28 },
  topicText: { flex: 1, fontSize: 19 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  navBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  progress: { flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center' },
  pip: { height: 8, flex: 1, maxWidth: 48, borderRadius: 4 },
  skip: { minWidth: 64, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  skipSpacer: { width: 64 },
  skipText: { fontSize: 16, fontFamily: fonts.bold },
  question: { fontSize: 22, marginBottom: spacing.md },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingBottom: spacing.md },
  option: {
    width: '48%', minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: spacing.md, borderWidth: 1,
  },
  optionEmoji: { fontSize: 24 },
  optionText: { flex: 1, fontSize: 17, fontFamily: fonts.bold },
  preview: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.md, marginTop: spacing.sm },
  previewLabel: { fontSize: 13, fontFamily: fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  previewText: { fontSize: 20, fontFamily: fonts.bold, lineHeight: 27, marginVertical: spacing.sm },
  previewActions: { flexDirection: 'row', gap: spacing.sm },
  useBtn: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: radii.md },
  useText: { fontSize: 17, fontFamily: fonts.bold },
});
