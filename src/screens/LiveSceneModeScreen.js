import '@tensorflow/tfjs-react-native'; // Initialize tfjs-react-native
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Button } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { AntDesign } from '@expo/vector-icons';
import * as tf from '@tensorflow/tfjs';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';
import * as cocossd from '@tensorflow-models/coco-ssd';
import * as Speech from 'expo-speech';

export default function LiveSceneModeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [model, setModel] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [isTfReady, setIsTfReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false); // toggle detection on/off
  const [currentDetection, setCurrentDetection] = useState(null);
  const cameraRef = useRef(null);

  // Constants for performance tuning:
  const CAPTURE_DELAY = 500; // delay between captures in ms when no detection (faster)
  const DETECTION_COOLDOWN = 3000; // cooldown delay after detection in ms

  // Initialize TensorFlow and load model
  useEffect(() => {
    const initTf = async () => {
      try {
        await tf.ready();
        console.log('TensorFlow ready');
        setIsTfReady(true);
        const loadedModel = await cocossd.load({ base: 'lite_mobilenet_v2' });
        console.log('Model loaded');
        setModel(loadedModel);
      } catch (error) {
        console.error('Error initializing TF:', error);
      }
    };

    initTf();
  }, []);

  // Recursive frame processing function with adjustable delays
  const processFrame = useCallback(async () => {
    if (!model || !cameraRef.current || !isDetecting) return;
    if (isProcessing) return; // safeguard

    try {
      setIsProcessing(true);
      // Use a lower quality value to speed up capture and decoding
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.2,
        base64: false,
        skipProcessing: true,
      });

      // Fetch the image bytes from the photo URI.
      const response = await fetch(photo.uri);
      const imageData = await response.arrayBuffer();
      const raw = new Uint8Array(imageData);

      // Decode the JPEG image using tfjs-react-native's decodeJpeg
      const imageTensor = decodeJpeg(raw);

      // Get predictions
      const detections = await model.detect(imageTensor);
      console.log('Detections:', detections);
      setPredictions(detections);

      // If a detection is found and it's new, announce it and start a cooldown
      if (detections.length > 0) {
        const bestDetection = detections.reduce((prev, curr) =>
          prev.score > curr.score ? prev : curr
        );
        if (!currentDetection || currentDetection.class !== bestDetection.class) {
          setCurrentDetection(bestDetection);
          Speech.speak(`I see a ${bestDetection.class}`, { rate: 0.9 });
          // Cooldown: Do not process further frames for DETECTION_COOLDOWN
          setTimeout(() => {
            setCurrentDetection(null);
            processFrame();
          }, DETECTION_COOLDOWN);
          tf.dispose(imageTensor);
          setIsProcessing(false);
          return;
        }
      }

      tf.dispose(imageTensor);
    } catch (error) {
      console.error('Error processing frame:', error);
    } finally {
      setIsProcessing(false);
      // Schedule next frame if not in cooldown
      if (isDetecting && !currentDetection) {
        setTimeout(processFrame, CAPTURE_DELAY);
      }
    }
  }, [model, isDetecting, isProcessing, currentDetection]);

  // Start frame processing when detection is enabled
  useEffect(() => {
    if (isDetecting) {
      processFrame();
    }
  }, [isDetecting, processFrame]);

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const toggleDetection = () => {
    setIsDetecting((prev) => !prev);
  };

  // While permissions are still loading
  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // If permissions are not granted
  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.text}>We need your permission to show the camera</Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  // While TensorFlow or the model is loading
  if (!isTfReady || !model) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.text}>
          {!isTfReady ? 'Loading TensorFlow...' : 'Loading model...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={toggleCameraFacing}>
            <AntDesign name="retweet" size={44} color="black" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={toggleDetection}>
            <Text style={{ color: '#FFF', fontSize: 18 }}>
              {isDetecting ? 'Stop Detection' : 'Start Detection'}
            </Text>
          </TouchableOpacity>
        </View>
        {/* Show the current detection in the center */}
        {currentDetection && (
          <View style={styles.centerDetection}>
            <Text style={styles.centerText}>
              {currentDetection.class} ({(currentDetection.score * 100).toFixed(0)}%)
            </Text>
          </View>
        )}
        <View style={styles.predictionsContainer}>
          <Text style={styles.predictionText}>
            Found {predictions.length} objects
          </Text>
          {predictions.map((prediction, index) => (
            <Text key={index} style={styles.predictionText}>
              {prediction.class} ({(prediction.score * 100).toFixed(0)}%)
            </Text>
          ))}
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: { flex: 1 },
  buttonContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    margin: 64,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  button: {
    backgroundColor: 'gray',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  text: { fontSize: 16, textAlign: 'center', marginBottom: 10 },
  predictionsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 16,
  },
  predictionText: {
    color: '#FFF',
    fontSize: 16,
    marginVertical: 4,
  },
  centerDetection: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
});
