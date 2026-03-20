// src/screens/OnboardingScreen.js
// First-launch welcome screen. Sets hasLaunched in AsyncStorage.
// Accessible, themed, and informative without being overwhelming.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

export default function OnboardingScreen({ onComplete }) {
  const completeOnboarding = async () => {
    await AsyncStorage.setItem('hasLaunched', 'true');
    if (onComplete) onComplete();
  };

  return (
    <View style={styles.container} accessible accessibilityRole="summary">
      <View style={styles.iconRow}>
        <Ionicons name="chatbubble-ellipses" size={64} color="#4CAF50" />
      </View>

      <Text style={styles.title}>Welcome to CommAI</Text>
      <Text style={styles.subtitle}>Your communication assistant</Text>

      <View style={styles.features}>
        <FeatureRow icon="grid-outline" text="Tap words to build sentences" />
        <FeatureRow icon="volume-high-outline" text="Speak your sentences aloud" />
        <FeatureRow icon="color-palette-outline" text="Customise themes and voice" />
        <FeatureRow icon="cloud-offline-outline" text="Works offline — no internet needed" />
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={completeOnboarding}
        accessibilityRole="button"
        accessibilityLabel="Get started with the app"
        accessibilityHint="Dismisses this welcome screen and opens the communication board"
      >
        <Text style={styles.buttonText}>Get Started</Text>
        <Ionicons name="arrow-forward" size={20} color="#FFF" />
      </TouchableOpacity>

      <Text style={styles.note}>
        No account needed — sign in later to sync across devices.
      </Text>
    </View>
  );
}

function FeatureRow({ icon, text }) {
  return (
    <View style={styles.featureRow} accessibilityRole="text">
      <Ionicons name={icon} size={24} color="#4CAF50" style={styles.featureIcon} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#FFFFFF',
  },
  iconRow: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  features: {
    width: '100%',
    marginBottom: 32,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  featureIcon: {
    marginRight: 12,
    width: 28,
  },
  featureText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
    minWidth: 200,
    justifyContent: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  note: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
});
