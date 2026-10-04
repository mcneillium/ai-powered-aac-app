// src/components/ClassicTileLabel.js
// Label for a Classic board tile. Fitted in JS like the new board's tiles:
// the user's size (with the system font size) when it fits, otherwise the
// largest size down to 12 px, whole words first, then a word that is too
// wide wraps with a visible hyphen. Android shrink-to-fit is not used: it
// ignores any minimum and can shrink a word far below a readable size.

import React, { useMemo } from 'react';
import { Text, Platform, useWindowDimensions } from 'react-native';
import { fitTileLabel } from '../design/fitLabel';

/**
 * Label width of a Classic tile: grid padding 4 and tile margin 3 on each
 * side, padding 8 each side, and the widest border (the 4 px scan ring) plus
 * 1.5 px of slack. Errs on the narrow side.
 */
export function classicLabelWidth(windowWidth, columns) {
  return Math.max(0, Math.floor((windowWidth - 8) / columns) - 6 - 16 - 3 - 8);
}

/**
 * @param {string} label
 * @param {number} size   wanted size in px before the system font size
 * @param {number} width  label width in px (0 when unknown)
 * @param {object} style  colour/weight (fontSize and lineHeight are set here)
 */
export default function ClassicTileLabel({ label, size, width, style }) {
  const { fontScale: sysScale = 1 } = useWindowDimensions();
  const fontScale = Math.min(2, Math.max(1, sysScale || 1));
  const wanted = Math.round(size * fontScale);
  // Memoised: every tile re-renders on each switch-scan step.
  const fit = useMemo(() => fitTileLabel(label, wanted, { width, height: Infinity, symbol: 0 }), [label, wanted, width]);
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
