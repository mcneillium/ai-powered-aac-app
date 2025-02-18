// src/screens/AdvancedSentenceBuilderScreen.js
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Image,
  TouchableOpacity,
  ScrollView,
  Button,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import { searchPictograms, getPictogramUrl } from '../services/arasaacService';

// ONLY ONE default export:
export default function AdvancedSentenceBuilderScreen() {
  const [availablePictures, setAvailablePictures] = useState([]);
  const [sentencePictures, setSentencePictures] = useState([]);
  const [loading, setLoading] = useState(false);

  // For free text sentence building:
  const [sentenceWords, setSentenceWords] = useState([]);
  const [inputWord, setInputWord] = useState('');
  const [predictedWords, setPredictedWords] = useState([]);

  // Predefined word bank
  const wordBank = ['I', 'or', 'want', 'of', 'can', 'I have', 'please', 'more', 'do', 'you', 'like'];

  useEffect(() => {
    loadAvailablePictures('Everyday');
  }, []);

  const loadAvailablePictures = async (category) => {
    setLoading(true);
    const data = await searchPictograms('en', category);
    if (data) {
      setAvailablePictures(data);
    }
    setLoading(false);
  };

  const addPictureToSentence = (picture) => {
    setSentencePictures((prev) => [...prev, picture]);
    Speech.speak(picture.name);
  };

  const speakSentence = () => {
    const pictogramSentence = sentencePictures.map((p) => p.name).join(' ');
    const wordSentence = sentenceWords.join(' ');
    const combinedSentence = [pictogramSentence, wordSentence]
      .filter(Boolean)
      .join('. ');
    if (combinedSentence) {
      Speech.speak(combinedSentence);
    } else {
      Speech.speak('No sentence to speak');
    }
  };

  const clearSentence = () => {
    setSentencePictures([]);
    setSentenceWords([]);
  };

  const addWordToSentence = () => {
    if (inputWord.trim() !== '') {
      setSentenceWords((prev) => [...prev, inputWord.trim()]);
      setInputWord('');
      setPredictedWords([]);
    }
  };

  const addPredefinedWord = (word) => {
    setSentenceWords((prev) => [...prev, word]);
  };

  // Simple, demo-based text prediction
  const predictWords = (text) => {
    if (!text) return [];
    // Return dummy predictions starting with the same letter
    const dummyPredictions = ['apple', 'application', 'apartment'];
    return dummyPredictions.filter((word) =>
      word.toLowerCase().startsWith(text.toLowerCase())
    );
  };

  const handleInputChange = (text) => {
    setInputWord(text);
    const predictions = predictWords(text);
    setPredictedWords(predictions);
  };

  // Simple gesture event example
  const onGestureEvent = (event) => {
    // If the user swipes right (translationX > 50), clear predictions
    if (event.nativeEvent.translationX > 50) {
      setPredictedWords([]);
      console.log('Swipe right detected, clearing predictions');
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <PanGestureHandler onGestureEvent={onGestureEvent}>
        <View style={styles.container}>
          <Text style={styles.heading}>Advanced Sentence Builder</Text>

          {/* Free text input */}
          <View style={styles.freeTextContainer}>
            <TextInput
              style={styles.input}
              placeholder="Type a word..."
              value={inputWord}
              onChangeText={handleInputChange}
            />
            <Button title="Add Word" onPress={addWordToSentence} color="#4CAF50" />
          </View>

          {/* Predictions */}
          {predictedWords.length > 0 && (
            <View style={styles.predictionsContainer}>
              {predictedWords.map((word, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    setInputWord(word);
                    setPredictedWords([]);
                  }}
                >
                  <Text style={styles.prediction}>{word}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Word Bank */}
          <Text style={styles.wordBankHeading}>Word Bank:</Text>
          <ScrollView horizontal contentContainerStyle={styles.wordBankContainer}>
            {wordBank.map((word, index) => (
              <TouchableOpacity
                key={index}
                style={styles.wordBankItem}
                onPress={() => addPredefinedWord(word)}
              >
                <Text style={styles.wordBankText}>{word}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Display typed words */}
          <ScrollView horizontal contentContainerStyle={styles.sentenceBoard}>
            {sentenceWords.map((word, index) => (
              <View key={index} style={styles.sentenceItem}>
                <Text style={styles.sentenceText}>{word}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Pictogram Section */}
          <Text style={styles.availableHeading}>Available Pictures:</Text>
          {loading ? (
            <Text style={styles.loadingText}>Loading…</Text>
          ) : (
            <FlatList
              data={availablePictures}
              horizontal
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => addPictureToSentence(item)}>
                  <Image
                    style={styles.availablePicture}
                    source={{ uri: getPictogramUrl(item._id, 500) }}
                  />
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.availablePicturesList}
            />
          )}

          {/* Action buttons */}
          <View style={styles.sentenceButtons}>
            <Button title="Speak Sentence" onPress={speakSentence} color="#4CAF50" />
            <Button title="Clear Sentence" onPress={clearSentence} color="#f44336" />
          </View>

          <StatusBar style="auto" />
        </View>
      </PanGestureHandler>
    </TouchableWithoutFeedback>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f2f2f2',
  },
  heading: {
    fontSize: 26,
    textAlign: 'center',
    marginBottom: 15,
  },
  freeTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  input: {
    flex: 1,
    borderColor: '#ccc',
    borderWidth: 1,
    padding: 10,
    marginRight: 10,
    borderRadius: 5,
  },
  predictionsContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  prediction: {
    backgroundColor: '#d0e8ff',
    padding: 8,
    marginRight: 5,
    borderRadius: 5,
  },
  wordBankHeading: {
    fontSize: 20,
    marginBottom: 10,
  },
  wordBankContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  wordBankItem: {
    backgroundColor: '#d0e8ff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginRight: 10,
  },
  wordBankText: {
    fontSize: 18,
    color: '#333',
  },
  sentenceBoard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    marginBottom: 15,
  },
  sentenceItem: {
    marginHorizontal: 10,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 5,
  },
  sentenceText: {
    fontSize: 16,
  },
  availableHeading: {
    fontSize: 20,
    marginBottom: 10,
  },
  availablePicturesList: {
    alignItems: 'center',
  },
  availablePicture: {
    width: 120,
    height: 120,
    borderRadius: 15,
    marginRight: 10,
  },
  loadingText: {
    fontSize: 18,
    textAlign: 'center',
  },
  sentenceButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
});
