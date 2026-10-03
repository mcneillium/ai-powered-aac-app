import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, TextInput, Button, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Image } from 'react-native';
import { speak, buildSpeechOptions } from '../services/speechService';
import { StatusBar } from 'expo-status-bar';
import { searchPictograms } from '../services/arasaacService';
import { suggestNext } from '../services/suggestionEngine';
import { updateLastActivity } from '../utils/syncStatus';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, spacing, radii } from '../theme';
import { recordSentenceSpoken, recordFailedSearch } from '../services/aiProfileStore';
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

  const categories = Object.keys(OFFLINE_CATEGORIES);
  const palette = getPalette(settings.theme, settings.boardLayout);
  const [offlineMode, setOfflineMode] = useState(false);
  // Learning follows the same explicit opt-in as the board.
  const aiEnabled = settings.personalLearning === true && settings.aiPersonalisationEnabled !== false;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const reps = {};
      for (let cat of categories) {
        try {
          const data = await searchPictograms('en', cat);
          if (data?.length) reps[cat] = data[0];
        } catch { /* offline — category renders as a text chip */ }
      }
      if (!cancelled) setCategoryImages(reps);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced, cancellable pictogram search: one in-flight request wins,
  // stale responses are dropped so results always match the current input.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoadingPictures(true);
      try {
        const pics = wordSearch ? await searchPictograms('en', wordSearch) : await searchPictograms('en', selectedCategory);
        if (cancelled) return;
        if (wordSearch) setSearchResults(pics || []);
        else setCategoryPictures(pics || []);
        setOfflineMode(false);
      } catch (e) {
        if (cancelled) return;
        // Fall back to offline word list — no disruptive alert
        setOfflineMode(true);
        if (wordSearch) setSearchResults([]);
        else setCategoryPictures([]);
        if (wordSearch && aiEnabled) recordFailedSearch(wordSearch).catch(() => {});
      } finally {
        if (!cancelled) setLoadingPictures(false);
      }
    }, wordSearch ? 300 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, wordSearch]);

  // Same on-device engine as the board (synchronous, offline).
  useEffect(() => {
    setSuggestions(suggestNext(sentenceWords, { k: 5 }).map(x => x.word));
  }, [sentenceWords]);

  const addWord = async (word) => {
    setSentenceWords(prev => [...prev, word]);
    try {
      await updateLastActivity();
      // Taps are not used for learning (only spoken messages on the board).
    } catch (e) {
      console.warn('Prediction training error:', e.message);
    }
  };

  const removeWord = (i) => setSentenceWords(ws => ws.filter((_, idx) => idx !== i));
  const clearSentence = () => setSentenceWords([]);
  const speakSentence = () => {
    const text = sentenceWords.join(' ');
    if (!text.trim()) return;
    speak(text, buildSpeechOptions(settings));
    addSentenceToHistory(text).catch(() => {});
    if (aiEnabled && sentenceWords.length > 0) {
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
    const uri = id ? `https://static.arasaac.org/pictograms/${id}/${id}_500.png` : null;
    return (
      <TouchableOpacity
        style={[styles.categoryCard, isSel && [styles.categorySelected, { borderColor: palette.primary }]]}
        onPress={() => { setWordSearch(''); setSelectedCategory(item); }}
        accessibilityRole="button"
        accessibilityLabel={`${item} category`}
        accessibilityState={{ selected: isSel }}
      >
        {uri ? (
          <Image source={{ uri }} style={styles.categoryImage} accessibilityElementsHidden />
        ) : (
          <View style={[styles.categoryImage, styles.categoryImageFallback, { backgroundColor: palette.chipBg }]}>
            <Text style={[styles.categoryFallbackText, { color: palette.text }]}>{item[0]}</Text>
          </View>
        )}
        <Text style={[styles.categoryLabel, { color: palette.text }]}>{item}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: palette.background }]} nestedScrollEnabled>
      <View style={styles.headerRow}><Text style={[styles.heading, { color: palette.text }]}>Build a Sentence</Text><Button title="Clear" onPress={clearSentence} color={palette.danger}/></View>
      <View style={styles.row}>{sentenceWords.map((w, i) => <View key={i} style={[styles.wordChipContainer, { backgroundColor: palette.chipBg }]}><Text style={[styles.wordChip, { color: palette.text }]}>{w}</Text><TouchableOpacity onPress={() => removeWord(i)} style={[styles.removeChip, { backgroundColor: palette.danger }]} accessibilityRole="button" accessibilityLabel={`Remove ${w} from sentence`} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Text style={{ color: palette.buttonText }}>✕</Text></TouchableOpacity></View>)}</View>
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
  categoryImageFallback: { alignItems: 'center', justifyContent: 'center' },
  categoryFallbackText: { fontSize: 24, fontWeight: '700' },
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