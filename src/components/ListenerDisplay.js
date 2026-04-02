// src/components/ListenerDisplay.js
// Auto Listener Mode: shows spoken text in large print for conversation partners.
// Appears as a bottom sheet overlay after any speech event.
// Auto-dismisses after a few seconds. Tap to dismiss early.
// Does not interrupt fast communication — uses non-blocking overlay.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, radii, spacing } from '../theme';
import { onSpeech } from '../services/speechService';

const DISPLAY_DURATION = 4000; // ms before auto-dismiss
const FADE_DURATION = 300;

export default function ListenerDisplay() {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef(null);

  const dismiss = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_DURATION,
      useNativeDriver: true,
    }).start(() => setText(null));
  }, [opacity]);

  const show = useCallback((spokenText) => {
    if (!spokenText || !spokenText.trim()) return;
    setText(spokenText.trim());

    // Reset and fade in
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_DURATION,
      useNativeDriver: true,
    }).start();

    // Auto-dismiss
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(dismiss, DISPLAY_DURATION);
  }, [opacity, dismiss]);

  useEffect(() => {
    if (!settings.listenerModeEnabled) return;
    const unsub = onSpeech(show);
    return () => {
      unsub();
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [settings.listenerModeEnabled, show]);

  if (!settings.listenerModeEnabled || !text) return null;

  // Scale font size based on text length for readability
  const fontSize = text.length > 80 ? 24 : text.length > 40 ? 30 : 36;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          backgroundColor: palette.cardBg,
          borderColor: palette.border,
          paddingBottom: insets.bottom + 70, // above tab bar
        },
      ]}
      pointerEvents="box-only"
    >
      <TouchableOpacity
        style={styles.touchArea}
        onPress={dismiss}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={`Spoken text: ${text}. Tap to dismiss.`}
      >
        <Text style={[styles.spokenText, { color: palette.text, fontSize }]}>
          {text}
        </Text>
        <Text style={[styles.hint, { color: palette.textSecondary }]}>
          Tap to dismiss
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    zIndex: 999,
  },
  touchArea: {
    padding: spacing.xl,
    paddingTop: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  spokenText: {
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 44,
  },
  hint: {
    fontSize: 13,
    marginTop: spacing.md,
  },
});
