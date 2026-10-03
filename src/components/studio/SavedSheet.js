// src/components/studio/SavedSheet.js
// Favourite and recent messages in one place.

import React, { useState } from 'react';
import { View } from 'react-native';
import { Sheet, Segmented, ListRow, EmptyState, ActionButton } from '../../design/components';
import { usePaper } from '../../design/usePaper';
import { space, touch } from '../../design/tokens';
import { t } from '../../i18n/strings';

export default function SavedSheet({
  visible, onClose, favourites, history, hasWords, isCurrentFavourite,
  onToggleCurrent, onFavourite, onHistory, onRemoveFavourite,
}) {
  const { c } = usePaper();
  const [tab, setTab] = useState('favourites');
  return (
    <Sheet visible={visible} onClose={onClose} title="Saved" subtitle="Tap a message to say it again.">
      <ActionButton
        icon={isCurrentFavourite ? 'star' : 'star-outline'}
        label={isCurrentFavourite ? 'Remove this message from favourites' : 'Save this message as a favourite'}
        onPress={onToggleCurrent}
        disabled={!hasWords}
        size={touch.min}
        style={{ marginBottom: space.md }}
      />
      <Segmented
        label="Saved messages"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'favourites', label: `Favourites (${favourites.length})`, icon: 'star' },
          { value: 'recent', label: 'Recent', icon: 'time-outline' },
        ]}
      />
      <View style={{ marginTop: space.sm }}>
        {tab === 'favourites' ? (
          favourites.length === 0 ? (
            <EmptyState icon="star-outline" title="No favourites yet" body="Build a message, then save it here for one-tap use." />
          ) : favourites.map((f) => (
            <ListRow
              key={f.id} icon="star" iconColor={c.signal} text={f.phrase}
              onPress={() => onFavourite(f.phrase)} a11yLabel={`Speak favourite: ${f.phrase}`}
              right={<ActionButton icon="close" variant="ghost" size={touch.min} a11yLabel={`${t('removeFavourite')}: ${f.phrase}`} onPress={() => onRemoveFavourite(f)} />}
            />
          ))
        ) : history.length === 0 ? (
          <EmptyState icon="time-outline" title="Nothing spoken yet" body="Messages you speak appear here, newest first." />
        ) : history.map((h, i) => (
          <ListRow
            key={`${i}-${h.timestamp}`} icon="refresh" text={h.text}
            meta={(h.speakCount || 0) > 1 ? `${h.speakCount}×` : null}
            onPress={() => onHistory(h.text)} a11yLabel={`Repeat: ${h.text}`}
          />
        ))}
      </View>
    </Sheet>
  );
}
