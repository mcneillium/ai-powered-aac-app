// src/components/ClassicTileLabel.js
// Label for a Classic board tile. Fitted in JS like the new board's tiles:
// the user's size (with the system font size) when it fits, otherwise the
// largest size down to 12 px, whole words first, then a word that is too
// wide wraps with a visible hyphen. Android shrink-to-fit is not used: it
// ignores any minimum and can shrink a word far below a readable size.

import React from 'react';
import { Text, Platform, useWindowDimensions } from 'react-native';
import { fitTileLabel } from '../design/fitLabel';

/**
 * @param {string} label
 * @param {number} size   wanted size in px before the system font size
 * @param {number} width  label width in px (0 when unknown)
 * @param {object} style  colour/weight (fontSize and lineHeight are set here)
 */
export default function ClassicTileLabel({ label, size, width, style }) {
  const { fontScale: sysScale = 1 } = useWindowDimensions();
  const fontScale = Math.min(2, Math.max(1, sysScale || 1));
  const fit = fitTileLabel(label, Math.round(size * fontScale), { width, height: Infinity, symbol: 0 });
  return (
    <Text
      style={[style, { fontSize: fit.size, lineHeight: fit.lineHeight }]}
      numberOfLines={width ? fit.lines : 2}
      // Safety net on iOS only, where the 12 px floor is honoured.
      adjustsFontSizeToFit={Platform.OS === 'ios'}
      minimumFontScale={Math.min(1, 12 / fit.size)}
      maxFontSizeMultiplier={1}
      android_hyphenationFrequency="none"
      importantForAccessibility="no"
      accessibilityElementsHidden
    >
      {fit.text}
    </Text>
  );
}
