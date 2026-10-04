// src/design/components.js
// Reusable Voice 2 components. Every interactive element:
// - has an accessibility role and label,
// - is at least touch.min (48dp) in both dimensions,
// - shows a visible focus ring when scanning focuses it,
// - gives press feedback that respects reduced motion.

import React, { useRef, useState } from 'react';
import {
  View, Text, Pressable, Animated, StyleSheet, Modal, Image, ScrollView, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePaper } from './usePaper';
import { getCategoryColors, space, type, touch, motion } from './tokens';
import { fitLabelSize, linesAt } from './fitLabel';
import { getScanState, advanceScan, selectCurrent } from '../services/switchScanService';

/** Press feedback: a quick scale-down (skipped with reduced motion). */
function usePressScale(reduceMotion) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v) => {
    if (reduceMotion) return;
    Animated.timing(scale, { toValue: v, duration: motion.press, useNativeDriver: true }).start();
  };
  return { scale, onPressIn: () => to(0.95), onPressOut: () => to(1) };
}

/** Category of a vocabulary button for colour purposes. */
export function tileCategory(button) {
  if (button.navigateTo) return 'nav';
  if (button.multiWord) return 'starter';
  return button.category || 'misc';
}

/**
 * A vocabulary tile.
 * symbolStyle: 'symbols' (large picture), 'mixed' (small picture + label),
 * 'text' (label only). Pictures appear only when available offline: a
 * downloaded symbol image if there is one, otherwise the built-in emoji.
 */
export function Tile({
  button, onPress, symbolSource, emoji = null, symbolStyle = 'mixed', focused = false,
  height, accessibilityLabel, accessibilityHint, testID,
}) {
  const p = usePaper();
  const { c, r, mode, theme, scale: textScale } = p;
  const press = usePressScale(p.reduceMotion);
  const cat = getCategoryColors(theme, tileCategory(button));
  const isNav = !!button.navigateTo;
  const child = mode === 'child';
  const hc = theme === 'highContrast';
  // A picture that fails to load (offline, missing file) falls back to the
  // built-in picture, or to the label alone, instead of a blank gap.
  const [failedUri, setFailedUri] = useState(null);
  // Tile width, measured once laid out, so the label can be fitted to it.
  const [tileWidth, setTileWidth] = useState(0);
  const imageOk = !!symbolSource && !(symbolSource.uri && symbolSource.uri === failedUri);
  const showImage = symbolStyle !== 'text' && imageOk;
  const showEmoji = symbolStyle !== 'text' && !showImage && !!emoji;
  const showSymbol = showImage || showEmoji;
  const bigSymbol = showSymbol && symbolStyle === 'symbols';
  const bg = hc ? '#000' : child ? cat.fill : (isNav ? c.sunk : c.card);
  const iconName = !showSymbol && button.icon ? button.icon : null;
  // Fit the label so no word is broken or cut off: the user's size when it
  // fits, otherwise the largest size that does (never below 12).
  // Width budget: 6 px padding and up to 4 px focus border on each side.
  const wantedSize = Math.round((child ? 17 : 15) * textScale);
  const labelWidth = tileWidth ? tileWidth - 20 : 0;
  const labelSize = fitLabelSize(button.label, wantedSize, labelWidth);
  const labelLine = Math.round(labelSize * 1.25);
  const labelLines = labelWidth ? Math.min(2, linesAt(button.label, labelSize, labelWidth)) : 1;
  // The picture gives way to the label when both do not fit the tile.
  const baseSymbol = bigSymbol ? Math.round(height * 0.5) : Math.round(Math.min(34, height * 0.38));
  const symbolSize = Math.max(20, Math.min(baseSymbol, height - 20 - space.xs - labelLines * labelLine));
  // Pictures are black line art: in dark and high contrast they sit on a
  // light plate so they stay visible.
  const plate = c.symbolPlate;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected: focused }}
      style={styles.tileOuter}
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w !== tileWidth) setTileWidth(w);
      }}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.tile,
            {
              height,
              backgroundColor: bg,
              borderRadius: r.tile,
              borderColor: focused ? c.focus : hc ? c.line : child ? 'transparent' : c.line,
              borderWidth: focused ? 4 : hc ? 2 : child ? 0 : 1,
              transform: [{ scale: press.scale }],
            },
          ]}
        >
          {/* Category edge (Adult / High contrast); Child uses the fill. */}
          {!child && <View style={[styles.edge, { backgroundColor: cat.edge }]} />}
          {pressed && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.signal, opacity: 0.14 }]} />}
          {showEmoji && (
            <Text
              style={{ fontSize: Math.round(symbolSize * 0.8), lineHeight: symbolSize, marginBottom: space.xs, textAlign: 'center' }}
              importantForAccessibility="no"
              accessibilityElementsHidden
              maxFontSizeMultiplier={1}
            >
              {emoji}
            </Text>
          )}
          {showImage && (
            <View style={{ width: symbolSize, height: symbolSize, marginBottom: space.xs, alignItems: 'center', justifyContent: 'center', borderRadius: Math.round(symbolSize / 5), backgroundColor: plate || 'transparent' }}>
              <Image
                source={symbolSource}
                style={{ width: plate ? symbolSize - 6 : symbolSize, height: plate ? symbolSize - 6 : symbolSize }}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
                onError={() => setFailedUri(symbolSource.uri || null)}
              />
            </View>
          )}
          {iconName && (
            <Ionicons name={iconName} size={Math.round(20 * textScale)} color={hc ? cat.edge : c.inkSoft} style={{ marginBottom: 2 }} />
          )}
          <Text
            style={[type.tile, { color: c.ink, fontSize: labelSize, lineHeight: labelLine, textAlign: 'center' }]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {button.label}
          </Text>
          {isNav && (
            <View style={[styles.navMark, { backgroundColor: hc ? c.line : cat.edge }]}>
              <Ionicons name="chevron-forward" size={12} color={hc ? '#000' : '#fff'} />
            </View>
          )}
        </Animated.View>
      )}
    </Pressable>
  );
}

/**
 * A control button. variant: 'signal' (Speak), 'quiet', 'danger', 'ghost'.
 * Pass `label` to show text beside the icon; `a11yLabel` always describes it.
 */
export function ActionButton({
  icon, label, a11yLabel, onPress, variant = 'quiet', disabled = false,
  focused = false, size = touch.action, flex, style, testID, hint,
}) {
  const p = usePaper();
  const { c, r } = p;
  const press = usePressScale(p.reduceMotion);
  const bg = variant === 'signal' ? c.signal : variant === 'danger' ? c.dangerSoft : variant === 'ghost' ? 'transparent' : c.sunk;
  const fg = variant === 'signal' ? c.onSignal : variant === 'danger' ? c.danger : c.ink;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel || label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled, selected: focused }}
      style={[flex ? { flex } : null, style]}
      hitSlop={4}
    >
      <Animated.View
        style={[
          styles.action,
          {
            minHeight: size, minWidth: size, borderRadius: r.control, backgroundColor: bg,
            opacity: disabled ? 0.38 : 1,
            borderWidth: focused ? 4 : p.theme === 'highContrast' && variant !== 'signal' ? 2 : 0,
            borderColor: focused ? c.focus : c.line,
            transform: [{ scale: press.scale }],
          },
        ]}
      >
        {icon && <Ionicons name={icon} size={label ? 22 : 24} color={fg} />}
        {/* Two lines rather than an ellipsis: a cut-off label hides what the
            control does (e.g. "Save this message as a favou…"). */}
        {label ? <Text style={[type.label, { color: fg, fontSize: 16, marginLeft: icon ? 8 : 0, flexShrink: 1, textAlign: 'center' }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.5}>{label}</Text> : null}
      </Animated.View>
    </Pressable>
  );
}

/** A prediction. Dashed outline: always reads as a suggestion. */
export function SuggestionChip({ word, reason, onPress, onLongPress, focused, maxFontSizeMultiplier }) {
  const { c, theme, scale } = usePaper();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`Suggestion: ${word}${reason ? `. ${reason}` : ''}`}
      accessibilityHint={onLongPress ? 'Adds this word. Long press for options.' : 'Adds this word to your message'}
      accessibilityState={{ selected: !!focused }}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: focused ? c.focus : c.lineStrong,
          borderWidth: focused ? 3 : theme === 'highContrast' ? 2 : 1.5,
          backgroundColor: pressed ? c.signalSoft : 'transparent',
        },
      ]}
    >
      <Text
        style={[type.label, { color: c.ink, fontSize: Math.round(16 * scale), lineHeight: Math.round(20 * scale) }]}
        numberOfLines={1}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
      >
        {word}
      </Text>
    </Pressable>
  );
}

/** Bottom sheet with a title and an always-visible Close button. */
export function Sheet({ visible, onClose, title, subtitle, children, scroll = true, footer, closeFocused = false, scanning = false }) {
  const { c, r } = usePaper();
  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.scrim, { backgroundColor: c.scrim }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View
          style={[styles.sheet, { backgroundColor: c.paper, borderTopLeftRadius: r.sheet, borderTopRightRadius: r.sheet, paddingBottom: insets.bottom + space.md }]}
          accessibilityViewIsModal
        >
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[type.title, { color: c.ink }]} accessibilityRole="header">{title}</Text>
              {subtitle ? <Text style={[type.body, { color: c.inkSoft, marginTop: 2 }]}>{subtitle}</Text> : null}
            </View>
            <ActionButton icon="close" a11yLabel={`Close ${title}`} onPress={onClose} size={touch.min} focused={closeFocused} />
          </View>
          <Body style={scroll ? { flexGrow: 0 } : { flex: 0 }} contentContainerStyle={scroll ? { paddingBottom: space.md } : undefined}>
            {children}
          </Body>
          {footer}
          {/* While switch scanning, Select (and Next in step mode) stay at the
              bottom of the sheet, where the board's scan strip would be. */}
          {scanning && (
            <View style={[styles.scanBar, { borderColor: c.focus, borderRadius: r.control }]}>
              {getScanState().scanMode === 'step' && (
                <ActionButton label="Next" onPress={advanceScan} flex={1} size={touch.action} />
              )}
              <ActionButton label="Select" variant="signal" onPress={selectCurrent} flex={1} size={touch.action} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

/** Segmented choice. options: [{ value, label, icon? }] */
export function Segmented({ value, options, onChange, label }) {
  const { c, r, theme } = usePaper();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.segment, { backgroundColor: c.sunk, borderRadius: r.control }]}>
      {options.map((o) => (
        <SegmentItem key={String(o.value)} o={o} on={o.value === value} onChange={onChange} c={c} r={r} theme={theme} />
      ))}
    </View>
  );
}

// One option. Its label wraps to two lines and, if a word still does not
// fit (narrow phones, large text), gets smaller instead of being cut off.
function SegmentItem({ o, on, onChange, c, r, theme }) {
  const [w, setW] = useState(0);
  // Width budget: 6 px padding and 2 px high-contrast border each side, icon.
  const avail = w ? w - 16 - (o.icon ? 24 : 0) : 0;
  const size = fitLabelSize(o.label, type.label.fontSize, avail, { min: 11 });
  return (
    <Pressable
      onPress={() => onChange(o.value)}
      onLayout={(e) => { const nw = Math.round(e.nativeEvent.layout.width); if (nw !== w) setW(nw); }}
      accessibilityRole="radio"
      accessibilityLabel={o.a11yLabel || o.label}
      accessibilityState={{ checked: on }}
      style={[
        styles.segmentItem,
        { borderRadius: r.control - 4, backgroundColor: on ? c.card : 'transparent' },
        on && theme === 'highContrast' && { borderWidth: 2, borderColor: c.signal },
      ]}
    >
      {o.icon ? <Ionicons name={o.icon} size={18} color={on ? c.signal : c.inkSoft} style={{ marginRight: 6 }} /> : null}
      <Text style={[type.label, { color: on ? c.ink : c.inkSoft, fontSize: size, lineHeight: Math.round(size * 1.25), textAlign: 'center', flexShrink: 1 }]} numberOfLines={2}>{o.label}</Text>
    </Pressable>
  );
}

/** A switch row: label + explanation + switch, announced as a switch. */
export function SwitchRow({ label, description, value, onValueChange, disabled }) {
  const { c } = usePaper();
  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: !!value, disabled: !!disabled }}
      style={[styles.row, { opacity: disabled ? 0.5 : 1 }]}
    >
      <View style={{ flex: 1, paddingRight: space.md }}>
        <Text style={[type.heading, { color: c.ink, fontSize: 16 }]}>{label}</Text>
        {description ? <Text style={[type.body, { color: c.inkSoft, marginTop: 2 }]}>{description}</Text> : null}
      </View>
      <Switch
        value={!!value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: c.signal, false: c.lineStrong }}
        thumbColor={c.card}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      />
    </Pressable>
  );
}

/** Card grouping for settings-style screens. */
export function Card({ title, caption, children, style }) {
  const { c, r, theme } = usePaper();
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderRadius: r.sheet - 6, borderColor: c.line, borderWidth: theme === 'highContrast' ? 2 : 1 }, style]}>
      {title ? <Text style={[type.caption, { color: c.inkSoft, textTransform: 'uppercase', marginBottom: space.sm }]} accessibilityRole="header">{title}</Text> : null}
      {caption ? <Text style={[type.body, { color: c.inkSoft, marginBottom: space.sm }]}>{caption}</Text> : null}
      {children}
    </View>
  );
}

/** Inline notice (info / warning). Never blocks the board. */
export function Notice({ icon = 'information-circle-outline', children, tone = 'info', action }) {
  const { c, r } = usePaper();
  const bg = tone === 'warning' ? c.dangerSoft : c.signalSoft;
  const fg = tone === 'warning' ? c.danger : c.signal;
  return (
    <View style={[styles.notice, { backgroundColor: bg, borderRadius: r.control }]} accessibilityRole={tone === 'warning' ? 'alert' : undefined}>
      <Ionicons name={icon} size={20} color={fg} />
      <Text style={[type.body, { color: c.ink, flex: 1, marginLeft: space.sm }]}>{children}</Text>
      {action}
    </View>
  );
}

/** Friendly empty state. */
export function EmptyState({ icon, title, body }) {
  const { c } = usePaper();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={28} color={c.inkSoft} />
      <Text style={[type.heading, { color: c.ink, marginTop: space.sm, textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[type.body, { color: c.inkSoft, marginTop: 4, textAlign: 'center' }]}>{body}</Text> : null}
    </View>
  );
}

/** A tappable list row (phrase, history item...). */
export function ListRow({ icon, iconColor, text, meta, onPress, a11yLabel, right, focused = false }) {
  const { c } = usePaper();
  return (
    <View style={[styles.listRow, { borderBottomColor: c.line }, focused && { borderWidth: 3, borderColor: c.focus, borderRadius: 8 }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel || text}
        accessibilityState={{ selected: focused }}
        style={({ pressed }) => [styles.listMain, pressed && { backgroundColor: c.signalSoft }]}
      >
        {icon ? <Ionicons name={icon} size={20} color={iconColor || c.signal} /> : null}
        <Text style={[type.body, { color: c.ink, flex: 1, fontSize: 17, marginLeft: icon ? space.md : 0 }]} numberOfLines={3}>{text}</Text>
        {/* Meta never squeezes the main text (it was cut to "See what Voic…"). */}
        {meta ? <Text style={[type.caption, { color: c.inkSoft, flexShrink: 1, maxWidth: '40%', marginLeft: space.sm, textAlign: 'right' }]}>{meta}</Text> : null}
      </Pressable>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  tileOuter: { flex: 1, margin: 4 },
  tile: {
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 6, overflow: 'hidden',
  },
  edge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  navMark: {
    position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  chip: {
    minHeight: touch.min, minWidth: touch.min, paddingHorizontal: 16, borderRadius: 999, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', marginRight: space.sm,
  },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { paddingHorizontal: space.lg, paddingTop: space.lg, maxHeight: '88%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.md },
  segment: { flexDirection: 'row', padding: 4 },
  segmentItem: { flex: 1, minHeight: touch.min, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: space.sm },
  card: { padding: space.lg, marginBottom: space.md },
  notice: { flexDirection: 'row', alignItems: 'center', padding: space.md },
  scanBar: { flexDirection: 'row', gap: space.sm, padding: space.sm, borderWidth: 2, marginTop: space.sm },
  empty: { alignItems: 'center', padding: space.xl },
  listRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  listMain: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: space.sm, paddingHorizontal: space.xs },
});
