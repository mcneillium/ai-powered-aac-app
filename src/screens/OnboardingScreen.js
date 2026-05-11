// src/screens/OnboardingScreen.js
// Picture-based onboarding: large OpenMoji illustrations with short captions.

import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { brand, getPalette, radii, spacing } from '../theme';
import SymbolImage from '../components/SymbolImage';

const { width } = Dimensions.get('window');
const p = getPalette('light');

const slides = [
  {
    key: 'welcome',
    caption: 'Tap to talk!',
    hexcode: '1F4AC',
    color: p.primary,
    bg: '#E3F2FD',
  },
  {
    key: 'offline',
    caption: 'Works offline',
    hexcode: '1F4F1',
    color: p.info,
    bg: '#E8F5E9',
  },
  {
    key: 'feelings',
    caption: 'Share feelings',
    hexcode: '1F604',
    color: '#4CAF50',
    bg: '#FFF9C4',
  },
  {
    key: 'ready',
    caption: "Let's go!",
    hexcode: '1F3C3',
    color: p.accent,
    bg: '#F3E5F5',
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
    <View style={[styles.slide, { width, backgroundColor: item.bg }]} accessible accessibilityLabel={item.caption}>
      <View style={[styles.iconCircle, { backgroundColor: '#FFFFFF' }]}>
        <SymbolImage hexcode={item.hexcode} size={120} />
      </View>
      <Text style={styles.caption}>{item.caption}</Text>
    </View>
  );

  const isLast = currentIndex === slides.length - 1;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.skipBtn}
        onPress={completeOnboarding}
        accessibilityRole="button"
        accessibilityLabel="Skip"
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
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: slides[currentIndex]?.color || brand.primaryColor }]}
          onPress={goToNext}
          accessibilityRole="button"
          accessibilityLabel={isLast ? 'Get started' : 'Next'}
        >
          <Text style={styles.nextText}>{isLast ? 'Start' : 'Next'}</Text>
          <Ionicons name={isLast ? 'checkmark' : 'arrow-forward'} size={24} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: p.background },
  skipBtn: { position: 'absolute', top: 56, right: spacing.xl, zIndex: 10, padding: spacing.sm },
  skipText: { fontSize: 16, color: p.textSecondary, fontWeight: '600' },
  slide: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xxl },
  iconCircle: {
    width: 180, height: 180, borderRadius: 90,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.xxl,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  caption: { fontSize: 32, fontWeight: '800', color: '#333', textAlign: 'center' },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: 40, alignItems: 'center', backgroundColor: p.background },
  dots: { flexDirection: 'row', marginBottom: spacing.xl },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: p.border, marginHorizontal: spacing.xs },
  dotActive: { backgroundColor: p.primary, width: 28 },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 40, paddingVertical: 16,
    borderRadius: radii.xl, gap: spacing.sm,
    minWidth: 160, justifyContent: 'center',
  },
  nextText: { color: '#FFF', fontSize: 20, fontWeight: '700' },
});
