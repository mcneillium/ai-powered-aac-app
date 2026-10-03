// src/components/board/VocabTile.js
// One word on the board. Soft Studio style: a rounded tile with its
// Fitzgerald Key colour as a cap. Child: tinted fill, bigger corners and a
// picture. Adult: plain tile, text first (pictures if the user turns them on).
// Size and position come from the grid, never from the experience.

import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fitzColours, fonts, TILE_HEIGHT } from '../../theme';

function VocabTile({
  item, onPress, palette, theme, experience, showSymbol, symbol, textScale, numColumns, focused, focusStyle,
}) {
  const isNav = !!item.navigateTo;
  const hc = theme === 'highContrast';
  const fz = fitzColours(theme, item);
  const child = experience.tileFill === 'tint';
  const bg = hc ? palette.tileBg : (child ? fz.tint : palette.tileBg);
  const fg = palette.text;
  const labelSize = Math.round((numColumns >= 4 ? experience.labelSize - 2 : experience.labelSize) * textScale);
  // A fixed height, the same in every mode and with or without a picture, so
  // rows never shift. Labels shrink to fit instead of growing the tile.
  const height = tileHeight(textScale, numColumns);
  const pic = showSymbol ? symbol : null;

  return (
    <TouchableOpacity
      style={[
        styles.tile,
        {
          backgroundColor: bg,
          borderColor: hc ? palette.tileBorder : (child ? 'transparent' : palette.tileBorder),
          borderRadius: experience.tileRadius,
          flex: 1 / numColumns,
          height,
        },
        focused && focusStyle,
      ]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={isNav ? `Go to ${item.label} page` : `Say ${item.label}. ${item.category}`}
      accessibilityHint={isNav ? 'Opens a new vocabulary page' : 'Adds this word to your sentence'}
      accessibilityState={{ selected: !!focused }}
    >
      <View
        style={[styles.cap, { backgroundColor: fz.cap, height: experience.capHeight }]}
        importantForAccessibility="no"
      />
      {pic ? (
        <Text style={[styles.symbol, { fontSize: Math.round(28 * textScale), lineHeight: Math.round(34 * textScale) }]} importantForAccessibility="no" accessibilityElementsHidden>
          {pic}
        </Text>
      ) : (item.icon && isNav ? (
        <Ionicons name={item.icon} size={Math.round(22 * textScale)} color={fz.cap} style={styles.navIcon} />
      ) : null)}
      <Text
        style={[styles.label, { color: fg, fontSize: labelSize, fontFamily: fonts.bold }]}
        numberOfLines={pic ? 1 : 2}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {item.label}
      </Text>
      {isNav && (
        <View style={[styles.folder, { backgroundColor: fz.cap }]} importantForAccessibility="no">
          <Ionicons name="chevron-forward" size={12} color={palette.buttonText} />
        </View>
      )}
    </TouchableOpacity>
  );
}

export default memo(VocabTile);

/** Tile height for a text size and column count (independent of mode). */
export function tileHeight(textScale = 1, numColumns = 3) {
  return Math.round(TILE_HEIGHT * textScale * (numColumns >= 4 ? 0.85 : 1));
}

const styles = StyleSheet.create({
  tile: {
    margin: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cap: { position: 'absolute', top: 0, left: 0, right: 0 },
  symbol: { textAlign: 'center', marginBottom: 2 },
  navIcon: { marginBottom: 2 },
  label: { textAlign: 'center' },
  folder: {
    position: 'absolute', right: 6, bottom: 6, width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
});
