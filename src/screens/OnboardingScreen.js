// src/screens/OnboardingScreen.js
// Multi-step onboarding that introduces the AAC app to new users.
// Accessible, themed, and sets initial preferences.

import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  Dimensions, Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { brand } from '../theme';

const { width } = Dimensions.get('window');

const slides = [
  {
    key: 'welcome',
    title: `Welcome to ${brand.name}`,
    description: 'A powerful communication tool designed for everyone. Tap words to build sentences and speak them aloud.',
    icon: 'chatbubbles',
    color: '#4CAF50',
  },
  {
    key: 'offline',
    title: 'Works Offline',
    description: 'Your vocabulary and AI predictions work without the internet. No connection needed to communicate.',
    icon: 'cloud-offline',
    color: '#2196F3',
  },
  {
    key: 'personalise',
    title: 'Personalise Your Experience',
    description: 'Adjust grid size, themes, speech speed, and voice in Settings. The app learns from your usage over time.',
    icon: 'settings',
    color: '#FF9800',
  },
  {
    key: 'ready',
    title: "You're Ready!",
    description: 'Start communicating. Sign in later to sync across devices, or use guest mode — no account required.',
    icon: 'rocket',
    color: '#9C27B0',
  },
];

export default function OnboardingScreen({ onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);

  const completeOnboarding = async () => {
    await AsyncStorage.setItem('hasLaunched', 'true');
    if (onComplete) onComplete();
  };

  const goToNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      completeOnboarding();
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const renderSlide = ({ item }) => (
    <View style={[styles.slide, { width }]} accessible accessibilityLabel={`${item.title}. ${item.description}`}>
      <View style={[styles.iconCircle, { backgroundColor: item.color + '20' }]}>
        <Ionicons name={item.icon} size={64} color={item.color} />
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>
    </View>
  );

  const isLast = currentIndex === slides.length - 1;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.skipBtn}
        onPress={completeOnboarding}
        accessibilityRole="button"
        accessibilityLabel="Skip onboarding"
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        renderItem={renderSlide}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentIndex && styles.dotActive]}
              accessibilityLabel={`Page ${i + 1} of ${slides.length}`}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: slides[currentIndex]?.color || brand.primaryColor }]}
          onPress={goToNext}
          accessibilityRole="button"
          accessibilityLabel={isLast ? 'Get started' : 'Next slide'}
        >
          <Text style={styles.nextText}>{isLast ? 'Get Started' : 'Next'}</Text>
          <Ionicons name={isLast ? 'checkmark' : 'arrow-forward'} size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  skipBtn: { position: 'absolute', top: 56, right: 20, zIndex: 10, padding: 8 },
  skipText: { fontSize: 16, color: '#999' },
  slide: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  iconCircle: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#000', textAlign: 'center', marginBottom: 16 },
  description: { fontSize: 17, color: '#555', textAlign: 'center', lineHeight: 24 },
  footer: { paddingHorizontal: 24, paddingBottom: 40, alignItems: 'center' },
  dots: { flexDirection: 'row', marginBottom: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DDD', marginHorizontal: 4 },
  dotActive: { backgroundColor: '#4CAF50', width: 24 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 28, gap: 8 },
  nextText: { color: '#FFF', fontSize: 18, fontWeight: '600' },
});
