// src/components/PartnerCoachOverlay.js
// Lightweight advisory overlay for conversation partners / caregivers.
// Shows evidence-based communication tips to help partners support
// the AAC user without taking over their voice.
//
// Design: calm, non-intrusive, card-based tips. Accessible via a
// floating button or from Settings. NEVER speaks for the AAC user.

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, radii, spacing } from '../theme';

const COACHING_TIPS = [
  {
    id: 'wait',
    title: 'Wait longer',
    detail: 'AAC takes time. Wait at least 10 seconds after asking a question before saying anything else. Silence is OK.',
    icon: 'time-outline',
    color: '#2979FF',
  },
  {
    id: 'one_thing',
    title: 'Ask one thing at a time',
    detail: 'Multiple questions at once are overwhelming. Ask one clear question and wait for a response before moving on.',
    icon: 'finger-print-outline',
    color: '#7C4DFF',
  },
  {
    id: 'choices',
    title: 'Offer two choices',
    detail: 'Instead of open-ended questions, try: "Do you want A or B?" This reduces cognitive load and speeds up communication.',
    icon: 'git-compare-outline',
    color: '#FF9800',
  },
  {
    id: 'confirm',
    title: 'Confirm understanding',
    detail: 'Repeat back what you think they said: "I think you mean... is that right?" This shows you are listening and helps correct misunderstandings.',
    icon: 'checkmark-circle-outline',
    color: '#4CAF50',
  },
  {
    id: 'eye_level',
    title: 'Get to their level',
    detail: 'Make eye contact at the same height. Face them directly so they can see your expressions and feel included in the conversation.',
    icon: 'eye-outline',
    color: '#00BCD4',
  },
  {
    id: 'dont_finish',
    title: 'Do not finish their sentences',
    detail: 'It is tempting to guess what they are saying, but let them finish. Their voice matters more than speed.',
    icon: 'hand-left-outline',
    color: '#E91E63',
  },
  {
    id: 'presumeCompetence',
    title: 'Presume competence',
    detail: 'Speak to them at their age level. Using AAC does not mean they do not understand. Talk to them, not about them.',
    icon: 'person-outline',
    color: '#FF5722',
  },
  {
    id: 'model',
    title: 'Model AAC use',
    detail: 'Point to words on their device as you speak. This shows them how to use it and normalises AAC as a valid way to communicate.',
    icon: 'tablet-portrait-outline',
    color: '#9C27B0',
  },
  {
    id: 'topic',
    title: 'Name the topic',
    detail: 'Start by saying what you are talking about: "I want to talk about lunch." This helps them find the right words faster.',
    icon: 'chatbubble-outline',
    color: '#607D8B',
  },
  {
    id: 'respect_no',
    title: 'Respect "no" and "stop"',
    detail: 'If they say no or stop, honour it immediately. Trust their communication even when it is short or unexpected.',
    icon: 'shield-outline',
    color: '#F44336',
  },
];

export default function PartnerCoachOverlay() {
  const [visible, setVisible] = useState(false);
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);
  const insets = useSafeAreaInsets();

  // Position below Crisis FAB (which is at 60 + insets.bottom + 80)
  const fabBottom = 60 + insets.bottom + 140;

  if (settings.partnerCoachEnabled === false) return null;

  return (
    <>
      {/* Floating partner coach button */}
      <TouchableOpacity
        style={[styles.fab, { bottom: fabBottom, backgroundColor: palette.info }]}
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Partner coaching tips"
        accessibilityHint="Opens communication tips for conversation partners"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="people-outline" size={22} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Full coaching overlay */}
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
        accessibilityViewIsModal
      >
        <View style={[styles.overlay, { backgroundColor: palette.background, paddingTop: insets.top }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: palette.text }]}>Partner Tips</Text>
              <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
                How to support this conversation
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setVisible(false)}
              style={[styles.closeBtn, { backgroundColor: palette.chipBg }]}
              accessibilityRole="button"
              accessibilityLabel="Close partner tips"
            >
              <Ionicons name="close" size={24} color={palette.text} />
            </TouchableOpacity>
          </View>

          {/* Tips list */}
          <ScrollView contentContainerStyle={styles.tipsList} showsVerticalScrollIndicator={false}>
            {COACHING_TIPS.map((tip) => (
              <View key={tip.id} style={[styles.tipCard, { backgroundColor: palette.cardBg }]}>
                <View style={[styles.tipIcon, { backgroundColor: tip.color }]}>
                  <Ionicons name={tip.icon} size={22} color="#FFFFFF" />
                </View>
                <View style={styles.tipContent}>
                  <Text style={[styles.tipTitle, { color: palette.text }]}>{tip.title}</Text>
                  <Text style={[styles.tipDetail, { color: palette.textSecondary }]}>{tip.detail}</Text>
                </View>
              </View>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    zIndex: 1000,
  },
  overlay: {
    flex: 1,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipsList: {
    gap: spacing.md,
  },
  tipCard: {
    flexDirection: 'row',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  tipIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  tipDetail: {
    fontSize: 14,
    lineHeight: 20,
  },
});
