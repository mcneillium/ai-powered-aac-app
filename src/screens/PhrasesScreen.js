// src/screens/PhrasesScreen.js
// Phrases tab for the new board: every situation's phrases as large,
// one-tap tiles. The chosen situation is shared with the board's Phrases
// sheet (settings.activeContext) and is only ever changed by the user.
// Phrases speak on tap; the star saves one as a favourite.

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { usePaper } from '../design/usePaper';
import { space, type, touch } from '../design/tokens';
import { speak, buildSpeechOptions } from '../services/speechService';
import { getContextPacksForMode, getContextPack } from '../data/contextPacks';
import { loadFavourites, addFavourite, removeFavourite, getFavourites, isFavourite } from '../services/favouritesStore';

export default function PhrasesScreen() {
  const { settings, updateSettings } = useSettings();
  const { c, r, mode, scale, theme } = usePaper();
  const { width } = useWindowDimensions();
  const packs = getContextPacksForMode(mode);
  const current = getContextPack(settings.activeContext) || packs[0];
  const columns = width >= 720 ? 3 : 2;
  const [, setFavTick] = useState(0);
  useEffect(() => { loadFavourites().then(() => setFavTick((n) => n + 1)).catch(() => {}); }, []);

  const say = useCallback((text) => speak(text, buildSpeechOptions(settings)), [settings]);
  const toggleFavourite = useCallback(async (text) => {
    if (isFavourite(text)) {
      const fav = getFavourites().find((f) => f.phrase === text);
      if (fav) await removeFavourite(fav.id);
    } else {
      await addFavourite(text);
    }
    setFavTick((n) => n + 1);
  }, []);

  return (
    <ScrollView style={{ backgroundColor: c.paper }} contentContainerStyle={styles.content}>
      <Text style={[type.body, { color: c.inkSoft, marginBottom: space.sm }]}>
        Choose where you are. Tap a phrase to say it.
      </Text>
      <View style={styles.ctxWrap} accessibilityRole="tablist">
        {packs.map((pk) => {
          const on = pk.id === current.id;
          return (
            <Pressable
              key={pk.id}
              onPress={() => updateSettings({ activeContext: pk.id })}
              accessibilityRole="tab"
              accessibilityLabel={pk.label}
              accessibilityState={{ selected: on }}
              style={[styles.ctx, { backgroundColor: on ? c.signal : c.sunk }, theme === 'highContrast' && !on && { borderWidth: 2, borderColor: c.line }]}
            >
              <Ionicons name={pk.icon} size={18} color={on ? c.onSignal : c.ink} />
              <Text style={[type.label, { color: on ? c.onSignal : c.ink, marginLeft: 6 }]}>{pk.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[type.title, { color: c.ink, marginTop: space.lg, marginBottom: space.sm }]} accessibilityRole="header">
        {current.label}
      </Text>
      <View style={styles.grid}>
        {current.phrases.map((ph) => {
          const fav = isFavourite(ph.label);
          return (
            <View key={ph.id} style={{ width: `${100 / columns}%`, padding: 4 }}>
              <Pressable
                onPress={() => say(ph.label)}
                accessibilityRole="button"
                accessibilityLabel={`Say: ${ph.label}`}
                style={({ pressed }) => [
                  styles.tile,
                  {
                    backgroundColor: pressed ? c.signalSoft : c.card,
                    borderColor: c.line, borderWidth: theme === 'highContrast' ? 2 : 1, borderRadius: r.tile,
                  },
                ]}
              >
                <Text style={[type.heading, { color: c.ink, fontSize: Math.round(17 * scale), lineHeight: Math.round(22 * scale) }]}>
                  {ph.label}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => toggleFavourite(ph.label)}
                accessibilityRole="button"
                accessibilityLabel={fav ? `Remove from favourites: ${ph.label}` : `Save as favourite: ${ph.label}`}
                style={styles.star}
                hitSlop={4}
              >
                <Ionicons name={fav ? 'star' : 'star-outline'} size={20} color={fav ? c.signal : c.inkSoft} />
              </Pressable>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: 40 },
  ctxWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  ctx: { flexDirection: 'row', alignItems: 'center', minHeight: touch.min, paddingHorizontal: 14, borderRadius: 999 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  tile: { minHeight: 96, padding: space.md, paddingRight: 40, justifyContent: 'center' },
  star: { position: 'absolute', top: 8, right: 8, width: touch.min, height: touch.min, alignItems: 'center', justifyContent: 'center' },
});
