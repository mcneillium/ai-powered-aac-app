// src/screens/EasySentenceBuilderScreen.js
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
  Alert,
  SafeAreaView
} from 'react-native';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { searchPictograms, getPictogramUrl } from '../services/arasaacService';
import { getAISuggestions } from '../services/getAISuggestions';
import { pushLogsToFirebase } from '../services/logSyncService';
import { fineTuneUserModel } from '../services/userFineTuneService';

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

  const wordBank = [
    'I', 'a', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'us', 'my', 'your', 'our',
    'want', 'need', 'have', 'go', 'come', 'do', 'make', 'eat', 'drink', 'play', 'sleep',
    'read', 'write', 'look', 'see', 'get', 'give', 'take', 'help', 'start', 'stop',
    'open', 'close', 'buy', 'sell',
    'happy', 'sad', 'angry', 'excited', 'scared', 'calm', 'tired', 'hungry', 'thirsty',
    'big', 'small', 'good', 'bad', 'new', 'old', 'fast', 'slow',
    'food', 'water', 'home', 'school', 'friend', 'family', 'car', 'book', 'toy', 'ball',
    'bed', 'work', 'park', 'shop', 'phone',
    'love', 'like', 'more', 'please', 'okay', 'yes', 'no', 'maybe',
    'now', 'later', 'here', 'there', 'today', 'tomorrow',
    'help', 'stop', 'start', 'again', 'why', 'what', 'where'
  ];

  const filteredWordBank = wordSearch.length > 0
    ? wordBank.filter(word => word.toLowerCase().includes(wordSearch.toLowerCase()))
    : wordBank;

  const categories = ['Everyday', 'Food', 'Drinks', 'People', 'Places'];

  useEffect(() => {
    loadAvailablePictures(selectedCategory);
  }, [selectedCategory]);

  useEffect(() => {
    const updateSuggestions = async () => {
      const currentSentence = sentenceWords.join(' ');
      console.log("Current sentence for prediction:", currentSentence);
      const newSuggestions = await getAISuggestions(currentSentence);
      console.log("New suggestions returned:", newSuggestions);
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

  const logUserInteraction = async (interactionData) => {
    try {
      const storedLog = await AsyncStorage.getItem('userInteractionLog');
      let logArray = storedLog ? JSON.parse(storedLog) : [];
      logArray.push(interactionData);
      await AsyncStorage.setItem('userInteractionLog', JSON.stringify(logArray));
      console.log("Logged interaction:", interactionData);
    } catch (error) {
      console.error('Error logging interaction:', error);
    }
  };

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

  const clearSentence = () => {
    setSentenceWords([]);
    logUserInteraction({
      action: 'clearSentence',
      timestamp: new Date().toISOString(),
    });
  };

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
      }, 500);
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

  const toggleLogVisibility = () => {
    setLogVisible(prev => !prev);
    if (!logVisible) {
      fetchLogData();
    }
  };

  // Push logs to Firebase when the button is pressed.
  const handlePushLogs = async () => {
    try {
      await pushLogsToFirebase();
      Alert.alert('Success', 'Logs have been pushed to Firebase!');
    } catch (error) {
      Alert.alert('Error', 'Failed to push logs. Please check console.');
    }
  };

  // Fine-tune model using user logs.
  const handleFineTuneModel = async () => {
    try {
      await fineTuneUserModel(3); // Fine-tune for 3 epochs (adjust as needed)
      Alert.alert('Success', 'Model fine-tuned with your inputs!');
    } catch (error) {
      console.error('Error fine-tuning model:', error);
      Alert.alert('Error', 'Model fine-tuning failed. Check console.');
    }
  };

  const renderCategoryButton = (category, index) => (
    <TouchableOpacity
      key={index}
      style={[
        styles.categoryButton,
        category === selectedCategory && styles.categoryButtonSelected,
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

  const renderSuggestionButton = (word, index) => (
    <TouchableOpacity
      key={index}
      style={styles.suggestionButton}
      onPress={() => addWord(word)}
    >
      <Text style={styles.suggestionButtonText}>{word}</Text>
    </TouchableOpacity>
  );

  const getPictogramLabel = (item) => {
    if (item.keywords && item.keywords.length > 0 && item.keywords[0].keyword) {
      return item.keywords[0].keyword;
    }
    return 'No description';
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <ScrollView contentContainerStyle={styles.container}>
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
          {suggestions.map((suggestion, index) =>
            renderSuggestionButton(suggestion, index)
          )}
        </ScrollView>

        {/* Word Bank with Search */}
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
          {categories.map((category, index) =>
            renderCategoryButton(category, index)
          )}
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

        <View style={styles.buttonRow}>
          <Button title="Push Logs to Firebase" onPress={handlePushLogs} color="#FF9800" />
        </View>

        <View style={styles.buttonRow}>
          <Button title="Fine-Tune Model" onPress={handleFineTuneModel} color="#FF5722" />
        </View>

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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  heading: {
    fontSize: 28,
    textAlign: 'center',
    marginVertical: 15,
    fontWeight: 'bold',
  },
  sentencePreview: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    minHeight: 60,
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#fafafa'
  },
  sentenceWord: {
    fontSize: 20,
    color: '#333',
  },
  highlightedWord: {
    backgroundColor: '#ffff00',
  },
  sectionHeading: {
    fontSize: 22,
    marginBottom: 10,
    fontWeight: '600',
    width: '100%',
  },
  searchInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
  },
  wordBankContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    paddingHorizontal: 5,
  },
  wordButton: {
    backgroundColor: '#d0e8ff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginRight: 10,
  },
  wordButtonText: {
    fontSize: 18,
    color: '#333',
  },
  categoryBar: {
    flexDirection: 'row',
    marginBottom: 20,
    paddingHorizontal: 5,
  },
  categoryButton: {
    backgroundColor: '#e0e0e0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 10,
  },
  categoryButtonSelected: {
    backgroundColor: '#4CAF50',
  },
  categoryButtonText: {
    fontSize: 16,
    color: '#333',
  },
  pictogramContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  pictogramItem: {
    marginRight: 10,
  },
  pictogramImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },
  loadingText: {
    fontSize: 18,
    textAlign: 'center',
    marginVertical: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 8,
  },
  suggestionBar: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  suggestionButton: {
    backgroundColor: '#ffcccb',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 10,
  },
  suggestionButtonText: {
    fontSize: 16,
    color: '#333',
  },
  logContainer: {
    marginTop: 20,
    maxHeight: 150,
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
  },
  logHeading: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
  },
  logText: {
    fontSize: 14,
    color: '#555',
    marginVertical: 2,
  },
});
