// src/screens/CustomizationScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  Button,
  Image,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export default function CustomizationScreen() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageLabel, setImageLabel] = useState('');

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Permission to access media library is required!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      // FIX: Use new array-based MediaType
      mediaTypes: [ImagePicker.MediaType.IMAGE],
      quality: 1,
    });

    if (!result.canceled && result.assets?.length) {
      const imageAsset = result.assets[0];
      setSelectedImage(imageAsset.uri);
    }
  };

  const saveImage = () => {
    if (!selectedImage || !imageLabel.trim()) {
      Alert.alert('Incomplete', 'Please select an image and provide a label.');
      return;
    }
    // Here you might upload the image & label to a backend or DB
    Alert.alert('Saved', `Image saved with label: ${imageLabel}`);
    setSelectedImage(null);
    setImageLabel('');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Customize Your Image Database</Text>
      <Button title="Pick an Image" onPress={pickImage} color="#4CAF50" />
      {selectedImage && (
        <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
      )}
      <TextInput
        style={styles.input}
        placeholder="Enter image label or category"
        value={imageLabel}
        onChangeText={setImageLabel}
      />
      <Button title="Save Image" onPress={saveImage} color="#4CAF50" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#eef2f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 24,
    marginVertical: 15,
    fontWeight: 'bold',
  },
  imagePreview: {
    width: 200,
    height: 200,
    marginVertical: 15,
    borderRadius: 10,
  },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    width: '100%',
    paddingHorizontal: 10,
    marginBottom: 15,
    borderRadius: 5,
  },
});
