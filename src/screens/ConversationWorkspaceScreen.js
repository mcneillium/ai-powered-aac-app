import React, { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, View, Text, TextInput, Pressable } from 'react-native';
import { StackActions, useIsFocused, usePreventRemove } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePaper } from '../design/usePaper';
import { type, touch } from '../design/tokens';
import { useSettings } from '../contexts/SettingsContext';
import { VisualMessage } from '../components/studio/VisualMessage';
import { speak, stop, buildSpeechOptions } from '../services/speechService';
import {
  listConversationDrafts, parkConversationDraft, deleteConversationDraft,
  queueWorkspaceReturn, subscribeConversationClear, wordFormChoices, MAX_MESSAGE_LENGTH, conversationGeneration,
} from '../services/conversation-workspace';
import { saveScanContext, restoreScanContext, stopScan, startScan, setScanItems, onScanChange, onScanSelect,
  setScanMode, setScanSpeed, advanceScan, selectCurrent } from '../services/switchScanService';

export default function ConversationWorkspaceScreen({ navigation, route }) {
  const initial = typeof route?.params?.message === 'string' ? route.params.message : '';
  const [message, setMessage] = useState(initial);
  const [drafts, setDrafts] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [previous, setPrevious] = useState(null);
  const [leaveAllowed, setLeaveAllowed] = useState(false);
  const [exitAction, setExitAction] = useState(null);
  const mounted = useRef(true);
  const epoch = useRef(0);
  const [scanning, setScanning] = useState(false);
  const [focused, setFocused] = useState(null);
  const scanItems = useRef([]);
  const scanRefs = useRef({});
  const scrollRef = useRef(null);
  const scrollOffset = useRef(0);
  scanItems.current = [];
  const { c } = usePaper();
  const { settings } = useSettings();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const requestLeave = action => { setExitAction(action); setLeaveAllowed(true); };
  const load = async () => {
    const started = epoch.current;
    const rows = await listConversationDrafts();
    if (mounted.current && started === epoch.current) setDrafts(rows);
  };
  useEffect(() => {
    mounted.current = true;
    load().catch(e => setError(e.message));
    const unsubscribe = subscribeConversationClear(() => {
      epoch.current++; setMessage(''); setDrafts([]); setPrevious(null); setScanning(false); setExitAction(null);
      navigation.setParams?.({ message: '' });
    });
    return () => { mounted.current = false; unsubscribe(); };
  }, [navigation]);
  usePreventRemove(!leaveAllowed && !!message.trim() && message !== initial && !drafts.some(d => d.text === message), ({ data }) => {
    const savedGeneration = conversationGeneration();
    Alert.alert('Keep this message?', 'Your board message is unchanged. This edited draft has not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Leave without saving', style: 'destructive', onPress: () => requestLeave(data.action) },
      { text: 'Save and leave', onPress: async () => {
        const started = epoch.current;
        try { await parkConversationDraft(message, savedGeneration); if (started !== epoch.current || !mounted.current) return; requestLeave(data.action); }
        catch (err) { setError(err.message); }
      } },
    ]);
  });
  // Dispatch only after usePreventRemove has observed the changed state.
  useEffect(() => {
    if (leaveAllowed && exitAction) { setExitAction(null); navigation.dispatch(exitAction); }
  }, [leaveAllowed, exitAction, navigation]);
  useEffect(() => {
    if (!isFocused) setScanning(false);
    else setLeaveAllowed(false);
  }, [isFocused]);
  useEffect(() => {
    if (!scanning || !isFocused) return undefined;
    const saved = saveScanContext();
    stopScan();
    setScanMode(settings.scanMode || 'auto'); setScanSpeed(settings.scanSpeed || 1500);
    setScanItems(scanItems.current);
    onScanChange(({ currentIndex, isRunning }) => setFocused(isRunning ? scanItems.current[currentIndex]?.id : null));
    onScanSelect(({ item }) => scanItems.current.find(row => row.id === item?.id)?.onSelect());
    startScan();
    return () => { stopScan(); setFocused(null); restoreScanContext(saved, { resume: false }); };
  }, [scanning, isFocused, settings.scanMode, settings.scanSpeed]);
  useEffect(() => { if (scanning && isFocused) setScanItems(scanItems.current); }, [scanning, isFocused, message, drafts, busy, previous]);
  useEffect(() => {
    const node = scanRefs.current[focused];
    if (node?.measureInWindow && scrollRef.current?.measureInWindow) {
      node.measureInWindow((x, y, width, height) => scrollRef.current?.measureInWindow((sx, sy, sw, sh) => {
        if (y < sy || y + height > sy + sh) scrollRef.current?.scrollTo({ y: Math.max(0, scrollOffset.current + y - sy - 20), animated: false });
      }));
    }
  }, [focused]);
  const act = async task => {
    if (busy) return;
    setBusy(true); setError(null);
    const started = epoch.current;
    try { await task(() => mounted.current && started === epoch.current); await load(); } catch (e) { if (mounted.current) setError(e.message); }
    finally { if (mounted.current) setBusy(false); }
  };
  const changeMessage = value => { setPrevious(message); setMessage(value); };
  const button = (label, action, { disabled = false, primary = false, scan = true, id = label, a11yLabel = label } = {}) => {
    if (!disabled && scan) scanItems.current.push({ id, label: a11yLabel, onSelect: action });
    return <Pressable ref={node => { scanRefs.current[id] = node; }}
    accessibilityRole="button" accessibilityLabel={a11yLabel} accessibilityState={{ disabled }} disabled={disabled}
    onPress={action} style={{ minHeight: touch.min, minWidth: touch.min, padding: 12, borderRadius: 14,
      borderWidth: 3, borderColor: focused === id ? c.focus : 'transparent',
      backgroundColor: primary ? c.signal : c.sunk, opacity: disabled ? 0.55 : 1, justifyContent: 'center', marginVertical: 4 }}>
    <Text style={[type.label, { color: primary ? c.onSignal : c.ink }]}>{label}</Text>
  </Pressable>;
  };
  // Input is an explicit scan target; the device switch keyboard handles typing.
  scanItems.current.push({ id: 'draft-input', label: 'Current conversation draft', onSelect: () => scanRefs.current['draft-input']?.focus() });
  return <ScrollView ref={scrollRef} onScroll={e => { scrollOffset.current = e.nativeEvent.contentOffset.y; }} scrollEventThrottle={32} keyboardShouldPersistTaps="handled" style={{ backgroundColor: c.paper }} contentContainerStyle={{ padding: 16, paddingBottom: 48 + insets.bottom, gap: 16 }}>
    <Text accessibilityRole="header" style={[type.heading, { color: c.ink }]}>Conversation workspace</Text>
    <Text style={[type.body, { color: c.inkSoft }]}>Keep a message for later while you answer something else. Up to 10 drafts stay on this device. Saving does not train predictions or add to history.</Text>
    <Text style={[type.body, { color: c.inkSoft }]}>Workspace scanning reaches the message field and buttons. Use device switch access for the keyboard.</Text>
    {button(scanning ? 'Stop workspace scanning' : 'Start workspace scanning', () => setScanning(!scanning), { disabled: !isFocused })}
    {scanning && isFocused && <View>{button('Next scan item', advanceScan, { scan: false })}{button('Choose scan item', selectCurrent, { scan: false })}</View>}
    <View style={{ backgroundColor: c.card, padding: 16, borderRadius: 18 }}>
      <TextInput ref={node => { scanRefs.current['draft-input'] = node; }} accessibilityLabel="Current conversation draft" multiline value={message} onChangeText={setMessage}
        maxLength={MAX_MESSAGE_LENGTH} placeholder="Write a message" placeholderTextColor={c.inkSoft}
        style={[type.body, { color: c.ink, minHeight: 120, padding: 12, borderWidth: focused === 'draft-input' ? 3 : 1, borderColor: focused === 'draft-input' ? c.focus : c.lineStrong, borderRadius: 12, textAlignVertical: 'top' }]} />
      <VisualMessage text={message} />
      {button('Speak draft', () => { speak(message, buildSpeechOptions(settings)); }, { disabled: !message.trim(), primary: true })}
      {button('Stop speaking', stop)}
      {message.length > MAX_MESSAGE_LENGTH && <Text style={[type.body, { color: c.ink }]}>This message is longer than the 4,000-character workspace limit. Your original board message is unchanged.</Text>}
      {button('Use on board', () => {
        queueWorkspaceReturn(message);
        requestLeave(StackActions.popTo('App', { screen: settings.boardLayout === 'studio' ? 'Talk' : 'AAC Board' }));
      }, { disabled: !message.trim() || message.length > MAX_MESSAGE_LENGTH || busy })}
      {button('Park message and start another', () => act(async isCurrent => { await parkConversationDraft(message); if (isCurrent()) changeMessage(''); }), { disabled: !message.trim() || busy })}
      {previous !== null && button('Undo last draft change', () => { const old = previous; setPrevious(message); setMessage(old); })}
      {wordFormChoices(message).length > 0 && <View>
        <Text style={[type.body, { color: c.inkSoft }]}>Optional English forms for the last word. Choose only if it expresses what you mean.</Text>
        {wordFormChoices(message).map(choice => <View key={choice.word}>{button(`Use ${choice.word}`, () => changeMessage(choice.text))}</View>)}
      </View>}
    </View>
    {error && <Text accessibilityRole="alert" style={[type.body, { color: c.ink }]}>{error}</Text>}
    <Text accessibilityRole="header" style={[type.heading, { color: c.ink }]}>Parked messages · {drafts.length}/10</Text>
    {!drafts.length && <Text style={[type.body, { color: c.inkSoft }]}>No parked messages yet.</Text>}
    {drafts.map(draft => <View key={draft.id} style={{ backgroundColor: c.card, padding: 16, borderRadius: 18 }}>
      <VisualMessage text={draft.text} compact />
      <Text style={[type.body, { color: c.ink }]}>{draft.text}</Text>
      {button('Resume message', () => act(async isCurrent => {
        if (message.trim() && message !== draft.text) await parkConversationDraft(message);
        if (isCurrent()) changeMessage(draft.text);
      }), { disabled: busy, id: `resume-${draft.id}`, a11yLabel: `Resume: ${draft.text}` })}
      {button('Delete saved draft', () => Alert.alert('Delete saved draft?', 'The current message will not change.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => act(() => deleteConversationDraft(draft.id)) },
      ]), { disabled: busy, id: `delete-${draft.id}`, a11yLabel: `Delete saved draft: ${draft.text}` })}
    </View>)}
  </ScrollView>;
}
