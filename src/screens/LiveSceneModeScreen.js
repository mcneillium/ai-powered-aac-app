import '@tensorflow/tfjs-react-native';
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as tf from '@tensorflow/tfjs';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';
import * as cocossd from '@tensorflow-models/coco-ssd';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import { useSettings } from '../contexts/SettingsContext';

export default function LiveSceneModeScreen() {
  const { settings, loading: settingsLoading } = useSettings();
  const [permission, requestPermission] = useCameraPermissions();
  const [model, setModel] = useState(null);
  const [isTfReady, setIsTfReady] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [currentDetection, setCurrentDetection] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef(null);

  const palettes = {
    light: { background: '#fff', text: '#000' },
    dark:  { background: '#000', text: '#fff' },
    highContrast: { background: '#000', text: '#FFD600' },
  };
  const palette = palettes[settings.theme];

  // Load TF and model
  useEffect(() => {
    (async () => {
      await tf.ready();
      setIsTfReady(true);
      setModel(await cocossd.load({ base: 'lite_mobilenet_v2' }));
    })();
  }, []);

  const timeoutRef = useRef(null);

  // Trigger frame processing when detection toggled on
  useEffect(() => {
    if (isDetecting) {
      processFrame();
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isDetecting, processFrame]);

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
      if (detections.length && detections[0].class !== currentDetection?.class) {
        setCurrentDetection(detections[0]);
        Speech.speak(`I see a ${detections[0].class}`);
      }
      tf.dispose(imgT);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
      if (isDetecting) {
        timeoutRef.current = setTimeout(processFrame, 500);
      }
    }
  }, [model, isDetecting, isProcessing, currentDetection]);

  // Show loading while settings/model/permissions not ready
  if (settingsLoading || !isTfReady || permission?.status !== 'granted') {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>  
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>  
      <CameraView style={styles.camera} ref={cameraRef} />
      <TouchableOpacity
        style={[styles.toggle, { backgroundColor: '#4CAF50' }]}
        onPress={() => setIsDetecting(d => !d)}
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
