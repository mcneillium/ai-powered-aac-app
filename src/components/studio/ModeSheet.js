// src/components/studio/ModeSheet.js
// Explicit Child / Adult switch with a preview of what changes. Switching
// keeps every word, favourite, pronunciation and message.

import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet, ActionButton } from '../../design/components';
import { usePaper } from '../../design/usePaper';
import { useSettings } from '../../contexts/SettingsContext';
import { MODE_DESCRIPTIONS } from '../../contexts/experience';
import { categoryColors, space, type, touch, shape } from '../../design/tokens';
import { useOverlayScan } from '../../hooks/useOverlayScan';

const PREVIEW = [['I want', 'starter'], ['more', 'adjective'], ['help', 'verb'], ['stop', 'important'], ['Mum', 'noun'], ['yes', 'social']];

function MiniBoard({ mode, theme, c }) {
  const set = categoryColors[theme] || categoryColors.light;
  const child = mode === 'child';
  return (
    <View style={[styles.mini, { backgroundColor: c.paper }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {PREVIEW.map(([w, cat]) => (
        <View
          key={w}
          style={[styles.miniTile, {
            width: '30%', height: 40,
            backgroundColor: child ? set[cat].fill : c.card,
            borderRadius: shape[mode].tile / 2,
            borderLeftWidth: child ? 0 : 4, borderLeftColor: set[cat].edge,
            borderWidth: child ? 0 : 1, borderColor: c.line,
          }]}
        >
          <Text style={{ color: c.ink, fontSize: child ? 13 : 11, fontWeight: '700' }}>{w}</Text>
        </View>
      ))}
    </View>
  );
}

export default function ModeSheet({ visible, onClose }) {
  const { c, r, theme } = usePaper();
  const { settings, updateSettings } = useSettings();
  const current = settings.uiMode === 'child' ? 'child' : 'adult';
  const [choice, setChoice] = useState(current);
  useEffect(() => { if (visible) setChoice(current); }, [visible, current]);
  const confirm = () => { if (choice !== current || !settings.uiMode) updateSettings({ uiMode: choice }); onClose(); };
  const focused = useOverlayScan(visible, [
    { id: 'child', onSelect: () => setChoice('child') },
    { id: 'adult', onSelect: () => setChoice('adult') },
    { id: 'pictures', onSelect: () => updateSettings({ symbolStyle: settings.symbolStyle === 'text' ? 'mixed' : 'text' }) },
    { id: 'confirm', onSelect: confirm },
    { id: 'close', onSelect: onClose },
  ]);

  return (
    <Sheet visible={visible} onClose={onClose} title="Child or Adult" subtitle="Choose how Voice looks and works. You can switch at any time." closeFocused={focused === 'close'} scanning={focused !== null}>
      {['child', 'adult'].map((m) => {
        const d = MODE_DESCRIPTIONS[m];
        const on = choice === m;
        return (
          <Pressable
            key={m}
            onPress={() => setChoice(m)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${d.title} mode. ${d.summary} ${d.details.join('. ')}`}
            style={[styles.option, { borderColor: focused === m ? c.focus : on ? c.signal : c.line, borderWidth: focused === m ? 4 : on ? 2.5 : 1, backgroundColor: c.card, borderRadius: r.sheet - 6 }]}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? c.signal : c.inkSoft} />
                <Text style={[type.title, { color: c.ink, marginLeft: space.sm }]}>{d.title}</Text>
                {m === current && <Text style={[type.caption, { color: c.inkSoft, marginLeft: space.sm }]}>IN USE</Text>}
              </View>
              <Text style={[type.body, { color: c.ink, marginTop: 4 }]}>{d.summary}</Text>
              {d.details.map((x) => <Text key={x} style={[type.body, { color: c.inkSoft }]}>• {x}</Text>)}
            </View>
            <MiniBoard mode={m} theme={theme} c={c} />
          </Pressable>
        );
      })}
      <Text style={[type.body, { color: c.inkSoft, marginVertical: space.sm }]}>
        Every word stays in the same place in both modes. Your words, favourites, history, voice and pronunciations are shared; each mode remembers its own colours and picture style.
      </Text>
      <ActionButton
        icon="images-outline"
        label={settings.symbolStyle === 'text' ? 'Turn on picture support' : 'Turn off picture support'}
        a11yLabel={settings.symbolStyle === 'text' ? 'Turn on pictures for words, predictions and saved messages' : 'Turn off pictures for words, predictions and saved messages'}
        onPress={() => updateSettings({ symbolStyle: settings.symbolStyle === 'text' ? 'mixed' : 'text' })}
        focused={focused === 'pictures'} size={touch.min} style={{ marginVertical: space.sm }}
      />
      <Text style={[type.body, { color: c.inkSoft, marginBottom: space.sm }]}>Pictures are available in either mode. Familiar photos and downloaded symbols are used on this device; other known words use emoji. Words without a picture remain readable text.</Text>
      <ActionButton
        label={choice === current ? 'Keep this mode' : `Switch to ${MODE_DESCRIPTIONS[choice].title}`}
        variant="signal"
        size={touch.action}
        onPress={confirm}
        focused={focused === 'confirm'}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', padding: space.md, marginBottom: space.md, gap: space.md },
  mini: { width: 116, borderRadius: 12, padding: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignContent: 'flex-start' },
  miniTile: { alignItems: 'center', justifyContent: 'center' },
});
