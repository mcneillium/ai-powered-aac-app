// src/components/studio/MoreSheet.js
// Less frequent board actions, kept off the main screen to avoid clutter.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Sheet, ListRow, Segmented, Card } from '../../design/components';
import { usePaper } from '../../design/usePaper';
import { space, type } from '../../design/tokens';
import { voicePresets } from '../../services/speechService';
import { t } from '../../i18n/strings';
import { useOverlayScan } from '../../hooks/useOverlayScan';

export default function MoreSheet({
  visible, onClose, modelling, onToggleModelling, voicePreset, onVoicePreset,
  scanActive, onToggleScan, onCamera, onStudio, onTools, onWorkspace,
}) {
  const { c } = usePaper();
  const focused = useOverlayScan(visible, [
    { id: 'model', onSelect: onToggleModelling },
    { id: 'scan', onSelect: onToggleScan },
    { id: 'camera', onSelect: onCamera },
    { id: 'studio', onSelect: onStudio },
    { id: 'tools', onSelect: onTools },
    { id: 'workspace', onSelect: onWorkspace },
    { id: 'close', onSelect: onClose },
  ]);
  return (
    <Sheet visible={visible} onClose={onClose} title="More" closeFocused={focused === 'close'} scanning={focused !== null}>
      <Card title="Voice style">
        <Segmented
          label="Voice style"
          value={voicePreset}
          onChange={onVoicePreset}
          options={['normal', 'calm', 'excited', 'serious'].map((id) => ({ value: id, label: voicePresets[id].label }))}
        />
      </Card>
      <Card title="Modelling" caption="For a parent, teacher or therapist showing words. While modelling, nothing is saved to history and nothing is learned.">
        <ListRow
          icon="school-outline"
          text={modelling ? 'Stop modelling' : 'Start modelling'}
          onPress={onToggleModelling}
          focused={focused === 'model'}
          a11yLabel={modelling ? 'Stop modelling' : 'Start modelling. Words you show are not saved or learned.'}
        />
      </Card>
      <View>
        <ListRow icon={scanActive ? 'stop-circle-outline' : 'scan-outline'} text={scanActive ? t('stopScanning') : t('startScanning')} onPress={onToggleScan} focused={focused === 'scan'} />
        <ListRow icon="camera-outline" text="Describe with the camera" onPress={onCamera} focused={focused === 'camera'} />
        <ListRow icon="color-palette-outline" text="Personalise words and look" onPress={onStudio} focused={focused === 'studio'} />
        <ListRow icon="images-outline" text="My scenes and communication tools" onPress={onTools} focused={focused === 'tools'} />
        <ListRow icon="chatbubbles-outline" text="Save a thought / my messages" onPress={onWorkspace} focused={focused === 'workspace'} />
      </View>
      <Text style={[type.caption, styles.note, { color: c.inkSoft }]}>Speak, Delete, Clear and Undo are always on the board.</Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({ note: { marginTop: space.md, letterSpacing: 0 } });
