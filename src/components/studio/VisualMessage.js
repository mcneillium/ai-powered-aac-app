import React, { useState } from 'react';
import { View, Text, Image, Pressable, useWindowDimensions } from 'react-native';
import { usePaper } from '../../design/usePaper';
import { useSettings } from '../../contexts/SettingsContext';
import { getCustomButtons } from '../../services/customVocabStore';
import { symbolSourceFor } from '../../services/symbolStore';
import { visualMessageTokens, visualVocabulary, localVisualSource } from '../../data/visualSymbols';
import { touch, type } from '../../design/tokens';

function Picture({ token, size = 28 }) {
  const source = localVisualSource(symbolSourceFor(token.button));
  const [failedUri, setFailedUri] = useState(null);
  if (source && failedUri !== source.uri) return <Image source={source} style={{ width: size, height: size }} resizeMode="contain" onError={() => setFailedUri(source.uri)} accessible={false} />;
  return token.emoji ? <Text allowFontScaling={false} style={{ fontSize: size - 4, height: size }}>{token.emoji}</Text> : null;
}

/** Pictures supplement original words; unknown/abstract text is never hidden. */
export function VisualMessage({ text, compact = false, horizontal = false }) {
  const { c, scale } = usePaper();
  const { settings } = useSettings();
  const { fontScale = 1 } = useWindowDimensions();
  // The composer has a fixed-height viewport. At extreme system text sizes,
  // prioritise the unabridged label rather than clipping it below a picture.
  const labelSize = horizontal ? type.message.fontSize * scale : 14 * Math.min(scale, 1.5);
  const labelLineHeight = horizontal ? Math.round(type.message.lineHeight * scale) : 19 * Math.min(scale, 1.5);
  const pictureSize = horizontal ? Math.max(0, Math.min(28, labelLineHeight * 2 + 8 - labelLineHeight * fontScale - 8)) : 28;
  if (settings.symbolStyle === 'text') return null;
  const tokens = visualMessageTokens(text, visualVocabulary(getCustomButtons()));
  const visible = compact ? tokens.filter((token) => token.emoji || localVisualSource(symbolSourceFor(token.button))).slice(0, 5) : tokens;
  if (!visible.length) return null;
  return (
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', flexWrap: horizontal || compact ? 'nowrap' : 'wrap', gap: 6, alignItems: 'center', overflow: compact ? 'hidden' : 'visible' }}>
      {visible.map((token, index) => (
        <View key={`${index}-${token.text}`} style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: compact ? 1 : 4 }}>
          {(compact || pictureSize >= 16) && <Picture token={token} size={compact ? 24 : pictureSize} />}
          {!compact && <Text style={[horizontal ? type.message : type.label, { color: c.ink, fontSize: labelSize, lineHeight: labelLineHeight }]}>{token.prefix}{token.text}</Text>}
        </View>
      ))}
    </View>
  );
}

export function VisualListRow({ text, onPress, a11yLabel, right, focused, meta }) {
  const { c } = usePaper();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: c.line, ...(focused ? { borderWidth: 3, borderColor: c.focus } : {}) }}>
      <Pressable accessibilityRole="button" accessibilityLabel={a11yLabel || text} accessibilityState={{ selected: !!focused }} onPress={onPress}
        style={({ pressed }) => ({ flex: 1, minHeight: touch.min, paddingVertical: 10, paddingHorizontal: 8, backgroundColor: pressed ? c.signalSoft : 'transparent' })}>
        <VisualMessage text={text} compact />
        <Text style={[type.body, { color: c.ink, marginTop: 3 }]}>{text}</Text>
        {!!meta && <Text style={[type.caption, { color: c.inkSoft }]}>{meta}</Text>}
      </Pressable>
      {right}
    </View>
  );
}

export function VisualSuggestionChip({ word, reason, onPress, onLongPress, focused, maxFontSizeMultiplier }) {
  const { c, scale } = usePaper();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Suggestion: ${word}${reason ? `. ${reason}` : ''}`} accessibilityHint="Adds this suggestion to your message" accessibilityState={{ selected: !!focused }}
      onPress={onPress} onLongPress={onLongPress}
      style={({ pressed }) => ({ flexDirection: 'row', gap: 6, alignItems: 'center', minHeight: touch.min, minWidth: touch.min, paddingHorizontal: 12, marginRight: 6, borderRadius: 18, borderStyle: 'dashed', borderWidth: focused ? 3 : 1.5, borderColor: focused ? c.focus : c.lineStrong, backgroundColor: pressed ? c.signalSoft : c.card })}>
      <VisualMessage text={word} compact />
      <Text maxFontSizeMultiplier={maxFontSizeMultiplier} numberOfLines={1} style={[type.label, { color: c.ink, fontSize: 16 * scale }]}>{word}</Text>
    </Pressable>
  );
}
