// src/screens/EasySentenceBuilderScreen.js
import React, { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, TextInput, Button, Alert,
  StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Image
} from 'react-native';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { searchPictograms } from '../services/arasaacService';
import { getAISuggestions } from '../services/getAISuggestions'; // remote fallback
import { updateLastActivity } from '../utils/syncStatus';
import { useSettings } from '../contexts/SettingsContext';

// Local predictor (no remote imports inside it)
import {
  ensureImprovedModelLoaded,
  predictTopKWordsWithImprovedModel
} from '../services/localPredictor';

export default function EasySentenceBuilderScreen() {
  const { settings, loading: settingsLoading } = useSettings();

  const [sentenceWords, setSentenceWords] = useState([]);
  const [typedWord, setTypedWord] = useState('');

  const [categoryPictures, setCategoryPictures] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loadingPictures, setLoadingPictures] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Everyday');
  const [wordSearch, setWordSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [categoryImages, setCategoryImages] = useState({});

  const categories = ['Everyday', 'Food', 'Drinks', 'People', 'Places'];

  const palettes = {
    light: { background: '#fff', text: '#000', inputBg: '#fff' },
    dark: { background: '#000', text: '#fff', inputBg: '#111' },
    highContrast: { background: '#000', text: '#FFD600', inputBg: '#111' }
  };
  const themeKey = ['light', 'dark', 'highContrast'].includes(settings?.theme) ? settings.theme : 'light';
  const palette = palettes[themeKey];

  // Preload rep icons for categories
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

// Local suggestions (predictor) with remote fallback
useEffect(() => {
  (async () => {
    try {
      await ensureImprovedModelLoaded();
      const local = await predictTopKWordsWithImprovedModel(
        null,                    // default model
        null,                    // (unused)
        sentenceWords.join(' '),
        1.25,                    // temperature
        4,                       // sequence length (auto-detected anyway)
        5                        // topK
      );

      console.log('[EasySentence] Local predictions:', local);

      if (Array.isArray(local) && local.length > 0) {
        setSuggestions(local);
        return; // ✅ only return if local worked
      }
    } catch (e) {
      console.log('[EasySentence] Local AI predict fallback:', e?.message || e);
    }

    // ✅ Remote or dummy fallback (if no local suggestions)
    try {
      const remote = await getAISuggestions(sentenceWords.join(' '));
      console.log('[EasySentence] Remote/dummy suggestions:', remote);
      setSuggestions(remote || []);
    } catch {
      setSuggestions([]);
    }
  })();
}, [sentenceWords]);


  const addWord = async (word) => {
    const next = [...sentenceWords, String(word)];
    setSentenceWords(next);

    try {
      const key = 'userInteractionLog';
      const existing = await AsyncStorage.getItem(key);
      const logArray = existing ? JSON.parse(existing) : [];
      logArray.push({
        action: 'addWord',
        wordAdded: String(word),
        sentence: next.join(' '),
        timestamp: new Date().toISOString()
      });
      await AsyncStorage.setItem(key, JSON.stringify(logArray));
      await updateLastActivity();
    } catch (e) {
      console.error('Logging error:', e);
    }
  };

  const addTypedWord = () => {
    const raw = typedWord.trim();
    if (!raw) return;
    raw.split(/\s+/).forEach(w => addWord(w));
    setTypedWord('');
  };

  const removeWord = (i) => setSentenceWords(ws => ws.filter((_, idx) => idx !== i));
  const clearSentence = () => setSentenceWords([]);
  const speakSentence = () => Speech.speak(sentenceWords.join(' ') || ' ');

  if (settingsLoading) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  const renderPic = ({ item, index }) => {
    const id = item?.id ?? item?._id;
    const uri = id
      ? `https://static.arasaac.org/pictograms/${id}/${id}_500.png`
      : `https://via.placeholder.com/80?text=?`;
    const keyword =
      item?.keywords?.[0]?.keyword ||
      item?.meaning ||
      item?.searchText ||
      wordSearch ||
      selectedCategory;

    return (
      <TouchableOpacity style={styles.picContainer} onPress={() => addWord(keyword)}>
        <Image source={{ uri }} style={styles.picImage} />
      </TouchableOpacity>
    );
  };

  const renderCategory = ({ item }) => {
    const rep = categoryImages[item];
    const id = rep?.id ?? rep?._id;
    const uri = id
      ? `https://static.arasaac.org/pictograms/${id}/${id}_500.png`
      : `https://via.placeholder.com/80?text=${encodeURIComponent(item)}`;
    return (
      <TouchableOpacity
        style={[styles.categoryCard, selectedCategory === item && styles.categorySelected]}
        onPress={() => { setWordSearch(''); setSelectedCategory(item); }}
      >
        <Image source={{ uri }} style={styles.categoryImage} />
        <Text style={[styles.categoryLabel, { color: palette.text }]}>{item}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: palette.background }]} nestedScrollEnabled>
      <View style={styles.headerRow}>
        <Text style={[styles.heading, { color: palette.text }]}>Build a Sentence</Text>
        <Button title="Clear" onPress={clearSentence} color="#f44336" />
      </View>

      <View style={styles.row}>
        {sentenceWords.map((w, i) => (
          <View key={`${w}-${i}`} style={styles.wordChipContainer}>
            <Text style={[styles.wordChip, { color: palette.text }]}>{w}</Text>
            <TouchableOpacity onPress={() => removeWord(i)} style={styles.removeChip}>
              <Text style={{ color: '#fff' }}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <View style={styles.speakButtonInline}>
        <Button title="Speak" onPress={speakSentence} color="#4CAF50" />
      </View>

      {/* Type-to-insert row */}
      <View style={styles.typeRow}>
        <TextInput
          style={[
            styles.typeInput,
            { color: palette.text, backgroundColor: palette.inputBg, borderColor: '#ccc' }
          ]}
          placeholder="Type a word… (press Add or Enter)"
          placeholderTextColor="#888"
          value={typedWord}
          onChangeText={setTypedWord}
          onSubmitEditing={addTypedWord}
          returnKeyType="done"
          blurOnSubmit
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={{ marginLeft: 8 }}>
          <Button title="Add" onPress={addTypedWord} color="#4CAF50" />
        </View>
      </View>

      <Text style={[styles.label, { color: palette.text }]}>Categories</Text>
      <FlatList
        data={categories}
        horizontal
        keyExtractor={i => i}
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginBottom: 12 }}
        contentContainerStyle={{ paddingVertical: 4 }}
        renderItem={renderCategory}
      />

      <TextInput
        style={[styles.input, { borderColor: '#ccc', color: palette.text, backgroundColor: palette.inputBg }]}
        placeholder="Search any English word"
        placeholderTextColor="#888"
        value={wordSearch}
        onChangeText={setWordSearch}
      />

      {loadingPictures ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={wordSearch ? searchResults : categoryPictures}
          horizontal
          keyExtractor={(item, i) => String(item?.id ?? item?._id ?? i)}
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, maxHeight: 100, marginBottom: 12 }}
          contentContainerStyle={{ paddingVertical: 4 }}
          renderItem={renderPic}
          ListEmptyComponent={() => (
            <Text style={[styles.emptyText, { color: palette.text }]}>No pictograms.</Text>
          )}
        />
      )}

      <Text style={[styles.label, { color: palette.text }]}>AI Suggestions</Text>
      <FlatList
        data={suggestions}
        horizontal
        keyExtractor={(_, i) => i.toString()}
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginBottom: 12 }}
        contentContainerStyle={{ paddingVertical: 4 }}
        renderItem={({ item }) => (
          <View style={{ marginRight: 8 }}>
            <Button title={String(item)} onPress={() => addWord(String(item))} color="#4CAF50" />
          </View>
        )}
      />

      <StatusBar style={themeKey === 'dark' ? 'light' : 'dark'} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heading: { fontSize: 24, fontWeight: 'bold' },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  wordChipContainer: { flexDirection: 'row', backgroundColor: '#e0e0e0', borderRadius: 16, margin: 4, paddingRight: 4, alignItems: 'center' },
  wordChip: { marginHorizontal: 8, fontSize: 16 },
  removeChip: { backgroundColor: '#f44336', borderRadius: 8, padding: 2 },
  speakButtonInline: { alignSelf: 'flex-end', marginBottom: 12 },
  typeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 8 },
  typeInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, minHeight: 44 },
  label: { fontSize: 18, marginTop: 16, marginBottom: 8 },
  input: { marginVertical: 12, borderWidth: 1, borderRadius: 8, padding: 8 },
  categoryCard: { marginRight: 12, alignItems: 'center' },
  categoryImage: { width: 60, height: 60, borderRadius: 8 },
  categoryLabel: { marginTop: 4, fontSize: 12, fontWeight: 'bold' },
  categorySelected: { borderColor: '#4CAF50', borderWidth: 2, borderRadius: 8 },
  picContainer: { marginRight: 8, alignItems: 'center' },
  picImage: { width: 80, height: 80, borderRadius: 8 },
  emptyText: { textAlign: 'center', fontSize: 16 }
});
