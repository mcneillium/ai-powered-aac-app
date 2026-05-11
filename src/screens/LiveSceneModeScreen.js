import '@tensorflow/tfjs-react-native';
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as tf from '@tensorflow/tfjs';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';
import * as cocossd from '@tensorflow-models/coco-ssd';
import { StatusBar } from 'expo-status-bar';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette } from '../theme';
import { speak } from '../services/speechService';

export default function LiveSceneModeScreen() {
  const { settings, loading: settingsLoading } = useSettings();
  const [permission, requestPermission] = useCameraPermissions();
  const [model, setModel] = useState(null);
  const [isTfReady, setIsTfReady] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [currentDetection, setCurrentDetection] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef(null);

  const palette = getPalette(settings.theme);
  const mountedRef = useRef(true);
  const timerRef = useRef(null);
  const autoPauseRef = useRef(null);
  const AUTO_PAUSE_MS = 30_000;

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (autoPauseRef.current) clearTimeout(autoPauseRef.current);
    };
  }, []);

  // Pause detection when app goes to background
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active' && isDetecting) {
        setIsDetecting(false);
      }
    });
    return () => sub.remove();
  }, [isDetecting]);

  // Load TF and model
  useEffect(() => {
    (async () => {
      try {
        await tf.ready();
        if (!mountedRef.current) return;
        setIsTfReady(true);
        setModel(await cocossd.load({ base: 'lite_mobilenet_v2' }));
      } catch (e) {
        // TF/model load failed — non-fatal
      }
    })();
  }, []);

  // Trigger frame processing when detection toggled on
  useEffect(() => {
    if (isDetecting) {
      processFrame();
      if (autoPauseRef.current) clearTimeout(autoPauseRef.current);
      autoPauseRef.current = setTimeout(() => {
        if (mountedRef.current) setIsDetecting(false);
      }, AUTO_PAUSE_MS);
    } else {
      if (autoPauseRef.current) clearTimeout(autoPauseRef.current);
    }
  }, [isDetecting]);

  const processFrame = useCallback(async () => {
    if (!model || !cameraRef.current || !isDetecting || isProcessing) return;
    setIsProcessing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.2, skipProcessing: true
      });
      const resp = await fetch(photo.uri);
      const buf = await resp.arrayBuffer();
      const imgT = decodeJpeg(new Uint8Array(buf));
      const detections = await model.detect(imgT);
      if (mountedRef.current && detections.length && detections[0].class !== currentDetection?.class) {
        setCurrentDetection(detections[0]);
        speak(`I see a ${detections[0].class}`);
        // Reset auto-pause on new detection
        if (autoPauseRef.current) clearTimeout(autoPauseRef.current);
        autoPauseRef.current = setTimeout(() => {
          if (mountedRef.current) setIsDetecting(false);
        }, AUTO_PAUSE_MS);
      }
      tf.dispose(imgT);
    } catch (e) {
      // Frame processing error — non-fatal
    } finally {
      if (mountedRef.current) setIsProcessing(false);
      if (mountedRef.current && isDetecting) {
        timerRef.current = setTimeout(processFrame, 500);
      }
    }
  }, [model, isDetecting, isProcessing, currentDetection]);

  // Show loading while settings/model not ready
  if (settingsLoading || !isTfReady) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  // Show permission request UI if camera access not granted
  if (permission?.status !== 'granted') {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <Text style={{ color: palette.text, marginBottom: 16, textAlign: 'center', paddingHorizontal: 24 }}>
          Camera access is required for Live Scene Mode.
        </Text>
        <TouchableOpacity
          style={[styles.toggle, { backgroundColor: palette.primary }]}
          onPress={requestPermission}
          accessibilityRole="button"
          accessibilityLabel="Grant camera permission"
        >
          <Text style={{ color: palette.text }}>Grant Camera Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>  
      <CameraView style={styles.camera} ref={cameraRef} accessible={true} accessibilityLabel="Camera viewfinder" />
      <TouchableOpacity
        style={[styles.toggle, { backgroundColor: palette.primary }]}
        onPress={() => setIsDetecting(d => !d)}
        accessibilityRole="button"
        accessibilityLabel={isDetecting ? 'Stop Detecting' : 'Start Detecting'}
      >
        <Text style={{ color: palette.text }}>
          {isDetecting ? 'Stop Detecting' : 'Start Detecting'}
        </Text>
      </TouchableOpacity>
      {isProcessing && <ActivityIndicator style={styles.loader} />}
      <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  camera:    { flex: 1 },
  toggle:    { position: 'absolute', bottom: 32, alignSelf: 'center', padding: 12, borderRadius: 8 },
  loader:    { position: 'absolute', top: 50, right: 20 },
});
