// Renders a symbol from OpenMoji (static require), ARASAAC (remote URL), or fallback.
// Usage: <SymbolImage symbol={symbolResult} size={64} />
//    or: <SymbolImage hexcode="1F604" size={64} />  (direct OpenMoji)
//    or: <SymbolImage word="happy" size={64} />      (lookup by word)

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { getOpenMojiSource, getOpenMojiForWord } from '../data/symbolAssetMap';

const PLACEHOLDER_COLORS = [
  '#5BB5B5', '#FF7043', '#42A5F5', '#66BB6A',
  '#EF5350', '#FFA726', '#AB47BC', '#78909C',
];

function getPlaceholderColor(word) {
  if (!word) return PLACEHOLDER_COLORS[0];
  let hash = 0;
  for (let i = 0; i < word.length; i++) {
    hash = word.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PLACEHOLDER_COLORS[Math.abs(hash) % PLACEHOLDER_COLORS.length];
}

function SymbolImageInner({ symbol, hexcode, word, size = 64, style, fallbackLabel }) {
  const accessLabel = fallbackLabel || word || hexcode || 'Symbol';

  // Direct hexcode prop
  if (hexcode) {
    const source = getOpenMojiSource(hexcode);
    if (source) {
      return (
        <Image
          source={source}
          style={[{ width: size, height: size }, style]}
          contentFit="contain"
          cachePolicy="memory-disk"
          accessible={true}
          accessibilityLabel={accessLabel}
        />
      );
    }
  }

  // Direct word prop — try static map
  if (word && !symbol) {
    const source = getOpenMojiForWord(word);
    if (source) {
      return (
        <Image
          source={source}
          style={[{ width: size, height: size }, style]}
          contentFit="contain"
          cachePolicy="memory-disk"
          accessible={true}
          accessibilityLabel={accessLabel}
        />
      );
    }
  }

  // Symbol result object from symbolService
  if (symbol) {
    if (symbol.type === 'static' && symbol.asset) {
      return (
        <Image
          source={symbol.asset}
          style={[{ width: size, height: size }, style]}
          contentFit="contain"
          cachePolicy="memory-disk"
          accessible={true}
          accessibilityLabel={accessLabel}
        />
      );
    }
    if (symbol.uri) {
      return (
        <Image
          source={{ uri: symbol.uri }}
          style={[{ width: size, height: size }, style]}
          contentFit="contain"
          cachePolicy="memory-disk"
          placeholder={require('../../assets/icon.png')}
          placeholderContentFit="contain"
          transition={200}
          accessible={true}
          accessibilityLabel={accessLabel}
        />
      );
    }
  }

  // Fallback: colored circle with first letter
  const label = fallbackLabel || word || '';
  const letter = label.charAt(0).toUpperCase();
  const bg = getPlaceholderColor(label);
  return (
    <View style={[styles.placeholder, { width: size, height: size, backgroundColor: bg }, style]}>
      {letter ? (
        <Text style={[styles.placeholderText, { fontSize: size * 0.4 }]}>{letter}</Text>
      ) : null}
    </View>
  );
}

const SymbolImage = React.memo(SymbolImageInner);
export default SymbolImage;

const styles = StyleSheet.create({
  placeholder: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
