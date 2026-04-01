// src/components/VoicePresetPicker.js
// Compact horizontal picker for voice expression presets.
// Shows in the AAC Board above the suggestion strip.
// Users tap to change how their speech sounds (calm, excited, serious, etc.)

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { voicePresets } from '../services/speechService';
import { getPalette, spacing, radii } from '../theme';
import { t } from '../i18n/strings';
import { useSettings } from '../contexts/SettingsContext';

const PRESET_LIST = Object.entries(voicePresets).map(([id, preset]) => ({
  id,
  ...preset,
}));

export default function VoicePresetPicker({ activePreset, onSelect }) {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);

  return (
    <View style={[styles.container, { backgroundColor: palette.surface }]}>
      <Ionicons name="mic-outline" size={14} color={palette.textSecondary} style={{ marginLeft: spacing.sm }} />
      <FlatList
        data={PRESET_LIST}
        horizontal
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isActive = item.id === activePreset;
          return (
            <TouchableOpacity
              style={[
                styles.chip,
                {
                  backgroundColor: isActive ? palette.primary : palette.chipBg,
                  borderColor: isActive ? palette.primary : palette.border,
                },
              ]}
              onPress={() => onSelect(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`${t('voiceStyle')}: ${item.label}`}
              accessibilityState={{ selected: isActive }}
            >
              <Ionicons
                name={item.icon}
                size={14}
                color={isActive ? palette.buttonText : palette.text}
              />
              <Text
                style={[
                  styles.chipText,
                  { color: isActive ? palette.buttonText : palette.text },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  list: {
    paddingHorizontal: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginHorizontal: 3,
    gap: 4,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
