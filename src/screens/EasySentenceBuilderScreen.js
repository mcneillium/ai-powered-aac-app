import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Button,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
} from 'react-native';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { searchPictograms, getPictogramUrl } from '../services/arasaacService';
import { getAISuggestions } from '../services/getAISuggestions';

export default function EasySentenceBuilderScreen() {
  const [sentenceWords, setSentenceWords] = useState([]);
  const [availablePictures, setAvailablePictures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Everyday');
  const [wordSearch, setWordSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [interactionLog, setInteractionLog] = useState([]);
  const [logVisible, setLogVisible] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(null);

  // Expanded Word Bank with more varied vocabulary
  const wordBank = [
    // Pronouns & Connectors
    'I', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'us', 'my', 'your', 'our',
    // Verbs (Actions)
    'want', 'need', 'have', 'go', 'come', 'do', 'make', 'eat', 'drink', 'play', 'sleep', 'read', 'write', 'look', 'see', 'get', 'give', 'take', 'help', 'start', 'stop', 'open', 'close', 'buy', 'sell',
    // Adjectives (Qualities/States)
    'happy', 'sad', 'angry', 'excited', 'scared', 'calm', 'tired', 'hungry', 'thirsty', 'big', 'small', 'good', 'bad', 'new', 'old', 'fast', 'slow',
    // Nouns (Common Objects and Places)
    'food', 'water', 'home', 'school', 'friend', 'family', 'car', 'book', 'toy', 'ball', 'bed', 'work', 'park', 'shop', 'phone',
    // Emotions & States
    'love', 'like', 'more', 'please', 'okay', 'yes', 'no', 'maybe',
    // Time & Direction
    'now', 'later', 'here', 'there', 'today', 'tomorrow',
    // Additional Useful Words
    'help', 'stop', 'start', 'again', 'why', 'what', 'where'
  ];

  const filteredWordBank =
    wordSearch.length > 0
      ? wordBank.filter(word =>
          word.toLowerCase().includes(wordSearch.toLowerCase())
        )
      : wordBank;

  // Pictogram categories for filtering the bank
  const categories = ['Everyday', 'Food', 'Drinks', 'People', 'Places'];

  useEffect(() => {
    loadAvailablePictures(selectedCategory);
  }, [selectedCategory]);

  useEffect(() => {
    // Update AI-driven suggestions whenever the sentence changes
    const updateSuggestions = async () => {
      const currentSentence = sentenceWords.join(' ');
      const newSuggestions = await getAISuggestions(currentSentence);
      setSuggestions(newSuggestions);
    };
    updateSuggestions();
  }, [sentenceWords]);

  const loadAvailablePictures = async (category) => {
    setLoading(true);
    const data = await searchPictograms('en', category);
    if (data) {
      setAvailablePictures(data);
    }
    setLoading(false);
  };

  // Log interaction data to AsyncStorage
  const logUserInteraction = async (interactionData) => {
    try {
      const storedLog = await AsyncStorage.getItem('userInteractionLog');
      let logArray = storedLog ? JSON.parse(storedLog) : [];
      logArray.push(interactionData);
      await AsyncStorage.setItem('userInteractionLog', JSON.stringify(logArray));
    } catch (error) {
      console.error('Error logging interaction:', error);
    }
  };

  // Fetch log data from AsyncStorage
  const fetchLogData = async () => {
    try {
      const storedLog = await AsyncStorage.getItem('userInteractionLog');
      const logArray = storedLog ? JSON.parse(storedLog) : [];
      setInteractionLog(logArray);
      console.log('User Interaction Log:', logArray);
    } catch (error) {
      console.error('Error fetching log data:', error);
    }
  };

  // Add a word to the sentence and log the interaction
  const addWord = (word) => {
    setSentenceWords((prev) => {
      const newSentence = [...prev, word];
      logUserInteraction({
        action: 'addWord',
        wordAdded: word,
        sentence: newSentence.join(' '),
        timestamp: new Date().toISOString(),
      });
      return newSentence;
    });
  };

  // Clear the sentence and log the interaction
  const clearSentence = () => {
    setSentenceWords([]);
    logUserInteraction({
      action: 'clearSentence',
      timestamp: new Date().toISOString(),
    });
  };

  // Updated speakSentence function:
  // It highlights each word sequentially as the sentence is spoken.
  const speakSentence = () => {
    const sentence = sentenceWords.join(' ');
    if (sentence.trim().length > 0) {
      const words = sentenceWords;
      let currentIndex = 0;
      setHighlightIndex(currentIndex);
      const interval = setInterval(() => {
        currentIndex++;
        if (currentIndex < words.length) {
          setHighlightIndex(currentIndex);
        } else {
          clearInterval(interval);
          setHighlightIndex(null);
        }
      }, 500); // 500ms per word; adjust as needed

      Speech.speak(sentence);
      logUserInteraction({
        action: 'speakSentence',
        sentence: sentence,
        timestamp: new Date().toISOString(),
      });
    } else {
      Speech.speak('No sentence to speak');
    }
  };

  // Toggle log visibility and fetch log data when showing
  const toggleLogVisibility = () => {
    setLogVisible(prev => !prev);
    if (!logVisible) {
      fetchLogData();
    }
  };

  // Helper: Extract a label from a pictogram item.
  const getPictogramLabel = (item) => {
    if (item.keywords && item.keywords.length > 0 && item.keywords[0].keyword) {
      return item.keywords[0].keyword;
    }
    return 'No description';
  };

  const renderCategoryButton = (category, index) => (
    <TouchableOpacity
      key={index}
      style={[
        styles.categoryButton,
        category === selectedCategory ? styles.categoryButtonSelected : null,
      ]}
      onPress={() => setSelectedCategory(category)}
    >
      <Text style={styles.categoryButtonText}>{category}</Text>
    </TouchableOpacity>
  );

  const renderPictogramItem = ({ item }) => (
    <TouchableOpacity
      style={styles.pictogramItem}
      onPress={() => addWord(getPictogramLabel(item))}
    >
      <Image
        style={styles.pictogramImage}
        source={{ uri: getPictogramUrl(item._id, 500) }}
      />
    </TouchableOpacity>
  );

  const renderWordButton = (word, index) => (
    <TouchableOpacity
      key={index}
      style={styles.wordButton}
      onPress={() => addWord(word)}
    >
      <Text style={styles.wordButtonText}>{word}</Text>
    </TouchableOpacity>
  );

  // Render suggestion button for AI-generated suggestions (each suggestion is a single word)
  const renderSuggestionButton = (word, index) => (
    <TouchableOpacity
      key={index}
      style={styles.suggestionButton}
      onPress={() => addWord(word)}
    >
      <Text style={styles.suggestionButtonText}>{word}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Create Your Sentence</Text>
      
      {/* Sentence Preview */}
      <View style={styles.sentencePreview}>
        {sentenceWords.map((word, index) => (
          <Text
            key={index}
            style={[
              styles.sentenceWord,
              highlightIndex === index && styles.highlightedWord,
            ]}
          >
            {word}{' '}
          </Text>
        ))}
      </View>

      {/* AI-Driven Suggestion Bar */}
      <ScrollView horizontal contentContainerStyle={styles.suggestionBar}>
        {suggestions.map((suggestion, index) => renderSuggestionButton(suggestion, index))}
      </ScrollView>

      {/* Expanded Word Bank with Search */}
      <Text style={styles.sectionHeading}>Word Bank</Text>
      <TextInput
        style={styles.searchInput}
        placeholder="Search words..."
        value={wordSearch}
        onChangeText={setWordSearch}
      />
      <ScrollView horizontal contentContainerStyle={styles.wordBankContainer}>
        {filteredWordBank.map((word, index) => renderWordButton(word, index))}
      </ScrollView>

      {/* Pictogram Categories */}
      <Text style={styles.sectionHeading}>Pictogram Categories</Text>
      <ScrollView horizontal contentContainerStyle={styles.categoryBar}>
        {categories.map((category, index) => renderCategoryButton(category, index))}
      </ScrollView>

      {/* Pictogram Bank */}
      <Text style={styles.sectionHeading}>Pictogram Bank</Text>
      {loading ? (
        <Text style={styles.loadingText}>Loading pictograms...</Text>
      ) : (
        <FlatList
          data={availablePictures}
          horizontal
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderPictogramItem}
          contentContainerStyle={styles.pictogramContainer}
        />
      )}

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        <Button title="Speak Sentence" onPress={speakSentence} color="#4CAF50" />
        <Button title="Clear Sentence" onPress={clearSentence} color="#f44336" />
      </View>
      <View style={styles.buttonRow}>
        <Button title={logVisible ? "Hide Log" : "View Log"} onPress={toggleLogVisibility} color="#2196F3" />
      </View>

      {/* Display Interaction Log if visible */}
      {logVisible && interactionLog.length > 0 && (
        <ScrollView style={styles.logContainer}>
          <Text style={styles.logHeading}>User Interaction Log:</Text>
          {interactionLog.map((log, index) => (
            <Text key={index} style={styles.logText}>
              {log.timestamp} - {log.action}{log.wordAdded ? `: ${log.wordAdded}` : ''}{log.sentence ? ` - ${log.sentence}` : ''}
            </Text>
          ))}
        </ScrollView>
      )}

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  heading: { fontSize: 28, textAlign: 'center', marginBottom: 15, fontWeight: 'bold' },
  sentencePreview: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    minHeight: 50,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sentenceWord: { fontSize: 20, color: '#333' },
  highlightedWord: { backgroundColor: '#ffff00' },
  sectionHeading: { fontSize: 22, marginBottom: 10, fontWeight: '600' },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    fontSize: 16,
  },
  wordBankContainer: { flexDirection: 'row', marginBottom: 20 },
  wordButton: {
    backgroundColor: '#d0e8ff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginRight: 10,
  },
  wordButtonText: { fontSize: 18, color: '#333' },
  categoryBar: { flexDirection: 'row', marginBottom: 20 },
  categoryButton: {
    backgroundColor: '#e0e0e0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 10,
  },
  categoryButtonSelected: { backgroundColor: '#4CAF50' },
  categoryButtonText: { fontSize: 16, color: '#333' },
  pictogramContainer: { alignItems: 'center', paddingVertical: 10 },
  pictogramItem: { marginRight: 10 },
  pictogramImage: { width: 100, height: 100, borderRadius: 10 },
  loadingText: { fontSize: 18, textAlign: 'center' },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 10,
  },
  suggestionBar: { flexDirection: 'row', marginBottom: 10 },
  suggestionButton: {
    backgroundColor: '#ffcccb',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 10,
  },
  suggestionButtonText: { fontSize: 16, color: '#333' },
  logContainer: { marginTop: 20, maxHeight: 150, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  logHeading: { fontSize: 18, fontWeight: '600', marginBottom: 5 },
  logText: { fontSize: 14, color: '#555' },
});
