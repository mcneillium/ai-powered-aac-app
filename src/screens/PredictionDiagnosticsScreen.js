import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette } from '../theme';
import { initPrediction, getLearningStats, suggestNext, subscribePrediction } from '../services/suggestionEngine';
import { predictionModelInfo, runIsolatedLearningDemo } from '../services/prediction/diagnostics';

const modelInfo = predictionModelInfo();
const clock = () => typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();

export default function PredictionDiagnosticsScreen() {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme, settings.boardLayout);
  const [stats, setStats] = useState(null);
  const [probe, setProbe] = useState(null);
  const [demo, setDemo] = useState(null);
  const [error, setError] = useState(null);
  const refresh = useCallback(() => setStats(getLearningStats()), []);
  useEffect(() => {
    let mounted = true;
    initPrediction().then(() => { if (mounted) refresh(); })
      .catch(() => { if (mounted) setError('Prediction statistics could not be loaded. Core communication is still available.'); });
    const unsubscribe = subscribePrediction(() => { if (mounted) refresh(); });
    return () => { mounted = false; unsubscribe(); };
  }, [refresh]);

  const runProbe = () => {
    const start = clock();
    const suggestions = suggestNext(['I', 'want'], {
      mode: settings.uiMode || undefined, context: settings.activeContext, k: 4,
    });
    setProbe({ suggestions, ms: Math.max(0, clock() - start) });
    refresh();
  };
  const runDemo = () => {
    setError(null);
    try { setDemo(runIsolatedLearningDemo()); }
    catch { setError('The demonstration could not run. Your personal model has not been changed.'); }
  };
  const text = { color: palette.text };
  const card = [styles.card, { backgroundColor: palette.cardBg, borderColor: palette.border }];
  const button = (label, onPress) => (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={[styles.button, { backgroundColor: palette.primary }]}>
      <Text style={[styles.buttonText, { color: palette.buttonText }]}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={[styles.title, text]}>Inside predictions</Text>
      <Text style={[styles.body, text]}>An owner view of the local prediction engine. These checks never speak a message or train your personal model.</Text>
      <View style={card}>
        <Text accessibilityRole="header" style={[styles.heading, text]}>Engine and learning</Text>
        <Text style={[styles.body, text]}>{modelInfo.algorithm}</Text>
        <Text style={[styles.body, text]}>{modelInfo.baseWords} base words. {modelInfo.source}.</Text>
        <Text style={[styles.body, text]}>New personal learning: {settings.personalLearning && settings.aiPersonalisationEnabled !== false ? 'enabled in Settings' : 'off in Settings'}.</Text>
        <Text style={[styles.body, text]}>Board suggestions: {settings.predictionEnabled !== false ? 'shown' : 'hidden'}.</Text>
        <Text style={[styles.body, text]}>{stats ? stats.summary : 'Reading engine statistics…'}</Text>
        <Text style={[styles.body, text]}>Turning learning off pauses new learning; previous learning may still influence suggestions. Use the learning controls in Personalise to delete it.</Text>
        {button('Refresh statistics', refresh)}
      </View>
      <View style={card}>
        <Text accessibilityRole="header" style={[styles.heading, text]}>Inspect a real prediction</Text>
        <Text style={[styles.body, text]}>Run “I want” through your current local engine. Results may include private learned words and are displayed only here. This does not learn from the example.</Text>
        {button('Inspect suggestions for I want', runProbe)}
        {probe && <View accessibilityLiveRegion="polite">
          <Text style={[styles.body, text]}>One local call: {probe.ms.toFixed(1)} ms (not a benchmark).</Text>
          {probe.suggestions.length === 0 && <Text style={[styles.body, text]}>No suggestions returned.</Text>}
          {probe.suggestions.map((s, i) => <Text key={`${i}-${s.word}`} style={[styles.body, text]}>{i + 1}. {s.word} — {s.reason} ({s.source})</Text>)}
        </View>}
      </View>
      <View style={card}>
        <Text accessibilityRole="header" style={[styles.heading, text]}>Try learning safely</Text>
        <Text style={[styles.body, text]}>An isolated model learns six made-up messages, predicts two different held-out sentences, then resets. It never accesses your stored learning or changes your consent.</Text>
        {button('Run isolated learning demonstration', runDemo)}
        {error && <Text accessibilityRole="alert" style={[styles.body, text]}>{error}</Text>}
        {demo && <View accessibilityLiveRegion="polite">
          {demo.adapted.map((row, i) => <View key={row.target} style={styles.example}>
            <Text style={[styles.heading, text]}>“{row.prefix} …”</Text>
            <Text style={[styles.body, text]}>Expected test word: {row.target}</Text>
            <Text style={[styles.body, text]}>Before: {demo.baseline[i].suggestions.map(s => s.label).join(', ')}</Text>
            <Text style={[styles.body, text]}>After learning: {row.suggestions.map(s => s.label).join(', ')}</Text>
            <Text style={[styles.body, text]}>After reset: {demo.reset[i].suggestions.map(s => s.label).join(', ')}</Text>
          </View>)}
          <Text style={[styles.body, text]}>Test words in top three: {demo.hits.baseline}/{demo.total} before; {demo.hits.adapted}/{demo.total} after learning.</Text>
          <Text style={[styles.body, text]}>Learning off prevented training: {demo.ignoredWhileOff ? 'yes' : 'no'}. Reset restored original suggestions: {demo.resetRestoredBaseline ? 'yes' : 'no'}.</Text>
          <Text style={[styles.body, text]}>{demo.disclaimer}</Text>
        </View>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, gap: 16 },
  title: { fontSize: 26, fontWeight: '700' },
  heading: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  body: { fontSize: 16, marginBottom: 10, flexShrink: 1 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  button: { minHeight: 48, borderRadius: 12, padding: 12, justifyContent: 'center', marginTop: 4 },
  buttonText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  example: { marginTop: 16 },
});
