import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { searchPictograms, getPictogramUrl } from '../services/arasaacService';
import { getAISuggestions } from '../services/getAISuggestions';
import { logEvent } from '../utils/logger';
import { pushLogsToFirebase } from '../services/logSyncService';
import { fineTuneUserModel } from '../services/userFineTuneService';
import { MaterialIcons, FontAwesome5, AntDesign } from '@expo/vector-icons';

// Get device dimensions for responsive design
const { width } = Dimensions.get('window');

export default function EasySentenceBuilderScreen() {
  const [sentenceWords, setSentenceWords] = useState([]);
  const [inputText, setInputText] = useState("");
  const [availablePictures, setAvailablePictures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Everyday');
  const [wordSearch, setWordSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [predictedWord, setPredictedWord] = useState(null);
  const [interactionLog, setInteractionLog] = useState([]);
  const [logVisible, setLogVisible] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(null);
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced', 'syncing', 'offline'
  const [showHelp, setShowHelp] = useState(false);

  // Enhanced word bank with color-coded categories (verbs, nouns, etc.)
  const wordBank = [
    { word: 'I', type: 'pronoun' },
    { word: 'you', type: 'pronoun' },
    { word: 'he', type: 'pronoun' },
    { word: 'she', type: 'pronoun' },
    { word: 'want', type: 'verb' },
    { word: 'need', type: 'verb' },
    { word: 'like', type: 'verb' },
    { word: 'eat', type: 'verb' },
    { word: 'drink', type: 'verb' },
    { word: 'play', type: 'verb' },
    { word: 'go', type: 'verb' },
    { word: 'more', type: 'adjective' },
    { word: 'less', type: 'adjective' },
    { word: 'big', type: 'adjective' },
    { word: 'small', type: 'adjective' },
    { word: 'water', type: 'noun' },
    { word: 'food', type: 'noun' },
    { word: 'bathroom', type: 'noun' },
    { word: 'outside', type: 'noun' },
    { word: 'yes', type: 'response' },
    { word: 'no', type: 'response' },
    { word: 'maybe', type: 'response' },
    { word: 'thank you', type: 'social' },
    { word: 'please', type: 'social' },
    { word: 'help', type: 'social' },
  ];

  const categories = ['Everyday', 'Food', 'Drinks', 'People', 'Places', 'Feelings', 'Activities'];

  const filteredWordBank = wordSearch.length > 0
    ? wordBank.filter(item => item.word.toLowerCase().includes(wordSearch.toLowerCase()))
    : wordBank;

  // Load saved sentence if any
  useEffect(() => {
    const loadSavedSentence = async () => {
      try {
        const savedSentence = await AsyncStorage.getItem('lastSentence');
        if (savedSentence) {
          setSentenceWords(JSON.parse(savedSentence));
        }
      } catch (error) {
        console.error('Error loading saved sentence:', error);
      }
    };

    loadSavedSentence();
    loadAvailablePictures(selectedCategory);
    
    // Check network status initially
    checkNetworkStatus();

    // Set up interval to check network status
    const interval = setInterval(checkNetworkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Update suggestions whenever the sentence changes
  useEffect(() => {
    const updateSuggestions = async () => {
      if (sentenceWords.length === 0) {
        setSuggestions([]);
        setPredictedWord(null);
        return;
      }
      
      const currentSentence = sentenceWords.join(' ');
      console.log("Current sentence for suggestion:", currentSentence);
      
      // Save current sentence to AsyncStorage
      try {
        await AsyncStorage.setItem('lastSentence', JSON.stringify(sentenceWords));
      } catch (error) {
        console.error('Error saving sentence:', error);
      }
      
      setSyncStatus('syncing');
      try {
        const newSuggestions = await getAISuggestions(currentSentence);
        console.log("New suggestions returned:", newSuggestions);
        setSuggestions(newSuggestions);
        
        // Set the first suggestion as the predicted word if available
        if (newSuggestions && newSuggestions.length > 0) {
          setPredictedWord(newSuggestions[0]);
        } else {
          setPredictedWord(null);
        }
        setSyncStatus('synced');
      } catch (error) {
        console.error('Error getting suggestions:', error);
        setSyncStatus('offline');
      }
    };
    
    updateSuggestions();
  }, [sentenceWords]);

  // Check network connectivity status
  const checkNetworkStatus = async () => {
    try {
      // Simple connectivity check
      await fetch('https://firebasestorage.googleapis.com/v0/status');
      setSyncStatus('synced');
    } catch (error) {
      setSyncStatus('offline');
      console.log('Network appears to be offline');
    }
  };

  const loadAvailablePictures = async (category) => {
    setLoading(true);
    try {
      const data = await searchPictograms('en', category);
      if (data) {
        setAvailablePictures(data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading pictograms:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to load pictograms. Please try again later.');
    }
  };

  const logUserInteraction = async (interactionData) => {
    try {
      const storedLog = await AsyncStorage.getItem('userInteractionLog');
      let logArray = storedLog ? JSON.parse(storedLog) : [];
      
      // Add timestamp if not provided
      if (!interactionData.timestamp) {
        interactionData.timestamp = new Date().toISOString();
      }
      
      logArray.push(interactionData);
      await AsyncStorage.setItem('userInteractionLog', JSON.stringify(logArray));
      console.log("Logged interaction:", interactionData);
      
      // Also log to Firebase if online
      if (syncStatus !== 'offline') {
        logEvent(interactionData.action, {
          details: interactionData,
          screen: 'EasySentenceBuilder'
        }).catch(err => console.error('Firebase logging error:', err));
      }
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

  const removeLastWord = () => {
    setSentenceWords((prev) => {
      if (prev.length === 0) return prev;
      const newSentence = prev.slice(0, -1);
      logUserInteraction({
        action: 'removeWord',
        sentence: newSentence.join(' '),
        timestamp: new Date().toISOString(),
      });
      return newSentence;
    });
  };

  const clearSentence = () => {
    if (sentenceWords.length === 0) return;
    
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
      
      // Vibrate feedback for accessibility
      if (Speech.speak) {
        const interval = setInterval(() => {
          currentIndex++;
          if (currentIndex < words.length) {
            setHighlightIndex(currentIndex);
          } else {
            clearInterval(interval);
            setHighlightIndex(null);
          }
        }, 500);
        
        // Set speaking options with slower rate for clarity
        Speech.speak(sentence, {
          rate: 0.8,
          pitch: 1.0,
          onDone: () => setHighlightIndex(null),
          onError: (error) => {
            console.error('Speech error:', error);
            setHighlightIndex(null);
            Alert.alert('Speech Error', 'Unable to speak. Please try again.');
          }
        });
        
        logUserInteraction({
          action: 'speakSentence',
          sentence: sentence,
          timestamp: new Date().toISOString(),
        });
      } else {
        Alert.alert('Speech Not Available', 'Text-to-speech is not available on this device.');
      }
    } else {
      Alert.alert('Empty Sentence', 'Please add words to your sentence first.');
    }
  };

  // Update the sentenceWords from manual text entry
  const updateSentenceFromInput = () => {
    if (inputText.trim() === "") {
      Alert.alert("Empty Input", "Please enter some text");
      return;
    }
    
    const words = inputText.trim().split(/\s+/);
    setSentenceWords(words);
    
    logUserInteraction({
      action: 'setSentence',
      sentence: inputText,
      timestamp: new Date().toISOString(),
    });
    
    setInputText("");
  };

  const handlePredictNextWord = async () => {
    const currentSentence = sentenceWords.join(' ');
    if (!currentSentence.trim()) {
      Alert.alert("Empty Sentence", "Please add words to your sentence first.");
      return;
    }
  
    try {
      setSyncStatus('syncing');
      // Get suggestions using the AI service
      const suggestions = await getAISuggestions(currentSentence);
      
      if (!suggestions || suggestions.length === 0) {
        Alert.alert("No Suggestions", "No word predictions available for this sentence.");
        setPredictedWord(null);
        setSyncStatus('synced');
        return;
      }
      
      // Use the top suggestion
      const predictedWordResult = suggestions[0];
      setPredictedWord(predictedWordResult);
      
      logUserInteraction({
        action: 'predictNextWord',
        sentence: currentSentence,
        predictedWord: predictedWordResult,
        timestamp: new Date().toISOString(),
      });
      
      setSyncStatus('synced');
    } catch (error) {
      console.error("Prediction Error:", error);
      Alert.alert("Prediction Failed", "Could not get word predictions. Please try again.");
      setSyncStatus('offline');
    }
  };

  const toggleLogVisibility = () => {
    setLogVisible(prev => !prev);
    if (!logVisible) {
      fetchLogData();
    }
  };

  const handlePushLogs = async () => {
    try {
      setSyncStatus('syncing');
      await pushLogsToFirebase();
      setSyncStatus('synced');
      Alert.alert('Success', 'Logs have been pushed to Firebase!');
    } catch (error) {
      setSyncStatus('offline');
      console.error('Error pushing logs:', error);
      Alert.alert('Error', 'Failed to push logs. Please check your connection.');
    }
  };

  const handleFineTuneModel = async () => {
    try {
      setSyncStatus('syncing');
      await fineTuneUserModel(3); // Fine-tune for 3 epochs
      setSyncStatus('synced');
      Alert.alert('Success', 'Model fine-tuned with your inputs!');
    } catch (error) {
      setSyncStatus('offline');
      console.error('Error fine-tuning model:', error);
      Alert.alert('Error', 'Model fine-tuning failed. Please try again later.');
    }
  };

  // Get color based on word type for visual categorization
  const getWordTypeColor = (type) => {
    switch (type) {
      case 'verb': return '#FF9800'; // Orange
      case 'noun': return '#4CAF50'; // Green
      case 'pronoun': return '#2196F3'; // Blue
      case 'adjective': return '#9C27B0'; // Purple
      case 'response': return '#F44336'; // Red
      case 'social': return '#00BCD4'; // Cyan
      default: return '#757575'; // Grey
    }
  };

  const renderCategoryButton = (category, index) => (
    <TouchableOpacity
      key={index}
      style={[
        styles.categoryButton,
        category === selectedCategory && styles.categoryButtonSelected,
      ]}
      onPress={() => {
        setSelectedCategory(category);
        loadAvailablePictures(category);
      }}
      accessibilityLabel={`Category ${category}`}
      accessibilityHint={`Switch to ${category} category`}
    >
      <Text style={styles.categoryButtonText}>{category}</Text>
    </TouchableOpacity>
  );

  const renderPictogramItem = ({ item }) => (
    <TouchableOpacity
      style={styles.pictogramItem}
      onPress={() => addWord(getPictogramLabel(item))}
      accessibilityLabel={getPictogramLabel(item)}
      accessibilityHint={`Add ${getPictogramLabel(item)} to sentence`}
    >
      <Image
        style={styles.pictogramImage}
        source={{ uri: getPictogramUrl(item._id, 500) }}
        accessible={true}
        accessibilityLabel={getPictogramLabel(item)}
      />
      <Text style={styles.pictogramLabel}>{getPictogramLabel(item)}</Text>
    </TouchableOpacity>
  );

  const renderWordButton = (item, index) => (
    <TouchableOpacity
      key={index}
      style={[
        styles.wordButton,
        { backgroundColor: getWordTypeColor(item.type) + '33' } // Add transparency
      ]}
      onPress={() => addWord(item.word)}
      accessibilityLabel={item.word}
      accessibilityHint={`Add ${item.word} to sentence`}
    >
      <Text style={[
        styles.wordButtonText,
        { color: getWordTypeColor(item.type) }
      ]}>
        {item.word}
      </Text>
    </TouchableOpacity>
  );

  const renderSuggestionButton = (word, index) => (
    <TouchableOpacity
      key={index}
      style={styles.suggestionButton}
      onPress={() => addWord(word)}
      accessibilityLabel={`Suggestion: ${word}`}
      accessibilityHint={`Add suggested word ${word} to sentence`}
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

  const renderSyncStatus = () => {
    switch (syncStatus) {
      case 'synced':
        return <AntDesign name="checkcircle" size={24} color="#4CAF50" style={styles.statusIcon} />;
      case 'syncing':
        return <ActivityIndicator size="small" color="#2196F3" style={styles.statusIcon} />;
      case 'offline':
        return <MaterialIcons name="cloud-off" size={24} color="#F44336" style={styles.statusIcon} />;
      default:
        return null;
    }
  };

  const renderHelpContent = () => (
    <View style={styles.helpContainer}>
      <ScrollView>
        <Text style={styles.helpTitle}>How to Use this App</Text>
        <Text style={styles.helpText}>1. Add words to your sentence by tapping on the word buttons below.</Text>
        <Text style={styles.helpText}>2. Use the categories to find more pictures.</Text>
        <Text style={styles.helpText}>3. Tap the "Speak" button to say your sentence out loud.</Text>
        <Text style={styles.helpText}>4. Use "Predict Next Word" to get suggestions.</Text>
        <Text style={styles.helpText}>5. Clear your sentence with the "Clear" button.</Text>
        <Text style={styles.helpText}>6. Use "Delete Last" to remove the last word.</Text>
        <Text style={styles.helpText}>• Words are color-coded by type:</Text>
        <View style={styles.colorLegend}>
          <View style={[styles.colorItem, {backgroundColor: getWordTypeColor('verb')}]}>
            <Text style={styles.colorText}>Verbs (actions)</Text>
          </View>
          <View style={[styles.colorItem, {backgroundColor: getWordTypeColor('noun')}]}>
            <Text style={styles.colorText}>Nouns (things)</Text>
          </View>
          <View style={[styles.colorItem, {backgroundColor: getWordTypeColor('pronoun')}]}>
            <Text style={styles.colorText}>Pronouns (I, you)</Text>
          </View>
          <View style={[styles.colorItem, {backgroundColor: getWordTypeColor('adjective')}]}>
            <Text style={styles.colorText}>Adjectives (describing)</Text>
          </View>
          <View style={[styles.colorItem, {backgroundColor: getWordTypeColor('response')}]}>
            <Text style={styles.colorText}>Responses (yes/no)</Text>
          </View>
          <View style={[styles.colorItem, {backgroundColor: getWordTypeColor('social')}]}>
            <Text style={styles.colorText}>Social (please/thanks)</Text>
          </View>
        </View>
      </ScrollView>
      <TouchableOpacity 
        style={styles.closeHelpButton}
        onPress={() => setShowHelp(false)}
      >
        <Text style={styles.closeHelpButtonText}>Close Help</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeContainer}>
      {showHelp ? (
        renderHelpContent()
      ) : (
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <Text style={styles.heading}>Create Your Sentence</Text>
            <TouchableOpacity 
              onPress={() => setShowHelp(true)}
              style={styles.helpButton}
              accessibilityLabel="Help"
              accessibilityHint="Show help instructions"
            >
              <MaterialIcons name="help-outline" size={24} color="#2196F3" />
            </TouchableOpacity>
            {renderSyncStatus()}
          </View>

          {/* Sentence Preview */}
          <View style={styles.sentencePreview}>
            {sentenceWords.length > 0 ? (
              sentenceWords.map((word, index) => (
                <Text
                  key={index}
                  style={[
                    styles.sentenceWord,
                    highlightIndex === index && styles.highlightedWord,
                  ]}
                >
                  {word}{' '}
                </Text>
              ))
            ) : (
              <Text style={styles.placeholderText}>
                Tap words below to build your sentence...
              </Text>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.speakButton]}
              onPress={speakSentence}
              disabled={sentenceWords.length === 0}
              accessibilityLabel="Speak Sentence"
              accessibilityHint="Speak your sentence out loud"
            >
              <FontAwesome5 name="volume-up" size={24} color="white" />
              <Text style={styles.actionButtonText}>Speak</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.deleteButton]}
              onPress={removeLastWord}
              disabled={sentenceWords.length === 0}
              accessibilityLabel="Delete Last Word"
              accessibilityHint="Remove the last word from your sentence"
            >
              <MaterialIcons name="backspace" size={24} color="white" />
              <Text style={styles.actionButtonText}>Delete Last</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.clearButton]}
              onPress={clearSentence}
              disabled={sentenceWords.length === 0}
              accessibilityLabel="Clear Sentence"
              accessibilityHint="Clear your entire sentence"
            >
              <MaterialIcons name="clear-all" size={24} color="white" />
              <Text style={styles.actionButtonText}>Clear All</Text>
            </TouchableOpacity>
          </View>

          {/* AI-Driven Suggestion Bar */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeading}>Suggestions</Text>
            <View style={styles.suggestionWrapper}>
              {suggestions.length > 0 ? (
                <ScrollView horizontal contentContainerStyle={styles.suggestionBar}>
                  {suggestions.map((suggestion, index) =>
                    renderSuggestionButton(suggestion, index)
                  )}
                </ScrollView>
              ) : (
                <Text style={styles.noSuggestionsText}>
                  {sentenceWords.length > 0 
                    ? "No suggestions available yet..."
                    : "Add words to get suggestions"}
                </Text>
              )}
            </View>
            
            {/* Display Predicted Next Word (from AI) */}
            {predictedWord && (
              <TouchableOpacity 
                style={styles.predictedWordButton} 
                onPress={() => addWord(predictedWord)}
                accessibilityLabel={`Predicted word: ${predictedWord}`}
                accessibilityHint={`Add predicted word ${predictedWord} to your sentence`}
              >
                <MaterialIcons name="auto-awesome" size={20} color="#2e7d32" />
                <Text style={styles.predictedWordText}>Predicted: {predictedWord}</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.predictButton}
              onPress={handlePredictNextWord}
              disabled={sentenceWords.length === 0}
              accessibilityLabel="Predict Next Word"
              accessibilityHint="Get AI suggestion for the next word"
            >
              <MaterialIcons name="psychology" size={24} color="white" />
              <Text style={styles.predictButtonText}>Predict Next Word</Text>
            </TouchableOpacity>
          </View>

          {/* Text Input for manual sentence entry */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeading}>Type Sentence</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.textInput}
                placeholder="Type your sentence here..."
                value={inputText}
                onChangeText={setInputText}
                accessibilityLabel="Sentence input field"
                accessibilityHint="Type your sentence manually"
              />
              <TouchableOpacity 
                style={styles.setButton}
                onPress={updateSentenceFromInput}
                disabled={inputText.trim() === ''}
                accessibilityLabel="Set Sentence"
                accessibilityHint="Use the typed sentence"
              >
                <Text style={styles.setButtonText}>Set</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Word Bank with Search */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeading}>Word Bank</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search words..."
              value={wordSearch}
              onChangeText={setWordSearch}
              accessibilityLabel="Search words"
              accessibilityHint="Search for specific words in the word bank"
            />
            <ScrollView horizontal contentContainerStyle={styles.wordBankContainer}>
              {filteredWordBank.map((item, index) => renderWordButton(item, index))}
            </ScrollView>
          </View>

          {/* Pictogram Categories */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeading}>Pictogram Categories</Text>
            <ScrollView horizontal contentContainerStyle={styles.categoryBar}>
              {categories.map((category, index) =>
                renderCategoryButton(category, index)
              )}
            </ScrollView>
          </View>

          {/* Pictogram Bank */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeading}>Pictogram Bank</Text>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text style={styles.loadingText}>Loading pictograms...</Text>
              </View>
            ) : (
              availablePictures.length > 0 ? (
                <ScrollView horizontal contentContainerStyle={styles.pictogramContainer}>
                  {availablePictures.map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.pictogramItem}
                      onPress={() => addWord(getPictogramLabel(item))}
                      accessibilityLabel={getPictogramLabel(item)}
                      accessibilityHint={`Add ${getPictogramLabel(item)} to sentence`}
                    >
                      <Image
                        style={styles.pictogramImage}
                        source={{ uri: getPictogramUrl(item._id, 500) }}
                        accessible={true}
                        accessibilityLabel={getPictogramLabel(item)}
                      />
                      <Text style={styles.pictogramLabel}>{getPictogramLabel(item)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.noContentText}>No pictograms found for this category.</Text>
              )
            )}
          </View>

          {/* Advanced Functions */}
          <View style={styles.advancedButtonsContainer}>
            <TouchableOpacity 
              style={styles.advancedButton}
              onPress={toggleLogVisibility}
              accessibilityLabel={logVisible ? "Hide Log" : "View Log"}
              accessibilityHint="Show or hide the activity log"
            >
              <MaterialIcons name={logVisible ? "visibility-off" : "visibility"} size={18} color="white" />
              <Text style={styles.advancedButtonText}>
                {logVisible ? "Hide Log" : "View Log"}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.advancedButton}
              onPress={handlePushLogs}
              accessibilityLabel="Push Logs"
              accessibilityHint="Push activity logs to the cloud"
            >
              <MaterialIcons name="cloud-upload" size={18} color="white" />
              <Text style={styles.advancedButtonText}>Push Logs</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.advancedButton}
              onPress={handleFineTuneModel}
              accessibilityLabel="Fine-Tune Model"
              accessibilityHint="Improve word predictions with your data"
            >
              <MaterialIcons name="auto-fix-high" size={18} color="white" />
              <Text style={styles.advancedButtonText}>Fine-Tune Model</Text>
            </TouchableOpacity>
          </View>

          {logVisible && (
            <View style={styles.logContainer}>
              <Text style={styles.logHeading}>User Interaction Log:</Text>
              {interactionLog.length > 0 ? (
                interactionLog.map((log, index) => (
                  <Text key={index} style={styles.logText}>
                    {new Date(log.timestamp).toLocaleTimeString()} - {log.action}
                    {log.wordAdded ? `: ${log.wordAdded}` : ''}
                    {log.sentence ? ` - "${log.sentence}"` : ''}
                  </Text>
                ))
              ) : (
                <Text style={styles.noContentText}>No log entries found.</Text>
              )}
            </View>
          )}

          <StatusBar style="auto" />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#f5f8fa',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  helpButton: {
    padding: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  statusIcon: {
    marginLeft: 5,
  },
  sectionContainer: {
    marginVertical: 12,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  sentencePreview: {
    width: '100%',
    minHeight: 80,
    borderWidth: 2,
    borderColor: '#2196F3',
    borderRadius: 10,
    padding: 15,
    backgroundColor: '#fff',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  sentenceWord: {
    fontSize: 22,
    color: '#333',
    fontWeight: '500',
    marginRight: 5,
  },
  highlightedWord: {
    backgroundColor: '#FFEB3B',
    borderRadius: 4,
  },
  placeholderText: {
    color: '#aaa',
    fontSize: 18,
    fontStyle: 'italic',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  speakButton: {
    backgroundColor: '#4CAF50',
  },
  deleteButton: {
    backgroundColor: '#FF9800',
  },
  clearButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 5,
    fontSize: 14,
  },
  suggestionWrapper: {
    minHeight: 50,
    marginBottom: 8,
  },
  suggestionBar: {
    paddingVertical: 5,
  },
  noSuggestionsText: {
    fontStyle: 'italic',
    color: '#999',
    textAlign: 'center',
    padding: 10,
  },
  suggestionButton: {
    backgroundColor: '#E1F5FE',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#B3E5FC',
  },
  suggestionButtonText: {
    fontSize: 16,
    color: '#0277BD',
  },
  predictedWordButton: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  predictedWordText: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '600',
    marginLeft: 5,
  },
  predictButton: {
    backgroundColor: '#3F51B5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  predictButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 15,
    backgroundColor: 'white',
    fontSize: 16,
    marginRight: 8,
  },
  setButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
  },
  setButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  searchInput: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 10,
    backgroundColor: 'white',
    fontSize: 16,
  },
  wordBankContainer: {
    paddingVertical: 10,
  },
  wordButton: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  wordButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  categoryBar: {
    flexDirection: 'row',
    paddingVertical: 10,
  },
  categoryButton: {
    backgroundColor: '#e0e0e0',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginRight: 10,
  },
  categoryButtonSelected: {
    backgroundColor: '#4CAF50',
  },
  categoryButtonText: {
    color: '#333',
    fontWeight: '500',
    fontSize: 14,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  noContentText: {
    textAlign: 'center',
    fontStyle: 'italic',
    color: '#999',
    padding: 15,
  },
  pictogramContainer: {
    paddingVertical: 10,
  },
  pictogramItem: {
    marginRight: 12,
    alignItems: 'center',
    width: 120,
  },
  pictogramImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  pictogramLabel: {
    marginTop: 5,
    textAlign: 'center',
    fontSize: 14,
    color: '#333',
  },
  advancedButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 16,
  },
  advancedButton: {
    backgroundColor: '#607D8B',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  advancedButtonText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 12,
    marginLeft: 5,
  },
  logContainer: {
    padding: 15,
    backgroundColor: '#FFF',
    borderRadius: 8,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 20,
  },
  logHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  logText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  helpContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  helpTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#2196F3',
  },
  helpText: {
    fontSize: 16,
    marginBottom: 15,
    lineHeight: 24,
    color: '#333',
  },
  colorLegend: {
    marginTop: 15,
  },
  colorItem: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    opacity: 0.8,
  },
  colorText: {
    color: 'white',
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  closeHelpButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    alignItems: 'center',
  },
  closeHelpButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  }
});