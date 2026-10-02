// src/components/MoreActionsMenu.js
// Compact layout only: less frequent sentence actions (favourites, history,
// show on screen, camera, voice style) in one menu, so small screens keep a
// single fixed row of core actions above the word grid.
// Items keep a fixed order; unavailable items are shown disabled, not hidden.

import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPalette, radii, spacing } from '../theme';
import { useSettings } from '../contexts/SettingsContext';
import { t } from '../i18n/strings';
import VoicePresetPicker from './VoicePresetPicker';

export default function MoreActionsMenu({ visible, onClose, items, voicePreset, onSelectVoicePreset }) {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} accessibilityViewIsModal>
      <View style={[styles.overlay, { backgroundColor: palette.overlay }]}>
        <View style={[styles.panel, { backgroundColor: palette.cardBg }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.text }]} accessibilityRole="header">
              {t('moreActions')}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: palette.chipBg }]}
              accessibilityRole="button"
              accessibilityLabel={t('close')}
            >
              <Ionicons name="close" size={24} color={palette.text} />
            </TouchableOpacity>
          </View>
          <ScrollView>
            {items.map(item => (
              <TouchableOpacity
                key={item.key}
                onPress={() => { onClose(); item.onPress(); }}
                disabled={item.disabled}
                style={[styles.item, { borderBottomColor: palette.border }, item.disabled && styles.disabled]}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityState={{ disabled: !!item.disabled }}
              >
                <Ionicons name={item.icon} size={22} color={palette.text} />
                <Text style={[styles.itemText, { color: palette.text }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            {settings.showVoiceStyles !== false && (
              <>
                <Text style={[styles.section, { color: palette.textSecondary }]}>{t('voiceStyle')}</Text>
                <VoicePresetPicker activePreset={voicePreset} onSelect={onSelectVoicePreset} />
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  panel: { borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg, maxHeight: '85%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  title: { fontSize: 18, fontWeight: '700' },
  closeBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth },
  itemText: { fontSize: 17, fontWeight: '500', flex: 1 },
  section: { fontSize: 13, fontWeight: '600', marginTop: spacing.md, marginBottom: spacing.xs, textTransform: 'uppercase' },
  disabled: { opacity: 0.4 },
});
