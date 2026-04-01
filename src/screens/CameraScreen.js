import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, radii, spacing } from '../theme';
import { speak } from '../services/speechService';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';

// Cloud Function endpoints
const FUNCTIONS_BASE = 'https://us-central1-commai-b98fe.cloudfunctions.net';
const CAPTION_ENDPOINT = `${FUNCTIONS_BASE}/imageCaptionProxy`;
const IMAGE_AAC_ENDPOINT = `${FUNCTIONS_BASE}/imageToAACPhrases`;
const OCR_AAC_ENDPOINT = `${FUNCTIONS_BASE}/ocrToAACPhrases`;

// Timeout wrapper: rejects if promise doesn't resolve in ms
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// Read file as base64 with a timeout. Returns null on failure.
async function readBase64(uri, timeoutMs = 8000) {
  try {
    console.log('[Camera] base64 read start');
    const result = await withTimeout(
      FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }),
      timeoutMs,
      'base64 read'
    );
    console.log('[Camera] base64 read done, length:', result?.length || 0);
    return result;
  } catch (e) {
    console.warn('[Camera] base64 read failed:', e.message);
    return null;
  }
}

// Call a Cloud Function with base64 image. Returns parsed JSON or null.
async function callCloudFunction(endpoint, body, timeoutMs, label) {
  try {
    console.log(`[Camera] ${label} call start`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) {
      console.warn(`[Camera] ${label} HTTP ${response.status}`);
      return null;
    }
    const json = await response.json();
    console.log(`[Camera] ${label} call done`);
    return json;
  } catch (e) {
    console.warn(`[Camera] ${label} failed:`, e.message);
    return null;
  }
}

export default function CombinedImageScreen() {
  const { settings, loading: settingsLoading } = useSettings();
  const [cameraPerm, requestPerm] = useCameraPermissions();
  const [selected, setSelected] = useState(null);
  const [openCam, setOpenCam] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [aacPhrases, setAacPhrases] = useState([]);
  const [ocrResult, setOcrResult] = useState(null);
  const [mode, setMode] = useState('describe');
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

  const speakPhrase = (text) => {
    speak(text, {
      rate: settings.speechRate,
      pitch: settings.speechPitch,
      voice: settings.speechVoice,
    });
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.5 });
    if (!res.canceled) {
      handleImage(res.assets[0].uri);
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    console.log('[Camera] takePicture start');
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
    console.log('[Camera] takePicture done, uri:', photo.uri?.slice(0, 50));
    setOpenCam(false);
    handleImage(photo.uri);
  };

  const handleImage = async (uri) => {
    console.log('[Camera] handleImage start, mode:', mode);
    setSelected({ uri, name: '' });
    setAacPhrases([]);
    setOcrResult(null);
    setProcessing(true);

    try {
      // Read base64 ONCE with a timeout — shared by all backend calls
      const base64 = await readBase64(uri, 8000);

      if (mode === 'read') {
        await processOCR(uri, base64);
      } else {
        await processDescribe(uri, base64);
      }
    } catch (e) {
      // Catch-all: if anything unexpected throws, always clear loading
      console.error('[Camera] handleImage unexpected error:', e);
      setSelected({ uri, name: 'Something went wrong — try again' });
      setProcessing(false);
    }
  };

  const processDescribe = async (uri, base64) => {
    console.log('[Camera] processDescribe start, has base64:', !!base64);

    if (!base64) {
      // Can't send to any backend without base64
      setSelected({ uri, name: 'Could not process this image — try again' });
      setProcessing(false);
      return;
    }

    // Run caption and AAC phrases in parallel, each with its own timeout
    const captionPromise = callCloudFunction(
      CAPTION_ENDPOINT, { image: base64 }, 10000, 'caption'
    );
    const phrasesPromise = callCloudFunction(
      IMAGE_AAC_ENDPOINT, { image: base64 }, 10000, 'image-aac'
    );

    const [captionResult, phrasesResult] = await Promise.all([captionPromise, phrasesPromise]);

    const caption = captionResult?.caption || null;
    const phrases = phrasesResult?.phrases || [];

    console.log('[Camera] processDescribe results — caption:', !!caption, 'phrases:', phrases.length);

    if (caption) {
      setSelected({ uri, name: caption });
      speakPhrase(caption);
    } else if (phrases.length > 0) {
      setSelected({ uri, name: 'Could not describe, but here are some phrases:' });
    } else {
      setSelected({ uri, name: 'Could not describe this image — check your connection' });
    }

    if (phrases.length > 0) setAacPhrases(phrases);
    setProcessing(false);
    console.log('[Camera] processDescribe done, processing=false');
  };

  const processOCR = async (uri, base64) => {
    console.log('[Camera] processOCR start, has base64:', !!base64);

    if (!base64) {
      setOcrResult({ extractedText: '', phrases: [] });
      setSelected({ uri, name: 'Could not process this image — try again' });
      setProcessing(false);
      return;
    }

    const result = await callCloudFunction(
      OCR_AAC_ENDPOINT, { image: base64 }, 10000, 'ocr-aac'
    );

    if (result) {
      setOcrResult(result);
      setSelected({ uri, name: result.extractedText || 'No text found in this image' });
    } else {
      setOcrResult({ extractedText: '', phrases: [] });
      setSelected({ uri, name: 'Could not read text — check your connection' });
    }

    setProcessing(false);
    console.log('[Camera] processOCR done, processing=false');
  };

  if (settingsLoading) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: palette.background }]} contentContainerStyle={styles.scrollContent}>
      {openCam ? (
        <View style={styles.cameraContainer}>
          <CameraView style={styles.camera} ref={cameraRef} />
          <TouchableOpacity
            onPress={takePicture}
            style={[styles.fab, { bottom: 30, backgroundColor: palette.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
          >
            <MaterialIcons name="camera" size={28} color={palette.buttonText} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setOpenCam(false)}
            style={[styles.fab, { top: 30, right: 20, bottom: 'auto', backgroundColor: palette.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Close camera"
          >
            <MaterialIcons name="close" size={28} color={palette.buttonText} />
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Mode toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, { backgroundColor: mode === 'describe' ? palette.primary : palette.chipBg }]}
              onPress={() => setMode('describe')}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'describe' }}
              accessibilityLabel="Describe mode"
            >
              <Ionicons name="image-outline" size={18} color={mode === 'describe' ? palette.buttonText : palette.text} />
              <Text style={[styles.modeBtnText, { color: mode === 'describe' ? palette.buttonText : palette.text }]}>Describe</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, { backgroundColor: mode === 'read' ? palette.primary : palette.chipBg }]}
              onPress={() => setMode('read')}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'read' }}
              accessibilityLabel="Read Text mode"
            >
              <Ionicons name="document-text-outline" size={18} color={mode === 'read' ? palette.buttonText : palette.text} />
              <Text style={[styles.modeBtnText, { color: mode === 'read' ? palette.buttonText : palette.text }]}>Read Text</Text>
            </TouchableOpacity>
          </View>

          {/* Capture buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={() => setOpenCam(true)}
              accessibilityRole="button" accessibilityLabel="Open camera">
              <MaterialIcons name="photo-camera" size={32} color={palette.primary} />
              <Text style={[styles.actionText, { color: palette.text }]}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={pickImage}
              accessibilityRole="button" accessibilityLabel="Pick from gallery">
              <MaterialIcons name="photo-library" size={32} color={palette.primary} />
              <Text style={[styles.actionText, { color: palette.text }]}>Gallery</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {processing && <ActivityIndicator style={{ marginTop: 20 }} size="large" color={palette.primary} />}

      {/* Results — shown when not processing AND we have a selected image with a name */}
      {selected && !processing && selected.name !== '' && (
        <View style={styles.previewContainer}>
          <Image source={{ uri: selected.uri }} style={styles.preview} />

          <View style={[styles.captionBox, { backgroundColor: palette.cardBg }]}>
            <Text style={[styles.captionLabel, { color: palette.textSecondary }]}>
              {mode === 'read' ? 'Text found:' : 'Description:'}
            </Text>
            <Text style={[styles.captionText, { color: palette.text }]}>{selected.name}</Text>
            <TouchableOpacity
              onPress={() => speakPhrase(selected.name)}
              style={[styles.speakCaptionBtn, { backgroundColor: palette.primary }]}
              accessibilityRole="button"
              accessibilityLabel={`Say: ${selected.name}`}
            >
              <Ionicons name="volume-high" size={16} color={palette.buttonText} />
              <Text style={[styles.speakCaptionText, { color: palette.buttonText }]}>Say this</Text>
            </TouchableOpacity>
          </View>

          {/* OCR phrases */}
          {ocrResult && ocrResult.phrases.length > 0 && (
            <View style={styles.phrasesContainer}>
              <Text style={[styles.phrasesLabel, { color: palette.textSecondary }]}>What would you like to say?</Text>
              <View style={styles.phrasesRow}>
                {ocrResult.phrases.map((phrase, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.phraseChip, { backgroundColor: palette.primary }]}
                    onPress={() => speakPhrase(phrase)}
                    accessibilityRole="button"
                    accessibilityLabel={`Say: ${phrase}`}
                  >
                    <Text style={[styles.phraseChipText, { color: palette.buttonText }]}>{phrase}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Describe mode phrases */}
          {mode === 'describe' && aacPhrases.length > 0 && (
            <View style={styles.phrasesContainer}>
              <Text style={[styles.phrasesLabel, { color: palette.textSecondary }]}>Say something about this:</Text>
              <View style={styles.phrasesRow}>
                {aacPhrases.map((phrase, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.phraseChip, { backgroundColor: palette.primary }]}
                    onPress={() => speakPhrase(phrase)}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 80 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cameraContainer: { height: 400 },
  camera: { flex: 1 },
  fab: { position: 'absolute', alignSelf: 'center', padding: 16, borderRadius: 32 },
  modeToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    gap: spacing.xs,
  },
  modeBtnText: { fontSize: 15, fontWeight: '600' },
  actionsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.xl },
  actionButton: { alignItems: 'center' },
  actionText: { marginTop: 8, fontSize: 16 },
  previewContainer: { alignItems: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.lg },
  preview: { width: '100%', height: 250, borderRadius: radii.md },
  captionBox: { marginTop: spacing.md, padding: spacing.md, borderRadius: radii.sm, width: '100%' },
  captionLabel: { fontSize: 12, fontWeight: '500', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  captionText: { fontSize: 16 },
  speakCaptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    marginTop: spacing.sm,
    gap: 4,
  },
  speakCaptionText: { fontSize: 13, fontWeight: '600' },
  phrasesContainer: { marginTop: spacing.lg, width: '100%' },
  phrasesLabel: { fontSize: 13, marginBottom: spacing.sm, fontWeight: '500' },
  phrasesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  phraseChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill },
  phraseChipText: { fontSize: 14, fontWeight: '500' },
});
