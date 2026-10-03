// src/components/studio/TypeSheet.js
// Type a message with the keyboard, with word completion from the same
// on-device engine as the board. Typed words join the message on the board
// (so Speak, Undo, Show and Saved all work the same); nothing is spoken or
// added until the user taps a button. Optional: some people type, some
// don't, and the board never assumes either.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, Keyboard } from 'react-native';
import { Sheet, ActionButton, SuggestionChip } from '../../design/components';
import { usePaper } from '../../design/usePaper';
import { space, type, touch } from '../../design/tokens';
import { suggestNext } from '../../services/suggestionEngine';
import { splitTyping } from '../../utils/typing';

export default function TypeSheet({ visible, onClose, messageWords, onAdd, onAddAndSpeak, context, mode }) {
  const { c, r, scale } = usePaper();
  const [text, setText] = useState('');
  const input = useRef(null);
  useEffect(() => { if (visible) { setText(''); setTimeout(() => input.current?.focus(), 250); } }, [visible]);

  const { context: ctx, partial } = useMemo(() => splitTyping(text, messageWords), [text, messageWords]);
  const suggestions = useMemo(
    () => suggestNext(ctx, { k: 6, context, mode, prefix: partial || undefined }),
    [ctx, partial, context, mode]
  );

  const accept = (word) => {
    // Replace the partial word (if any) with the suggestion, then a space.
    const base = partial ? text.slice(0, text.length - partial.length) : text.replace(/\s*$/, text.trim() ? ' ' : '');
    setText(`${base}${word} `);
    input.current?.focus();
  };

  const words = text.trim() ? text.trim().split(/\s+/) : [];
  const finish = (speakToo) => {
    if (words.length === 0) return;
    Keyboard.dismiss();
    if (speakToo) onAddAndSpeak(words); else onAdd(words);
    setText('');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Type" subtitle="Typed words join your message. Suggestions complete the word you are typing.">
      <TextInput
        ref={input}
        value={text}
        onChangeText={setText}
        placeholder="Type here"
        placeholderTextColor={c.inkSoft}
        style={[styles.input, { color: c.ink, borderColor: c.lineStrong, backgroundColor: c.card, borderRadius: r.control, fontSize: Math.round(20 * scale) }]}
        autoCapitalize="sentences"
        autoCorrect
        multiline
        accessibilityLabel="Type your message"
        returnKeyType="done"
        blurOnSubmit
        onSubmitEditing={() => finish(false)}
      />
      <View style={[styles.suggest, { height: touch.min + space.md }]} accessibilityLabel="Word suggestions">
        {suggestions.length === 0 ? (
          <Text style={[type.body, { color: c.inkSoft }]}>No suggestions</Text>
        ) : (
          <FlatList
            data={suggestions}
            horizontal
            keyboardShouldPersistTaps="always"
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, i) => `${item.word}-${i}`}
            renderItem={({ item }) => <SuggestionChip word={item.word} onPress={() => accept(item.word)} />}
          />
        )}
      </View>
      <View style={styles.row}>
        <ActionButton label="Add" icon="add" a11yLabel="Add to message" onPress={() => finish(false)} disabled={words.length === 0} flex={1} size={touch.action} />
        <ActionButton label="Add and speak" icon="volume-high" variant="signal" onPress={() => finish(true)} disabled={words.length === 0} flex={1} size={touch.action} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 88, borderWidth: 1.5, padding: space.md, textAlignVertical: 'top' },
  suggest: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm },
  row: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
});
