import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, TextInput, Button, Alert, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Image } from 'react-native';
import { speak } from '../services/speechService';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { searchPictograms } from '../services/arasaacService';
import { getAISuggestions } from '../services/getAISuggestions';
import { updateLastActivity } from '../utils/syncStatus';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, spacing, radii } from '../theme';
import { useOnDevicePrediction } from '../hooks/useOnDevicePrediction';
import { recordWordSelection, recordSentenceSpoken, recordSuggestionsShown, recordFailedSearch } from '../services/aiProfileStore';
import { addSentenceToHistory } from '../services/sentenceHistoryStore';
import { corePages } from '../data/coreVocabulary';

// Offline fallback: text-based word lists from core vocabulary
const OFFLINE_CATEGORIES = {
  Everyday: corePages.home.buttons.filter(b => !b.navigateTo).map(b => b.label),
  Food: corePages.food.buttons.map(b => b.label),
  People: corePages.people.buttons.map(b => b.label),
  Actions: corePages.actions.buttons.map(b => b.label),
  Feelings: corePages.feelings.buttons.map(b => b.label),
  Things: corePages.things.buttons.map(b => b.label),
  Places: corePages.places.buttons.map(b => b.label),
};

export default function EasySentenceBuilderScreen() {
  const { settings, loading: settingsLoading } = useSettings();
  const [sentenceWords, setSentenceWords] = useState([]);
  const [categoryPictures, setCategoryPictures] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loadingPictures, setLoadingPictures] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Everyday');
  const [wordSearch, setWordSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [categoryImages, setCategoryImages] = useState({});
  const { predictNext, recordTap } = useOnDevicePrediction();

  const categories = Object.keys(OFFLINE_CATEGORIES);
  const palette = getPalette(settings.theme);
  const [offlineMode, setOfflineMode] = useState(false);

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
    (async () => {
      setLoadingPictures(true);
      try {
        const pics = wordSearch ? await searchPictograms('en', wordSearch) : await searchPictograms('en', selectedCategory);
        wordSearch ? setSearchResults(pics || []) : setCategoryPictures(pics || []);
        setOfflineMode(false);
      } catch (e) {
        // Fall back to offline word list — no disruptive alert
        setOfflineMode(true);
        wordSearch ? setSearchResults([]) : setCategoryPictures([]);
        if (wordSearch) recordFailedSearch(wordSearch).catch(() => {});
      } finally {
        setLoadingPictures(false);
      }
    })();
  }, [selectedCategory, wordSearch]);

  useEffect(() => {
    (async () => {
      let local = [];
      try {
        local = await predictNext(sentenceWords, 5);
      } catch {}
      if (local.length === 0) {
        const remote = await getAISuggestions(sentenceWords.join(' '));
        setSuggestions(remote || []);
      } else {
        setSuggestions(local);
      }
      // AI Profile: track that suggestions were shown
      const shown = local.length > 0 ? local : [];
      if (shown.length > 0) recordSuggestionsShown(shown.length).catch(() => {});
    })();
  }, [sentenceWords]);

  const addWord = async (word, wasSuggestion = false) => {
    const next = [...sentenceWords, word];
    setSentenceWords(next);
    try {
      const key = 'userInteractionLog';
      const existing = await AsyncStorage.getItem(key);
      let logArray = existing ? JSON.parse(existing) : [];
      logArray.push({ action: 'addWord', wordAdded: word, sentence: next.join(' '), timestamp: new Date().toISOString() });
      await AsyncStorage.setItem(key, JSON.stringify(logArray));
      await updateLastActivity();
      await recordTap(sentenceWords, word);
      // AI Profile: record word selection for personalized learning
      await recordWordSelection(word, sentenceWords, wasSuggestion);
    } catch (e) {
      console.error('Logging or training error:', e);
    }
  };

  const removeWord = (i) => setSentenceWords(ws => ws.filter((_, idx) => idx !== i));
  const clearSentence = () => setSentenceWords([]);
  const speakSentence = () => {
    const text = sentenceWords.join(' ');
    if (!text.trim()) return;
    speak(text, {
      rate: settings.speechRate,
      pitch: settings.speechPitch,
      voice: settings.speechVoice,
    });
    addSentenceToHistory(text).catch(() => {});
    if (sentenceWords.length > 0) {
      recordSentenceSpoken(sentenceWords).catch(() => {});
    }
  };

  if (settingsLoading) {
    return <View style={[styles.center, { backgroundColor: palette.background }]}><ActivityIndicator size="large" color={palette.primary}/></View>;
  }

  const renderPic = ({ item }) => {
    const id = item.id ?? item._id;
    const uri = `https://static.arasaac.org/pictograms/${id}/${id}_500.png`;
    const keyword = item.keywords?.[0]?.keyword || wordSearch;
    return <TouchableOpacity style={styles.picContainer} onPress={() => addWord(keyword)} accessibilityRole="button" accessibilityLabel={`Add ${keyword} to sentence`}><Image source={{ uri }} style={styles.picImage} accessibilityElementsHidden/></TouchableOpacity>;
  };

  const renderCategory = ({ item }) => {
    const isSel = selectedCategory === item;
    if (offlineMode) {
      return (
        <TouchableOpacity style={[styles.categoryChip, { backgroundColor: isSel ? palette.primary : palette.chipBg }]} onPress={() => { setWordSearch(''); setSelectedCategory(item); }} accessibilityRole="button" accessibilityState={{ selected: isSel }}>
          <Text style={[styles.categoryChipText, { color: isSel ? palette.buttonText : palette.text }]}>{item}</Text>
        </TouchableOpacity>
      );
    }
    const rep = categoryImages[item];
    const id = rep?.id ?? rep?._id;
    const uri = id ? `https://static.arasaac.org/pictograms/${id}/${id}_500.png` : `https://via.placeholder.com/80?text=${item}`;
    return <TouchableOpacity style={[styles.categoryCard, isSel && [styles.categorySelected, { borderColor: palette.primary }]]} onPress={() => { setWordSearch(''); setSelectedCategory(item); }}><Image source={{ uri }} style={styles.categoryImage}/><Text style={[styles.categoryLabel, { color: palette.text }]}>{item}</Text></TouchableOpacity>;
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: palette.background }]} nestedScrollEnabled>
      <View style={styles.headerRow}><Text style={[styles.heading, { color: palette.text }]}>Build a Sentence</Text><Button title="Clear" onPress={clearSentence} color={palette.danger}/></View>
      <View style={styles.row}>{sentenceWords.map((w, i) => <View key={i} style={[styles.wordChipContainer, { backgroundColor: palette.chipBg }]}><Text style={[styles.wordChip, { color: palette.text }]}>{w}</Text><TouchableOpacity onPress={() => removeWord(i)} style={[styles.removeChip, { backgroundColor: palette.danger }]}><Text style={{ color: palette.buttonText }}>✕</Text></TouchableOpacity></View>)}</View>
      <View style={styles.speakButtonInline}><Button title="Speak" onPress={speakSentence} color={palette.primary}/></View>
      <Text style={[styles.label, { color: palette.text }]}>Categories</Text>
      <FlatList data={categories} horizontal keyExtractor={i => i} showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }} contentContainerStyle={{ paddingVertical: 4 }} renderItem={renderCategory} />
      <TextInput style={[styles.input, { borderColor: palette.inputBorder, color: palette.text }]} placeholder="Search any English word" placeholderTextColor={palette.textSecondary} value={wordSearch} onChangeText={setWordSearch}/>
      {loadingPictures ? <ActivityIndicator/> : offlineMode ? (
        <View style={styles.offlineGrid}>
          {(OFFLINE_CATEGORIES[selectedCategory] || []).map(word => (
            <TouchableOpacity key={word} style={[styles.offlineWord, { backgroundColor: palette.chipBg, borderColor: palette.border }]} onPress={() => addWord(word)} accessibilityRole="button" accessibilityLabel={`Add ${word}`}>
              <Text style={[styles.offlineWordText, { color: palette.text }]}>{word}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <FlatList data={wordSearch ? searchResults : categoryPictures} horizontal keyExtractor={item => ((item.id ?? item._id) ?? '').toString()} showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, maxHeight: 100, marginBottom: 12 }} contentContainerStyle={{ paddingVertical: 4 }} renderItem={renderPic} ListEmptyComponent={() => <Text style={[styles.emptyText, { color: palette.text }]}>No pictograms found.</Text>} />
      )}
      <Text style={[styles.label, { color: palette.text }]}>AI Suggestions</Text>
      <FlatList data={suggestions} horizontal keyExtractor={(_, i) => i.toString()} showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }} contentContainerStyle={{ paddingVertical: 4 }} renderItem={({ item }) => <View style={{ marginRight: 8 }}><Button title={item} onPress={() => addWord(item, true)} color={palette.primary}/></View>} />
      <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'}/>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heading: { fontSize: 24, fontWeight: 'bold' },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  wordChipContainer: { flexDirection: 'row', borderRadius: 16, margin: 4, paddingRight: 4, alignItems: 'center' },
  wordChip: { marginHorizontal: 8, fontSize: 16 },
  removeChip: { borderRadius: 8, padding: 2 },
  speakButtonInline: { alignSelf: 'flex-end', marginBottom: 12 },
  label: { fontSize: 18, marginTop: 16, marginBottom: 8 },
  input: { marginVertical: 12, borderWidth: 1, borderRadius: 8, padding: 8 },
  categoryCard: { marginRight: 12, alignItems: 'center' },
  categoryImage: { width: 60, height: 60, borderRadius: 8 },
  categoryLabel: { marginTop: 4, fontSize: 12, fontWeight: 'bold' },
  categorySelected: { borderWidth: 2, borderRadius: 8 },
  picContainer: { marginRight: 8, alignItems: 'center' },
  picImage: { width: 80, height: 80, borderRadius: 8 },
  emptyText: { textAlign: 'center', fontSize: 16 },
  offlineGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  offlineWord: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.sm, borderWidth: 1 },
  offlineWordText: { fontSize: 15, fontWeight: '500' },
  categoryChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.pill, marginRight: spacing.sm },
  categoryChipText: { fontSize: 14, fontWeight: '600' },
});