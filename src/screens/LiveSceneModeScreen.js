import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Button } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { AntDesign } from '@expo/vector-icons';
import * as tf from '@tensorflow/tfjs';
import * as cocossd from '@tensorflow-models/coco-ssd';
import * as FileSystem from 'expo-file-system';

export default function LiveSceneModeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [model, setModel] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [isTfReady, setIsTfReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef(null);
  const frameProcessorRef = useRef(null);

  // Initialize TensorFlow and load model
  useEffect(() => {
    const initTf = async () => {
      try {
        await tf.ready();
        console.log('TensorFlow ready');
        setIsTfReady(true);
        
        const loadedModel = await cocossd.load({
          base: 'lite_mobilenet_v2'
        });
        console.log('Model loaded');
        setModel(loadedModel);
      } catch (error) {
        console.error('Error initializing TF:', error);
      }
    };

    initTf();

    return () => {
      if (frameProcessorRef.current) {
        clearInterval(frameProcessorRef.current);
      }
    };
  }, []);

  // Process frames periodically
  useEffect(() => {
    if (model && !frameProcessorRef.current) {
      frameProcessorRef.current = setInterval(processFrame, 1000);
    }
    
    return () => {
      if (frameProcessorRef.current) {
        clearInterval(frameProcessorRef.current);
        frameProcessorRef.current = null;
      }
    };
  }, [model]);

  const processFrame = async () => {
    if (!model || !cameraRef.current || isProcessing) return;

    try {
      setIsProcessing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: true,
        skipProcessing: true
      });

      // Convert base64 to tensor
      const base64Image = await FileSystem.readAsStringAsync(photo.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const imgBuffer = tf.util.encodeString(base64Image, 'base64').buffer;
      const raw = new Uint8Array(imgBuffer);
      const imageTensor = tf.node.decodeImage(raw);

      // Get predictions
      const detections = await model.detect(imageTensor);
      console.log('Detections:', detections);
      setPredictions(detections);

      // Cleanup
      tf.dispose(imageTensor);
    } catch (error) {
      console.error('Error processing frame:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
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

  // While TensorFlow is loading
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
      <CameraView 
        style={styles.camera} 
        facing={facing} 
        ref={cameraRef}
      >
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={toggleCameraFacing}>
            <AntDesign name="retweet" size={44} color="black" />
          </TouchableOpacity>
        </View>
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
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
  },
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
  text: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
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
  }
});