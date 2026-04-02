// src/components/CrisisOverlay.js
// Always-accessible emergency communication panel.
// Floating SOS button visible on every screen → opens full-screen crisis panel.
// Zero navigation required. Large targets. Instant speech on tap.
// Designed for maximum speed and minimum cognitive load in distress.

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { speak } from '../services/speechService';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, radii, spacing } from '../theme';
import { addSentenceToHistory, loadSentenceHistory } from '../services/sentenceHistoryStore';

// Phrases designed for real emergencies — short, clear, unmistakable
const CRISIS_PHRASES = [
  { id: 'help',        label: 'HELP',           phrase: 'I need help right now',   icon: 'alert-circle',          color: '#D32F2F' },
  { id: 'pain',        label: 'PAIN',           phrase: 'I am in pain',            icon: 'medkit',                color: '#E53935' },
  { id: 'stop',        label: 'STOP',           phrase: 'Stop. Please stop.',      icon: 'close-circle',          color: '#B71C1C' },
  { id: 'breathe',     label: "CAN'T BREATHE",  phrase: 'I cannot breathe',        icon: 'alert-circle-outline',  color: '#D32F2F' },
  { id: 'sick',        label: 'SICK',           phrase: 'I am going to be sick',   icon: 'warning',               color: '#E65100' },
  { id: 'call_carer',  label: 'CALL MY CARER',  phrase: 'Please call my carer',    icon: 'call',                  color: '#C62828' },
  { id: 'yes',         label: 'YES',            phrase: 'Yes',                     icon: 'checkmark-circle',      color: '#2E7D32' },
  { id: 'no',          label: 'NO',             phrase: 'No',                      icon: 'close-circle-outline',  color: '#C62828' },
  { id: 'medicine',    label: 'MEDICINE',       phrase: 'I need my medicine',      icon: 'medkit-outline',        color: '#E65100' },
  { id: 'toilet',      label: 'TOILET',         phrase: 'I need the toilet',       icon: 'navigate',              color: '#5D4037' },
  { id: 'not_safe',    label: 'NOT SAFE',       phrase: 'I do not feel safe',      icon: 'shield-outline',        color: '#B71C1C' },
  { id: 'go_home',     label: 'TAKE ME HOME',   phrase: 'Take me home',            icon: 'home',                  color: '#5D4037' },
];

// Ensure history store is loaded
loadSentenceHistory().catch(() => {});

export default function CrisisOverlay() {
  const [visible, setVisible] = useState(false);
  const [lastSpoken, setLastSpoken] = useState(null);
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);
  const insets = useSafeAreaInsets();

  // Position FAB just above the QuickRepair FAB — tight vertical stack
  const fabBottom = 60 + insets.bottom + 76;

  const handlePhrase = useCallback((item) => {
    speak(item.phrase, {
      rate: Math.max(settings.speechRate, 0.9), // never too slow in emergency
      pitch: settings.speechPitch,
      voice: settings.speechVoice,
    });
    setLastSpoken(item);
    addSentenceToHistory(item.phrase).catch(() => {});
  }, [settings]);

  const screenWidth = Dimensions.get('window').width;
  const numCols = screenWidth > 500 ? 4 : 3;

  if (settings.crisisModeEnabled === false) return null;

  return (
    <>
      {/* Floating SOS button — always visible */}
      <TouchableOpacity
        style={[styles.fab, { bottom: fabBottom }]}
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Emergency phrases"
        accessibilityHint="Opens emergency communication panel"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="alert-circle" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Full-screen crisis panel */}
      <Modal
        visible={visible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setVisible(false)}
        accessibilityViewIsModal
      >
        <View style={[styles.fullScreen, { backgroundColor: '#1A1A1A', paddingTop: insets.top }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Emergency</Text>
            <TouchableOpacity
              onPress={() => { setVisible(false); setLastSpoken(null); }}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close emergency panel"
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Last spoken phrase — large display for conversation partner */}
          {lastSpoken && (
            <TouchableOpacity
              style={styles.spokenDisplay}
              onPress={() => handlePhrase(lastSpoken)}
              accessibilityRole="button"
              accessibilityLabel={`Repeat: ${lastSpoken.phrase}`}
            >
              <Text style={styles.spokenText}>{lastSpoken.phrase}</Text>
              <Text style={styles.spokenHint}>Tap to repeat</Text>
            </TouchableOpacity>
          )}

          {/* Crisis phrase grid */}
          <View style={styles.grid}>
            {CRISIS_PHRASES.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.crisisBtn,
                  {
                    backgroundColor: item.color,
                    width: `${Math.floor(100 / numCols) - 2}%`,
                  },
                ]}
                onPress={() => handlePhrase(item)}
                accessibilityRole="button"
                accessibilityLabel={`Say: ${item.phrase}`}
                accessibilityHint="Speaks this phrase immediately"
              >
                <Ionicons name={item.icon} size={32} color="#FFFFFF" />
                <Text style={styles.crisisBtnText} numberOfLines={2} adjustsFontSizeToFit>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Bottom safety hint */}
          <Text style={styles.safetyHint}>
            Tap any button to speak immediately
          </Text>
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
    backgroundColor: '#D32F2F',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    zIndex: 1001,
  },
  fullScreen: {
    flex: 1,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FF5252',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spokenDisplay: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  spokenText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  spokenHint: {
    fontSize: 13,
    color: '#888888',
    marginTop: spacing.xs,
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
    alignContent: 'flex-start',
  },
  crisisBtn: {
    aspectRatio: 1,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    marginBottom: spacing.sm,
    minHeight: 90,
  },
  crisisBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  safetyHint: {
    color: '#888888',
    fontSize: 13,
    textAlign: 'center',
    paddingBottom: spacing.lg,
  },
});
