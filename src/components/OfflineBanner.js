// src/components/OfflineBanner.js
// Shows a subtle, non-blocking banner when the device is offline.
// Does NOT block communication — just informs.
//
// It wraps the app so that, while it is shown, it owns the status-bar inset:
// the banner sits below the status bar and the screens under it get a top
// inset of 0, so they don't add the status-bar padding a second time.
// (Native test, Android 15 edge-to-edge: the banner was drawn at y 0..68
// under a 136px status bar, over the clock and icons.)
//
// The children are always rendered inside the same provider, online or
// offline, so a connectivity change never remounts navigation or loses the
// sentence being built.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '../contexts/NetworkContext';

// White on #9C4A12 is 6.2:1 (WCAG AA). The previous #E8A070 was 2.2:1.
export const BANNER_BACKGROUND = '#9C4A12';
export const BANNER_TEXT = '#FFFFFF';

export default function OfflineBanner({ children = null }) {
  const { isOnline } = useNetwork();
  const insets = useSafeAreaInsets();
  const childInsets = useMemo(
    () => (isOnline ? insets : { ...insets, top: 0 }),
    [isOnline, insets]
  );

  return (
    <>
      {!isOnline && (
        <View
          style={[styles.banner, { paddingTop: insets.top + 4 }]}
          accessible
          accessibilityRole="alert"
          accessibilityLabel="You are offline. Communication still works."
        >
          <Ionicons name="cloud-offline-outline" size={16} color={BANNER_TEXT} />
          <Text style={styles.text}>Offline — communication still works</Text>
        </View>
      )}
      <SafeAreaInsetsContext.Provider value={childInsets}>
        {children}
      </SafeAreaInsetsContext.Provider>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: BANNER_BACKGROUND,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 4,
    paddingHorizontal: 12,
    gap: 6,
  },
  text: {
    color: BANNER_TEXT,
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'center',
  },
});
