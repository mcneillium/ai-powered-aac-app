// src/screens/EasySentenceBuilderScreen.js
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Button, ActivityIndicator, StyleSheet } from 'react-native';
import {
  ensureImprovedModelLoaded,
  waitUntilModelReady,
  predictTopKWordsWithImprovedModel
} from '../services/improvedModelLoader';

export default function EasySentenceBuilderScreen() {
  const [loadingModel, setLoadingModel] = useState(true);
  const [error, setError] = useState(null);
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        await ensureImprovedModelLoaded();
      } catch (e) {
        setError(e?.message || String(e));
      } finally {
        setLoadingModel(false);
      }
    })();
  }, []);

  const fetchSuggestions = useCallback(async (inputText) => {
    try {
      console.log('🚀 Fetching AI suggestions for:', JSON.stringify(inputText));
      await waitUntilModelReady(5000); // guard against race
      const top = await predictTopKWordsWithImprovedModel(
        null,     // use singleton model
        null,     // use singleton tokenizer
        inputText,
        1.2,      // temperature
        4,        // sequence length
        4         // topK
      );
      setSuggestions(top);
    } catch (e) {
      console.warn('⚠️ Suggestion fetch failed:', e);
      setError(e?.message || String(e));
    }
  }, []);

  if (loadingModel) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Loading language model…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Model error:</Text>
        <Text style={styles.suberror}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Type your sentence:</Text>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Start typing…"
        onSubmitEditing={() => fetchSuggestions(text)}
      />
      <Button title="Get suggestions" onPress={() => fetchSuggestions(text)} />
      <View style={styles.suggestions}>
        <Text style={styles.sugTitle}>Suggestions:</Text>
        {suggestions.length ? (
          suggestions.map((s, i) => <Text key={i} style={styles.sugItem}>• {s}</Text>)
        ) : (
          <Text style={styles.sugEmpty}>No suggestions yet</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#d32f2f', fontSize: 18, fontWeight: 'bold', marginTop: 8 },
  suberror: { color: '#666', textAlign: 'center', paddingHorizontal: 20, marginTop: 4 },
  container: { flex: 1, padding: 16 },
  label: { fontSize: 16, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12 },
  suggestions: { marginTop: 16 },
  sugTitle: { fontWeight: '600', marginBottom: 8 },
  sugItem: { fontSize: 16, marginBottom: 4 },
  sugEmpty: { color: '#999' },
});
