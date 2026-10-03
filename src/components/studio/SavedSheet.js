// src/components/studio/SavedSheet.js
// Favourite and recent messages in one place.

import React, { useState } from 'react';
import { View } from 'react-native';
import { Sheet, Segmented, ListRow, EmptyState, ActionButton } from '../../design/components';
import { usePaper } from '../../design/usePaper';
import { space, touch } from '../../design/tokens';
import { t } from '../../i18n/strings';
import { useOverlayScan } from '../../hooks/useOverlayScan';

export default function SavedSheet({
  visible, onClose, favourites, history, hasWords, isCurrentFavourite,
  onToggleCurrent, onFavourite, onHistory, onRemoveFavourite,
}) {
  const { c } = usePaper();
  const [tab, setTab] = useState('favourites');
  const rows = tab === 'favourites'
    ? favourites.map((f) => ({ id: `fav-${f.id}`, onSelect: () => onFavourite(f.phrase) }))
    : history.map((h, i) => ({ id: `his-${i}`, onSelect: () => onHistory(h.text) }));
  const focused = useOverlayScan(visible, [
    ...(hasWords ? [{ id: 'toggle', onSelect: onToggleCurrent }] : []),
    { id: 'tab', onSelect: () => setTab((v) => (v === 'favourites' ? 'recent' : 'favourites')) },
    ...rows,
    { id: 'close', onSelect: onClose },
  ]);
  return (
    <Sheet visible={visible} onClose={onClose} title="Saved" subtitle="Tap a message to say it again." closeFocused={focused === 'close'} scanning={focused !== null}>
      <ActionButton
        icon={isCurrentFavourite ? 'star' : 'star-outline'}
        label={isCurrentFavourite ? 'Remove this message from favourites' : 'Save this message as a favourite'}
        onPress={onToggleCurrent}
        disabled={!hasWords}
        size={touch.min}
        focused={focused === 'toggle'}
        style={{ marginBottom: space.md }}
      />
      <View style={focused === 'tab' ? { borderWidth: 3, borderColor: c.focus, borderRadius: 16 } : null}>
      <Segmented
        label="Saved messages"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'favourites', label: `Favourites (${favourites.length})`, icon: 'star' },
          { value: 'recent', label: 'Recent', icon: 'time-outline' },
        ]}
      />
      </View>
      <View style={{ marginTop: space.sm }}>
        {tab === 'favourites' ? (
          favourites.length === 0 ? (
            <EmptyState icon="star-outline" title="No favourites yet" body="Build a message, then save it here for one-tap use." />
          ) : favourites.map((f) => (
            <ListRow
              key={f.id} icon="star" iconColor={c.signal} text={f.phrase}
              onPress={() => onFavourite(f.phrase)} a11yLabel={`Speak favourite: ${f.phrase}`} focused={focused === `fav-${f.id}`}
              right={<ActionButton icon="close" variant="ghost" size={touch.min} a11yLabel={`${t('removeFavourite')}: ${f.phrase}`} onPress={() => onRemoveFavourite(f)} />}
            />
          ))
        ) : history.length === 0 ? (
          <EmptyState icon="time-outline" title="Nothing spoken yet" body="Messages you speak appear here, newest first." />
        ) : history.map((h, i) => (
          <ListRow
            key={`${i}-${h.timestamp}`} icon="refresh" text={h.text}
            meta={(h.speakCount || 0) > 1 ? `${h.speakCount}×` : null}
            onPress={() => onHistory(h.text)} a11yLabel={`Repeat: ${h.text}`} focused={focused === `his-${i}`}
          />
        ))}
      </View>
    </Sheet>
  );
}
