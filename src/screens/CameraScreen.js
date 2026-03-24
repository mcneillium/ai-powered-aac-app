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
import { getImageCaption } from '../services/hfImageCaption';
import { getImageAACPhrases } from '../services/vertexAISuggestions';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette } from '../theme';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';

export default function CombinedImageScreen() {
  const { settings, loading: settingsLoading } = useSettings();
  const [cameraPerm, requestPerm] = useCameraPermissions();
  const [selected, setSelected] = useState(null);
  const [openCam, setOpenCam] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [aacPhrases, setAacPhrases] = useState([]);
  const cameraRef = useRef(null);

  const palette = getPalette(settings.theme);

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
    setAacPhrases([]);
    try {
      const desc = await getImageCaption(uri);
      setSelected({ uri, name: desc });
      Speech.speak(desc);

      // Also get AAC-friendly phrase suggestions via Vertex AI (async, non-blocking)
      try {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const phrases = await getImageAACPhrases(base64);
        if (phrases.length > 0) setAacPhrases(phrases);
      } catch {
        // AAC phrases are optional enhancement
      }
    } catch (e) {
      setSelected({ uri, name: 'Could not describe this image' });
      Speech.speak('Could not describe this image');
    } finally {
      setProcessing(false);
    }
  };

  if (settingsLoading) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>  
        <ActivityIndicator size="large" color={palette.primary} />
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
            style={[styles.fab, { bottom: 30, backgroundColor: palette.primary }]}
          >
            <MaterialIcons name="camera" size={28} color={palette.buttonText} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setOpenCam(false)}
            style={[styles.fab, { top: 30, right: 20, bottom: 'auto', backgroundColor: palette.primary }]}
          >
            <MaterialIcons name="close" size={28} color={palette.buttonText} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={() => setOpenCam(true)}>
            <MaterialIcons name="photo-camera" size={32} color={palette.primary} />
            <Text style={[styles.actionText, { color: palette.text }]}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
            <MaterialIcons name="photo-library" size={32} color={palette.primary} />
            <Text style={[styles.actionText, { color: palette.text }]}>Gallery</Text>
          </TouchableOpacity>
        </View>
      )}

      {processing && <ActivityIndicator style={{ marginTop: 20 }} size="large" color={palette.primary} />}
      {selected && (
        <View style={styles.previewContainer}>
          <Image source={{ uri: selected.uri }} style={styles.preview} />
          <View style={[styles.captionBox, { backgroundColor: palette.background + 'DD' }]}>
            <Text style={[styles.captionText, { color: palette.text }]}>{selected.name}</Text>
          </View>
          {aacPhrases.length > 0 && (
            <View style={styles.phrasesContainer}>
              <Text style={[styles.phrasesLabel, { color: palette.textSecondary }]}>Say something about this:</Text>
              <View style={styles.phrasesRow}>
                {aacPhrases.map((phrase, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.phraseChip, { backgroundColor: palette.primary }]}
                    onPress={() => Speech.speak(phrase)}
                    accessibilityRole="button"
                    accessibilityLabel={`Say: ${phrase}`}
                  >
                    <Text style={[styles.phraseChipText, { color: palette.buttonText }]}>{phrase}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
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
  fab: { position: 'absolute', alignSelf: 'center', padding: 16, borderRadius: 32 },
  actionsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 40 },
  actionButton: { alignItems: 'center' },
  actionText: { marginTop: 8, fontSize: 16 },
  previewContainer: { alignItems: 'center', marginTop: 20, padding: 16 },
  preview:   { width: '100%', height: 300, borderRadius: 12 },
  captionBox: { marginTop: -40, padding: 12, borderRadius: 8, maxWidth: '90%' },
  captionText: { fontSize: 16, textAlign: 'center' },
  phrasesContainer: { marginTop: 12, width: '100%' },
  phrasesLabel: { fontSize: 13, marginBottom: 8, fontWeight: '500' },
  phrasesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  phraseChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  phraseChipText: { fontSize: 14, fontWeight: '500' },
});
