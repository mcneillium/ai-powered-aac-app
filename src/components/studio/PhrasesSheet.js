// src/components/studio/PhrasesSheet.js
// Context panels: the user explicitly picks a situation (Home, School,
// University, Work, Shopping...) and its phrases appear here. Choosing a
// context never rearranges the board; it is remembered until changed.
// No location, microphone or other inferred context is used.

import React from 'react';
import { Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from '../../design/components';
import { VisualListRow as ListRow } from './VisualMessage';
import { usePaper } from '../../design/usePaper';
import { space, type, touch } from '../../design/tokens';
import { getContextPacksForMode, getContextPack } from '../../data/contextPacks';
import { useOverlayScan } from '../../hooks/useOverlayScan';

export default function PhrasesSheet({ visible, onClose, mode, activeContext, onChooseContext, onPhrase }) {
  const { c } = usePaper();
  const packs = getContextPacksForMode(mode);
  const current = getContextPack(activeContext) || packs[0];
  // Switch scanning: situations, then phrases, then Close.
  const focused = useOverlayScan(visible, [
    ...packs.map((pk) => ({ id: `ctx-${pk.id}`, onSelect: () => onChooseContext(pk.id) })),
    ...current.phrases.map((ph) => ({ id: `ph-${ph.id}`, onSelect: () => onPhrase(ph.label) })),
    { id: 'close', onSelect: onClose },
  ]);

  return (
    <Sheet visible={visible} onClose={onClose} title="Phrases" subtitle="Choose where you are. Tap a phrase to say it." closeFocused={focused === 'close'} scanning={focused !== null}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.ctxRow} accessibilityRole="tablist">
        {packs.map((pk) => {
          const on = pk.id === current.id;
          return (
            <Pressable
              key={pk.id}
              onPress={() => onChooseContext(pk.id)}
              accessibilityRole="tab"
              accessibilityLabel={pk.label}
              accessibilityState={{ selected: on }}
              style={[styles.ctx, { backgroundColor: on ? c.signal : c.sunk }, focused === `ctx-${pk.id}` && { borderWidth: 3, borderColor: c.focus }]}
            >
              <Ionicons name={pk.icon} size={18} color={on ? c.onSignal : c.ink} />
              <Text style={[type.label, { color: on ? c.onSignal : c.ink, marginLeft: 6 }]}>{pk.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {current.phrases.map((ph) => (
        <ListRow key={ph.id} icon="volume-medium-outline" text={ph.label} onPress={() => onPhrase(ph.label)} a11yLabel={`Say: ${ph.label}`} focused={focused === `ph-${ph.id}`} />
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  ctxRow: { gap: space.sm, paddingBottom: space.md },
  ctx: { flexDirection: 'row', alignItems: 'center', minHeight: touch.min, paddingHorizontal: 14, borderRadius: 999 },
});
