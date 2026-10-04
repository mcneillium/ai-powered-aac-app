// src/components/studio/ShowMessage.js
// Large, readable "show my message" view for a conversation partner. Works
// without speech. Can turn the text to face someone opposite. Closing returns
// to the board with the same message.

import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton } from '../../design/components';
import { usePaper } from '../../design/usePaper';
import { space, type, touch } from '../../design/tokens';
import { useOverlayScan } from '../../hooks/useOverlayScan';
import { selectCurrent } from '../../services/switchScanService';

export default function ShowMessage({ visible, onClose, text, onSpeak }) {
  const { c } = usePaper();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [flipped, setFlipped] = useState(false);
  const focused = useOverlayScan(visible, [
    { id: 'back', onSelect: onClose },
    { id: 'flip', onSelect: () => setFlipped((f) => !f) },
    ...(onSpeak ? [{ id: 'speak', onSelect: onSpeak }] : []),
  ]);
  const len = (text || '').length;
  const base = width > 600 ? 72 : 48;
  const size = len > 80 ? base * 0.6 : len > 30 ? base * 0.8 : base;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View style={[styles.root, { backgroundColor: c.card, paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.md }]}>
        <View style={[styles.body, flipped && { transform: [{ rotate: '180deg' }] }]}>
          <Text
            style={{ color: c.ink, fontSize: size, lineHeight: Math.round(size * 1.2), fontWeight: '700', textAlign: 'center' }}
            accessibilityRole="text"
            accessibilityLabel={text ? `Message: ${text}` : 'No message yet'}
            adjustsFontSizeToFit
          >
            {text || 'No message yet'}
          </Text>
        </View>
        <View style={styles.bar}>
          <ActionButton icon="arrow-back" label="Back" a11yLabel="Back to board" onPress={onClose} flex={1} size={touch.action} focused={focused === 'back'} />
          <ActionButton icon="swap-vertical" a11yLabel={flipped ? 'Turn text back to me' : 'Turn text to face the other person'} onPress={() => setFlipped((f) => !f)} size={touch.action} focused={focused === 'flip'} />
          {onSpeak && <ActionButton icon="volume-high" label="Speak" variant="signal" onPress={onSpeak} flex={1} size={touch.action} focused={focused === 'speak'} />}
        </View>
        {focused !== null && (
          <View style={[styles.bar, { marginTop: space.sm }]}>
            <ActionButton label="Select" variant="signal" onPress={selectCurrent} flex={1} size={touch.action} />
          </View>
        )}
        <Text style={[type.caption, { color: c.inkSoft, textAlign: 'center', marginTop: space.sm, letterSpacing: 0 }]}>
          Your message stays on the board when you go back.
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: space.lg },
  body: { flex: 1, justifyContent: 'center' },
  bar: { flexDirection: 'row', gap: space.sm },
});
