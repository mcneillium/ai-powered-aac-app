import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as tf from '@tensorflow/tfjs';
import * as cocossd from '@tensorflow-models/coco-ssd';
import { cameraWithTensors } from '@tensorflow/tfjs-react-native';

const TensorCamera = cameraWithTensors(CameraView);

export default function LiveSceneModeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [model, setModel] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [isTfReady, setIsTfReady] = useState(false);
  const [facing, setFacing] = useState('back');
  const rafId = useRef(null);

  // Load TensorFlow model on mount
  useEffect(() => {
    (async () => {
      await tf.ready();
      setIsTfReady(true);
      const loadedModel = await cocossd.load();
      setModel(loadedModel);
    })();
    // Clean up on unmount
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  // This function processes each frame from the camera feed
  const handleCameraStream = (images, updatePreview, gl) => {
    const loop = async () => {
      const nextImageTensor = images.next().value;
      if (model && nextImageTensor) {
        const preds = await model.detect(nextImageTensor);
        setPredictions(preds);
      }
      rafId.current = requestAnimationFrame(loop);
    };
    loop();
  };

  // While permissions are still loading
  if (!permission) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // If permissions are not granted
  if (!permission.granted) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.text}>We need your permission to show the camera</Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  // While TensorFlow and model are loading
  if (!isTfReady || !model) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.text}>Loading TensorFlow model...</Text>
      </View>
    );
  }

  const textureDims = {
    height: Dimensions.get('window').height,
    width: Dimensions.get('window').width,
  };

  return (
    <View style={styles.container}>
      <TensorCamera
        style={styles.camera}
        facing={facing}
        cameraTextureHeight={textureDims.height}
        cameraTextureWidth={textureDims.width}
        resizeHeight={200}
        resizeWidth={152}
        resizeDepth={3}
        onReady={handleCameraStream}
        autorender={true}
      />
      <View style={styles.predictionsContainer}>
        {predictions.map((p, i) => (
          <Text key={i} style={styles.predictionText}>
            {p.class} - {(p.score * 100).toFixed(1)}%
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  camera: {
    flex: 1,
  },
  predictionsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
  },
  predictionText: {
    color: '#fff',
    fontSize: 16,
    marginVertical: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
});