// Scan actions get equal width and grow vertically with the user's text.
// Keep this outside normal board flow so starting a scan never moves tiles.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '../i18n/strings';

export default function ScanControls({ mode, onStop, onNext, onSelect, colors, textScale = 1 }) {
  const actions = [
    { key: 'stop', label: t('stopScanShort'), name: t('stopScanning'), icon: 'stop-circle-outline', press: onStop, bg: colors.stopBg, fg: colors.stopFg },
    ...(mode === 'step' ? [{ key: 'next', label: t('scanNext'), icon: 'arrow-forward', press: onNext, bg: colors.quietBg, fg: colors.quietFg }] : []),
    { key: 'select', label: t('scanSelect'), icon: 'checkmark-circle-outline', press: onSelect, bg: colors.selectBg, fg: colors.selectFg },
  ];
  return (
    <View style={styles.row}>
      {actions.map(action => (
        <Pressable key={action.key} onPress={action.press}
          accessibilityRole="button" accessibilityLabel={action.name || action.label}
          style={({ pressed }) => [styles.button, { backgroundColor: action.bg, opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name={action.icon} size={24} color={action.fg} accessibilityElementsHidden importantForAccessibility="no" />
          <Text adjustsFontSizeToFit={false} style={[styles.label, { color: action.fg, fontSize: 14 * textScale }]}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', gap: 8, width: '100%' },
  button: { flex: 1, minWidth: 0, minHeight: 48, padding: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { alignSelf: 'stretch', textAlign: 'center', fontWeight: '600', marginTop: 4 },
});
