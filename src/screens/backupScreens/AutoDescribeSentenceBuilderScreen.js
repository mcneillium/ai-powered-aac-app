// src/screens/AutoDescribeSentenceBuilderScreen.js
import React, { useState } from 'react';
import { View, Button, Image, Text, StyleSheet, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import { autoDescribeImage } from '../utils/autoDescribe';

export default function AutoDescribeSentenceBuilderScreen() {
  const [autoImage, setAutoImage] = useState(null);
  const [sentence, setSentence] = useState([]);

  // Picks an image from the library, then auto-describes it.
  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      alert('Permission to access media library is required!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!result.cancelled) {
      const description = await autoDescribeImage(result.uri);
      setAutoImage({ uri: result.uri, description });
    }
  };

  // Adds the auto-described text to the sentence builder.
  const addToSentence = () => {
    if (autoImage && autoImage.description) {
      setSentence((prev) => [...prev, autoImage.description]);
      setAutoImage(null);
    }
  };

  // Speaks out the combined sentence.
  const speakSentence = () => {
    if (sentence.length > 0) {
      const combinedSentence = sentence.join('. ');
      Speech.speak(combinedSentence);
    } else {
      Speech.speak('No sentence to speak');
    }
  };

  // Clears the current sentence.
  const clearSentence = () => {
    setSentence([]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Auto Describe Sentence Builder</Text>
      <Button title="Pick Image" onPress={pickImage} />
      {autoImage && (
        <View style={styles.autoImageContainer}>
          <Image source={{ uri: autoImage.uri }} style={styles.image} />
          <Text style={styles.descriptionText}>{autoImage.description}</Text>
          <Button title="Add to Sentence" onPress={addToSentence} color="#4CAF50" />
        </View>
      )}
      <ScrollView horizontal contentContainerStyle={styles.sentenceBoard}>
        {sentence.map((text, index) => (
          <View key={index} style={styles.sentenceItem}>
            <Text style={styles.sentenceText}>{text}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.buttonsContainer}>
        <Button title="Speak Sentence" onPress={speakSentence} color="#4CAF50" />
        <Button title="Clear Sentence" onPress={clearSentence} color="#f44336" />
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    paddingHorizontal: 10,
    backgroundColor: '#f2f2f2',
  },
  heading: {
    fontSize: 26,
    textAlign: 'center',
    marginBottom: 15,
  },
  autoImageContainer: {
    alignItems: 'center',
    marginVertical: 15,
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginBottom: 10,
  },
  descriptionText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
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
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
});
