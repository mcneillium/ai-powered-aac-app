// src/components/OfflineBanner.js
// Shows a subtle, non-blocking banner when the device is offline.
// Does NOT block communication — just informs.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetwork } from '../contexts/NetworkContext';

export default function OfflineBanner() {
  const { isOnline } = useNetwork();

  if (isOnline) return null;

  return (
    <View
      style={styles.banner}
      accessible
      accessibilityRole="alert"
      accessibilityLabel="You are offline. Communication still works."
    >
      <Ionicons name="cloud-offline-outline" size={16} color="#FFF" />
      <Text style={styles.text}>Offline — communication still works</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FF9800',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    gap: 6,
  },
  text: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
  },
});
