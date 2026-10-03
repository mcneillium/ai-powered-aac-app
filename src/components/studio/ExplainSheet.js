// src/components/studio/ExplainSheet.js
// "Help me explain": quick repair phrases (spoken on tap) and other ways to
// say the current message. Alternatives are previewed and only replace the
// message after the user confirms; the original stays in Undo.

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Sheet, ActionButton, Card } from '../../design/components';
import { usePaper } from '../../design/usePaper';
import { space, type, touch } from '../../design/tokens';
import { REPAIR_PHRASES, rephraseOptions } from '../../services/explain';

export default function ExplainSheet({ visible, onClose, message, say, onReplace }) {
  const { c, r } = usePaper();
  const [preview, setPreview] = useState(null);
  const options = useMemo(() => rephraseOptions(message), [message]);
  const done = () => { setPreview(null); onClose(); };

  return (
    <Sheet visible={visible} onClose={done} title="Help me explain" subtitle="Repair a misunderstanding, or try other words.">
      <Text style={[type.caption, styles.cap, { color: c.inkSoft }]} accessibilityRole="header">SAY NOW</Text>
      <View style={styles.repairs}>
        {REPAIR_PHRASES.map((ph) => (
          <Pressable
            key={ph.id}
            onPress={() => say(ph.text)}
            accessibilityRole="button"
            accessibilityLabel={`Say: ${ph.text}`}
            style={({ pressed }) => [styles.repair, { backgroundColor: pressed ? c.signalSoft : c.card, borderColor: c.line, borderRadius: r.control }]}
          >
            <Text style={[type.label, { color: c.ink, fontSize: 15 }]}>{ph.text}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[type.caption, styles.cap, { color: c.inkSoft }]} accessibilityRole="header">SAY IT ANOTHER WAY</Text>
      {!message ? (
        <Text style={[type.body, { color: c.inkSoft }]}>Build a message first, then come back for other ways to say it.</Text>
      ) : (
        <>
          <Card style={{ marginBottom: space.sm }}>
            <Text style={[type.caption, { color: c.inkSoft }]}>YOUR MESSAGE</Text>
            <Text style={[type.heading, { color: c.ink, marginTop: 2 }]}>{message}</Text>
          </Card>
          {options.map((o) => (
            <Pressable
              key={o.id}
              onPress={() => setPreview(o)}
              accessibilityRole="button"
              accessibilityLabel={`${o.label}: ${o.text}. Preview`}
              style={({ pressed }) => [styles.option, { borderColor: preview?.id === o.id ? c.signal : c.lineStrong, backgroundColor: pressed ? c.signalSoft : 'transparent', borderRadius: r.control }]}
            >
              <Text style={[type.caption, { color: c.inkSoft }]}>{o.label.toUpperCase()}</Text>
              <Text style={[type.body, { color: c.ink, fontSize: 17, marginTop: 2 }]}>{o.text}</Text>
            </Pressable>
          ))}
          <Text style={[type.caption, { color: c.inkSoft, marginTop: space.xs, letterSpacing: 0 }]}>
            Suggested wording from simple rules on this device. It only rewords what you wrote.
          </Text>
        </>
      )}

      {preview && (
        <View style={[styles.confirm, { backgroundColor: c.card, borderColor: c.signal, borderRadius: r.control }]} accessibilityLiveRegion="polite">
          <Text style={[type.body, { color: c.ink }]}>Replace your message with:</Text>
          <Text style={[type.heading, { color: c.ink, marginVertical: space.sm }]}>{preview.text}</Text>
          <View style={styles.confirmRow}>
            <ActionButton label="Keep mine" onPress={() => setPreview(null)} flex={1} size={touch.min} />
            <ActionButton label="Say it" icon="volume-high" onPress={() => say(preview.text)} flex={1} size={touch.min} />
            <ActionButton label="Replace" variant="signal" onPress={() => { onReplace(preview.text); setPreview(null); }} flex={1} size={touch.min} a11yLabel={`Replace message with: ${preview.text}. Undo brings yours back.`} />
          </View>
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cap: { marginBottom: space.sm, marginTop: space.sm },
  repairs: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  repair: { minHeight: touch.min, paddingHorizontal: space.md, justifyContent: 'center', borderWidth: 1 },
  option: { borderWidth: 1.5, borderStyle: 'dashed', padding: space.md, marginBottom: space.sm, minHeight: touch.min },
  confirm: { borderWidth: 2, padding: space.md, marginTop: space.md },
  confirmRow: { flexDirection: 'row', gap: space.sm },
});
