// src/hooks/useOnDevicePrediction.js
import { useRef, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';
import { word2idx, idx2word } from '../utils/vocab';

const SEQ_LEN = 4;
const BATCH_SIZE = 4;

const MODEL_JSON = require('../../assets/tf_model/model.json');
const MODEL_WEIGHTS = [ require('../../assets/tf_model/group1-shard1of1.bin') ];

export function useOnDevicePrediction() {
  const modelRef = useRef(null);
  const bufferRef = useRef({ xs: [], ys: [] });

  useEffect(() => {
    let mounted = true;
    (async () => {
      await tf.ready();
      try {
        modelRef.current = await tf.loadLayersModel(
          bundleResourceIO(MODEL_JSON, MODEL_WEIGHTS)
        );
      } catch (err) {
        console.warn('Failed to load bundled model:', err);
        return;
      }
      if (!mounted) return;
      modelRef.current.compile({ optimizer: 'adam', loss: 'sparseCategoricalCrossentropy' });
      bufferRef.current.xs.forEach(t => t.dispose());
      bufferRef.current.ys.forEach(t => t.dispose());
      bufferRef.current.xs = [];
      bufferRef.current.ys = [];
    })();
    return () => { mounted = false; };
  }, []);

  function encodeSequence(words) {
    const data = new Array(SEQ_LEN).fill(word2idx['<PAD>']);
    const start = Math.max(0, words.length - SEQ_LEN);
    words.slice(start).forEach((w, i) => {
      data[SEQ_LEN - (words.length - start) + i] = word2idx[w] ?? word2idx['<UNK>'];
    });
    return tf.tensor2d([data], [1, SEQ_LEN]);
  }

  async function predictNext(words, k = 5) {
    if (!modelRef.current) return [];
    try {
      const input = encodeSequence(words);
      const logits = modelRef.current.predict(input);
      const values = await logits.data();
      const top = Array.from(values)
        .map((v, i) => ({ v, i }))
        .sort((a, b) => b.v - a.v)
        .slice(0, k)
        .map(x => idx2word[x.i]);
      tf.dispose([input, logits]);
      return top;
    } catch (err) {
      console.warn('On-device predict error:', err);
      return [];
    }
  }

  async function recordTap(words, nextWord) {
    if (!modelRef.current) return;
    const xs = encodeSequence(words);
    const ys = tf.tensor1d([ word2idx[nextWord] ?? word2idx['<UNK>'] ], 'float32');
    if (bufferRef.current.xs.length > 0 && bufferRef.current.xs[0].shape[1] !== xs.shape[1]) {
      bufferRef.current.xs.forEach(t => t.dispose());
      bufferRef.current.ys.forEach(t => t.dispose());
      bufferRef.current.xs = [];
      bufferRef.current.ys = [];
    }
    bufferRef.current.xs.push(xs);
    bufferRef.current.ys.push(ys);

    if (bufferRef.current.xs.length >= BATCH_SIZE) {
      const xsBatch = tf.concat(bufferRef.current.xs);
      const ysBatch = tf.concat(bufferRef.current.ys);
      await modelRef.current.fit(xsBatch, ysBatch, { epochs: 1, batchSize: BATCH_SIZE });
      // Model is kept in memory only (localStorage not available in React Native)
      bufferRef.current.xs.forEach(t => t.dispose());
      bufferRef.current.ys.forEach(t => t.dispose());
      bufferRef.current.xs = [];
      bufferRef.current.ys = [];
    }
  }

  return { predictNext, recordTap };
}