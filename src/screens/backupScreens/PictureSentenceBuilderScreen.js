import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  ScrollView, 
  Button, 
  Text 
} from 'react-native';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import { searchPictograms, getPictogramUrl } from '../services/arasaacService';

export default function PictureSentenceBuilderScreen() {
  const [availablePictures, setAvailablePictures] = useState([]);
  const [sentencePictures, setSentencePictures] = useState([]);
  const [loading, setLoading] = useState(false);

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
    if (sentencePictures.length > 0) {
      const sentence = sentencePictures.map(p => p.name).join(' ');
      Speech.speak(sentence);
    }
  };

  const clearSentence = () => setSentencePictures([]);

  const renderAvailablePicture = ({ item }) => (
    <TouchableOpacity onPress={() => addPictureToSentence(item)}>
      <Image 
        style={styles.availablePicture} 
        source={{ uri: getPictogramUrl(item._id, 500) }} 
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Picture Sentence Builder</Text>

      {/* Sentence Board */}
      <ScrollView horizontal contentContainerStyle={styles.sentenceBoard}>
        {sentencePictures.map((pic, index) => (
          <View key={index} style={styles.sentencePictureContainer}>
            <Image 
              style={styles.sentencePicture} 
              source={{ uri: getPictogramUrl(pic._id, 300) }} 
            />
          </View>
        ))}
      </ScrollView>

      <View style={styles.sentenceButtons}>
        <Button title="Speak Sentence" onPress={speakSentence} color="#4CAF50" />
        <Button title="Clear Sentence" onPress={clearSentence} color="#f44336" />
      </View>

      <Text style={styles.availableHeading}>Available Pictures:</Text>
      {loading ? (
        <Text style={styles.loadingText}>Loading…</Text>
      ) : (
        <FlatList
          data={availablePictures}
          horizontal
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderAvailablePicture}
          contentContainerStyle={styles.availablePicturesList}
        />
      )}

      <StatusBar style="auto" />
    </View>
  );
}

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
  sentenceBoard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    marginBottom: 15,
  },
  sentencePictureContainer: {
    marginRight: 10,
  },
  sentencePicture: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  sentenceButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
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
});
