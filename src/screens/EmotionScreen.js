import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Animated,
  Easing,
  Alert
} from 'react-native';
import { speak } from '../services/speechService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { logEvent } from '../utils/logger';
import { StatusBar } from 'expo-status-bar';

const emotions = [
  { label: 'Happy', emoji: '😊' },
  { label: 'Sad', emoji: '😢' },
  { label: 'Angry', emoji: '😠' },
  { label: 'Excited', emoji: '😃' },
  { label: 'Scared', emoji: '😱' },
  { label: 'Calm', emoji: '😌' },
  { label: 'Tired', emoji: '😴' },
  { label: 'Surprised', emoji: '😲' }
];

export default function EmotionScreen() {
  const { settings, loading: settingsLoading } = useSettings();
  const [selectedEmotion, setSelectedEmotion] = useState(null);
  const [saving, setSaving] = useState(false);

  const palettes = {
    light:       { background: '#eef2f3', text: '#000' },
    dark:        { background: '#000', text: '#fff' },
    highContrast:{ background: '#000', text: '#FFD600' }
  };
  const palette = palettes[settings.theme];

  const scaleAnim = useState(new Animated.Value(1))[0];

  const onPressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.9,
      duration: 100,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };
  const onPressOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 100,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const selectEmotion = (emo) => {
    setSelectedEmotion(emo);
    logEvent('Emotion selected', { emotion: emo.label, screen: 'EmotionScreen' });
  };

  const speakEmotion = () => {
    if (!selectedEmotion) return;
    const text = `I am ${selectedEmotion.label}`;
    speak(text, {
      rate: settings.speechRate,
      pitch: settings.speechPitch,
      voice: settings.speechVoice,
    });
    logEvent('Emotion spoken', { emotion: selectedEmotion.label, screen: 'EmotionScreen' });
  };

  const saveEmotion = async () => {
    if (!selectedEmotion) return;
    setSaving(true);
    try {
      await AsyncStorage.setItem('savedEmotion', selectedEmotion.label);
      logEvent('Emotion saved', { emotion: selectedEmotion.label, screen: 'EmotionScreen' });
      Alert.alert('Saved', `${selectedEmotion.label} has been saved.`);
    } catch {
      Alert.alert('Error', 'Unable to save emotion.');
    } finally {
      setSaving(false);
    }
  };

  if (settingsLoading) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>  
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>  
      <Text style={[styles.heading, { color: palette.text }]}>How are you feeling?</Text>
      {selectedEmotion && (
        <View style={[styles.preview, { borderColor: '#4CAF50' }]}>  
          <Text style={[styles.previewEmoji, { color: palette.text }]}>{selectedEmotion.emoji}</Text>
          <Text style={[styles.previewLabel, { color: palette.text }]}>{selectedEmotion.label}</Text>
        </View>
      )}
      <FlatList
        data={emotions}
        keyExtractor={item => item.label}
        numColumns={settings.gridSize}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={ settings.gridSize > 1 && styles.row }
        renderItem={({ item }) => {
          const isSel = selectedEmotion?.label === item.label;
          return (
            <Pressable
              onPress={() => selectEmotion(item)}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              style={[styles.card, isSel && styles.cardSelected]}
              accessibilityRole="button"
              accessibilityLabel={`I feel ${item.label}`}
              accessibilityState={{ selected: isSel }}
            >
              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <Text style={[styles.emoji, { color: palette.text }]}>{item.emoji}</Text>
                <Text style={[styles.label, { color: palette.text }]}>{item.label}</Text>
              </Animated.View>
            </Pressable>
          );
        }}
      />
      <View style={styles.footer}>
        <Pressable
          style={[styles.action, { backgroundColor: '#4CAF50' }]}
          onPress={speakEmotion}
          disabled={!selectedEmotion}
        >
          <MaterialIcons name="volume-up" size={24} color="#fff" />
          <Text style={styles.actionText}>Speak</Text>
        </Pressable>
        <Pressable
          style={[styles.action, { backgroundColor: '#2196F3' }]}
          onPress={saveEmotion}
          disabled={!selectedEmotion || saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <MaterialIcons name="save" size={24} color="#fff" />
          )}
          <Text style={styles.actionText}>Save</Text>
        </Pressable>
      </View>
      <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, padding: 16, paddingBottom: 80 },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heading:       { fontSize: 22, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  grid:          { paddingVertical: 8 },
  row:           { justifyContent: 'space-between' },
  card:          { flex: 1, margin: 8, backgroundColor: '#fff', borderRadius: 12, elevation: 3, alignItems: 'center', padding: 16 },
  cardSelected:  { borderWidth: 2, borderColor: '#4CAF50' },
  emoji:         { fontSize: 32, marginBottom: 8 },
  label:         { fontSize: 16 },
  preview:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16, padding: 12, borderWidth: 2, borderRadius: 12 },
  previewEmoji:  { fontSize: 36, marginRight: 8 },
  previewLabel:  { fontSize: 20, fontWeight: '500' },
  footer:        { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, marginBottom: 20 },
  action:        { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, margin: 4 },
  actionText:    { color: '#fff', marginLeft: 6, fontSize: 14 }
});
