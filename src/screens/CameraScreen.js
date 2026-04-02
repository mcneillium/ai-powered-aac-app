import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, radii, spacing } from '../theme';
import { speak } from '../services/speechService';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { addSentenceToHistory, loadSentenceHistory } from '../services/sentenceHistoryStore';
import { addFavourite, isFavourite, loadFavourites } from '../services/favouritesStore';

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
  const [aacPhrases, setAacPhrases] = useState(null); // { comments, requests, questions, summary } or null
  const [ocrResult, setOcrResult] = useState(null);
  const [mode, setMode] = useState('describe');
  const cameraRef = useRef(null);

  const palette = getPalette(settings.theme);
  const [saveMenu, setSaveMenu] = useState(null); // { phrase, alreadyFav }
  const [toast, setToast] = useState(null); // string or null
  const toastTimer = useRef(null);

  useEffect(() => {
    (async () => {
      await requestPerm();
      const media = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!media.granted) {
        Alert.alert('Permission needed', 'Need permission to access library');
      }
      // Pre-load stores so isFavourite() works synchronously
      await loadSentenceHistory();
      await loadFavourites();
    })();
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  const speakPhrase = (text) => {
    speak(text, {
      rate: settings.speechRate,
      pitch: settings.speechPitch,
      voice: settings.speechVoice,
    });
  };

  const handleLongPress = useCallback((phrase) => {
    setSaveMenu({ phrase, alreadyFav: isFavourite(phrase) });
  }, []);

  const handleSaveToHistory = useCallback(async () => {
    if (!saveMenu) return;
    await addSentenceToHistory(saveMenu.phrase);
    speakPhrase(saveMenu.phrase);
    setSaveMenu(null);
    showToast('Saved to history');
  }, [saveMenu, showToast]);

  const handleSaveToFavourites = useCallback(async () => {
    if (!saveMenu) return;
    await addFavourite(saveMenu.phrase);
    await addSentenceToHistory(saveMenu.phrase);
    speakPhrase(saveMenu.phrase);
    setSaveMenu(null);
    showToast('Added to favourites ★');
  }, [saveMenu, showToast]);

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
    setAacPhrases(null);
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
    // Extract categorized phrases, fall back to flat array
    const comments = phrasesResult?.comments || phrasesResult?.phrases || [];
    const requests = phrasesResult?.requests || [];
    const questions = phrasesResult?.questions || [];
    const summary = phrasesResult?.summary || [];
    const hasAny = comments.length + requests.length + questions.length + summary.length > 0;

    console.log('[Camera] processDescribe results — caption:', !!caption,
      'comments:', comments.length, 'requests:', requests.length,
      'questions:', questions.length, 'summary:', summary.length);

    if (summary.length > 0) {
      setSelected({ uri, name: summary[0] });
      speakPhrase(summary[0]);
    } else if (caption) {
      setSelected({ uri, name: caption });
      speakPhrase(caption);
    } else if (hasAny) {
      setSelected({ uri, name: 'Here is what you can say about this:' });
    } else {
      setSelected({ uri, name: 'Could not describe this image — check your connection' });
    }

    if (hasAny) setAacPhrases({ comments, requests, questions, summary });
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
                    onLongPress={() => handleLongPress(phrase)}
                    delayLongPress={400}
                    accessibilityRole="button"
                    accessibilityLabel={`Say: ${phrase}. Long press to save.`}
                  >
                    <Text style={[styles.phraseChipText, { color: palette.buttonText }]}>{phrase}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Describe mode — categorized phrases */}
          {mode === 'describe' && aacPhrases && (
            <>
              <PhraseGroup label="Comment" icon="chatbubble-outline" color={palette.primary}
                phrases={aacPhrases.comments} speakPhrase={speakPhrase} onLongPress={handleLongPress} palette={palette} />
              <PhraseGroup label="Request" icon="hand-left-outline" color={palette.success}
                phrases={aacPhrases.requests} speakPhrase={speakPhrase} onLongPress={handleLongPress} palette={palette} />
              <PhraseGroup label="Ask" icon="help-circle-outline" color={palette.info}
                phrases={aacPhrases.questions} speakPhrase={speakPhrase} onLongPress={handleLongPress} palette={palette} />
            </>
          )}

          {/* Conversation actions — useful prompts for discussing what you see */}
          <ConversationActions speakPhrase={speakPhrase} onLongPress={handleLongPress} palette={palette} />
        </View>
      )}
      {/* Save menu modal — shown on long press */}
      <Modal visible={!!saveMenu} transparent animationType="fade" onRequestClose={() => setSaveMenu(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSaveMenu(null)}>
          <View style={[styles.saveMenuCard, { backgroundColor: palette.cardBg }]}>
            <Text style={[styles.saveMenuPhrase, { color: palette.text }]} numberOfLines={3}>
              "{saveMenu?.phrase}"
            </Text>
            <TouchableOpacity
              style={[styles.saveMenuBtn, { backgroundColor: palette.primary }]}
              onPress={handleSaveToHistory}
              accessibilityRole="button"
              accessibilityLabel="Save to history and speak"
            >
              <Ionicons name="time-outline" size={18} color="#FFF" />
              <Text style={styles.saveMenuBtnText}>Save to history</Text>
            </TouchableOpacity>
            {!saveMenu?.alreadyFav && (
              <TouchableOpacity
                style={[styles.saveMenuBtn, { backgroundColor: palette.warning }]}
                onPress={handleSaveToFavourites}
                accessibilityRole="button"
                accessibilityLabel="Add to favourites and speak"
              >
                <Ionicons name="star" size={18} color="#FFF" />
                <Text style={styles.saveMenuBtnText}>Add to favourites</Text>
              </TouchableOpacity>
            )}
            {saveMenu?.alreadyFav && (
              <Text style={[styles.saveMenuNote, { color: palette.textSecondary }]}>
                ★ Already in favourites
              </Text>
            )}
            <TouchableOpacity
              style={[styles.saveMenuBtn, { backgroundColor: palette.chipBg }]}
              onPress={() => setSaveMenu(null)}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[styles.saveMenuBtnText, { color: palette.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Toast notification */}
      {toast && (
        <View style={[styles.toast, { backgroundColor: palette.text }]} pointerEvents="none">
          <Text style={[styles.toastText, { color: palette.background }]}>{toast}</Text>
        </View>
      )}

      <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} />
    </ScrollView>
  );
}

const CONVERSATION_PROMPTS = [
  { label: 'What is the important part?',  color: '#7C4DFF' },
  { label: 'Help me choose',              color: '#FF9800' },
  { label: 'Compare these for me',        color: '#00BCD4' },
  { label: 'What can I ask about this?',  color: '#4CAF50' },
  { label: 'Explain this simply',         color: '#2979FF' },
  { label: 'What should I notice?',       color: '#9C27B0' },
  { label: 'Read it to me',               color: '#607D8B' },
  { label: 'I have a question about this', color: '#E91E63' },
];

function ConversationActions({ speakPhrase, onLongPress, palette }) {
  return (
    <View style={styles.phrasesContainer}>
      <View style={styles.phrasesHeader}>
        <Ionicons name="bulb-outline" size={14} color={palette.warning} />
        <Text style={[styles.phrasesLabel, { color: palette.textSecondary }]}>Conversation</Text>
      </View>
      <View style={styles.phrasesRow}>
        {CONVERSATION_PROMPTS.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.phraseChip, { backgroundColor: item.color }]}
            onPress={() => speakPhrase(item.label)}
            onLongPress={() => onLongPress(item.label)}
            delayLongPress={400}
            accessibilityRole="button"
            accessibilityLabel={`Say: ${item.label}. Long press to save.`}
          >
            <Text style={[styles.phraseChipText, { color: '#FFF' }]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function PhraseGroup({ label, icon, color, phrases, speakPhrase, onLongPress, palette }) {
  if (!phrases || phrases.length === 0) return null;
  return (
    <View style={styles.phrasesContainer}>
      <View style={styles.phrasesHeader}>
        <Ionicons name={icon} size={14} color={color} />
        <Text style={[styles.phrasesLabel, { color: palette.textSecondary }]}>{label}</Text>
      </View>
      <View style={styles.phrasesRow}>
        {phrases.map((phrase, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.phraseChip, { backgroundColor: color }]}
            onPress={() => speakPhrase(phrase)}
            onLongPress={() => onLongPress(phrase)}
            delayLongPress={400}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${phrase}. Long press to save.`}
          >
            <Text style={[styles.phraseChipText, { color: '#FFF' }]}>{phrase}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
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
  phrasesHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  phrasesLabel: { fontSize: 13, fontWeight: '600' },
  phrasesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  phraseChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill },
  phraseChipText: { fontSize: 14, fontWeight: '500' },
  // Save menu modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  saveMenuCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  saveMenuPhrase: {
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  saveMenuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    gap: spacing.sm,
  },
  saveMenuBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  saveMenuNote: {
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Toast
  toast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    opacity: 0.9,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
