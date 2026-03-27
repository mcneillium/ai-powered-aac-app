// src/components/DisplayMode.js
// Full-screen display mode for showing the current sentence to conversation partners.
//
// Two modes:
// 1. DISPLAY MODE: Shows sentence text very large, no speech. For noisy environments
//    or when showing a screen to someone across a table.
// 2. LISTENER MODE: Shows the most recently spoken phrase prominently so the
//    conversation partner can read along. Auto-updates on speak.
//
// Triggered from the AAC Board sentence bar. Exits with a tap or back button.

import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  StatusBar, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette } from '../theme';
import { t } from '../i18n/strings';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function DisplayMode({ visible, onClose, text, mode = 'display' }) {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);

  if (!visible) return null;

  const isListener = mode === 'listener';
  const bgColor = settings.theme === 'highContrast' ? '#000000' : '#FFFFFF';
  const textColor = settings.theme === 'highContrast' ? '#FFD600' : '#2E2E3A';
  const displayText = text || (isListener ? t('waitingForSpeech') : t('noSentenceToDisplay'));
  const hasText = !!text;

  // Scale font size based on text length
  const baseSize = SCREEN_W > 500 ? 56 : 42;
  const fontSize = displayText.length > 40 ? baseSize * 0.7
    : displayText.length > 20 ? baseSize * 0.85
    : baseSize;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
    >
      <StatusBar hidden />
      <TouchableOpacity
        style={[styles.container, { backgroundColor: bgColor }]}
        onPress={onClose}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={t('tapToCloseLabel')}
      >
        {/* Mode label */}
        <View style={styles.header}>
          <Ionicons
            name={isListener ? 'ear-outline' : 'tv-outline'}
            size={20}
            color={palette.textSecondary}
          />
          <Text style={[styles.modeLabel, { color: palette.textSecondary }]}>
            {isListener ? t('listenerMode') : t('displayMode')}
          </Text>
        </View>

        {/* Main text */}
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.displayText,
              { color: textColor, fontSize },
              !hasText && styles.placeholderText,
            ]}
            adjustsFontSizeToFit
            numberOfLines={6}
            accessibilityRole="text"
            accessibilityLabel={`Displayed text: ${displayText}`}
          >
            {displayText}
          </Text>
        </View>

        {/* Close hint */}
        <Text style={[styles.hint, { color: palette.textSecondary }]}>
          {t('tapToClose')}
        </Text>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  header: {
    position: 'absolute',
    top: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeLabel: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  displayText: {
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: undefined, // let adjustsFontSizeToFit handle it
  },
  placeholderText: {
    fontStyle: 'italic',
    opacity: 0.5,
  },
  hint: {
    position: 'absolute',
    bottom: 32,
    fontSize: 14,
  },
});
