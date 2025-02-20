import React, { useState } from 'react';
import { View, Button, Image, Text, StyleSheet, Alert } from 'react-native';
import * as Speech from 'expo-speech';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { getImageCaption } from '../services/hfImageCaption';

export default function ImagePickerSpeechScreen() {
  const [selectedImage, setSelectedImage] = useState(null);

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log("Media Library Permission Result:", permissionResult);
      if (!permissionResult.granted) {
        Alert.alert('Permission Needed', 'Permission to access media library is required!');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      console.log("Image Picker Result:", result);
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageAsset = result.assets[0];
        // Use the Hugging Face image captioning API to generate a caption
        const description = await getImageCaption(imageAsset.uri);
        setSelectedImage({ uri: imageAsset.uri, name: description });
      }
    } catch (error) {
      console.error("Error picking image:", error);
    }
  };

  const speakImageName = () => {
    if (selectedImage && selectedImage.name) {
      Speech.speak(selectedImage.name);
    } else {
      Speech.speak('No image selected');
    }
  };

  return (
    <View style={styles.container}>
      <Button title="Pick Image" onPress={pickImage} />
      {selectedImage ? (
        <>
          <Image source={{ uri: selectedImage.uri }} style={styles.image} />
          <Text style={styles.imageName}>{selectedImage.name}</Text>
        </>
      ) : (
        <Text style={styles.placeholderText}>No image selected</Text>
      )}
      <Button title="Speak" onPress={speakImageName} color="#4CAF50" />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef2f3',
    paddingTop: 50,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  image: {
    width: 200,
    height: 200,
    marginVertical: 15,
    borderRadius: 10,
  },
  imageName: {
    fontSize: 18,
    marginBottom: 15,
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: 16,
    marginVertical: 15,
    textAlign: 'center',
  },
});
