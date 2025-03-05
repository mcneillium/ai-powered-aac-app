// src/screens/EmotionScreen.js
import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, Button } from 'react-native';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import { logEvent } from '../utils/logger';

const emotions = [
  { label: 'Happy', emoji: '😊' },
  { label: 'Sad', emoji: '😢' },
  { label: 'Angry', emoji: '😠' },
  { label: 'Excited', emoji: '😃' },
  { label: 'Scared', emoji: '😱' },
  { label: 'Calm', emoji: '😌' },
  { label: 'Tired', emoji: '😴' },
  { label: 'Surprised', emoji: '😲' },
];

export default function EmotionScreen() {
  const [selectedEmotion, setSelectedEmotion] = useState(null);

  const selectEmotion = (emotion) => {
    setSelectedEmotion(emotion);
    logEvent(`Emotion selected: ${emotion.label}`, { emotion, screen: 'EmotionScreen' });
  };

  const speakEmotion = () => {
    if (selectedEmotion) {
      Speech.speak(`I am ${selectedEmotion.label}`);
      logEvent(`Spoke emotion: ${selectedEmotion.label}`, { emotion: selectedEmotion, screen: 'EmotionScreen' });
    } else {
      Speech.speak('No emotion selected');
      logEvent('Attempted to speak without selecting an emotion', { screen: 'EmotionScreen' });
    }
  };

  const clearSelection = () => {
    setSelectedEmotion(null);
    logEvent('Cleared emotion selection', { screen: 'EmotionScreen' });
  };

  const renderEmotionItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.emotionItem,
        selectedEmotion && selectedEmotion.label === item.label ? styles.selectedEmotion : null,
      ]}
      onPress={() => selectEmotion(item)}
    >
      <Text style={styles.emoji}>{item.emoji}</Text>
      <Text style={styles.emotionLabel}>{item.label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Express Your Emotions</Text>
      {selectedEmotion && (
        <View style={styles.selectedContainer}>
          <Text style={styles.selectedText}>Selected: {selectedEmotion.label}</Text>
        </View>
      )}
      <FlatList
        data={emotions}
        keyExtractor={(item) => item.label}
        renderItem={renderEmotionItem}
        numColumns={3}
        contentContainerStyle={styles.emotionGrid}
      />
      <View style={styles.buttonRow}>
        <Button title="Speak Emotion" onPress={speakEmotion} color="#4CAF50" />
        <Button title="Clear Selection" onPress={clearSelection} color="#f44336" />
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#eef2f3',
  },
  heading: {
    fontSize: 28,
    textAlign: 'center',
    marginBottom: 15,
    fontWeight: 'bold',
  },
  emotionGrid: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emotionItem: {
    alignItems: 'center',
    margin: 10,
    padding: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 10,
    width: 100,
    height: 100,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  selectedEmotion: {
    borderColor: '#4CAF50',
  },
  emoji: {
    fontSize: 40,
  },
  emotionLabel: {
    fontSize: 16,
    marginTop: 5,
    color: '#333',
  },
  selectedContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  selectedText: {
    fontSize: 18,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 20,
  },
});
