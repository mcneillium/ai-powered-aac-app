// src/components/Sheet.js
// Bottom sheet used for every board panel (favourites, history, situations,
// Help me explain). Panels used to open inline and push the word grid down;
// as a sheet they cover it instead, so no word ever moves.

import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPalette, getExperience, fonts, radii, spacing } from '../theme';
import { useSettings } from '../contexts/SettingsContext';
import { t } from '../i18n/strings';

/**
 * Runs an action after the sheet has closed. iOS cannot present another
 * modal while this one is still dismissing.
 */
export function useAfterClose(onClose) {
  const pending = useRef(null);
  const closeThen = (action) => {
    if (Platform.OS === 'ios') {
      pending.current = action;
      onClose();
    } else {
      onClose();
      if (action) setTimeout(action, 0);
    }
  };
  const onDismiss = () => {
    const action = pending.current;
    pending.current = null;
    if (action) action();
  };
  return { closeThen, onDismiss };
}

export default function Sheet({ visible, onClose, onDismiss, title, icon, children, tall = false, footer = null }) {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);
  const x = getExperience(settings.experience);
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={onDismiss}
      statusBarTranslucent
      navigationBarTranslucent
      accessibilityViewIsModal
    >
      <View style={[styles.overlay, { backgroundColor: palette.overlay }]}>
        <TouchableOpacity
          style={styles.scrim}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('close')}
        />
        <View
          style={[
            styles.panel,
            tall && styles.tall,
            { backgroundColor: palette.background, paddingBottom: spacing.lg + insets.bottom },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: palette.border }]} />
          <View style={styles.header}>
            {icon ? <Text style={styles.icon} importantForAccessibility="no">{icon}</Text> : null}
            <Text
              style={[styles.title, { color: palette.text, fontFamily: x.headlineFont }]}
              accessibilityRole="header"
              numberOfLines={2}
            >
              {title}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: palette.surface }]}
              accessibilityRole="button"
              accessibilityLabel={t('close')}
            >
              <Ionicons name="close" size={24} color={palette.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.body}>{children}</View>
          {footer}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  scrim: { flex: 1 },
  panel: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: '86%',
  },
  tall: { height: '86%' },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  icon: { fontSize: 26 },
  title: { flex: 1, fontSize: 22, fontFamily: fonts.bold },
  closeBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  body: { flexShrink: 1 },
});
