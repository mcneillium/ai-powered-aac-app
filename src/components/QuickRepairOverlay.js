// src/components/QuickRepairOverlay.js
// Always-accessible conversation repair phrases.
// This overlay can be triggered from any screen — it floats above everything.
// Critical for AAC users who need instant access to "wait", "not that", "help" etc.
//
// Design: Minimal floating button → opens a grid of high-priority phrases.
// All phrases speak immediately on tap. No sentence building required.

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Dimensions, AccessibilityInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { speak } from '../services/speechService';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, radii, spacing } from '../theme';

const REPAIR_PHRASES = [
  { id: 'wait',       label: 'Wait',           icon: 'hand-left-outline',   color: '#FF9800', priority: 'high' },
  { id: 'yes',        label: 'Yes',            icon: 'checkmark-circle',    color: '#4CAF50', priority: 'high' },
  { id: 'no',         label: 'No',             icon: 'close-circle',        color: '#F44336', priority: 'high' },
  { id: 'help',       label: 'I need help',    icon: 'alert-circle',        color: '#F44336', priority: 'high' },
  { id: 'not_that',   label: 'Not that',       icon: 'arrow-undo',          color: '#FF5722', priority: 'high' },
  { id: 'again',      label: 'Say that again', icon: 'refresh',             color: '#2979FF', priority: 'mid' },
  { id: 'thinking',   label: "I'm thinking",   icon: 'ellipsis-horizontal', color: '#9C27B0', priority: 'mid' },
  { id: 'finish',     label: 'Let me finish',  icon: 'timer-outline',       color: '#FF9800', priority: 'mid' },
  { id: 'slower',     label: 'Slower please',  icon: 'speedometer-outline', color: '#2979FF', priority: 'mid' },
  { id: 'maybe',      label: 'Maybe',          icon: 'help-circle-outline', color: '#607D8B', priority: 'mid' },
  { id: 'private',    label: "That's private", icon: 'lock-closed',         color: '#795548', priority: 'low' },
  { id: 'i_mean',     label: 'I mean...',      icon: 'swap-horizontal',     color: '#009688', priority: 'low' },
];

export default function QuickRepairOverlay() {
  const [visible, setVisible] = useState(false);
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);

  const handlePhrase = (phrase) => {
    speak(phrase.label, {
      rate: settings.speechRate,
      pitch: settings.speechPitch,
      voice: settings.speechVoice,
    });
    // Don't close — user may need multiple quick phrases in succession
  };

  const screenWidth = Dimensions.get('window').width;
  const numCols = screenWidth > 500 ? 4 : 3;

  return (
    <>
      {/* Floating trigger button — always visible */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: palette.primary }]}
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Quick phrases. Tap for instant communication repair phrases like wait, yes, no, help."
        accessibilityHint="Opens quick repair phrase panel"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="flash" size={24} color={palette.buttonText} />
      </TouchableOpacity>

      {/* Full-screen overlay with repair phrases */}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
        accessibilityViewIsModal
      >
        <View style={[styles.overlay, { backgroundColor: palette.overlay }]}>
          <View style={[styles.panel, { backgroundColor: palette.cardBg }]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: palette.text }]}>Quick Phrases</Text>
              <TouchableOpacity
                onPress={() => setVisible(false)}
                style={[styles.closeBtn, { backgroundColor: palette.danger }]}
                accessibilityRole="button"
                accessibilityLabel="Close quick phrases"
              >
                <Ionicons name="close" size={24} color={palette.buttonText} />
              </TouchableOpacity>
            </View>

            <View style={styles.grid}>
              {REPAIR_PHRASES.map((phrase) => (
                <TouchableOpacity
                  key={phrase.id}
                  style={[
                    styles.phraseBtn,
                    {
                      backgroundColor: phrase.color,
                      width: `${Math.floor(100 / numCols) - 2}%`,
                    },
                  ]}
                  onPress={() => handlePhrase(phrase)}
                  accessibilityRole="button"
                  accessibilityLabel={`Say: ${phrase.label}`}
                  accessibilityHint="Speaks this phrase immediately"
                >
                  <Ionicons name={phrase.icon} size={28} color="#FFFFFF" />
                  <Text style={styles.phraseText} numberOfLines={2} adjustsFontSizeToFit>
                    {phrase.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  panel: {
    width: '100%',
    maxWidth: 500,
    borderRadius: radii.lg,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  phraseBtn: {
    aspectRatio: 1,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    marginBottom: spacing.sm,
    minHeight: 80,
  },
  phraseText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
});
