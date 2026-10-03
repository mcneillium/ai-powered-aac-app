// src/components/studio/WelcomeSheet.js
// First-run welcome. The board is already usable behind it; "Start talking"
// (or closing) dismisses it immediately. No account, consent or setup is
// required to communicate.

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Sheet, ActionButton } from '../../design/components';
import { usePaper } from '../../design/usePaper';
import { useSettings } from '../../contexts/SettingsContext';
import { MODE_DESCRIPTIONS } from '../../contexts/experience';
import { space, type, touch } from '../../design/tokens';

export default function WelcomeSheet({ onDone }) {
  const { c, r } = usePaper();
  const { updateSettings } = useSettings();
  const [choice, setChoice] = useState(null);
  const [visible, setVisible] = useState(true);

  const finish = async () => {
    if (choice) updateSettings({ uiMode: choice });
    setVisible(false);
    try { await AsyncStorage.setItem('hasLaunched', 'true'); } catch { /* shown again next launch */ }
    onDone?.();
  };

  return (
    <Sheet visible={visible} onClose={finish} title="Welcome to Voice" subtitle="You can start talking straight away. Everything works on this device, without an account.">
      <Text style={[type.caption, { color: c.inkSoft, marginBottom: space.sm }]} accessibilityRole="header">HOW SHOULD VOICE LOOK? (OPTIONAL)</Text>
      <View style={styles.row}>
        {['child', 'adult'].map((m) => {
          const d = MODE_DESCRIPTIONS[m];
          const on = choice === m;
          return (
            <Pressable
              key={m}
              onPress={() => setChoice(m)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${d.title}. ${d.summary}`}
              style={[styles.card, { backgroundColor: c.card, borderRadius: r.sheet - 8, borderColor: on ? c.signal : c.line, borderWidth: on ? 2.5 : 1 }]}
            >
              <Ionicons name={m === 'child' ? 'sunny-outline' : 'reader-outline'} size={26} color={on ? c.signal : c.ink} />
              <Text style={[type.heading, { color: c.ink, marginTop: space.sm }]}>{d.title}</Text>
              <Text style={[type.body, { color: c.inkSoft, marginTop: 2 }]}>{d.summary}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[type.body, { color: c.inkSoft, marginVertical: space.md }]}>
        A mode only changes the look. Every word and feature is in both, and you can switch any time from the top of the board.
        Learning from your messages is off until you turn it on in Personalise.
      </Text>
      <ActionButton label="Start talking" icon="chatbubble-ellipses" variant="signal" size={touch.action} onPress={finish} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  card: { flex: 1, padding: space.md, minHeight: 140 },
});
