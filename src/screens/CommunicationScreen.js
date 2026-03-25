import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Image,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import { searchPictograms } from '../services/arasaacService';
import { logEvent } from '../utils/logger';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette } from '../theme';

export default function CommunicationScreen() {
  const { settings, loading: settingsLoading } = useSettings();
  const [pictograms, setPictograms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [categoryImages, setCategoryImages] = useState({});
  const categories = ['Everyday', 'Food', 'Drinks', 'People', 'Places'];
  const palette = getPalette(settings.theme);

  useEffect(() => {
    (async () => {
      const reps = {};
      for (let cat of categories) {
        try {
          const data = await searchPictograms('en', cat);
          if (data?.length) reps[cat] = data[0];
        } catch {}
      }
      setCategoryImages(reps);
    })();
  }, []);

  useEffect(() => {
    loadCategory('Everyday');
  }, []);

  const loadCategory = useCallback(async (cat) => {
    setLoading(true);
    try {
      logEvent('Category selected', { category: cat });
      const data = await searchPictograms('en', cat);
      setPictograms(data || []);
    } catch (e) {
      Alert.alert('Error', 'Failed to load pictograms.');
      setPictograms([]);
    } finally {
      setSelected(null);
      setLoading(false);
    }
  }, []);

  const selectPictogram = (item) => {
    const desc = item.keywords?.[0]?.keyword || 'No description';
    setSelected({ ...item, description: desc });
    logEvent('Pictogram selected', { id: item._id });
    Speech.speak(desc);
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
      {/* Category picker */}
      <FlatList
        data={categories}
        horizontal
        keyExtractor={(cat) => cat}
        style={styles.categoryList}
        contentContainerStyle={styles.categoryListContent}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => {
          const rep = categoryImages[item];
          const uri = rep
            ? `https://static.arasaac.org/pictograms/${rep._id}/${rep._id}_500.png`
            : `https://via.placeholder.com/80?text=${item}`;
          return (
            <TouchableOpacity
              style={styles.categoryCard}
              onPress={() => loadCategory(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item} category`}
              accessibilityHint="Loads pictograms for this category"
            >
              <Image source={{ uri }} style={styles.categoryImage} accessibilityElementsHidden />
              <Text style={[styles.categoryLabel, { color: palette.text }]}>{item}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Grid of pictograms */}
      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={palette.primary} />
      ) : (
        <FlatList
          data={pictograms}
          keyExtractor={(item) => item._id.toString()}
          numColumns={settings.gridSize}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                { flex: 1 / settings.gridSize },
                styles.picItem,
                selected?._id === item._id && styles.selectedItem
              ]}
              onPress={() => selectPictogram(item)}
              accessibilityRole="button"
              accessibilityLabel={`Say ${item.keywords?.[0]?.keyword || 'pictogram'}`}
              accessibilityHint="Speaks this word aloud"
              accessibilityState={{ selected: selected?._id === item._id }}
            >
              <Image
                source={{ uri: `https://static.arasaac.org/pictograms/${item._id}/${item._id}_500.png` }}
                style={styles.picImage}
                accessibilityElementsHidden
              />
            </TouchableOpacity>
          )}
          ListEmptyComponent={() => (
            <Text style={[styles.emptyText, { color: palette.text }]}>No pictograms.</Text>
          )}
        />
      )}

      <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  center:          { flex: 1, justifyContent: 'center', alignItems: 'center' },
  categoryList:    { flexGrow: 0, maxHeight: 120 },
  categoryListContent: { paddingHorizontal: 8 },
  categoryCard:    { margin: 8, alignItems: 'center' },
  categoryImage:   { width: 60, height: 60, borderRadius: 8 },
  categoryLabel:   { marginTop: 4, fontSize: 12, fontWeight: 'bold' },
  loader:          { marginTop: 30 },
  grid:            { padding: 4 },
  picItem:         { aspectRatio: 1, margin: 4, backgroundColor: '#F2F4F7', borderRadius: 8 },
  picImage:        { width: '100%', height: '100%', borderRadius: 8 },
  selectedItem:    { borderWidth: 2, borderColor: '#2979FF' },
  emptyText:       { textAlign: 'center', marginTop: 20, fontSize: 16 }
});
