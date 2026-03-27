// src/components/QuickRepairOverlay.js
// Always-accessible conversation repair phrases.
// This overlay can be triggered from any screen — it floats above everything.
// Critical for AAC users who need instant access to "wait", "not that", "help" etc.
//
// Design: Minimal floating button → opens a grid of high-priority phrases.
// All phrases speak immediately on tap. No sentence building required.
// Supports switch scanning when the modal is open.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { speak } from '../services/speechService';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, radii, spacing } from '../theme';
import { t } from '../i18n/strings';
import {
  setScanItems, onScanChange, onScanSelect,
  startScan, stopScan, cleanup as cleanupScan,
  getScanState, advanceScan, selectCurrent,
} from '../services/switchScanService';

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
  const [scanFocusId, setScanFocusId] = useState(null);
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);
  const wasScanningBefore = useRef(false);

  const handlePhrase = useCallback((phrase) => {
    speak(phrase.label, {
      rate: settings.speechRate,
      pitch: settings.speechPitch,
      voice: settings.speechVoice,
    });
  }, [settings]);

  // When modal opens, take over scan with repair phrases.
  // When modal closes, restore previous scan state.
  useEffect(() => {
    if (visible) {
      wasScanningBefore.current = getScanState().isRunning;
      if (wasScanningBefore.current) {
        stopScan();
      }
      const items = REPAIR_PHRASES.map(p => ({ type: 'repair', id: p.id, phrase: p }));
      // Add close button as last scan item
      items.push({ type: 'close', id: 'close_repair', label: 'Close' });
      setScanItems(items);

      onScanChange(({ currentIndex, isRunning }) => {
        if (!isRunning || currentIndex < 0) {
          setScanFocusId(null);
        } else {
          setScanFocusId(items[currentIndex]?.id || null);
        }
      });
      onScanSelect(({ item }) => {
        if (!item) return;
        if (item.type === 'repair') {
          handlePhrase(item.phrase);
        } else if (item.type === 'close') {
          setVisible(false);
        }
      });

      if (wasScanningBefore.current) {
        startScan();
      }
    } else {
      // Modal closed — stop scanning repair items
      setScanFocusId(null);
      stopScan();
      // AACBoard will re-register its own items when it re-renders
    }
  }, [visible, handlePhrase]);

  const screenWidth = Dimensions.get('window').width;
  const numCols = screenWidth > 500 ? 4 : 3;

  const scanRing = { borderColor: '#FF6600', borderWidth: 4 };

  return (
    <>
      {/* Floating trigger button — always visible */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: palette.primary }]}
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={t('quickPhrasesLabel')}
        accessibilityHint={t('quickPhrasesHint')}
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
              <Text style={[styles.title, { color: palette.text }]}>{t('quickPhrases')}</Text>
              <TouchableOpacity
                onPress={() => setVisible(false)}
                style={[styles.closeBtn, { backgroundColor: palette.danger }, scanFocusId === 'close_repair' && scanRing]}
                accessibilityRole="button"
                accessibilityLabel={t('closeQuickPhrases')}
              >
                <Ionicons name="close" size={24} color={palette.buttonText} />
              </TouchableOpacity>
            </View>

            {/* Scan controls when scanning is active inside the modal */}
            {visible && wasScanningBefore.current && (
              <View style={styles.scanControls}>
                {getScanState().scanMode === 'step' ? (
                  <>
                    <TouchableOpacity onPress={advanceScan} style={[styles.scanBtn, { backgroundColor: palette.info }]}
                      accessibilityRole="button" accessibilityLabel={t('scanNext')}>
                      <Text style={[styles.scanBtnText, { color: palette.buttonText }]}>{t('scanNext')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={selectCurrent} style={[styles.scanBtn, { backgroundColor: palette.primary }]}
                      accessibilityRole="button" accessibilityLabel={t('scanSelect')}>
                      <Text style={[styles.scanBtnText, { color: palette.buttonText }]}>{t('scanSelect')}</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={[styles.scanHint, { color: palette.textSecondary }]}>
                    {t('scanningSelectHint')}
                  </Text>
                )}
              </View>
            )}

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
                    scanFocusId === phrase.id && scanRing,
                  ]}
                  onPress={() => handlePhrase(phrase)}
                  accessibilityRole="button"
                  accessibilityLabel={`Say: ${phrase.label}`}
                  accessibilityHint="Speaks this phrase immediately"
                  accessibilityState={{ selected: scanFocusId === phrase.id }}
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
  scanControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  scanBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  scanBtnText: { fontSize: 14, fontWeight: '600' },
  scanHint: { fontSize: 13, fontStyle: 'italic' },
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
