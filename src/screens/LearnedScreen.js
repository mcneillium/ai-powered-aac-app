// src/screens/LearnedScreen.js
// "What Voice has learned": every word the personal suggestions are based on,
// with Forget per word, the suggestions the user asked not to see (with
// Undo), and Delete everything. Works whether learning is on or paused.
// Nothing here leaves the phone.

import React, { useState, useCallback, useEffect } from 'react';
import { ScrollView, Text, View, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { deleteLearnedData } from '../services/localData';
import { useSettings } from '../contexts/SettingsContext';
import { usePaper } from '../design/usePaper';
import { Card, ListRow, ActionButton, EmptyState } from '../design/components';
import { space, type, touch } from '../design/tokens';
import {
  getLearnedWords, forgetLearnedWord, getDismissedSuggestions, undismissSuggestion,
  getLearningStats, subscribePrediction,
} from '../services/suggestionEngine';
import { BOS } from '../services/prediction/tokenize';

const usesText = (u) => (u >= 10 ? 'used a lot' : u >= 3 ? 'used often' : 'used a few times');

export default function LearnedScreen() {
  const { c } = usePaper();
  const { settings, updateSettings } = useSettings();
  const learningOn = settings.personalLearning === true;
  const [words, setWords] = useState([]);
  const [dismissed, setDismissed] = useState([]);
  const [stats, setStats] = useState(getLearningStats());

  const refresh = useCallback(() => {
    setWords(getLearnedWords(80));
    setDismissed(getDismissedSuggestions());
    setStats(getLearningStats());
  }, []);
  useFocusEffect(refresh);
  useEffect(() => subscribePrediction(refresh), [refresh]);

  const confirmClear = () => {
    Alert.alert(
      'Delete what Voice has learned?',
      'Suggestions go back to the built-in ones. Your words, messages and settings are not touched. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => { await deleteLearnedData(); updateSettings({ learningCarriedOver: false }); refresh(); } },
      ]
    );
  };

  return (
    <ScrollView style={{ backgroundColor: c.paper }} contentContainerStyle={styles.content}>
      <Card title={learningOn ? 'Learning is on' : 'Learning is paused'}>
        <Text style={[type.body, { color: c.inkSoft }]}>
          {stats.summary} Everything below is kept on this phone only. You can turn learning on or off in Personalise.
        </Text>
      </Card>

      <Card title="Words it has learned" caption="Forget a word to remove everything learned about it. It stays on your board.">
        {words.length === 0 ? (
          <EmptyState icon="sparkles-outline" title="Nothing learned yet" body={learningOn ? 'Words from messages you speak will appear here.' : 'Turn learning on in Personalise to start.'} />
        ) : words.map((w) => (
          <ListRow
            key={w.word}
            text={w.display}
            meta={usesText(w.uses)}
            a11yLabel={`${w.display}, ${usesText(w.uses)}`}
            right={(
              <ActionButton
                label="Forget"
                a11yLabel={`Forget ${w.display}`}
                size={touch.min}
                onPress={async () => { await forgetLearnedWord(w.word); refresh(); }}
              />
            )}
          />
        ))}
      </Card>

      {dismissed.length > 0 && (
        <Card title="Not suggested" caption="Suggestions you long-pressed to hide.">
          {dismissed.map((d) => {
            const where = d.prev === BOS ? 'at the start' : `after “${d.prev}”`;
            return (
              <ListRow
                key={`${d.prev} ${d.word}`}
                text={`${d.word}`}
                meta={where}
                a11yLabel={`${d.word}, not suggested ${where}`}
                right={(
                  <ActionButton
                    label="Undo"
                    a11yLabel={`Suggest ${d.word} ${where} again`}
                    size={touch.min}
                    onPress={async () => { await undismissSuggestion(d.prev, d.word); refresh(); }}
                  />
                )}
              />
            );
          })}
        </Card>
      )}

      <View style={{ marginTop: space.sm }}>
        <ActionButton icon="trash-outline" label="Delete everything Voice has learned" variant="danger" onPress={confirmClear} size={touch.action} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
});
