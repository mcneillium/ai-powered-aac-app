// src/screens/CommunicationScreen.js
// Visual pictogram browser — uses ARASAAC API with category-based browsing.
// Child-friendly: large picture tiles, minimal text, color-coded categories.

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, FlatList, TouchableOpacity, Text, ActivityIndicator, Animated, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { searchPictograms } from '../services/arasaacService';
import { logEvent } from '../utils/enhancedLogger';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { getPalette, spacing, radii, CATEGORY_COLORS } from '../theme';
import { speak } from '../services/speechService';
import SymbolImage from '../components/SymbolImage';
import { loadCustomBoards, subscribeToFirebaseBoards, onBoardsChanged } from '../services/customBoardsService';

const CATEGORIES = [
  { id: 'Everyday', label: 'Daily', color: CATEGORY_COLORS.social, hexcode: '1F3E0' },
  { id: 'Food', label: 'Food', color: CATEGORY_COLORS.food, hexcode: '1F34E' },
  { id: 'Drinks', label: 'Drinks', color: CATEGORY_COLORS.things, hexcode: '1F4A7' },
  { id: 'People', label: 'People', color: CATEGORY_COLORS.people, hexcode: '1F9D1' },
  { id: 'Places', label: 'Places', color: CATEGORY_COLORS.places, hexcode: '1F3E0' },
];

const PictogramCell = React.memo(function PictogramCell({ item, gridSize, onPress, palette }) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const uri = `https://static.arasaac.org/pictograms/${item._id}/${item._id}_500.png`;
  const label = item.keywords?.[0]?.keyword || 'pictogram';

  const handlePress = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.1, duration: 75, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1.0, duration: 75, useNativeDriver: true }),
    ]).start();
    onPress(item);
  }, [scaleAnim, onPress, item]);

  return (
    <Animated.View style={[{ flex: 1 / gridSize, transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={[styles.picCell, { backgroundColor: palette.cardBg, borderColor: palette.border }]}
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Say ${label}`}
        accessibilityHint="Speaks this word aloud"
      >
        <Image
          source={{ uri }}
          style={styles.picImage}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={200}
          accessibilityLabel={label}
        />
        <Text style={[styles.picLabel, { color: palette.text }]} numberOfLines={1}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

export default function CommunicationScreen() {
  const { settings, loading: settingsLoading } = useSettings();
  const { user } = useAuth();
  const [pictograms, setPictograms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Everyday');
  const [customBoards, setCustomBoards] = useState([]);
  const [activeCustomBoard, setActiveCustomBoard] = useState(null);
  const palette = getPalette(settings.theme);

  const loadCategory = useCallback(async (cat) => {
    setLoading(true);
    setActiveCategory(cat);
    setActiveCustomBoard(null);
    try {
      logEvent('Category selected', { category: cat });
      const data = await searchPictograms(settings.communicationLanguage || 'en', cat);
      setPictograms(data || []);
    } catch (e) {
      setPictograms([]);
    } finally {
      setLoading(false);
    }
  }, [settings.communicationLanguage]);

  useEffect(() => {
    loadCategory('Everyday');
    loadCustomBoards().then(setCustomBoards);
    if (user?.uid) subscribeToFirebaseBoards(user.uid);
    onBoardsChanged((boards) => setCustomBoards(boards));
  }, [user, loadCategory]);

  const selectCustomBoard = useCallback((board) => {
    setActiveCategory(null);
    setActiveCustomBoard(board);
    setPictograms([]);
  }, []);

  const selectPictogram = (item) => {
    const desc = item.keywords?.[0]?.keyword || 'No description';
    logEvent('Pictogram selected', { id: item._id });
    speak(desc);
  };

  if (settingsLoading) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      {/* Category tabs — icon + 1 word */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.categoryRow}>
        {CATEGORIES.map(cat => {
          const active = activeCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryTab,
                { backgroundColor: active ? cat.color : palette.cardBg, borderColor: cat.color },
              ]}
              onPress={() => loadCategory(cat.id)}
              accessibilityRole="button"
              accessibilityLabel={`${cat.label} category`}
              accessibilityState={{ selected: active }}
            >
              <SymbolImage hexcode={cat.hexcode} size={32} />
              <Text style={[styles.categoryLabel, { color: active ? '#FFF' : palette.text }]}>{cat.label}</Text>
            </TouchableOpacity>
          );
        })}
        {customBoards.map(board => {
          const active = activeCustomBoard?.id === board.id;
          return (
            <TouchableOpacity
              key={`custom-${board.id}`}
              style={[
                styles.categoryTab,
                { backgroundColor: active ? (board.color || palette.primary) : palette.cardBg, borderColor: board.color || palette.primary },
              ]}
              onPress={() => selectCustomBoard(board)}
              accessibilityRole="button"
              accessibilityLabel={`${board.name} custom board`}
              accessibilityState={{ selected: active }}
            >
              {board.icon ? <SymbolImage hexcode={board.icon} size={32} /> : null}
              <Text style={[styles.categoryLabel, { color: active ? '#FFF' : palette.text }]} numberOfLines={1}>{board.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Custom board word grid */}
      {activeCustomBoard && !loading && (
        <FlatList
          data={(activeCustomBoard.words || []).map((w, i) => ({ _id: `custom-${i}`, word: w }))}
          keyExtractor={(item) => item._id}
          numColumns={settings.gridSize}
          key={`custom-grid-${settings.gridSize}`}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[{ flex: 1 / settings.gridSize }, styles.customWordCell, { backgroundColor: palette.cardBg, borderColor: palette.border }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                speak(item.word);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Say ${item.word}`}
            >
              <SymbolImage word={item.word} size={48} fallbackLabel={item.word} />
              <Text style={[styles.customWordLabel, { color: palette.text }]}>{item.word}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: palette.textSecondary }]}>No words in this board yet</Text>
            </View>
          )}
          getItemLayout={(_, index) => ({ length: 100, offset: 100 * index, index })}
          windowSize={5}
        />
      )}

      {/* Grid */}
      {!activeCustomBoard && loading ? (
        <View style={styles.loadingContainer}>
          <SymbolImage hexcode="1F50D" size={48} />
          <Text style={[styles.loadingText, { color: palette.textSecondary }]}>Finding pictures...</Text>
        </View>
      ) : !activeCustomBoard ? (
        <FlatList
          data={pictograms}
          keyExtractor={(item) => item._id.toString()}
          numColumns={settings.gridSize}
          key={`comm-grid-${settings.gridSize}`}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <PictogramCell item={item} gridSize={settings.gridSize} onPress={selectPictogram} palette={palette} />
          )}
          getItemLayout={(_, index) => ({ length: 120, offset: 120 * index, index })}
          windowSize={5}
          maxToRenderPerBatch={12}
          initialNumToRender={9}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <SymbolImage hexcode="1F4AC" size={64} />
              <Text style={[styles.emptyText, { color: palette.textSecondary }]}>Let's find pictures!</Text>
            </View>
          )}
        />
      ) : null}

      <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  categoryScroll: { flexGrow: 0 },
  categoryRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  categoryTab: {
    minWidth: 80,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 2,
    gap: 2,
    minHeight: 64,
    justifyContent: 'center',
  },
  categoryLabel: { fontSize: 12, fontWeight: '700' },
  grid: { padding: spacing.xs },
  picCell: {
    margin: 4,
    borderRadius: radii.lg,
    borderWidth: 2,
    padding: 6,
    aspectRatio: 0.85,
    alignItems: 'center',
    justifyContent: 'center',
  },
  picImage: { width: '100%', flex: 1, borderRadius: radii.sm },
  picLabel: { fontSize: 12, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loadingText: { fontSize: 16, fontWeight: '600' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80, gap: spacing.md },
  emptyText: { fontSize: 18, fontWeight: '600' },
  customWordCell: {
    margin: 4, borderRadius: radii.lg,
    borderWidth: 2, padding: 8,
    aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  customWordLabel: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
