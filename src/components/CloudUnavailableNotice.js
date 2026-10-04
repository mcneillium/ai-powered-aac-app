// src/components/CloudUnavailableNotice.js
// Shown ONLY on screens whose features need cloud services (accounts, sync,
// online suggestions) when Firebase is not configured or failed to start.
// Communication screens never show it: they work fully on the device.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isFirebaseAvailable } from '../../firebaseConfig';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, radii, spacing } from '../theme';

export default function CloudUnavailableNotice({ feature = 'Accounts and sync' }) {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme, settings.boardLayout);
  if (isFirebaseAvailable()) return null;

  return (
    <View
      style={[styles.box, { backgroundColor: palette.surface, borderColor: palette.border }]}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${feature} are unavailable in this version of the app. Communication boards, speech, favourites and history still work on this device.`}
    >
      <Ionicons name="cloud-offline-outline" size={22} color={palette.text} />
      <Text style={[styles.text, { color: palette.text }]}>
        {feature} are unavailable in this version of the app. Communication boards, speech, favourites and history still work on this device.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  text: { flex: 1, fontSize: 15, lineHeight: 21 },
});
