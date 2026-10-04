import React, { useState, useEffect, useRef } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePaper } from '../design/usePaper';
import { useSettings } from '../contexts/SettingsContext';
import { Card, ActionButton, SwitchRow } from '../design/components';
import { space, type, touch } from '../design/tokens';
import { createPortableBoard, sharePortableBoard, pickPortableBoard, previewImport, applyPortableImport, importWillSyncWords, subscribePortableReset } from '../services/portable-board-files';

export default function PortableBoardScreen() {
  const { c } = usePaper();
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState(false);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const revision = useRef(0);
  const [preview, setPreview] = useState(null);
  const [syncConsent, setSyncConsent] = useState(false);
  const [status, setStatus] = useState('');
  const locked = settings.editLock === true;
  useEffect(() => subscribePortableReset(() => { revision.current++; setPreview(null); setSyncConsent(false); setStatus('Personal data cleared. Choose a file again to import.'); }), []);
  const run = async (operation) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try { await operation(); } catch (error) { setStatus(error.message); Alert.alert('Vocabulary files', error.message); }
    finally { running.current = false; setBusy(false); }
  };
  const exportFile = (pdf) => run(async () => {
    const result = await createPortableBoard({ includePhotos: photos, columns: settings.gridSize || 3 });
    if (result.omittedPhotos.length) {
      setStatus(`Export paused: ${result.omittedPhotos.length} photo(s) could not be included: ${result.omittedPhotos.join(', ')}. Turn photos off to export words only, or fix these pictures first.`);
      return;
    }
    await sharePortableBoard(result.board, pdf);
    setStatus('Share sheet closed. If you chose a destination, check that the file was saved there.');
  });
  const choose = () => run(async () => {
    const started = revision.current;
    const board = await pickPortableBoard();
    if (!board || started !== revision.current) return;
    const plan = await previewImport(board);
    if (started !== revision.current) return;
    setSyncConsent(false);
    setPreview({ board, ...plan });
    setStatus('Review the words below before confirming.');
  });
  const confirm = () => run(async () => {
    if (!preview || locked) return;
    const result = await applyPortableImport(preview.board, { allowAccountSync: syncConsent });
    setPreview(null);
    setStatus(`Added ${result.added.length} word(s). Kept ${result.skipped.length} existing/duplicate label(s) unchanged.${result.failedPhotos.length ? ` Photos not attached for: ${result.failedPhotos.join(', ')}. The words were saved.` : ''} Return to the board to see new words appended after existing words.`);
  });
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.paper }} contentContainerStyle={{ padding: space.md, paddingBottom: insets.bottom + space.xl }}>
      <Card title="Vocabulary files & paper board" caption="An offline copy for transferring personal words or communicating on paper.">
        <Text style={[type.body, { color: c.ink }]}>This is a Voice vocabulary file, not a complete account backup or Open Board Format. It includes core-page references and personal words. It excludes history, learned predictions, settings, saved phrases and photo scenes. Downloaded symbol artwork is not exported.</Text>
      </Card>
      <Card title="Save a copy">
        <Text style={[type.body, { color: c.inkSoft }]}>Voice keeps temporary shared files for receiving apps to read. They are cleared after 24 hours on the next launch/export, or when you delete personal data. Copies saved elsewhere remain there.</Text>
        <SwitchRow label="Include my personal tile photos" description="The shared file will contain private pictures. Choose a trusted destination. Off by default." value={photos} onValueChange={setPhotos} />
        <Text style={[type.body, { color: c.inkSoft, marginBottom: space.sm }]}>Up to 250 personal words. Each encoded photo is limited to 2 MB; the file to 20 MB. Paper uses the selected column count, with personal words on a separate page. Paper positions may differ from the screen.</Text>
        <ActionButton label="Export vocabulary JSON" icon="download-outline" onPress={() => exportFile(false)} disabled={busy} size={touch.action} />
        <View style={{ height: space.sm }} />
        <ActionButton label="Create printable PDF" icon="print-outline" onPress={() => exportFile(true)} disabled={busy} size={touch.action} />
      </Card>
      <Card title="Add words from a file">
        <Text style={[type.body, { color: c.inkSoft, marginBottom: space.sm }]}>Import only adds new personal words. Existing words, pictures and positions stay unchanged. Core references in a file never replace the built-in board. Duplicate labels are skipped, even if their pictures differ.</Text>
        {locked && <Text style={[type.body, { color: c.ink }]}>Editing is locked. Turn off the editing lock in Personalise to import words.</Text>}
        <ActionButton label="Choose Voice JSON file" icon="folder-open-outline" onPress={choose} disabled={busy || locked} size={touch.action} />
        {preview && <View style={{ marginTop: space.md }}>
          <Text accessibilityRole="header" style={[type.heading, { color: c.ink }]}>Preview: {preview.add.length} new words</Text>
          {preview.add.map((item, index) => <Text key={`add-${index}`} style={[type.body, { color: c.ink }]}>+ {item.word} ({item.category}){item.photo ? ' · photo included' : ''}</Text>)}
          <Text style={[type.heading, { color: c.ink, marginTop: space.sm }]}>Skipped: {preview.skipped.length}</Text>
          {preview.skipped.map((item, index) => <Text key={`skip-${index}`} style={[type.body, { color: c.inkSoft }]}>{item.word}: {item.reason}</Text>)}
          {importWillSyncWords() && <SwitchRow label="Allow imported labels to sync to my account" description="Existing signed-in vocabulary sync sends word labels and categories to Firebase. Photos stay on this device. This does not enable personal learning." value={syncConsent} onValueChange={setSyncConsent} />}
          <ActionButton label={`Confirm: add ${preview.add.length} words`} variant="signal" onPress={confirm} disabled={busy || locked || !preview.add.length || (importWillSyncWords() && !syncConsent)} size={touch.action} />
          <ActionButton label="Cancel import" onPress={() => setPreview(null)} disabled={busy} size={touch.min} />
        </View>}
      </Card>
      {!!status && <Text accessibilityLiveRegion="polite" style={[type.body, { color: c.ink, padding: space.sm }]}>{status}</Text>}
      {busy && <Text accessibilityLiveRegion="polite" style={[type.body, { color: c.ink }]}>Preparing vocabulary file…</Text>}
    </ScrollView>
  );
}
