import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Button, Image, Platform } from 'react-native';
import * as ExpoCamera from 'expo-camera'; // Namespace import for Expo Camera
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import { getImageCaption } from '../services/hfImageCaption';

export default function CameraScreen() {
  const [hasPermission, setHasPermission] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await ExpoCamera.Camera.requestCameraPermissionsAsync();
        console.log("Camera permission status:", status);
        setHasPermission(status === 'granted');
      } catch (error) {
        console.error("Error requesting camera permissions:", error);
      }
    })();
  }, []);

  if (hasPermission === null) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text>No access to camera. Please enable camera permission in settings.</Text>
      </View>
    );
  }

  const toggleCameraType = () => {
    setCameraType((current) =>
      current === ExpoCamera.Camera.Constants.Type.back
        ? ExpoCamera.Camera.Constants.Type.front
        : ExpoCamera.Camera.Constants.Type.back
    );
  };

  // Use a fallback for camera type if ExpoCamera.Camera.Constants.Type.back is undefined.
  const cameraType = ExpoCamera.Camera?.Constants?.Type?.back || 0;

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
        console.log("Picture taken:", photo.uri);
        const description = await getImageCaption(photo.uri);
        console.log("Caption:", description);
        setCapturedImage({ uri: photo.uri, description });
      } catch (error) {
        console.error('Error taking picture:', error);
      }
    }
  };

  const speakImageDescription = () => {
    if (capturedImage && capturedImage.description) {
      Speech.speak(capturedImage.description);
    } else {
      Speech.speak('No image captured');
    }
  };

  // For Android-specific UI, use simple Buttons inside the Camera view.
  const renderAndroidCameraUI = () => (
    <View style={styles.androidButtonContainer}>
      <Button title="Take Picture" onPress={takePicture} color="#4CAF50" />
      <Button title="Flip Camera" onPress={toggleCameraType} color="#4CAF50" />
    </View>
  );

  // For iOS, use similar UI (you can customize further if needed)
  const renderIOSCameraUI = () => (
    <View style={styles.buttonContainer}>
      <Button title="Take Picture" onPress={takePicture} color="#4CAF50" />
      <Button title="Flip Camera" onPress={toggleCameraType} color="#4CAF50" />
    </View>
  );

  return (
    <View style={styles.container}>
      <ExpoCamera.Camera style={styles.camera} ref={cameraRef} type={cameraType}>
        {Platform.OS === 'android' ? renderAndroidCameraUI() : renderIOSCameraUI()}
      </ExpoCamera.Camera>
      {capturedImage && (
        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedImage.uri }} style={styles.previewImage} />
          <Text style={styles.descriptionText}>{capturedImage.description}</Text>
          <Button title="Speak Description" onPress={speakImageDescription} color="#4CAF50" />
        </View>
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#eef2f3' 
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: { 
    flex: 1 
  },
  androidButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewContainer: {
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 10,
  },
  previewImage: {
    width: 300,
    height: 300,
    borderRadius: 10,
    marginVertical: 10,
  },
  descriptionText: { 
    fontSize: 16, 
    marginBottom: 10 
  },
});
