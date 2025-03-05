// src/screens/CameraScreen.js
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Button, Image, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { AntDesign } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import { getImageCaption } from '../services/hfImageCaption';

export default function CombinedImageScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [selectedImage, setSelectedImage] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef(null);

  useEffect(() => {
    (async () => {
      await requestCameraPermission();
      const mediaResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!mediaResult.granted) {
        Alert.alert('Permission Needed', 'Permission to access media library is required!');
      }
    })();
  }, []);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageAsset = result.assets[0];
        const description = await getImageCaption(imageAsset.uri);
        setSelectedImage({ uri: imageAsset.uri, name: description });
        Speech.speak(description);
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      setIsProcessing(true);
      try {
        const options = { quality: 1, base64: true, exif: false };
        const capturedPhoto = await cameraRef.current.takePictureAsync(options);
        const description = await getImageCaption(capturedPhoto.uri);
        setSelectedImage({ uri: capturedPhoto.uri, name: description });
        Speech.speak(description);
      } catch (error) {
        console.error('Error taking picture:', error);
      } finally {
        setIsProcessing(false);
        setIsCameraOpen(false);
      }
    }
  };

  if (isCameraOpen) {
    return (
      <View style={styles.container}>
        <CameraView style={styles.camera} facing="back" ref={cameraRef}>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={() => setIsCameraOpen(false)}>
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={takePicture} disabled={isProcessing}>
              {isProcessing ? (
                <ActivityIndicator color="white" />
              ) : (
                <AntDesign name="camera" size={44} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>Upload or Take a Picture</Text>
      <View style={styles.buttonRow}>
        <Button title="Pick an Image" onPress={pickImage} />
        <Button title="Take a Picture" onPress={() => setIsCameraOpen(true)} />
      </View>
      {selectedImage ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: selectedImage.uri }} style={styles.image} />
          <Text style={styles.captionText}>{selectedImage.name}</Text>
          <Button title="Speak Caption" onPress={() => Speech.speak(selectedImage.name)} color="#4CAF50" />
        </View>
      ) : (
        <Text style={styles.placeholderText}>No image selected</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 16,
    backgroundColor: '#eef2f3',
    alignItems: 'center',
  },
  title: {
    fontSize: 24, 
    marginVertical: 20,
  },
  buttonRow: {
    flexDirection: 'row', 
    width: '100%', 
    justifyContent: 'space-around', 
    marginBottom: 20,
  },
  previewContainer: {
    alignItems: 'center',
  },
  image: { 
    width: 300, 
    height: 300, 
    borderRadius: 10, 
    marginBottom: 10,
  },
  captionText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
  },
  placeholderText: {
    fontSize: 16,
    marginVertical: 15,
    textAlign: 'center',
  },
  camera: { 
    flex: 1, 
    width: '100%',
  },
  buttonContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    margin: 32,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  button: {
    backgroundColor: 'gray',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
  },
});
