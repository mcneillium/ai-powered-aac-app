import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, TextInput, Button, Alert, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Image } from 'react-native';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { searchPictograms } from '../services/arasaacService';
import { getAISuggestions } from '../services/getAISuggestions';
import { updateLastActivity } from '../utils/syncStatus';
import { useSettings } from '../contexts/SettingsContext';
import { useOnDevicePrediction } from '../hooks/useOnDevicePrediction';

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

  const categories = ['Everyday', 'Food', 'Drinks', 'People', 'Places'];
  const palettes = { light: { background: '#fff', text: '#000' }, dark: { background: '#000', text: '#fff' }, highContrast: { background: '#000', text: '#FFD600' } };
  const palette = palettes[settings.theme];

  useEffect(() => {
    (async () => {
      const reps = {};
      for (let cat of categories) {
        try {
          const data = await searchPictograms('en', cat);
          if (data?.length) reps[cat] = data[0];
        } catch (e) {
          console.warn(`Failed to load pictogram for category "${cat}":`, e.message);
        }
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
      } catch (e) {
        if (!(wordSearch && e.response?.status === 404)) {
          console.error('Error loading pictograms:', e);
          Alert.alert('Error', 'Failed to load pictograms.');
        } else {
          wordSearch ? setSearchResults([]) : setCategoryPictures([]);
        }
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
      } catch (e) {
        console.warn('On-device prediction failed:', e.message);
      }
      if (local.length === 0) {
        const remote = await getAISuggestions(sentenceWords.join(' '));
        setSuggestions(remote || []);
      } else {
        setSuggestions(local);
      }
    })();
  }, [sentenceWords]);

  const addWord = async (word) => {
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
    } catch (e) {
      console.error('Logging or training error:', e);
    }
  };

  const removeWord = (i) => setSentenceWords(ws => ws.filter((_, idx) => idx !== i));
  const clearSentence = () => setSentenceWords([]);
  const speakSentence = () => Speech.speak(sentenceWords.join(' ') || ' ');

  if (settingsLoading) {
    return <View style={[styles.center, { backgroundColor: palette.background }]}><ActivityIndicator size="large" color="#4CAF50"/></View>;
  }

  const renderPic = ({ item }) => {
    const id = item.id ?? item._id;
    const uri = `https://static.arasaac.org/pictograms/${id}/${id}_500.png`;
    const keyword = item.keywords?.[0]?.keyword || wordSearch;
    return <TouchableOpacity style={styles.picContainer} onPress={() => addWord(keyword)}><Image source={{ uri }} style={styles.picImage}/></TouchableOpacity>;
  };

  const renderCategory = ({ item }) => {
    const rep = categoryImages[item];
    const id = rep?.id ?? rep?._id;
    const uri = id ? `https://static.arasaac.org/pictograms/${id}/${id}_500.png` : `https://via.placeholder.com/80?text=${item}`;
    return <TouchableOpacity style={[styles.categoryCard, selectedCategory === item && styles.categorySelected]} onPress={() => { setWordSearch(''); setSelectedCategory(item); }}><Image source={{ uri }} style={styles.categoryImage}/><Text style={[styles.categoryLabel, { color: palette.text }]}>{item}</Text></TouchableOpacity>;
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: palette.background }]} nestedScrollEnabled>
      <View style={styles.headerRow}><Text style={[styles.heading, { color: palette.text }]}>Build a Sentence</Text><Button title="Clear" onPress={clearSentence} color="#f44336"/></View>
      <View style={styles.row}>{sentenceWords.map((w, i) => <View key={i} style={styles.wordChipContainer}><Text style={[styles.wordChip, { color: palette.text }]}>{w}</Text><TouchableOpacity onPress={() => removeWord(i)} style={styles.removeChip}><Text style={{ color: '#fff' }}>✕</Text></TouchableOpacity></View>)}</View>
      <View style={styles.speakButtonInline}><Button title="Speak" onPress={speakSentence} color="#4CAF50"/></View>
      <Text style={[styles.label, { color: palette.text }]}>Categories</Text>
      <FlatList data={categories} horizontal keyExtractor={i => i} showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }} contentContainerStyle={{ paddingVertical: 4 }} renderItem={renderCategory} />
      <TextInput style={[styles.input, { borderColor: '#ccc', color: palette.text }]} placeholder="Search any English word" placeholderTextColor="#888" value={wordSearch} onChangeText={setWordSearch}/>
      {loadingPictures ? <ActivityIndicator/> : <FlatList data={wordSearch ? searchResults : categoryPictures} horizontal keyExtractor={item => ((item.id ?? item._id) ?? '').toString()} showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, maxHeight: 100, marginBottom: 12 }} contentContainerStyle={{ paddingVertical: 4 }} renderItem={renderPic} ListEmptyComponent={() => <Text style={[styles.emptyText, { color: palette.text }]}>No pictograms.</Text>} />}
      <Text style={[styles.label, { color: palette.text }]}>AI Suggestions</Text>
      <FlatList data={suggestions} horizontal keyExtractor={(_, i) => i.toString()} showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }} contentContainerStyle={{ paddingVertical: 4 }} renderItem={({ item }) => <View style={{ marginRight: 8 }}><Button title={item} onPress={() => addWord(item)} color="#4CAF50"/></View>} />
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
  wordChipContainer: { flexDirection: 'row', backgroundColor: '#e0e0e0', borderRadius: 16, margin: 4, paddingRight: 4, alignItems: 'center' },
  wordChip: { marginHorizontal: 8, fontSize: 16 },
  removeChip: { backgroundColor: '#f44336', borderRadius: 8, padding: 2 },
  speakButtonInline: { alignSelf: 'flex-end', marginBottom: 12 },
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