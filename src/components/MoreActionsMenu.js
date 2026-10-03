// src/components/MoreActionsMenu.js
// Less frequent message actions (favourites, history, saving a favourite,
// show on screen, Help me explain, situations, camera, voice style) in one
// menu, so the message card keeps a single fixed row of core actions.
// Items keep a fixed order; unavailable items are shown disabled, not hidden.

import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPalette, fonts, radii, spacing } from '../theme';
import { useSettings } from '../contexts/SettingsContext';
import { t } from '../i18n/strings';
import VoicePresetPicker from './VoicePresetPicker';

export default function MoreActionsMenu({ visible, onClose, items, voicePreset, onSelectVoicePreset }) {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);
  // iOS cannot present another modal (e.g. Show on screen) while this one is
  // still dismissing, so run the chosen action once dismissal has finished.
  const pending = useRef(null);
  const choose = (item) => {
    if (Platform.OS === 'ios') {
      pending.current = item.onPress;
      onClose();
    } else {
      onClose();
      setTimeout(item.onPress, 0);
    }
  };
  const handleDismiss = () => {
    const action = pending.current;
    pending.current = null;
    if (action) action();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onDismiss={handleDismiss} accessibilityViewIsModal>
      <View style={[styles.overlay, { backgroundColor: palette.overlay }]}>
        <View style={[styles.panel, { backgroundColor: palette.background }]}>
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
                onPress={() => choose(item)}
                disabled={item.disabled}
                style={[styles.item, { borderBottomColor: palette.border }, item.disabled && styles.disabled]}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityState={{ disabled: !!item.disabled }}
              >
                <Ionicons name={item.icon} size={22} color={palette.primary} />
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
  panel: { borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.lg, maxHeight: '85%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  title: { fontSize: 20, fontFamily: fonts.bold },
  closeBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth },
  itemText: { fontSize: 17, fontFamily: fonts.bold, flex: 1 },
  section: { fontSize: 13, fontFamily: fonts.bold, marginTop: spacing.md, marginBottom: spacing.xs, textTransform: 'uppercase' },
  disabled: { opacity: 0.4 },
});
