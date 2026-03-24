import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import * as Speech from 'expo-speech';

export default function PhotoPreviewSection({ photo, handleRetakePhoto }) {
  const speakDescription = () => {
    if (photo.description) {
      Speech.speak(photo.description);
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: photo.uri }}
        style={styles.image}
        resizeMode="contain"
      />
      <Text style={styles.description}>
        {photo.description || 'No description available'}
      </Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={speakDescription}>
          <Text style={styles.buttonText}>Speak Description</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={handleRetakePhoto}>
          <Text style={styles.buttonText}>Retake Photo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: 300,
    marginBottom: 20,
    borderRadius: 10,
  },
  description: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
  },
  button: {
    backgroundColor: '#4AADA8',
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginHorizontal: 10,
    borderRadius: 12,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
