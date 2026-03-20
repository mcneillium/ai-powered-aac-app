import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import { getVisionLabels } from '../services/visionService';
import { useSettings } from '../contexts/SettingsContext';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';

export default function CombinedImageScreen() {
  const { settings, loading: settingsLoading } = useSettings();
  const [cameraPerm, requestPerm] = useCameraPermissions();
  const [selected, setSelected] = useState(null);
  const [openCam, setOpenCam] = useState(false);
  const [processing, setProcessing] = useState(false);
  const cameraRef = useRef(null);

  const palettes = {
    light: { background: '#fff', text: '#000' },
    dark:  { background: '#000', text: '#fff' },
    highContrast: { background: '#000', text: '#FFD600' },
  };
  const palette = palettes[settings.theme];

  useEffect(() => {
    (async () => {
      await requestPerm();
      const media = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!media.granted) {
        Alert.alert('Permission needed', 'Need permission to access library');
      }
    })();
  }, []);

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
    if (!res.canceled) {
      processImage(res.assets[0].uri);
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
    setOpenCam(false);
    processImage(photo.uri);
  };

  const processImage = async (uri) => {
    setProcessing(true);
    try {
      const desc = await getVisionLabels(uri);
      setSelected({ uri, name: desc });
      Speech.speak(desc);
    } catch (e) {
      Alert.alert('Error', 'Failed to caption image');
    } finally {
      setProcessing(false);
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
      {openCam ? (
        <View style={styles.cameraContainer}>
          <CameraView style={styles.camera} ref={cameraRef} />
          <TouchableOpacity
            onPress={takePicture}
            style={[styles.fab, { bottom: 30 }]}
          >
            <MaterialIcons name="camera" size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setOpenCam(false)}
            style={[styles.fab, { top: 30, right: 20, bottom: 'auto' }]}
          >
            <MaterialIcons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={() => setOpenCam(true)}>
            <MaterialIcons name="photo-camera" size={32} color="#4CAF50" />
            <Text style={[styles.actionText, { color: palette.text }]}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
            <MaterialIcons name="photo-library" size={32} color="#4CAF50" />
            <Text style={[styles.actionText, { color: palette.text }]}>Gallery</Text>
          </TouchableOpacity>
        </View>
      )}

      {processing && <ActivityIndicator style={{ marginTop: 20 }} size="large" color="#4CAF50" />}
      {selected && (
        <View style={styles.previewContainer}>
          <Image source={{ uri: selected.uri }} style={styles.preview} />
          <View style={[styles.captionBox, { backgroundColor: palette.background + 'DD' }]}>  
            <Text style={[styles.captionText, { color: palette.text }]}>{selected.name}</Text>
          </View>
        </View>
      )}
      <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cameraContainer: { flex: 1 },
  camera:    { flex: 1 },
  fab: { position: 'absolute', alignSelf: 'center', padding: 16, backgroundColor: '#4CAF50', borderRadius: 32 },
  actionsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 40 },
  actionButton: { alignItems: 'center' },
  actionText: { marginTop: 8, fontSize: 16 },
  previewContainer: { alignItems: 'center', marginTop: 20, padding: 16 },
  preview:   { width: '100%', height: 300, borderRadius: 12 },
  captionBox: { marginTop: -40, padding: 12, borderRadius: 8, maxWidth: '90%' },
  captionText: { fontSize: 16, textAlign: 'center' },
});
