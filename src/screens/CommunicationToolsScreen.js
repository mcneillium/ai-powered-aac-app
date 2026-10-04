import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useOverlayScan } from '../hooks/useOverlayScan';
import { advanceScan, selectCurrent } from '../services/switchScanService';
import * as ImagePicker from 'expo-image-picker';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette } from '../theme';
import { buildSpeechOptions, speak, stop } from '../services/speechService';
import { loadScenes, parseScenePack, saveScenes, getScenesGeneration, subscribeScenesDeletion } from '../services/communication-scenes';
import { shareSceneBackup, pickSceneBackup, shareScenePdf } from '../services/communication-transfer';
import { VisualMessage } from '../components/studio/VisualMessage';

const REPAIRS = ['Please give me time.', 'That is not what I meant.', 'Please ask me one question at a time.', 'Please speak directly to me.', 'Please do not guess what I am saying.', 'Let me try another way.'];
const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
export default function CommunicationToolsScreen({ route, navigation }) {
  const { settings } = useSettings();
  const isFocused = useIsFocused();
  const locked = settings.editLock === true;
  const lockedRef = useRef(locked); lockedRef.current = locked;
  const generation = getScenesGeneration();
  const scrollRef = useRef(null);
  const scrollOffset = useRef(0);
  const scanRefs = useRef({});
  const [highlight, setHighlight] = useState(null);
  const scanItems = [];
  const palette = getPalette(settings.theme, settings.boardLayout);
  const [tab, setTab] = useState('Scenes');
  const [scenes, setScenes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sceneId, setSceneId] = useState(null);
  const [sceneName, setSceneName] = useState('');
  const [rename, setRename] = useState('');
  const [editing, setEditing] = useState(false);
  const [position, setPosition] = useState(null);
  const [label, setLabel] = useState('');
  const [phrase, setPhrase] = useState('');
  const [selected, setSelected] = useState(null);
  const [size, setSize] = useState({ width: 1, height: 260 });
  const [original, setOriginal] = useState(route?.params?.message || '');
  const [alternative, setAlternative] = useState('');
  const [drawing, setDrawing] = useState([]);
  const [importText, setImportText] = useState('');
  const [pasteImport, setPasteImport] = useState(false);
  const [preview, setPreview] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const scene = scenes.find((s) => s.id === sceneId);
  const say = (text) => { if (text.trim()) speak(text, buildSpeechOptions(settings)); };
  const error = () => Alert.alert('Could not complete this action', 'Your existing saved scenes have not been replaced. Try again.');
  useEffect(() => {
    let mounted = true;
    const started = getScenesGeneration();
    const unsubscribe = subscribeScenesDeletion(() => {
      if (!mounted) return;
      stop(); setScenes([]); setSceneId(null); setSceneName(''); setRename(''); setEditing(false); setPosition(null); setLabel(''); setPhrase(''); setSelected(null); setOriginal(''); setAlternative(''); setDrawing([]); setImportText(''); setPreview(null); setConfirmation(null); setPasteImport(false); setBusy(false); setLoaded(true);
    });
    loadScenes().then((items) => { if (mounted && started === getScenesGeneration()) { setScenes(items); setSceneId(items[0]?.id || null); setLoaded(true); } }).catch(() => { if (mounted && started === getScenesGeneration()) Alert.alert('Scenes could not be read', 'The saved copy has been preserved. Close and reopen this screen.'); });
    return () => { mounted = false; unsubscribe(); stop(); };
  }, []);
  useEffect(() => { if (locked) { setEditing(false); setPosition(null); setPreview(null); setConfirmation(null); setImportText(''); } }, [locked]);
  useEffect(() => { if (confirmation) scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [confirmation]);
  async function persist(next) {
    if (lockedRef.current || generation !== getScenesGeneration()) return false;
    setBusy(true);
    try { await saveScenes(next, generation); if (generation !== getScenesGeneration()) return false; setScenes(next); return true; } catch { error(); return false; } finally { setBusy(false); }
  }
  async function addScene() {
    if (lockedRef.current) return;
    if (!sceneName.trim()) return Alert.alert('Name your scene', 'For example, my kitchen.');
    if (scenes.length >= 3) return Alert.alert('Three scenes saved', 'Export a backup before removing a scene to make space.');
    setBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.2, allowsEditing: true, aspect: [4, 3] });
      if (result.canceled || lockedRef.current || generation !== getScenesGeneration()) return;
      const asset = result.assets?.[0];
      if (!asset?.base64 || asset.base64.length > 599900) return Alert.alert('Choose a smaller picture', 'This scene supports a compressed picture up to about 450 KB. Try cropping the picture first.');
      const photo = `data:image/${asset.mimeType === 'image/png' ? 'png' : 'jpeg'};base64,${asset.base64}`;
      const next = { id: id(), name: sceneName.trim(), photo, points: [] };
      if (await persist([...scenes, next])) { setSceneId(next.id); setSceneName(''); setEditing(true); setSelected(null); }
    } catch { error(); } finally { setBusy(false); }
  }
  async function savePoint() {
    if (!scene || !position || !label.trim() || !phrase.trim()) return Alert.alert('Finish the point', 'Choose a position, name it and enter what you want to say.');
    if (!position.id && scene.points.length >= 12) return Alert.alert('Twelve points saved', 'Edit or remove a point first.');
    const point = { ...position, id: position.id || id(), label: label.trim(), phrase: phrase.trim() };
    const points = position.id ? scene.points.map((p) => p.id === position.id ? point : p) : [...scene.points, point];
    if (await persist(scenes.map((s) => s.id === scene.id ? { ...s, points } : s))) { setPosition(null); setLabel(''); setPhrase(''); setSelected(point); }
  }
  function editPoint(p) { setEditing(true); setPosition(p); setLabel(p.label); setPhrase(p.phrase); }
  const button = (title, action, active = false, disabled = false, key = title) => {
    const scanId = `button:${key}`;
    if (!disabled) scanItems.push({ id: scanId, label: title, onSelect: action });
    return <Pressable ref={(node) => { scanRefs.current[scanId] = node; }} key={key} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled, selected: active }} disabled={disabled} onPress={action} style={[styles.button, { backgroundColor: active ? palette.primary : palette.cardBg, borderColor: highlight === scanId ? palette.primary : palette.textSecondary, borderWidth: highlight === scanId ? 4 : 1, opacity: disabled ? 0.5 : 1 }]}><Text style={[styles.buttonText, { color: active ? palette.buttonText : palette.text }]}>{title}</Text></Pressable>; };
  const input = (value, setter, placeholder, maxLength = 300) => {
    const scanId = `input:${placeholder}`;
    scanItems.push({ id: scanId, label: placeholder, onSelect: () => scanRefs.current[scanId]?.focus() });
    return <TextInput ref={(node) => { scanRefs.current[scanId] = node; }} accessibilityLabel={placeholder} value={value} onChangeText={setter} placeholder={placeholder} placeholderTextColor={palette.textSecondary} maxLength={maxLength} multiline style={[styles.input, { color: palette.text, borderColor: palette.textSecondary, backgroundColor: palette.cardBg, borderWidth: highlight === scanId ? 4 : 1 }]} />; };
  const heading = (text) => <Text accessibilityRole="header" style={[styles.heading, { color: palette.text }]}>{text}</Text>;
  const copy = (text) => <Text style={[styles.copy, { color: palette.text }]}>{text}</Text>;
  const content = <ScrollView ref={scrollRef} onScroll={(e) => { scrollOffset.current = e.nativeEvent.contentOffset.y; }} scrollEventThrottle={32} style={{ flex: 1, backgroundColor: palette.background }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    {heading('More ways to communicate')}
    {confirmation && <View style={[styles.card, { backgroundColor: palette.cardBg }]}>{heading(confirmation.title)}{copy('Export a backup first if you want to keep your current scenes.')}{button('Cancel', () => setConfirmation(null), false, false, 'confirm:cancel')}{button('Confirm', async () => { const action = confirmation.action; setConfirmation(null); await action(); }, true, busy, 'confirm:yes')}</View>}
    <View style={styles.row}>{['Scenes', 'Explain', 'Backup'].map((t) => button(t, () => { stop(); setTab(t); }, tab === t))}</View>
    {button('Stop speaking', stop)}
    {locked && copy('Editing is locked. Your scenes, messages and communication tools are still available. Unlock editing in Settings to change saved scenes.')}
    {copy('In-app scanning reaches buttons and input fields. Use device switch access for the keyboard and system file/photo pickers. Drawing is touch-based; phrases and scales are available without drawing.')}
    {tab === 'Scenes' && <>
      {copy('Your pictures, your words. Photos stay on this device unless you explicitly share a scene backup. Device backups may include them.')}
      {!loaded && copy('Loading saved scenes…')}
      <View style={styles.row}>{scenes.map((s) => button(s.name, () => { setSceneId(s.id); setPosition(null); setSelected(null); setEditing(false); }, sceneId === s.id, false, s.id))}</View>
      {scene && <>
        {heading(scene.name)}
        {!locked && button(editing ? 'Finish editing' : 'Edit points', () => { setEditing(!editing); setPosition(null); setRename(scene.name); }, editing, busy)}
        {editing && !locked && copy('Tap the picture to position a point, or use Centre point. Existing points can be edited using the list below.')}
        <Pressable accessibilityRole="image" accessibilityLabel={`${scene.name}. All picture points are also available as buttons below.`} onLayout={(e) => setSize(e.nativeEvent.layout)} onPress={(e) => { if (editing && !locked) { setPosition({ x: Math.max(0, Math.min(1, e.nativeEvent.locationX / size.width)), y: Math.max(0, Math.min(1, e.nativeEvent.locationY / size.height)) }); setLabel(''); setPhrase(''); } }} style={styles.picture}>
          <Image accessible={false} source={{ uri: scene.photo }} resizeMode="stretch" style={StyleSheet.absoluteFill} />
          {scene.points.map((p, i) => <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Select ${p.label}`} onPress={(e) => { e.stopPropagation(); setSelected(p); }} style={[styles.marker, { left: Math.max(0, Math.min(size.width - 48, p.x * size.width - 24)), top: Math.max(0, Math.min(size.height - 48, p.y * size.height - 24)) }]}><Text style={styles.markerText}>{i + 1}</Text></Pressable>)}
        </Pressable>
        {selected && <View style={[styles.card, { backgroundColor: palette.cardBg }]}><VisualMessage text={selected.phrase} compact />{copy(selected.phrase)}{button(`Speak: ${selected.label}`, () => say(selected.phrase), true)}</View>}
        {scene.points.map((p, i) => <View key={p.id} style={styles.row}>{button(`${i + 1}. ${p.label}`, () => setSelected(p), selected?.id === p.id)}{editing && !locked && button(`Edit ${p.label}`, () => editPoint(p), false, busy, `edit:${p.id}`)}</View>)}
        {editing && !locked && <>
          {button('Centre point', () => { setPosition({ x: 0.5, y: 0.5 }); setLabel(''); setPhrase(''); })}
          {position && <>{copy('Position selected. Name this point and its phrase.')}{input(label, setLabel, 'Point name', 60)}{input(phrase, setPhrase, 'Phrase to say')}{button('Save point', savePoint, true, busy)}{position.id && button('Remove selected point', async () => { if (await persist(scenes.map((s) => s.id === scene.id ? { ...s, points: s.points.filter((p) => p.id !== position.id) } : s))) { setPosition(null); setSelected(null); } }, false, busy)}</>}
          {input(rename, setRename, 'Rename scene', 60)}
          {button('Save scene name', async () => { if (rename.trim()) await persist(scenes.map((s) => s.id === scene.id ? { ...s, name: rename.trim() } : s)); }, false, busy)}
          {button('Delete this scene', () => setConfirmation({ title: 'Delete this scene?', action: async () => { if (await persist(scenes.filter((s) => s.id !== scene.id))) { setSceneId(null); setSelected(null); } } }), false, busy)}
        </>}
      </>}
      {!locked && <>{heading('New photo scene')}{input(sceneName, setSceneName, 'Name for new scene', 60)}{button('Choose photo and create scene', addScene, true, !loaded || busy)}</>}
    </>}
    {tab === 'Explain' && <>
      {heading('Keep my meaning')}{copy('Keep your original message while you try another way. Nothing is replaced or spoken automatically.')}
      {input(original, setOriginal, 'Original message', 2000)}{button('Speak original', () => say(original), true)}
      {input(alternative, setAlternative, 'Another way to say it', 2000)}{button('Speak alternative', () => say(alternative), true)}
      {heading('Help me explain')}{REPAIRS.map((p) => <View key={p} style={[styles.card, { backgroundColor: palette.cardBg }]}><VisualMessage text={p} compact />{button(p, () => say(p))}</View>)}
      {heading('How much?')}{copy('Choose your own meaning: comfort, noise, worry or something else. These are communication choices, not an assessment.')}
      <View style={styles.row}>{['None', 'A little', 'Some', 'A lot', 'Too much'].map((v, i) => button(`${'●'.repeat(i + 1)} ${v}`, () => say(v)))}</View>
      {heading('Draw or point')}{copy('Use a finger to draw. The drawing is temporary and is not saved or shared.')}
      <View accessibilityLabel="Temporary drawing pad" onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderGrant={(e) => { const p = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }; setDrawing((d) => [...d, p].slice(-600)); }} onResponderMove={(e) => { const p = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }; setDrawing((d) => [...d, p].slice(-600)); }} style={styles.drawing}>{drawing.map((p, i) => <View key={i} style={[styles.dot, { left: p.x - 4, top: p.y - 4 }]} />)}</View>
      {button('Undo last drawing marks', () => setDrawing((d) => d.slice(0, -20)))}{button('Clear drawing', () => setDrawing([]))}
    </>}
    {tab === 'Backup' && <>
      {heading('Portable photo scenes')}{copy('This exports photo scenes and their phrases only, not the main vocabulary board, settings or history. The JSON includes personal photos and text. Share only with someone you choose. Imports replace scenes only after confirmation.')}
      {copy('Temporary shared files stay in Voice so receiving apps can read them. They are cleared after 24 hours on the next launch/export, or when you delete personal data. Copies saved elsewhere remain there.')}
      {button('Share scene backup', async () => { setBusy(true); try { await shareSceneBackup(scenes); } catch { error(); } finally { setBusy(false); } }, true, !loaded || busy)}
      {button('Share printable photo scene PDF', async () => { setBusy(true); try { await shareScenePdf(scenes); } catch { error(); } finally { setBusy(false); } }, false, !loaded)}
      {!locked && <>{button('Choose scene backup file', async () => { setBusy(true); try { const pack = await pickSceneBackup(); if (pack && !lockedRef.current && generation === getScenesGeneration()) setPreview(pack); } catch { Alert.alert('Cannot import', 'Choose a supported Voice scene JSON file. Existing scenes are unchanged.'); } finally { setBusy(false); } }, false, !loaded || busy)}
      {button('Paste JSON instead', () => setPasteImport(!pasteImport), pasteImport)}
      {pasteImport && <>{input(importText, (v) => { setImportText(v); setPreview(null); }, 'Paste Voice scene JSON', 1900000)}
      {button('Validate import', () => { try { setPreview(parseScenePack(importText)); } catch { Alert.alert('Cannot import', 'This is not a supported Voice scene pack. Existing scenes are unchanged.'); } }, false, !loaded || busy)}</>}
      {preview && <>{copy(`Ready: ${preview.scenes.length} scenes, ${preview.scenes.reduce((n, s) => n + s.points.length, 0)} points. This replaces your current scenes.`)}{button('Replace scenes with this import', () => setConfirmation({ title: 'Replace saved scenes?', action: async () => { if (await persist(preview.scenes)) { setSceneId(preview.scenes[0]?.id || null); setPreview(null); setImportText(''); setSelected(null); } } }), true, busy)}</>}</>}
    </>}
  </ScrollView>;
  scanItems.push({ id: 'screen:back', label: 'Back to board', onSelect: () => navigation.goBack() });
  const scanFocus = useOverlayScan(isFocused, busy ? [] : confirmation ? scanItems.filter((item) => item.id.startsWith('button:confirm:') || item.id === 'screen:back') : scanItems);
  useEffect(() => {
    setHighlight(scanFocus);
    const node = scanRefs.current[scanFocus];
    if (node?.measureInWindow && scrollRef.current?.measureInWindow) {
      node.measureInWindow((x, y, width, height) => scrollRef.current?.measureInWindow((sx, sy, sw, sh) => {
        if (y < sy || y + height > sy + sh) scrollRef.current?.scrollTo({ y: Math.max(0, scrollOffset.current + y - sy - 20), animated: false });
      }));
    }
  }, [scanFocus]);
  return <View style={{ flex: 1, backgroundColor: palette.background }}>{content}<View style={[styles.row, { padding: 10, paddingBottom: 24, backgroundColor: palette.cardBg }]}>
    {[['Next', advanceScan], ['Select', selectCurrent], ['Back', () => navigation.goBack()]].map(([title, action]) => <Pressable key={title} accessibilityRole="button" accessibilityState={{ disabled: title !== 'Back' && !scanFocus }} disabled={title !== 'Back' && !scanFocus} onPress={action} style={[styles.button, { flex: 1, opacity: title !== 'Back' && !scanFocus ? 0.5 : 1, borderWidth: title === 'Back' && scanFocus === 'screen:back' ? 4 : 1, borderColor: palette.textSecondary }]}><Text style={{ color: palette.text, fontSize: 16 }}>{title}</Text></Pressable>)}
  </View></View>;
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 110, gap: 12 }, heading: { fontSize: 23, fontWeight: '700', marginTop: 8 }, copy: { fontSize: 16, lineHeight: 24 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, button: { minHeight: 48, minWidth: 48, borderWidth: 1, borderRadius: 14, padding: 12, justifyContent: 'center' }, buttonText: { fontSize: 16, fontWeight: '600' },
  input: { minHeight: 54, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 17, textAlignVertical: 'top' }, picture: { width: '100%', height: 260, overflow: 'hidden', borderRadius: 16 },
  marker: { position: 'absolute', width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFF', borderColor: '#151D35', borderWidth: 3, alignItems: 'center', justifyContent: 'center' }, markerText: { color: '#151D35', fontSize: 20, fontWeight: '800' },
  card: { padding: 12, gap: 8, borderRadius: 14 }, drawing: { height: 250, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#151D35', borderRadius: 16, overflow: 'hidden' }, dot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#151D35' },
});
